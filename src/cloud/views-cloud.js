/* ============================================================
   MÀN HÌNH ĐÁM MÂY
   Thiết lập máy → liên kết Supabase → thiết bị nhân viên → gói cước.
   Hành động của các màn này đặt tên bắt đầu bằng "c_" và được cloudAct() xử lý
   (handleAct trong app.js gọi cloudAct trước).
   ============================================================ */

const FREE_ROUTES = ['setup', 'ownerAuth', 'ownerInit', 'ownerLink', 'ownerRestore', 'staffJoin', 'restoring', 'login', 'supabaseGuide'];
/** Khi gói cước hết hạn (khoá mềm): chủ quán vẫn xem được báo cáo và gia hạn */
const LOCK_OK_OWNER = ['locked', 'subscription', 'cloud', 'admin', 'reports', 'history', 'historyDetail', 'exportHub', 'login'];
const LOCK_OK_STAFF = ['locked', 'login'];

const fmtTime = ts => ts ? new Date(ts).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—';

/* ---------- thanh trạng thái đồng bộ (đầu mọi màn) ---------- */
function syncBannerHtml() {
  if (typeof Cloud === 'undefined' || !Cloud.linked) return '';
  const s = Sync.state;
  let msg = '', bg = '';
  if (s.status === 'offline') { msg = 'Đang offline — thay đổi được lưu trên máy và tự đồng bộ khi có mạng'; bg = 'var(--amber)'; }
  else if (s.status === 'error' || s.status === 'auth') { msg = 'Đồng bộ lỗi: ' + s.lastError; bg = 'var(--red)'; }
  if (!msg) return '';
  return `<div style="background:${bg};color:#fff;padding:7px 14px;font-size:12px;font-weight:600;text-align:center">${esc(msg)}</div>`;
}
function syncBanner() { return `<div id="syncbar">${syncBannerHtml()}</div>`; }
function updateSyncBanner() { const el = document.getElementById('syncbar'); if (el) el.innerHTML = syncBannerHtml(); }

/* ---------- 1. Chọn vai trò của máy ---------- */
function vSetup() {
  const notice = route.params.notice;
  return `<div class="screen"><div class="body" style="justify-content:center;padding:28px 22px;gap:14px">
    <div style="text-align:center;margin-bottom:10px">
      <div style="width:60px;height:60px;border-radius:17px;background:var(--accent);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:28px">🍜</div>
      <div class="t-lg" style="margin-top:12px">Quản Lý Nhà Hàng</div>
      <div class="t-xs" style="margin-top:4px">Thiết lập thiết bị này</div>
    </div>
    ${notice ? `<div class="card" style="background:var(--amber-soft);border-color:var(--amber)"><div class="t-sm" style="color:var(--amber);line-height:1.6">${esc(notice)}</div></div>` : ''}
    <button class="card col" data-go="ownerAuth" style="gap:6px;align-items:flex-start;text-align:left">
      <span class="t-md">Tôi là chủ quán</span>
      <span class="t-xs" style="line-height:1.5">Tạo hoặc đăng nhập <b>tài khoản lưu trữ dữ liệu</b> (bằng email) — nơi lưu dữ liệu và gói cước của quán. Máy này sẽ là máy gốc, có toàn quyền.</span>
    </button>
    <button class="card col" data-go="staffJoin" style="gap:6px;align-items:flex-start;text-align:left">
      <span class="t-md">Đây là máy nhân viên</span>
      <span class="t-xs" style="line-height:1.5">Quét mã QR trên máy chủ quán để liên kết. Máy nhân viên chỉ làm được các thao tác vận hành.</span>
    </button>
  </div></div>`;
}

/* ---------- 2. Tài khoản lưu trữ dữ liệu (email + mật khẩu lưu trữ; KHÁC tài khoản đăng nhập app) ---------- */
function vOwnerAuth() {
  const mode = route.params.mode === 'signup' ? 'signup' : 'login';
  return `<div class="screen">
    ${hdr(mode === 'signup' ? 'Tạo tài khoản lưu trữ dữ liệu' : 'Đăng nhập tài khoản lưu trữ')}
    <div class="body">
      <div class="row" style="gap:6px">
        <button class="btn sm ${mode === 'login' ? 'pri' : ''}" data-go="ownerAuth" data-mode="login" style="flex:1">Đăng nhập</button>
        <button class="btn sm ${mode === 'signup' ? 'pri' : ''}" data-go="ownerAuth" data-mode="signup" style="flex:1">Tạo tài khoản</button>
      </div>
      ${mode === 'signup' ? `<div class="field"><label class="f">Tên nhà hàng</label><input class="input" id="oa_shop" placeholder="vd. Nhà Hàng Sen Vàng"></div>` : ''}
      <div class="field"><label class="f">Email tài khoản lưu trữ</label><input class="input" id="oa_email" type="email" autocomplete="email" autocapitalize="none" value="${esc(window._ownerEmail || '')}"></div>
      <div class="field"><label class="f">Mật khẩu lưu trữ (tối thiểu 6 ký tự)</label><input class="input" id="oa_pass" type="password" autocomplete="current-password"></div>
      <div class="t-xs" style="line-height:1.6"><b>Tài khoản lưu trữ</b> dùng để lưu dữ liệu quán trên Supabase, quản lý gói cước và khôi phục dữ liệu khi đổi máy. Đây <b>không phải</b> tài khoản đăng nhập vào app bán hàng — tài khoản đó bạn đặt ở bước sau.</div>
      <button class="btn pri" data-act="c_ownerAuthGo" data-mode="${mode}">${mode === 'signup' ? 'Tạo tài khoản' : 'Đăng nhập'}</button>
    </div>
  </div>`;
}

/* ---------- 3. Thông tin quán + tài khoản đăng nhập app (KHÁC tài khoản lưu trữ dữ liệu) ---------- */
function vOwnerInit() {
  return `<div class="screen">
    ${hdr('Thiết lập quán')}
    <div class="body">
      <div class="field"><label class="f">Tên nhà hàng</label><input class="input" id="oi_shop" value="${esc(window._shopName || '')}"></div>
      <div class="field"><label class="f">Số điện thoại (không bắt buộc)</label><input class="input" id="oi_phone" type="tel"></div>
      <div class="sec">Tài khoản đăng nhập app (dùng hằng ngày để vào app bán hàng)</div>
      <div class="field"><label class="f">Tên của bạn</label><input class="input" id="oi_name"></div>
      <div class="field"><label class="f">Tên đăng nhập app</label><input class="input" id="oi_user" autocapitalize="none" value="chuquan"></div>
      <div class="field"><label class="f">Mật khẩu đăng nhập app (tối thiểu 6 ký tự)</label><input class="input" id="oi_pass" type="password"></div>
      <div class="field"><label class="f">Nhập lại mật khẩu đăng nhập app</label><input class="input" id="oi_pass2" type="password"></div>
      <div class="t-xs" style="line-height:1.6;color:var(--amber)">Mật khẩu đăng nhập app được đồng bộ (dạng băm) xuống các máy nhân viên để đăng nhập khi mất mạng — vì vậy <b>đừng dùng chung</b> với <b>mật khẩu lưu trữ</b>, mật khẩu Supabase hay mật khẩu khác của bạn.</div>
      <label class="card between"><div style="flex:1"><div class="t-md">Nạp dữ liệu mẫu</div><div class="t-xs">Vài bàn, thực đơn và kho để thử ngay. Có thể xoá sau.</div></div>
        <input type="checkbox" class="switch" id="oi_sample" checked aria-label="Nạp dữ liệu mẫu"></label>
      <button class="btn pri" data-act="c_ownerInitGo">Tiếp tục</button>
    </div>
  </div>`;
}

/* ---------- 4. Liên kết Supabase của quán ---------- */
function vOwnerLink() {
  const linked = Cloud.linked;
  return `<div class="screen">
    ${hdr('Liên kết Supabase của quán', linked ? 'Đã liên kết' : 'Để đồng bộ nhiều thiết bị')}
    <div class="body">
      ${linked ? `<div class="card" style="background:var(--green-soft);border-color:var(--green)"><div class="t-sm" style="color:var(--green)">✓ Đã liên kết: <span class="mono">${esc(Cloud.cfg.storeUrl || '')}</span></div></div>` : `
      ${autoProvCard()}
      <div class="sec">Hoặc tự cấu hình (nếu bạn đã quen dùng Supabase)</div>
      <div class="card" style="line-height:1.7">
        <div class="t-md" style="margin-bottom:6px">Làm một lần (khoảng 5 phút)</div>
        <div class="t-sm">1. Tạo dự án miễn phí tại <b>supabase.com</b> — đây là kho dữ liệu RIÊNG của quán.<br>
          2. Vào <b>Authentication → Sign In / Providers</b>: bật <b>Allow anonymous sign-ins</b>; ở mục <b>Email</b> tắt <b>Confirm email</b>.<br>
          3. Vào <b>SQL Editor</b> → dán script bên dưới → <b>Run</b>.<br>
          4. Vào <b>Project Settings → API</b>, chép <b>Project URL</b> và khoá <b>anon / publishable</b> (không phải service_role) dán vào hai ô dưới.</div>
      </div>
      <button class="btn ghost" data-act="c_copySql">Sao chép script SQL</button>
      <div class="field"><label class="f">Project URL</label><input class="input" id="ol_url" placeholder="https://xxxx.supabase.co" autocapitalize="none"></div>
      <div class="field"><label class="f">Khoá anon / publishable</label><input class="input" id="ol_key" placeholder="eyJ... hoặc sb_publishable_..." autocapitalize="none"></div>
      <div class="field"><label class="f">Nhập lại mật khẩu lưu trữ</label><input class="input" id="ol_pass" type="password"></div>
      <button class="btn pri" data-act="c_linkGo">Liên kết &amp; đồng bộ</button>`}
      <button class="btn ghost" data-act="c_linkSkip">${linked ? 'Xong' : 'Để sau — dùng một máy trước'}</button>
    </div>
  </div>`;
}

/* ---------- 5. Máy mới của chủ quán đã có liên kết ---------- */
function vOwnerRestore() {
  return `<div class="screen">
    ${hdr('Khôi phục dữ liệu quán')}
    <div class="body">
      <div class="card" style="line-height:1.7"><div class="t-sm">Tài khoản lưu trữ này đã liên kết Supabase của quán. Nhập lại <b>mật khẩu lưu trữ</b> để tải toàn bộ dữ liệu về máy này.</div></div>
      <div class="field"><label class="f">Mật khẩu lưu trữ</label><input class="input" id="or_pass" type="password"></div>
      <div class="t-xs" style="line-height:1.6">Đây là <b>mật khẩu lưu trữ</b> bạn đặt lúc tạo tài khoản lưu trữ dữ liệu (cùng mật khẩu đã nhập khi liên kết Supabase) — <b>không phải</b> mật khẩu đăng nhập app bán hàng.</div>
      <button class="btn pri" data-act="c_restoreGo">Khôi phục</button>
      <div class="t-xs" style="margin-top:18px;line-height:1.6">Không nhớ mật khẩu, hoặc muốn làm lại từ đầu?</div>
      <button class="btn ghost" data-act="c_newStoreAsk">Tạo kho dữ liệu mới</button>
    </div>
  </div>`;
}

function vRestoring() {
  if (D && D.staff && D.staff.length) { route = { name: 'login', params: {} }; return vLogin(); }
  const s = Sync.state;
  return `<div class="screen"><div class="body" style="justify-content:center;align-items:center;text-align:center;padding:32px;gap:12px">
    <div class="t-lg">Đang tải dữ liệu quán…</div>
    <div class="t-sm muted" style="line-height:1.6">${s.status === 'error' || s.status === 'auth' ? esc(s.lastError) : s.status === 'offline' ? 'Cần có mạng để tải dữ liệu lần đầu.' : 'Vui lòng đợi trong giây lát.'}</div>
    <button class="btn ghost sm" data-act="c_syncNow" style="width:auto">Thử lại</button>
    <button class="btn ghost sm" data-act="c_unlinkAsk" style="width:auto">Huỷ liên kết</button>
  </div></div>`;
}

/* ---------- 6. Máy nhân viên: nhập mã mời ---------- */
function vStaffJoin() {
  return `<div class="screen">
    ${hdr('Liên kết máy nhân viên')}
    <div class="body">
      <div class="card" style="line-height:1.7"><div class="t-sm">Trên máy chủ quán: <b>Quản lý → Đồng bộ &amp; thiết bị → Thêm thiết bị nhân viên</b>, rồi quét mã QR hiện ra. Mã chỉ dùng được một lần và hết hạn sau 5 phút.</div></div>
      <div class="field"><label class="f">Tên máy này (vd. Máy bếp)</label><input class="input" id="sj_name" value="${esc(window._devName || '')}" placeholder="Máy bếp"></div>
      <button class="btn pri" data-act="c_scan">Quét mã QR</button>
      <div class="sec">Hoặc dán mã</div>
      <div class="field"><textarea class="input" id="sj_code" rows="3" placeholder="QLNH1|https://..." style="font-family:monospace;font-size:12px"></textarea></div>
      <div class="row" style="gap:8px">
        <button class="btn ghost" data-act="c_paste" style="flex:1">Dán từ khay nhớ tạm</button>
        <button class="btn pri" data-act="c_staffJoinGo" style="flex:1">Liên kết</button>
      </div>
    </div>
  </div>`;
}

/* ---------- 7. Đồng bộ & thiết bị ---------- */
function syncStatusText() {
  const s = Sync.state;
  return ({ ok: 'Đã đồng bộ', syncing: 'Đang đồng bộ…', offline: 'Offline', error: 'Lỗi', auth: 'Cần đăng nhập lại', off: 'Chưa liên kết', revoked: 'Đã bị thu hồi' })[s.status] || s.status;
}
function vCloud() {
  const isOwner = Cloud.role === 'owner', s = Sync.state, linked = Cloud.linked;
  if (isOwner && linked && !window._devices && !window._devicesLoading) loadDevices();
  const devs = window._devices || [];
  return `<div class="screen">
    ${hdr('Đồng bộ & thiết bị', isOwner ? 'Máy chủ quán (máy gốc)' : `Máy nhân viên · ${esc(Cloud.cfg.deviceName || '')}`)}
    <div class="body">
      <div class="card">
        <div class="between" style="margin-bottom:10px"><span class="t-sm">Trạng thái</span>
          <span class="badge ${s.status === 'ok' ? 'b-green' : s.status === 'syncing' ? 'b-blue' : s.status === 'offline' ? 'b-amber' : linked ? 'b-red' : 'b-gray'}">${esc(syncStatusText())}</span></div>
        ${linked ? `<div class="t-xs" style="line-height:1.7">Đồng bộ gần nhất: ${esc(fmtTime(s.lastSyncAt))}<br>Chờ gửi lên: ${Records.dirtyCount()} thay đổi${s.lastError ? `<br><span style="color:var(--red)">${esc(s.lastError)}</span>` : ''}</div>
          <div class="mono t-xs" style="margin-top:8px;word-break:break-all">${esc(Cloud.cfg.storeUrl || '')}</div>
          <button class="btn sm ghost" data-act="c_syncNow" style="margin-top:10px">Đồng bộ ngay</button>`
          : `<div class="t-xs" style="line-height:1.6">Máy này đang dùng dữ liệu riêng, chưa chia sẻ với thiết bị nào.</div>`}
      </div>
      ${s.conflicts.length ? `<div class="sec">Cần kiểm tra</div><div class="card">${s.conflicts.slice(0, 5).map(c =>
        `<div class="t-xs" style="margin-bottom:6px;color:var(--red)">⚠ ${esc(c.reason || 'Xung đột dữ liệu')} <span class="muted">(${esc(fmtTime(c.at))})</span></div>`).join('')}</div>` : ''}
      ${isOwner && !linked ? `<button class="btn pri" data-go="ownerLink">Liên kết Supabase của quán</button>` : ''}
      ${isOwner && linked ? `
        <div class="sec">Thiết bị nhân viên</div>
        <button class="btn pri" data-act="c_inviteNew">Thêm thiết bị nhân viên (mã QR)</button>
        ${devs.map(d => `<div class="card between">
          <div style="flex:1;min-width:0"><div class="t-md">${esc(d.device_name)}</div>
            <div class="t-xs">Liên kết ${esc(fmtTime(Date.parse(d.created_at)))} · Hoạt động ${esc(fmtTime(d.last_seen_at ? Date.parse(d.last_seen_at) : 0))}</div></div>
          ${d.revoked_at
            ? `<div class="row" style="gap:6px"><span class="badge b-red">Đã thu hồi</span>
                 <button class="btn sm ghost" data-act="c_deleteDeviceAsk" data-id="${esc(d.id)}" data-nm="${esc(d.device_name)}" style="width:auto">Xoá</button></div>`
            : `<button class="btn sm danger" data-act="c_revokeAsk" data-id="${esc(d.id)}" data-nm="${esc(d.device_name)}" style="width:auto">Thu hồi</button>`}
        </div>`).join('') || (window._devicesLoading ? '<div class="t-xs muted">Đang tải…</div>' : '<div class="t-xs muted">Chưa có thiết bị nhân viên nào.</div>')}` : ''}
      ${isOwner ? `<button class="btn ghost" data-go="subscription">Gói cước</button>` : ''}
      <div class="sec">Nâng cao</div>
      <button class="btn danger" data-act="c_unlinkAsk">Ngắt liên kết &amp; xoá dữ liệu trên máy này</button>
      ${isOwner ? `<button class="btn danger" data-act="c_deleteAccountAsk" style="margin-top:8px">Xoá tài khoản lưu trữ dữ liệu</button>` : ''}
    </div>
    ${navBar('admin')}
  </div>`;
}
async function loadDevices() {
  window._devicesLoading = true;
  try { window._devices = await Cloud.listDevices(); } catch (e) { window._devices = []; }
  window._devicesLoading = false;
  if (route.name === 'cloud') render();
}

/* ---------- 8. Mã QR mời thiết bị ---------- */
function vPairQr() {
  const inv = window._invite;
  if (!inv) { route = { name: 'cloud', params: {} }; return vCloud(); }
  const left = Math.max(0, Math.floor((inv.expiresAt - Date.now()) / 1000));
  queueMicrotask(startPairTimer);
  return `<div class="screen">
    ${hdr('Mã mời thiết bị nhân viên')}
    <div class="body" style="align-items:center;text-align:center">
      <div class="t-sm" style="line-height:1.6">Trên máy nhân viên chọn <b>"Đây là máy nhân viên"</b> rồi quét mã này.</div>
      <div class="card" style="padding:18px;background:#fff"><div id="pairQrBox" style="width:min(78vw,300px);height:min(78vw,300px)">${left > 0 ? QR.svg(inv.payload, { label: 'Mã mời' }) : ''}</div></div>
      <div id="pairLeft" class="mono" style="font-size:22px;font-weight:700;color:${left > 0 ? 'var(--accent)' : 'var(--red)'}">${left > 0 ? fmtCountdown(left) : 'Mã đã hết hạn'}</div>
      <div class="t-xs" style="line-height:1.6">Chỉ dùng được một lần. Chụp màn hình mã này vô ích sau khi hết hạn.</div>
      <button class="btn ghost" data-act="c_copyInvite">Sao chép mã (nếu không quét được)</button>
      <button class="btn pri" data-act="c_inviteNew">Tạo mã mới</button>
    </div>
  </div>`;
}
const fmtCountdown = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function startPairTimer() {
  clearInterval(window._pairTimer);
  window._pairTimer = setInterval(() => {
    if (route.name !== 'pairQr' || !window._invite) { clearInterval(window._pairTimer); return; }
    const left = Math.max(0, Math.floor((window._invite.expiresAt - Date.now()) / 1000));
    const el = document.getElementById('pairLeft');
    if (!el) return;
    if (left <= 0) { clearInterval(window._pairTimer); render(); return; }
    el.textContent = fmtCountdown(left);
  }, 1000);
}

/* ---------- 9. Gói cước ---------- */
function vSubscription() {
  // Bản "Google Play" (xem HUONG-DAN-GOOGLE-PLAY.md) dùng hẳn luồng mua qua Play Billing —
  // bản chuyển khoản tay giữ nguyên như cũ, không đổi gì ở phần dưới của hàm này.
  if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.billingMode === 'play') return vSubscriptionPlay();
  const st = License.status(), plan = window._plan || 6;
  const reqs = window._reqs || [];
  if (!window._reqsLoaded) { window._reqsLoaded = true; loadRequests(); }
  const tone = st.state === 'expired' ? 'var(--red)' : st.state === 'expiring' ? 'var(--amber)' : 'var(--green)';
  return `<div class="screen">
    ${hdr('Gói cước')}
    <div class="body">
      <div class="card" style="border-color:${tone}">
        <div class="t-md" style="color:${tone}">${esc(License.describe())}</div>
        <div class="t-xs" style="margin-top:6px">Kiểm tra lần cuối: ${esc(fmtTime(st.checkedAt))}</div>
        <button class="btn sm ghost" data-act="c_licCheck" style="margin-top:10px">Kiểm tra lại</button>
      </div>
      <div class="sec">Gia hạn</div>
      <div class="row" style="gap:8px;flex-wrap:wrap">${[1, 6, 12].map(m => `<button class="chip ${plan === m ? 'on' : ''}" data-act="c_planPick" data-m="${m}" style="flex:1 1 90px;justify-content:center">${m} tháng</button>`).join('')}</div>
      <div class="field"><label class="f">Ghi chú gửi nhà cung cấp (không bắt buộc)</label><input class="input" id="sub_note" placeholder="vd. đã chuyển khoản lúc 10:30"></div>
      <button class="btn pri" data-act="c_renewGo">Gửi yêu cầu gia hạn ${plan} tháng</button>
      <div class="t-xs" style="line-height:1.6">${esc((typeof APP_CONFIG !== 'undefined' && APP_CONFIG.supportText) || 'Sau khi thanh toán gói cước theo hướng dẫn của nhà cung cấp, gửi yêu cầu rồi bấm "Kiểm tra lại" khi đã được duyệt.')}</div>
      ${reqs.length ? `<div class="sec">Yêu cầu gần đây</div>${reqs.map(r => `<div class="card between"><div><div class="t-md">${r.plan_months} tháng</div><div class="t-xs">${esc(fmtTime(Date.parse(r.created_at)))}</div></div>
        <span class="badge ${r.status === 'approved' ? 'b-green' : r.status === 'rejected' ? 'b-red' : 'b-amber'}">${r.status === 'approved' ? 'Đã duyệt' : r.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt'}</span></div>`).join('')}` : ''}
    </div>
    ${navBar('admin')}
  </div>`;
}
async function loadRequests() {
  try {
    const { data } = await Cloud.central().from('renewal_requests').select('*').order('created_at', { ascending: false }).limit(5);
    window._reqs = data || [];
  } catch (e) { window._reqs = []; }
  if (route.name === 'subscription') render();
}

/* ---------- 10. Khoá do hết hạn ---------- */
function vLocked() {
  const owner = Cloud.role !== 'staff';
  return `<div class="screen"><div class="body" style="justify-content:center;align-items:center;text-align:center;padding:30px 24px;gap:14px">
    <div style="font-size:44px">🔒</div>
    <div class="t-lg">Gói cước đã hết hạn</div>
    <div class="t-sm muted" style="line-height:1.7">${owner ? 'Bạn vẫn xem và xuất được báo cáo. Gia hạn để tiếp tục gọi món, thanh toán và các thao tác khác.' : 'Vui lòng liên hệ chủ quán để gia hạn.'}</div>
    ${owner ? `<button class="btn pri" data-go="subscription">Gia hạn gói cước</button><button class="btn ghost" data-go="reports">Xem báo cáo</button>` : ''}
    <button class="btn ghost" data-act="logout">Đăng xuất</button>
  </div></div>`;
}

/* ---------- thẻ trạng thái trong màn Quản lý ---------- */
function cloudCardHtml() {
  const st = License.status(), linked = Cloud.linked, owner = Cloud.role === 'owner';
  return `<div class="sec">Đồng bộ &amp; gói cước</div>
    <button class="card col" data-go="cloud" style="gap:8px;align-items:stretch;text-align:left">
      <div class="between"><span class="t-sm">Đồng bộ</span><span class="badge ${linked ? (Sync.state.status === 'ok' ? 'b-green' : Sync.state.status === 'offline' ? 'b-amber' : 'b-blue') : 'b-gray'}">${esc(syncStatusText())}</span></div>
      <div class="between"><span class="t-sm">Gói cước</span><span class="t-xs" style="color:${st.state === 'expired' ? 'var(--red)' : st.state === 'expiring' ? 'var(--amber)' : 'inherit'}">${esc(License.describe())}</span></div>
      <div class="t-xs muted">${owner ? 'Máy chủ quán — quản lý thiết bị nhân viên và gói cước' : 'Máy nhân viên'}</div>
    </button>`;
}

/* ============================================================
   XỬ LÝ HÀNH ĐỘNG
   ============================================================ */
function cloudAct(el) {
  const a = el.dataset.act, d = el.dataset;
  if (!a || a.slice(0, 2) !== 'c_') return false;
  const busy = async fn => {
    if (el._busy) return; el._busy = true;
    const old = el.textContent; el.disabled = true;
    try { await fn(); } catch (e) { toast(e.message || 'Có lỗi xảy ra'); }
    finally { el._busy = false; el.disabled = false; if (el.isConnected) el.textContent = old; }
  };

  switch (a) {
    case 'c_ownerAuthGo': busy(async () => {
      const email = val('oa_email').trim(), pass = val('oa_pass');
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Email không hợp lệ');
      if (pass.length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự');
      window._ownerEmail = email;
      if (d.mode === 'signup') {
        window._shopName = val('oa_shop').trim();
        const r = await Cloud.ownerSignUp(email, pass, window._shopName);
        if (r.needConfirm) { toast('Đã gửi email xác nhận — mở thư, xác nhận rồi quay lại Đăng nhập'); go('ownerAuth', { mode: 'login' }); return; }
      } else {
        await Cloud.ownerSignIn(email, pass);
      }
      await License.refresh(true);
      const link = await Cloud.getStoreLink();
      go(link ? 'ownerRestore' : 'ownerInit');
    }); return true;

    case 'c_ownerInitGo': busy(async () => {
      const shop = val('oi_shop').trim(), user = val('oi_user').trim(), p1 = val('oi_pass'), p2 = val('oi_pass2');
      if (!shop) throw new Error('Nhập tên nhà hàng');
      if (!user) throw new Error('Nhập tên đăng nhập app');
      if (p1.length < 6) throw new Error('Mật khẩu tối thiểu 6 ký tự');
      if (p1 !== p2) throw new Error('Hai mật khẩu không khớp');
      if (Cloud.ownerPw && p1 === Cloud.ownerPw) throw new Error('Không dùng chung mật khẩu đăng nhập app với mật khẩu lưu trữ');
      await createStore({ shopName: shop, phone: val('oi_phone'), ownerName: val('oi_name'), username: user,
                          appPassword: p1, sample: !!document.getElementById('oi_sample')?.checked });
      await Cloud.saveCfg({ role: 'owner' });
      await Persist.flush();
      await License.refresh(true);
      go('ownerLink');
    }); return true;

    case 'c_autoProv': { AutoProv.start(val('ap_pass')); return true; }
    case 'c_autoProvSignup': { AutoProv.openSignup(); return true; }
    /* Nút trong màn hướng dẫn: chỉ mở trang của supabase.com (không mở địa chỉ tuỳ ý) */
    case 'c_guideOpen': { if (/^https:\/\/supabase\.com\//.test(d.url || '')) NativeBridge.browser.open(d.url).catch(e => toast(e.message || 'Không mở được trang')); return true; }

    case 'c_copySql': busy(async () => {
      await NativeBridge.copy(STORE_SQL);
      toast('Đã sao chép script SQL — dán vào SQL Editor của Supabase');
    }); return true;

    case 'c_linkGo': busy(async () => {
      const email = await Cloud.centralEmail();
      if (!email) throw new Error('Phiên đăng nhập tài khoản lưu trữ đã hết — đăng nhập lại');
      await Cloud.linkStoreAsOwner({ url: val('ol_url'), anonKey: val('ol_key'), email, password: val('ol_pass') });
      Cloud.ownerPw = null;
      toast('Đã liên kết — đang đồng bộ dữ liệu lên Supabase');
      route = { name: 'login', params: {} }; render();
    }); return true;

    case 'c_linkSkip': { route = Cloud.linked && ME ? { name: 'cloud', params: {} } : { name: ME ? 'cloud' : 'login', params: {} }; render(); return true; }

    case 'c_restoreGo': busy(async () => {
      const email = await Cloud.centralEmail();
      await Cloud.restoreOwner({ email, password: val('or_pass') });
      Cloud.ownerPw = null;
      route = { name: 'restoring', params: {} }; render();
    }); return true;

    case 'c_newStoreAsk': {
      sheet('Tạo kho dữ liệu mới?', `<div class="t-sm muted" style="margin-bottom:16px;line-height:1.7">Tài khoản này sẽ <b>không còn liên kết</b> với kho dữ liệu cũ. Bạn sẽ thiết lập quán lại từ đầu và liên kết một kho Supabase mới.<br><br>Dữ liệu bán hàng cũ <b>không bị xoá</b>: nó vẫn nằm trong dự án Supabase cũ của bạn, nhưng app này sẽ không đọc nó nữa. Bạn có thể tự xoá dự án cũ trên supabase.com để giải phóng chỗ miễn phí.</div>
        <button class="btn danger" data-act="c_newStoreGo">Gỡ liên kết cũ &amp; tạo mới</button>
        <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
      return true;
    }
    case 'c_newStoreGo': busy(async () => {
      closeSheet();
      await Cloud.discardStoreLink();
      toast('Đã gỡ liên kết cũ — thiết lập quán mới');
      go('ownerInit');
    }); return true;

    case 'c_scan': busy(async () => {
      const text = await NativeBridge.scan();
      if (!text) return;
      const ta = document.getElementById('sj_code'); if (ta) ta.value = text;
      window._devName = val('sj_name');
      await doStaffJoin(text, val('sj_name'));
    }); return true;

    case 'c_paste': busy(async () => {
      const t = await NativeBridge.readClipboard();
      const ta = document.getElementById('sj_code'); if (ta) ta.value = t || '';
      if (!t) toast('Khay nhớ tạm đang trống');
    }); return true;

    case 'c_staffJoinGo': busy(async () => {
      await doStaffJoin(val('sj_code'), val('sj_name'));
    }); return true;

    case 'c_inviteNew': busy(async () => {
      window._invite = await Cloud.createInvite();
      go('pairQr');
    }); return true;

    case 'c_copyInvite': busy(async () => {
      if (window._invite) { await NativeBridge.copy(window._invite.payload); toast('Đã sao chép mã mời'); }
    }); return true;

    case 'c_revokeAsk': {
      sheet('Thu hồi thiết bị?', `<div class="t-sm muted" style="margin-bottom:16px;line-height:1.6">Máy <b>${esc(d.nm)}</b> sẽ mất quyền truy cập ngay khi có mạng và dữ liệu trên máy đó bị xoá. Các máy khác không bị ảnh hưởng.</div>
        <button class="btn danger" data-act="c_revokeGo" data-id="${esc(d.id)}">Thu hồi</button>
        <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
      return true;
    }
    case 'c_revokeGo': busy(async () => {
      await Cloud.revokeDevice(d.id); closeSheet(); window._devices = null; toast('Đã thu hồi thiết bị'); render();
    }); return true;

    case 'c_deleteDeviceAsk': {
      sheet('Xoá khỏi danh sách?', `<div class="t-sm muted" style="margin-bottom:16px;line-height:1.6">Chỉ xoá dòng <b>${esc(d.nm)}</b> khỏi danh sách cho gọn — máy này đã bị thu hồi từ trước nên không mất thêm quyền gì. Không thể hoàn tác.</div>
        <button class="btn danger" data-act="c_deleteDeviceGo" data-id="${esc(d.id)}">Xoá</button>
        <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
      return true;
    }
    case 'c_deleteDeviceGo': busy(async () => {
      await Cloud.deleteDevice(d.id); closeSheet(); window._devices = null; toast('Đã xoá khỏi danh sách'); render();
    }); return true;

    case 'c_syncNow': busy(async () => { await Sync.syncNow(); if (route.name === 'cloud') render(); }); return true;

    case 'c_unlinkAsk': {
      // Chủ quán đã liên kết kho: cho chọn GỠ LUÔN liên kết ở máy chủ trung tâm (nếu chỉ xoá trên máy, tài khoản vẫn nhớ kho cũ)
      const detach = Cloud.role === 'owner' && Cloud.linked;
      sheet('Ngắt liên kết?', `<div class="t-sm muted" style="margin-bottom:16px;line-height:1.6">Toàn bộ dữ liệu trên máy này sẽ bị <b>xoá</b> và máy quay về màn thiết lập. Dữ liệu đã đồng bộ vẫn còn trên Supabase của quán.${detach ? `<br><br><b>Chỉ xoá trên máy này:</b> tài khoản lưu trữ vẫn nhớ kho Supabase — đăng nhập lại sẽ khôi phục được dữ liệu.<br><b>Xoá và gỡ liên kết kho:</b> tài khoản lưu trữ quên kho cũ để bạn tạo kho mới (kho cũ không bị xoá, bạn tự xoá trên supabase.com nếu muốn). Chọn cách này TRƯỚC khi xoá dự án trên Supabase.` : ''}${Records.dirtyCount() ? `<br><br><span style="color:var(--red)">Còn ${Records.dirtyCount()} thay đổi chưa gửi lên — sẽ mất nếu ngắt ngay.</span>` : ''}</div>
        <button class="btn danger" data-act="c_unlinkGo">${detach ? 'Chỉ xoá dữ liệu trên máy này' : 'Xoá dữ liệu &amp; ngắt liên kết'}</button>
        ${detach ? `<button class="btn danger" data-act="c_unlinkDetachGo" style="margin-top:8px">Xoá &amp; gỡ liên kết kho (để tạo kho mới)</button>` : ''}
        <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
      return true;
    }
    /* Xoá tài khoản (bắt buộc theo chính sách Google Play): phải gõ XOA để xác nhận */
    case 'c_deleteAccountAsk': {
      sheet('Xoá tài khoản lưu trữ?', `<div class="t-sm muted" style="margin-bottom:12px;line-height:1.65">Sẽ <b>xoá vĩnh viễn</b> tài khoản lưu trữ dữ liệu của bạn (email, gói cước, liên kết kho) và <b>xoá dữ liệu trên máy này</b>. Không thể hoàn tác.<br><br>
          • Dữ liệu bán hàng nằm trong dự án Supabase riêng của quán <b>không bị xoá</b> — bạn tự xoá trên supabase.com nếu muốn.<br>
          • Gói đăng ký trên Google Play <b>không tự huỷ</b> — hãy huỷ trong Google Play → Thanh toán và gói đăng ký.</div>
        <div class="field"><label class="f">Gõ <b>XOA</b> để xác nhận</label><input class="input" id="del_confirm" autocapitalize="characters" autocomplete="off"></div>
        <button class="btn danger" data-act="c_deleteAccountGo">Xoá tài khoản vĩnh viễn</button>
        <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
      return true;
    }
    case 'c_deleteAccountGo': busy(async () => {
      if (val('del_confirm').trim().toUpperCase() !== 'XOA') throw new Error('Gõ đúng chữ XOA để xác nhận');
      await Cloud.deleteAccount(); closeSheet(); TOKEN = null; ME = null;
      try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
      toast('Đã xoá tài khoản lưu trữ dữ liệu');
      route = { name: 'setup', params: {} }; render();
    }); return true;

    case 'c_unlinkDetachGo': busy(async () => {
      await Cloud.unlinkAndDetach(); closeSheet(); TOKEN = null; ME = null;
      try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
      toast('Đã gỡ liên kết kho khỏi tài khoản lưu trữ');
      route = { name: 'setup', params: {} }; render();
    }); return true;

    case 'c_unlinkGo': busy(async () => {
      closeSheet(); await Cloud.unlinkAll(); TOKEN = null; ME = null;
      try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
      route = { name: 'setup', params: {} }; render();
    }); return true;

    case 'c_planPick': { window._plan = Number(d.m); render(); return true; }
    case 'c_renewGo': busy(async () => {
      const { error } = await Cloud.central().rpc('request_renewal', { p_months: window._plan || 6, p_note: val('sub_note') });
      if (error) throw new Error(Cloud.friendly(error));
      window._reqsLoaded = false; toast('Đã gửi yêu cầu gia hạn'); render();
    }); return true;
    case 'c_licCheck': busy(async () => {
      await License.refresh(true); window._reqsLoaded = false;
      toast(License.locked() ? 'Gói vẫn hết hạn' : 'Đã cập nhật gói cước'); render();
    }); return true;

    case 'c_playBuy': { playPurchase(d.id); return true; }
    case 'c_playRestore': { playRestore(); return true; }
    case 'c_playManage': { NativeBridge.billing.manage(); return true; }
  }
  return false;
}

async function doStaffJoin(text, name) {
  if (!String(text || '').trim()) throw new Error('Chưa có mã mời');
  const nm = String(name || '').trim() || 'Máy nhân viên';
  await Cloud.joinAsStaff(text, nm);
  toast('Đã liên kết — đang tải dữ liệu quán');
  route = { name: 'restoring', params: {} }; render();
}
