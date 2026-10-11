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

/** Phiên bản script SQL đi kèm app (đọc từ chính script: 'version', N trong store_status). Kho của quán chạy bản thấp hơn → nhắc chủ quán chạy lại script. */
const STORE_SQL_VERSION = (() => { const m = /'version',\s*(\d+)/.exec(typeof STORE_SQL === 'string' ? STORE_SQL : ''); return m ? Number(m[1]) : 1; })();

const Sync = (() => {
  const REVOKED_RE = /bị thu hồi|chưa được liên kết/;
  const PUSH_BATCH = 200;
  const LOOKBACK = PUSH_BATCH * 2;   // kéo lùi ĐẦY ĐỦ (≥ 2 lô đẩy) để không sót bản ghi commit muộn / commit đảo thứ tự — chỉ dùng ở nhịp định kỳ 30 giây, mở lại app, bấm Đồng bộ ngay, có mạng lại, thử lại sau lỗi
  const QUICK_LOOKBACK = 50;         // lượt "nền" do Realtime báo / vừa lưu cục bộ: chỉ lùi nhỏ (kéo lại 400 dòng mỗi lần rất tốn băng thông); nhịp định kỳ vẫn lùi đủ nên không sót bản ghi
  const S = { status: 'off', lastSyncAt: 0, lastError: '', pending: 0, conflicts: [], online: true,
              running: false, revoked: false };
  let timer = null, periodic = null, channel = null, again = false, fails = 0, lastTouch = 0, lastAccessCheck = 0;
  let held = false;       // đang "giữ" đồng bộ (vd. máy nhân viên đang liên kết lại): mọi kick/lượt đều bị bỏ qua — xem hold()
  let deepNext = false;   // đang có yêu cầu đồng bộ "sâu" (kéo lùi đủ LOOKBACK) chờ chạy — không để một kick nền thay thế làm mất nó
  let gen = 0;   // số thế hệ của lượt đồng bộ: lượt cũ đã quá hạn / bị stop() huỷ (các vòng lặp kiểm tra gen) để không chạy chồng lượt mới
  /** Ngắt lượt đang chạy nếu: lượt đã bị thay thế/huỷ (gen đổi — kể cả do stop()), hoặc máy đã ngắt liên kết (Cloud.store/role mất).
      Gọi NGAY TRƯỚC mỗi lần ghi D / SQLite / con trỏ, để dữ liệu quán cũ không "sống lại" sau khi ngắt liên kết giữa lúc đang kéo. */
  const stale = my => { if ((my !== undefined && my !== gen) || !enabled()) throw Object.assign(new Error('cancelled'), { cancelled: true }); };
  let runStart = 0, timeoutMs = 60000;   // một lượt đồng bộ quá 60 giây (mạng yếu/máy chủ treo) bị coi là hỏng và thử lại — trước đây có thể treo mãi ở "Đang đồng bộ…"
  const withTimeout = (p, ms) => { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('Hết thời gian chờ máy chủ — mạng yếu, sẽ tự thử lại'), { timeout: true })), ms); })]).finally(() => clearTimeout(t)); };

  const enabled = () => !!(typeof Cloud !== 'undefined' && Cloud.store && Cloud.role);
  const notify = () => { try { if (Sync.onStatus) Sync.onStatus(S); } catch (e) {} };

  /** opts.deep: lượt này phải kéo lùi đủ LOOKBACK (nhịp định kỳ, mở lại app, có mạng lại, thử lại sau lỗi). Không có: chỉ lùi nhỏ. */
  function kick(delay, opts) {
    if (!enabled() || held) return;
    clearTimeout(timer);
    if (opts && opts.deep) deepNext = true;     // dù hẹn giờ này bị một kick nền khác thay thế, yêu cầu "sâu" vẫn được giữ lại
    // kick() luôn là đồng bộ "nền" (do Realtime báo có thay đổi, hoặc nhịp định kỳ) — cho phép bớt
    // bước checkAccess() nếu vừa kiểm tra gần đây. syncNow() (gọi tay/ngay sau một thao tác quan
    // trọng như thu hồi thiết bị) luôn kiểm tra đủ, không bớt bước nào.
    timer = setTimeout(() => cycle({ quick: true }), delay === undefined ? 1500 : delay);
  }

  async function cycle(opts) {
    if (!enabled() || S.revoked || held) return;
    if (!S.online) { S.status = 'offline'; notify(); return; }
    const wantDeep = !(opts && opts.quick);     // syncNow()/gọi tay luôn kéo lùi đủ; lượt nền (kick) chỉ lùi nhỏ, trừ khi có yêu cầu "sâu" đang chờ
    if (S.running) {
      if (Date.now() - runStart > timeoutMs * 1.5) { S.running = false; gen++; }   // lượt cũ đã treo quá lâu: huỷ nó, chạy lượt mới
      else { again = true; if (wantDeep) deepNext = true; return; }
    }
    const deep = wantDeep || deepNext; deepNext = false;
    S.running = true; runStart = Date.now(); S.status = 'syncing'; S.progress = 0; notify();
    const my = ++gen;
    let ownsRun = true;     // còn là lượt hiện hành không — lượt đã bị thay thế/huỷ thì KHÔNG được đụng tới trạng thái chung (S.running, lỗi, gen)
    try {
     await withTimeout((async () => {
      // checkAccess() tốn một vòng round-trip mạng riêng (dò xem máy còn quyền hay đã bị thu hồi).
      // Với đồng bộ NỀN (quick: Realtime/định kỳ) — quyền hiếm khi đổi nên bớt hỏi lại nếu vừa kiểm
      // tra trong vòng 1 phút, giúp đỡ hẳn một vòng mạng cho đa số lần đồng bộ nền (nguyên nhân chính
      // gây độ trễ vài giây khi 2 máy đồng bộ qua lại). Đồng bộ KHÔNG "quick" (gọi tay qua syncNow(),
      // vd. ngay sau khi chủ quán thu hồi một thiết bị) luôn kiểm tra đủ, không bớt bước nào — để phát
      // hiện thu hồi/mất quyền nhanh như trước, không đánh đổi bảo mật lấy tốc độ.
      if (!opts?.quick || Date.now() - lastAccessCheck > 60000) { lastAccessCheck = Date.now(); await checkAccess(); }
      // Máy vừa khôi phục/liên kết (đã xoá sạch dữ liệu cục bộ): kéo dữ liệu THẬT về và để nó thắng, TRƯỚC KHI đẩy bất cứ gì —
      // nếu lần kéo đầu bị lỗi mạng, các bản ghi mặc định mới tạo (tên quán, cài đặt...) không được đè lên dữ liệu thật trên kho.
      if (Persist.getMeta('initialPullPending', 0)) { await pullAll(my, { force: true }); stale(my); await Persist.setMeta('initialPullPending', 0); }
      stale(my);
      await pushAll(my);
      await pullAll(my, { deep });
     })(), timeoutMs);
      stale(my);       // lượt đã bị thay thế/huỷ trong lúc chờ → im lặng bỏ qua, không báo "đã đồng bộ"
      S.status = 'ok'; S.lastSyncAt = Date.now(); S.lastError = ''; fails = 0; S.progress = 0;
    } catch (e) {
      if (my !== gen) ownsRun = false;   // đã bị thay thế (lượt mới, hoặc stop()/ngắt liên kết): im lặng bỏ qua — KHÔNG gen++, KHÔNG đặt lỗi, KHÔNG đụng S.running của lượt mới
      else {
        if (e && e.timeout) gen++;       // lượt này quá hạn: các vòng lặp của nó dừng ở lần kiểm tra kế tiếp (chỉ khi nó VẪN là lượt hiện hành — nếu không sẽ huỷ oan lượt mới)
        await handleError(e);
      }
    } finally {
      if (ownsRun) {
        S.running = false;
        S.pending = Records.dirtyCount();
        notify();
        if (again) { again = false; kick(500); }     // lượt nối tiếp: yêu cầu "sâu" (nếu có) đã được giữ bởi deepNext, kick nền thường chỉ lùi nhỏ
      }
    }
  }

  /** Xác nhận máy này còn quyền; phát hiện máy bị thu hồi */
  async function checkAccess() {
    // Phiên đăng nhập vào kho: 'ok' | 'none' (CHẮC CHẮN không còn phiên) | 'unknown' (không xác định được — vd. token hết hạn mà làm mới thất bại vì mạng chập chờn:
    // supabase-js trả session=null kèm error). Chỉ 'none' mới là mất phiên thật; 'unknown' là lỗi mạng tạm → trạng thái offline, thử lại bình thường, KHÔNG báo "cần đăng nhập lại".
    const ss = await Cloud.sessionState();
    if (ss === 'unknown' || (ss === 'none' && !S.online)) {
      const e = new Error('Chưa kiểm tra được phiên đăng nhập vào kho (mạng chập chờn) — sẽ tự thử lại'); e.transient = true; throw e;
    }
    if (ss === 'none') {      // mất phiên đăng nhập vào kho (cả chủ quán lẫn máy nhân viên): báo rõ, KHÔNG coi là bị thu hồi, KHÔNG xoá dữ liệu
      const e = new Error('Phiên đăng nhập vào kho đã hết'); e.authLost = true; throw e;
    }
    const { data, error } = await Cloud.store.rpc('store_status');
    if (error) throw error;
    S.sqlVersion = Number(data && data.version) || 1;     // để màn Đồng bộ nhắc chủ quán chạy lại script SQL khi kho còn chạy bản cũ
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

  async function pushAll(my) {
    for (let guard = 0; guard < 500; guard++) {
      stale(my);
      const batch = Records.dirtyBatch(PUSH_BATCH, 800000);
      if (!batch.length) return;
      const { data, error } = await Cloud.store.rpc('push_records', { p_recs: batch });
      if (error) throw error;
      stale(my);
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
          if (handleDuplicate(b, r)) refetch.push(b);      // lấy bản máy chủ qua đường chung bên dưới (có await, có kiểm tra gen) — không bắn ngầm
        } else {
          // stale: máy chủ có bản mới hơn · rejected: máy chủ từ chối (không đủ quyền...) → lấy bản của máy chủ
          if (r.status === 'rejected') pushConflict({ collection: r.collection, id: r.id, reason: r.reason });
          refetch.push(b);
        }
      }
      // Bản ghi máy chủ không trả lời: để lần sau thử lại (tránh vòng lặp vô hạn)
      if (sent.size === batch.length) throw new Error('Máy chủ không phản hồi kết quả đồng bộ');
      stale(my);
      await Persist.writeRows(rows, removed);
      if (refetch.length) await refetchRecords(refetch, my);
    }
  }

  function pushConflict(c) {
    S.conflicts.unshift({ ...c, at: Date.now() });
    S.conflicts.length = Math.min(S.conflicts.length, 30);
  }

  /** Một đơn đã được máy khác thu tiền trước → đánh dấu bản thanh toán của máy này là trùng, không cộng doanh thu */
  /** Trả về true nếu cần lấy lại bản của máy chủ (do pushAll xử lý, có await + kiểm tra gen) */
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
      return true;
    }
    return false;
  }

  /** Lấy bản của máy chủ cho các bản ghi và ép áp dụng; máy chủ không có → bỏ bản cục bộ */
  async function refetchRecords(list, my) {
    const byCol = {};
    list.forEach(b => (byCol[b.collection] = byCol[b.collection] || []).push(b.id));
    const rows = [];
    for (const [col, ids] of Object.entries(byCol)) {
      const { data, error } = await Cloud.store.from('records')
        .select('collection,id,data,updated_at,deleted,seq').eq('collection', col).in('id', ids);
      if (error) throw error;
      stale(my);
      const got = new Set((data || []).map(r => r.id));
      rows.push(...(data || []));
      const lost = ids.filter(id => !got.has(id));
      const removed = lost.map(id => Records.forget(D, col, id)).filter(Boolean);
      if (removed.length) await Persist.writeRows([], removed);
    }
    if (rows.length) await applyRemote(rows, { force: true }, my);
    else if (list.length) { stale(my); Records.finalize(D, []); notifyChange(); }
  }

  async function pullAll(my, opts) {
    const force = !!(opts && opts.force);
    const lookback = (force || (opts && opts.deep)) ? LOOKBACK : QUICK_LOOKBACK;
    let cursor = Persist.getMeta('cursor', 0);
    let from = Math.max(0, cursor - lookback);
    let max = cursor, got = 0;
    for (let guard = 0; guard < 2000; guard++) {
      stale(my);
      const { data, error } = await Cloud.store.from('records')
        .select('collection,id,data,updated_at,deleted,seq').gt('seq', from)
        .order('seq', { ascending: true }).limit(500);
      if (error) throw error;
      if (!data || !data.length) break;
      await applyRemote(data, force ? { force: true } : {}, my);
      got += data.length; S.progress = got;          // hiện tiến độ tải dữ liệu để biết không bị treo (kho cũ có thể rất nhiều bản ghi)
      notify();
      from = data[data.length - 1].seq;
      max = Math.max(max, from);
      if (data.length < 500) break;
    }
    stale(my);     // đã ngắt liên kết giữa chừng thì KHÔNG ghi con trỏ cũ xuống máy
    if (max !== cursor) await Persist.setMeta('cursor', max);
  }

  async function applyRemote(rows, opts, my) {
    stale(my);     // kiểm tra NGAY TRƯỚC khi ghi vào D / SQLite
    const res = Records.applyBatch(D, rows, opts);
    Records.finalize(D, res.touched);
    await Persist.writeRows(res.rows, res.removed);
    if (res.touched.size) notifyChange(res.touched);
  }

  function notifyChange(touched) { try { if (Sync.onChange) Sync.onChange(touched); } catch (e) {} }

  async function handleError(e) {
    if (e && e.cancelled) return;      // lượt cũ đã bị lượt mới thay thế: bỏ qua, không báo lỗi
    const msg = (e && (e.message || e.msg)) || String(e);
    if (e && e.transient) {            // chưa xác định được phiên đăng nhập vì mạng chập chờn: KHÔNG phải mất phiên
      S.status = 'offline'; S.lastError = ''; fails++;
      kick(Math.min(60000, 4000 * Math.pow(2, Math.min(fails, 4))), { deep: true }); return;
    }
    // Mất phiên đăng nhập vào kho (lỗi 42501 "permission denied for function" do gọi bằng quyền ẩn danh): KHÔNG phải bị thu hồi — giữ nguyên dữ liệu chờ gửi
    if (e && (e.authLost || (e.code === '42501' && /permission denied for function/i.test(msg)))) {
      S.status = 'auth';
      S.lastError = Cloud.role === 'owner'
        ? 'Phiên đăng nhập vào kho đã hết — nhập lại mật khẩu lưu trữ để đồng bộ tiếp'
        : 'Máy mất phiên đăng nhập vào kho — dữ liệu chưa gửi vẫn được giữ. Mở Quản lý → Đồng bộ rồi liên kết lại bằng mã QR mới của chủ quán: các thay đổi chưa gửi sẽ không bị mất';
      kick(60000, { deep: true }); return;
    }
    if (e && (e.revoked || (e.code === '42501' && Cloud.role === 'staff') || REVOKED_RE.test(msg))) {
      S.revoked = true; S.status = 'revoked'; stop();
      // Trả về lời hứa để cycle() đợi xoá xong dữ liệu trước khi báo hoàn tất
      return Promise.resolve().then(() => Cloud.onRevoked()).catch(() => {});
    }
    if (e && e.fatal) { S.status = 'error'; S.lastError = msg; return; }
    if (e && e.timeout) { S.status = 'error'; S.lastError = msg; fails++; kick(Math.min(60000, 4000 * Math.pow(2, Math.min(fails, 4))), { deep: true }); return; }
    if (/Failed to fetch|NetworkError|Load failed|network|fetch/i.test(msg) && !(e && e.code)) {
      S.status = 'offline'; S.lastError = ''; fails++;
    } else if (e && (e.code === 'PGRST202' || /Could not find the function/i.test(msg))) {
      S.status = 'error'; S.lastError = 'Dự án Supabase chưa chạy script SQL dựng bảng';
    } else if (/JWT|session|Auth session missing|not authenticated/i.test(msg)) {
      S.status = 'auth'; S.lastError = 'Phiên đăng nhập Supabase hết hạn — đăng nhập lại ở mục Đồng bộ';
    } else {
      S.status = 'error'; S.lastError = msg; fails++;
    }
    kick(Math.min(60000, 4000 * Math.pow(2, Math.min(fails, 4))), { deep: true });
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
    periodic = setInterval(() => kick(0, { deep: true }), 30000);   // nhịp định kỳ luôn lùi đủ: bắt các bản ghi commit đảo thứ tự mà lượt nền (lùi nhỏ) có thể bỏ lỡ
    kick(0, { deep: true });
  }
  /** Giữ/thả đồng bộ. Đang giữ: huỷ lượt đang chạy, bỏ mọi kick và lượt mới. Dùng khi máy nhân viên liên kết lại: trong lúc đó phiên ẩn danh MỚI đã nằm trong
      kho lưu trữ chung nhưng chưa là thiết bị — nếu một lượt đồng bộ chen vào, store_status báo is_device=false và máy bị coi là "bị thu hồi" rồi xoá sạch. */
  function hold(on) {
    held = !!on;
    if (held) { gen++; S.running = false; again = false; deepNext = false; clearTimeout(timer); timer = null; }
  }
  function stop() {
    gen++;                      // huỷ mọi lượt đang chạy: chúng dừng ở lần kiểm tra stale() kế tiếp, không ghi thêm gì xuống máy
    S.running = false; again = false; deepNext = false;
    S.sqlVersion = 0;           // sẽ đọc lại từ kho ở lần kiểm tra quyền kế tiếp (có thể là kho khác sau khi ngắt/liên kết lại)
    if (S.status === 'syncing') S.status = 'off';
    clearTimeout(timer); timer = null;
    clearInterval(periodic); periodic = null;
    try { if (channel && Cloud.store) Cloud.store.removeChannel(channel); } catch (e) {}
    channel = null;
  }

  function setOnline(v) {
    const was = S.online; S.online = !!v;
    if (!was && S.online) kick(0, { deep: true });
    if (!S.online) { S.status = 'offline'; notify(); }
  }

  function syncNow() { again = false; return cycle(); }

  /** Chỉ kéo về, không đẩy lên — dùng ngay sau khi D vừa bị đặt rỗng (restoreOwner/joinAsStaff),
      để đảm bảo có dữ liệu THẬT trước khi bất cứ thứ gì có cơ hội đẩy bản rỗng đó lên đè mất dữ liệu gốc. */
  async function pullOnly() { await checkAccess(); await pullAll(undefined, { force: true }); stale(); await Persist.setMeta('initialPullPending', 0); }

  return { state: S, start, stop, hold, kick, syncNow, setOnline, cycle, pullOnly, setTimeoutMs: ms => { timeoutMs = ms; },
           onChange: null, onStatus: null };
})();
