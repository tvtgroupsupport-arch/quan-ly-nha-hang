/* ============================================================
   TỰ TẠO SUPABASE CHO QUÁN — chủ quán không phải vào trang Supabase để tự cấu hình.
   Luồng: app xin Edge Function provision-start một đường dẫn uỷ quyền → mở trong trình duyệt → chủ quán đăng nhập /
   bấm "Authorize" MỘT lần → máy chủ tự tạo dự án, chạy script SQL, bật cấu hình (provision-step) → app nhận về địa chỉ
   + khoá anon rồi dùng đúng luồng liên kết sẵn có (Cloud.linkStoreAsOwner).
   App KHÔNG bao giờ cầm token của Supabase — token chỉ nằm trên máy chủ trung tâm và bị xoá khi xong.
   ============================================================ */
const AutoProv = (() => {
  let st = { phase: 'idle', message: '', step: 0, total: 8 };
  let running = false;
  let delays = { wait: 3000, work: 5000 };   // chờ chủ quán đồng ý / chờ máy chủ làm việc (ms) — test đặt về 0
  const MAX_MS = 15 * 60 * 1000;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const set = (patch) => { st = { ...st, ...patch }; if (typeof render === 'function' && route && route.name === 'ownerLink') render(); };

  /** Gọi một Edge Function provision-* bằng chính phiên đăng nhập chủ quán hiện tại. */
  async function call(name) {
    const { data: sess } = await Cloud.central().auth.getSession();
    const token = sess && sess.session && sess.session.access_token;
    if (!token) throw new Error('Phiên đăng nhập tài khoản lưu trữ đã hết — đăng nhập lại rồi thử lại');
    const r = await fetch(`${APP_CONFIG.centralUrl}/functions/v1/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: APP_CONFIG.centralAnonKey },
      body: '{}',
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `Máy chủ báo lỗi (${r.status})`);
    return j;
  }

  /** Bấm "Tạo tự động" / "Tiếp tục". Dùng lại phiên đang dở nếu có — không bao giờ tạo dự án thứ hai. */
  async function start(password) {
    if (running) return;
    running = true;
    try {
      set({ phase: 'starting', message: 'Đang chuẩn bị…', step: 1 });
      const email = await Cloud.centralEmail();
      if (!email) throw new Error('Phiên đăng nhập tài khoản lưu trữ đã hết — đăng nhập lại');
      if (!password) throw new Error('Nhập mật khẩu lưu trữ trước');
      await Cloud.ownerSignIn(email, password);   // kiểm tra đúng mật khẩu NGAY, đừng để sai rồi mới biết sau khi đã tạo xong dự án

      const s = await call('provision-start');
      if (s.authorize_url) {
        set({ phase: 'waiting', message: 'Đã mở trang Supabase. Đăng nhập, bấm "Authorize" rồi quay lại ứng dụng.', step: 1 });
        await NativeBridge.browser.open(s.authorize_url);
      }
      await loop(email, password);
    } catch (e) {
      set({ phase: 'error', message: String((e && e.message) || e || 'Không tạo được — thử lại') });
    } finally {
      running = false;
      if (typeof render === 'function' && route && route.name === 'ownerLink') render();
    }
  }

  async function loop(email, password) {
    const deadline = Date.now() + MAX_MS;
    while (Date.now() < deadline) {
      // Chủ quán rời màn này → dừng hỏi (phiên vẫn còn trên máy chủ, vào lại bấm "Tiếp tục" là đi tiếp).
      if (route && route.name !== 'ownerLink') { set({ phase: 'idle', message: '' }); return; }
      const r = await call('provision-step');
      if (r.state === 'error') throw new Error(r.message || 'Có lỗi xảy ra');
      if (r.state === 'done') {
        set({ phase: 'linking', message: 'Đang liên kết và đồng bộ dữ liệu…', step: r.step || 8, total: r.total || 8 });
        // Kho vừa tạo: tên miền của nó có thể chưa kịp lan ra mạng → lỗi mạng thì thử nối lại vài lần (tối đa ~40 giây)
        // trước khi báo lỗi. Lỗi khác (sai mật khẩu, thiếu quyền…) báo ngay, không thử lại.
        for (let attempt = 0; ; attempt++) {
          try { await Cloud.linkStoreAsOwner({ url: r.url, anonKey: r.anon_key, email, password }); break; }
          catch (err) {
            const net = /Không kết nối được mạng|Failed to fetch|NetworkError|Load failed/i.test(String((err && err.message) || err));
            if (!net || attempt >= 8) throw err;
            set({ phase: 'linking', message: 'Kho dữ liệu vừa tạo đang được công bố trên mạng, đang thử nối lại…' });
            await sleep(delays.work);
          }
        }
        Cloud.ownerPw = null;
        set({ phase: 'idle', message: '' });
        toast('Đã tạo và liên kết kho dữ liệu của quán');
        route = { name: 'login', params: {} }; render();
        return;
      }
      set({ phase: r.state === 'awaiting_auth' ? 'waiting' : 'working', message: r.message || '', step: r.step || st.step, total: r.total || st.total });
      await sleep(r.state === 'awaiting_auth' ? delays.wait : delays.work);
    }
    throw new Error('Quá thời gian chờ. Bấm "Tiếp tục" để kiểm tra lại.');
  }

  function reset() { if (!running) st = { phase: 'idle', message: '', step: 0, total: 8, email: st.email, emailTried: st.emailTried }; }
  const status = () => ({ ...st, running });
  function setDelays(wait, work) { delays = { wait, work }; }

  /** Lấy email chủ quán (một lần) để hiện cho họ biết tài khoản Supabase PHẢI dùng đúng email này. */
  async function loadEmail() {
    if (st.emailTried) return;
    st.emailTried = true;
    let email = '';
    try { email = (await Cloud.centralEmail()) || ''; } catch (e) { /* offline: bỏ qua, chỉ là dòng nhắc */ }
    set({ email });
  }
  /** Mở trang đăng ký Supabase để chủ quán tạo tài khoản bằng đúng email của họ (không tạo thay được). */
  async function openSignup() {
    try { await NativeBridge.browser.open('https://supabase.com/dashboard/sign-up'); }
    catch (e) { set({ phase: 'error', message: String((e && e.message) || e) }); }
  }
  return { start, status, reset, setDelays, loadEmail, openSignup };
})();

/** Khối giao diện "Tạo tự động" — chèn vào màn Liên kết Supabase (vOwnerLink). */
function autoProvCard() {
  const s = AutoProv.status();
  const active = s.running || s.phase === 'waiting' || s.phase === 'working' || s.phase === 'linking' || s.phase === 'starting';
  const pct = Math.round(((s.step || 0) / (s.total || 8)) * 100);
  if (!s.emailTried) AutoProv.loadEmail();
  return `<div class="card" style="border-color:var(--accent);line-height:1.7">
    <div class="t-md" style="margin-bottom:4px">Cách nhanh: tạo tự động</div>
    <div class="t-sm">App tự tạo kho dữ liệu riêng cho quán trên Supabase (miễn phí). Bạn chỉ cần có tài khoản Supabase và bấm đồng ý một lần — không phải tự cấu hình gì.</div>
    <button class="btn pri sm" data-go="supabaseGuide" style="margin-top:10px;width:100%">📖 Xem hướng dẫn từng bước (có hình)</button>
    ${s.email ? `<div class="t-sm" style="margin-top:8px;padding:8px 10px;border-radius:8px;background:var(--amber-soft);color:var(--amber)">
      Tài khoản Supabase phải dùng <b>đúng email này: ${esc(s.email)}</b>.<br>
      Chưa có tài khoản? Đăng ký bằng email trên trước. Nếu trình duyệt đang đăng nhập Supabase bằng email khác, hãy đăng xuất trước (hoặc dùng cửa sổ ẩn danh).<br>
      Nếu trang Supabase báo <b>"No organizations found"</b>: bấm <b>Create an organization</b> (chọn gói <b>Free</b>), rồi quay lại đây bấm <b>Tạo tự động</b> lần nữa.</div>
      ${active ? '' : '<button class="btn sm ghost" data-act="c_autoProvSignup" style="margin-top:8px">Mở trang đăng ký Supabase</button>'}` : ''}
    ${active ? `
      <div style="margin-top:10px"><div style="height:8px;border-radius:4px;background:var(--line,#3332)"><div style="height:8px;border-radius:4px;background:var(--accent);width:${pct}%"></div></div></div>
      <div class="t-sm" style="margin-top:8px">${esc(s.message)}</div>
      ${s.phase === 'working' ? '<div class="t-xs muted">Có thể mất 1–3 phút, vui lòng không đóng app.</div>' : ''}` : `
      <div class="field" style="margin-top:10px"><label class="f">Mật khẩu lưu trữ</label><input class="input" id="ap_pass" type="password" autocomplete="current-password"></div>
      ${s.phase === 'error' ? `<div class="t-sm" style="color:var(--red);margin-bottom:8px">${esc(s.message)}</div>` : ''}
      <button class="btn pri" data-act="c_autoProv">${s.phase === 'error' ? 'Tiếp tục / thử lại' : 'Tạo tự động bằng Supabase'}</button>`}
  </div>`;
}
