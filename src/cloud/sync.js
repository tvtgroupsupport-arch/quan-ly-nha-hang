/* ============================================================
   ĐỘNG CƠ ĐỒNG BỘ
   Local-first: giao diện luôn đọc/ghi bộ nhớ cục bộ, không bao giờ chờ mạng.
   Khi có mạng, mỗi chu kỳ làm 3 việc:
     1. kiểm tra tư cách máy (còn là chủ quán / máy nhân viên chưa bị thu hồi?)
     2. ĐẨY các bản ghi chưa gửi lên Supabase qua push_records()
     3. KÉO các bản ghi mới của máy khác (theo con trỏ `seq` do máy chủ cấp)
   Xung đột: bản có mốc updated_at mới hơn thắng; riêng thanh toán thì máy chủ
   chặn việc một đơn bị thu tiền hai lần (xem chỉ mục one_paid_payment_per_order).
   ============================================================ */

const Sync = (() => {
  const LOOKBACK = 100;       // kéo lùi một đoạn để không sót bản ghi commit muộn
  const S = { status: 'off', lastSyncAt: 0, lastError: '', pending: 0, conflicts: [], online: true,
              running: false, revoked: false };
  let timer = null, periodic = null, channel = null, again = false, fails = 0, lastTouch = 0, lastAccessCheck = 0;
  let runStart = 0, timeoutMs = 60000;   // một lượt đồng bộ quá 60 giây (mạng yếu/máy chủ treo) bị coi là hỏng và thử lại — trước đây có thể treo mãi ở "Đang đồng bộ…"
  const withTimeout = (p, ms) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('Hết thời gian chờ máy chủ — mạng yếu, sẽ tự thử lại'), { timeout: true })), ms); })]).finally(() => clearTimeout(t)); };

  const enabled = () => !!(typeof Cloud !== 'undefined' && Cloud.store && Cloud.role);
  const notify = () => { try { if (Sync.onStatus) Sync.onStatus(S); } catch (e) {} };

  function kick(delay) {
    if (!enabled()) return;
    clearTimeout(timer);
    // kick() luôn là đồng bộ "nền" (do Realtime báo có thay đổi, hoặc nhịp định kỳ) — cho phép bớt
    // bước checkAccess() nếu vừa kiểm tra gần đây. syncNow() (gọi tay/ngay sau một thao tác quan
    // trọng như thu hồi thiết bị) luôn kiểm tra đủ, không bớt bước nào.
    timer = setTimeout(() => cycle({ quick: true }), delay === undefined ? 1500 : delay);
  }

  async function cycle(opts) {
    if (!enabled() || S.revoked) return;
    if (!S.online) { S.status = 'offline'; notify(); return; }
    if (S.running) {
      if (Date.now() - runStart > timeoutMs * 1.5) S.running = false;   // lượt cũ đã treo quá lâu: bỏ qua, chạy lượt mới
      else { again = true; return; }
    }
    S.running = true; runStart = Date.now(); S.status = 'syncing'; S.progress = 0; notify();
    try {
     await withTimeout((async () => {
      // checkAccess() tốn một vòng round-trip mạng riêng (dò xem máy còn quyền hay đã bị thu hồi).
      // Với đồng bộ NỀN (quick: Realtime/định kỳ) — quyền hiếm khi đổi nên bớt hỏi lại nếu vừa kiểm
      // tra trong vòng 1 phút, giúp đỡ hẳn một vòng mạng cho đa số lần đồng bộ nền (nguyên nhân chính
      // gây độ trễ vài giây khi 2 máy đồng bộ qua lại). Đồng bộ KHÔNG "quick" (gọi tay qua syncNow(),
      // vd. ngay sau khi chủ quán thu hồi một thiết bị) luôn kiểm tra đủ, không bớt bước nào — để phát
      // hiện thu hồi/mất quyền nhanh như trước, không đánh đổi bảo mật lấy tốc độ.
      if (!opts?.quick || Date.now() - lastAccessCheck > 60000) { lastAccessCheck = Date.now(); await checkAccess(); }
      await pushAll();
      await pullAll();
     })(), timeoutMs);
      S.status = 'ok'; S.lastSyncAt = Date.now(); S.lastError = ''; fails = 0; S.progress = 0;
    } catch (e) {
      await handleError(e);
    } finally {
      S.running = false;
      S.pending = Records.dirtyCount();
      notify();
      if (again) { again = false; kick(500); }
    }
  }

  /** Xác nhận máy này còn quyền; phát hiện máy bị thu hồi */
  async function checkAccess() {
    if (Cloud.role === 'owner' && !(await Cloud.hasStoreSession())) {      // mất phiên đăng nhập vào kho: báo rõ thay vì để mọi hàm bị "permission denied"
      const e = new Error('Phiên đăng nhập vào kho đã hết — nhập lại mật khẩu lưu trữ để đồng bộ tiếp'); e.authLost = true; throw e;
    }
    const { data, error } = await Cloud.store.rpc('store_status');
    if (error) throw error;
    if (Cloud.role === 'owner' && !data.is_owner) {
      const e = new Error('Tài khoản này không còn là chủ quán của dự án Supabase'); e.fatal = true; throw e;
    }
    if (Cloud.role === 'owner') maybeCleanup();
    if (Cloud.role === 'staff') {
      if (!data.is_device) { const e = new Error('revoked'); e.revoked = true; throw e; }
      if (Date.now() - lastTouch > 5 * 60000) {
        lastTouch = Date.now();
        Cloud.store.rpc('touch_device').then(() => {}, () => {});
      }
    }
  }

  /** Tự dọn dữ liệu cũ (xem hàm SQL cleanup_old_data) — tối đa 1 lần/ngày, không chặn đồng bộ
      (chạy ngầm, không await). Chỉ chủ quán gọi được (hàm SQL cũng tự kiểm tra lại, phòng khi
      logic phía client có sai sót). Mốc lần dọn gần nhất lưu cục bộ, sống sót qua khởi động lại
      app — không dọn lặp lại trong cùng một ngày dù app mở/tắt nhiều lần. */
  async function maybeCleanup() {
    try {
      const last = (typeof Persist !== 'undefined' && Persist.getMeta('lastCleanupAt', 0)) || 0;
      if (Date.now() - last < 24 * 3600000) return;
      if (typeof Persist !== 'undefined') await Persist.setMeta('lastCleanupAt', Date.now());
      Cloud.store.rpc('cleanup_old_data', {}).then(() => {}, () => {});
    } catch (e) { /* không chặn đồng bộ vì việc dọn dẹp lỗi — thử lại vào lần sau */ }
  }

  async function pushAll() {
    for (let guard = 0; guard < 500; guard++) {
      const batch = Records.dirtyBatch(200, 800000);
      if (!batch.length) return;
      const { data, error } = await Cloud.store.rpc('push_records', { p_recs: batch });
      if (error) throw error;
      const sent = new Map(batch.map(b => [b.collection + '|' + b.id, b]));
      const rows = [], removed = [], refetch = [];
      for (const r of (data || [])) {
        const b = sent.get(r.collection + '|' + r.id);
        if (!b) continue;
        sent.delete(r.collection + '|' + r.id);
        if (r.status === 'applied') {
          const m = Records.markClean(r.collection, r.id, b.updated_at);
          if (m && m.row) rows.push(m.row);
          if (m && m.removed) removed.push(m.removed);
        } else if (r.status === 'duplicate') {
          handleDuplicate(b, r);
        } else {
          // stale: máy chủ có bản mới hơn · rejected: máy chủ từ chối (không đủ quyền...) → lấy bản của máy chủ
          if (r.status === 'rejected') pushConflict({ collection: r.collection, id: r.id, reason: r.reason });
          refetch.push(b);
        }
      }
      // Bản ghi máy chủ không trả lời: để lần sau thử lại (tránh vòng lặp vô hạn)
      if (sent.size === batch.length) throw new Error('Máy chủ không phản hồi kết quả đồng bộ');
      await Persist.writeRows(rows, removed);
      if (refetch.length) await refetchRecords(refetch);
    }
  }

  function pushConflict(c) {
    S.conflicts.unshift({ ...c, at: Date.now() });
    S.conflicts.length = Math.min(S.conflicts.length, 30);
  }

  /** Một đơn đã được máy khác thu tiền trước → đánh dấu bản thanh toán của máy này là trùng, không cộng doanh thu */
  function handleDuplicate(b, r) {
    if (b.collection === 'payments') {
      const p = (D.payments || []).find(x => x.id === b.id);
      if (p) {
        p.state = 'duplicate';
        if (typeof addLog === 'function') addLog('Hệ thống', 'Trùng thanh toán',
          'Đơn đã được thu ở máy khác — kiểm tra lại tiền mặt đã nhận', 'warn');
      }
      pushConflict({ collection: 'payments', id: b.id, reason: r.reason || 'Đơn đã được thanh toán ở máy khác' });
      Persist.flush();     // ghi nhận bản mới (state=duplicate) ngay để lô sau đẩy được
    } else {
      pushConflict({ collection: b.collection, id: b.id, reason: r.reason });
      refetchRecords([b]);
    }
  }

  /** Lấy bản của máy chủ cho các bản ghi và ép áp dụng; máy chủ không có → bỏ bản cục bộ */
  async function refetchRecords(list) {
    const byCol = {};
    list.forEach(b => (byCol[b.collection] = byCol[b.collection] || []).push(b.id));
    const rows = [];
    for (const [col, ids] of Object.entries(byCol)) {
      const { data, error } = await Cloud.store.from('records')
        .select('collection,id,data,updated_at,deleted,seq').eq('collection', col).in('id', ids);
      if (error) throw error;
      const got = new Set((data || []).map(r => r.id));
      rows.push(...(data || []));
      const lost = ids.filter(id => !got.has(id));
      const removed = lost.map(id => Records.forget(D, col, id)).filter(Boolean);
      if (removed.length) await Persist.writeRows([], removed);
    }
    if (rows.length) await applyRemote(rows, { force: true });
    else if (list.length) { Records.finalize(D, []); notifyChange(); }
  }

  async function pullAll() {
    let cursor = Persist.getMeta('cursor', 0);
    let from = Math.max(0, cursor - LOOKBACK);
    let max = cursor, got = 0;
    for (let guard = 0; guard < 2000; guard++) {
      const { data, error } = await Cloud.store.from('records')
        .select('collection,id,data,updated_at,deleted,seq').gt('seq', from)
        .order('seq', { ascending: true }).limit(500);
      if (error) throw error;
      if (!data || !data.length) break;
      await applyRemote(data, {});
      got += data.length; S.progress = got;          // hiện tiến độ tải dữ liệu để biết không bị treo (kho cũ có thể rất nhiều bản ghi)
      notify();
      from = data[data.length - 1].seq;
      max = Math.max(max, from);
      if (data.length < 500) break;
    }
    if (max !== cursor) await Persist.setMeta('cursor', max);
  }

  async function applyRemote(rows, opts) {
    const res = Records.applyBatch(D, rows, opts);
    Records.finalize(D, res.touched);
    await Persist.writeRows(res.rows, res.removed);
    if (res.touched.size) notifyChange(res.touched);
  }

  function notifyChange(touched) { try { if (Sync.onChange) Sync.onChange(touched); } catch (e) {} }

  async function handleError(e) {
    const msg = (e && (e.message || e.msg)) || String(e);
    if (e && (e.revoked || e.code === '42501' && Cloud.role === 'staff' || /bị thu hồi|chưa được liên kết/.test(msg))) {
      S.revoked = true; S.status = 'revoked'; stop();
      // Trả về lời hứa để cycle() đợi xoá xong dữ liệu trước khi báo hoàn tất
      return Promise.resolve().then(() => Cloud.onRevoked()).catch(() => {});
    }
    if (e && e.fatal) { S.status = 'error'; S.lastError = msg; return; }
    if (Cloud.role === 'owner' && e && (e.authLost || (e.code === '42501' && /permission denied for function/i.test(msg)))) {
      S.status = 'auth'; S.lastError = 'Phiên đăng nhập vào kho đã hết — nhập lại mật khẩu lưu trữ để đồng bộ tiếp';
      kick(60000); return;                                                  // dữ liệu chờ gửi vẫn giữ nguyên trên máy
    }
    if (e && e.timeout) { S.status = 'error'; S.lastError = msg; fails++; kick(Math.min(60000, 4000 * Math.pow(2, Math.min(fails, 4)))); return; }
    if (/Failed to fetch|NetworkError|Load failed|network|fetch/i.test(msg) && !(e && e.code)) {
      S.status = 'offline'; S.lastError = ''; fails++;
    } else if (e && (e.code === 'PGRST202' || /Could not find the function/i.test(msg))) {
      S.status = 'error'; S.lastError = 'Dự án Supabase chưa chạy script SQL dựng bảng';
    } else if (/JWT|session|Auth session missing|not authenticated/i.test(msg)) {
      S.status = 'auth'; S.lastError = 'Phiên đăng nhập Supabase hết hạn — đăng nhập lại ở mục Đồng bộ';
    } else {
      S.status = 'error'; S.lastError = msg; fails++;
    }
    kick(Math.min(60000, 4000 * Math.pow(2, Math.min(fails, 4))));
  }

  /** Bắt đầu đồng bộ sau khi đã có Cloud.store + Cloud.role */
  function start() {
    stop(); S.revoked = false;
    if (!enabled()) { S.status = 'off'; notify(); return; }
    try {
      channel = Cloud.store.channel('qlnh-records')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, () => kick(200))
        .subscribe();
    } catch (e) { channel = null; }
    periodic = setInterval(() => kick(0), 30000);
    kick(0);
  }
  function stop() {
    clearTimeout(timer); timer = null;
    clearInterval(periodic); periodic = null;
    try { if (channel && Cloud.store) Cloud.store.removeChannel(channel); } catch (e) {}
    channel = null;
  }

  function setOnline(v) {
    const was = S.online; S.online = !!v;
    if (!was && S.online) kick(0);
    if (!S.online) { S.status = 'offline'; notify(); }
  }

  function syncNow() { again = false; return cycle(); }

  /** Chỉ kéo về, không đẩy lên — dùng ngay sau khi D vừa bị đặt rỗng (restoreOwner/joinAsStaff),
      để đảm bảo có dữ liệu THẬT trước khi bất cứ thứ gì có cơ hội đẩy bản rỗng đó lên đè mất dữ liệu gốc. */
  async function pullOnly() { await checkAccess(); await pullAll(); }

  return { state: S, start, stop, kick, syncNow, setOnline, cycle, pullOnly, setTimeoutMs: ms => { timeoutMs = ms; },
           onChange: null, onStatus: null };
})();
