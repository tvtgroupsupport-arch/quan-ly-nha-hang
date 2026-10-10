/* ============================================================
   GÓI CƯỚC QUA GOOGLE PLAY — chỉ dùng ở bản app "Google Play" (APP_CONFIG.billingMode === 'play').
   App KHÔNG tự quyết định "đã mua thành công" — chỉ Edge Function verify-purchase (chạy trên máy
   chủ, tự hỏi lại Google) mới có quyền nói vậy. App chỉ đưa purchaseToken lên, chờ kết quả.
   ============================================================ */

const PLAY_PRODUCT_IDS = ['goi_1_thang', 'goi_6_thang', 'goi_12_thang'];   // phải khớp đúng mã đã tạo trên Play Console
const PLAY_MONTHS = { goi_1_thang: 1, goi_6_thang: 6, goi_12_thang: 12 };
// ID base plan của từng gói trên Play Console (chỉ chữ thường, số, gạch ngang) — plugin bắt buộc truyền khi mua gói đăng ký.
const PLAY_BASE_PLANS = { goi_1_thang: 'goi-1-thang', goi_6_thang: 'goi-6-thang', goi_12_thang: 'goi-12-thang' };

let _playProducts = null, _playLoading = false, _playBusy = false, _playError = '', _playTries = 0;

/** Mã sản phẩm thật của một dòng plugin trả về. Android gói đăng ký: plugin trả MỖI base plan/ưu đãi một dòng, trong đó
    `identifier` là mã base plan (goi-1-thang) còn `planIdentifier` mới là mã sản phẩm (goi_1_thang) — dùng nhầm sẽ
    không tra ra base plan và mua báo "planIdentifier cannot be empty". iOS/bản cũ không có planIdentifier thì dùng identifier. */
function playProductId(p) { return (p && (p.planIdentifier || p.identifier)) || ''; }

/** Mỗi gói chỉ giữ MỘT dòng (ưu tiên giá gốc, bỏ dòng ưu đãi/dùng thử miễn phí trùng mã), đúng thứ tự 1 → 6 → 12 tháng. */
function normalizePlayProducts(list) {
  const byId = new Map();
  for (const p of (list || [])) {
    const id = playProductId(p);
    if (!PLAY_PRODUCT_IDS.includes(id)) continue;
    const isBase = p.offerId == null;
    const cur = byId.get(id);
    if (!cur || (isBase && cur.offerId != null)) byId.set(id, p);
  }
  return PLAY_PRODUCT_IDS.filter(id => byId.has(id)).map(id => byId.get(id));
}

/** Tải danh sách gói từ Google Play. Lỗi/rỗng KHÔNG còn bị nhớ mãi: tự thử lại tối đa 3 lần (cách nhau 4 giây — dịch vụ thanh toán đôi khi chưa kịp kết nối
    lúc mở màn), có nút "Thử tải lại"; lý do lỗi được giữ lại để hiện cho người dùng. */
async function loadPlayProducts(force) {
  if (_playLoading) return;
  if (force) { _playProducts = null; _playTries = 0; }
  if (_playProducts) return;
  _playLoading = true; _playError = '';
  try {
    const ok = await NativeBridge.billing.isSupported();
    if (!ok) { _playProducts = []; _playError = 'Google Play Billing không khả dụng — hãy cài app từ Google Play (kênh thử nghiệm), không cài tệp APK trực tiếp.'; return; }
    const raw = await NativeBridge.billing.getProducts(PLAY_PRODUCT_IDS);
    _playProducts = normalizePlayProducts(raw);
    if (!_playProducts.length) _playError = `Google Play trả về ${(raw || []).length} gói nhưng không khớp mã gói cước của app (kiểm tra gói đã được kích hoạt trên Play Console và tài khoản Google là người thử nghiệm).`;
  } catch (e) { _playProducts = []; _playError = String((e && e.message) || e || ''); }
  finally {
    _playLoading = false;
    if (_playProducts && !_playProducts.length && _playTries < 3) { _playTries++; setTimeout(() => { if (_playProducts && !_playProducts.length) { _playProducts = null; loadPlayProducts(); } }, 4000); }
    if (route.name === 'subscription') render();
  }
}

/** Gọi Edge Function verify-purchase bằng chính phiên đăng nhập Supabase trung tâm hiện tại. */
async function verifyPlayPurchase(purchaseToken, productId) {
  const { data: sess } = await Cloud.central().auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Phiên đăng nhập đã hết — đăng nhập lại rồi thử lại');
  const url = `${APP_CONFIG.centralUrl}/functions/v1/verify-purchase`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: APP_CONFIG.centralAnonKey },
    body: JSON.stringify({ purchaseToken, productId }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Máy chủ xác minh báo lỗi (${r.status})`);
  return j;
}

/** Các lượt mua gói còn hiệu lực trên tài khoản Google của máy này — KHÔNG lọc theo tài khoản app, vì giao dịch tạo thẳng trên
    Google Play (nút "Đăng ký lại"…) không mang mã tài khoản của app nhưng vẫn là tiền thật khách đã trả. */
async function ownedPlayPurchases() {
  let owned = [];
  try { owned = await NativeBridge.billing.getPurchases(); } catch (e) { owned = []; }
  return (owned || []).filter(p => p?.purchaseToken && PLAY_PRODUCT_IDS.includes(p.productIdentifier) && String(p.purchaseState) === '1');
}

/** Gửi mọi lượt mua đang có trên máy lên server xác minh (server hỏi lại Google rồi mới ghi nhận). Trả về số lượt được ghi nhận.
    Gọi khi mở màn Gói cước / bấm "Kiểm tra lại" / mở app / quay lại app — nên có chặn gọi dồn (10 phút) trừ khi force. */
let _playSyncAt = 0, _playSyncing = false;
async function playSyncPurchases(force) {
  if (_playSyncing) return 0;
  if (!force && Date.now() - _playSyncAt < 10 * 60000) return 0;
  _playSyncing = true;
  let ok = 0;
  try {
    if (!(await NativeBridge.billing.isSupported())) return 0;
    for (const p of await ownedPlayPurchases()) {
      try { await verifyPlayPurchase(p.purchaseToken, p.productIdentifier); ok++; }
      catch (e) { /* giao dịch của tài khoản app khác / đang chờ thanh toán / mạng lỗi: bỏ qua, lần sau thử lại */ }
    }
    _playSyncAt = Date.now();
  } catch (e) { /* không đồng bộ được — để lần sau */ }
  finally { _playSyncing = false; }
  return ok;
}

/** Làm mới gói cước: đồng bộ giao dịch Google Play (bản Google Play) rồi hỏi lại hạn từ máy chủ. */
async function refreshLicenseWithPlay(force) {
  if (typeof Cloud !== 'undefined' && Cloud.localMode) return License.status();   // chưa có tài khoản BEPO: gói dùng thử tính trên máy, không hỏi máy chủ
  if (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.billingMode === 'play') await playSyncPurchases(force);
  await License.refresh(!!force);
}

function _playLabel(id) { return ({ goi_1_thang: '1 tháng', goi_6_thang: '6 tháng', goi_12_thang: '12 tháng' }[id] || id); }

async function playPurchase(productId, force) {
  if (_playBusy) return;
  _playBusy = true; render();
  try {
    const { data: userRes } = await Cloud.central().auth.getUser();
    const ownerId = userRes?.user?.id;
    if (!ownerId) throw new Error('Chưa đăng nhập tài khoản lưu trữ');

    // Chặn mua trùng: Google Play cho phép giữ NHIỀU gói đăng ký cùng lúc (mỗi gói là một sản phẩm riêng) và tính tiền cả hai.
    // Plugin hiện không hỗ trợ "đổi gói" nên hỏi lại cho chắc trước khi thu thêm tiền.
    if (!force) {
      const owned = await ownedPlayPurchases();
      if (owned.length) {
        const same = owned.find(p => p.productIdentifier === productId);
        if (same) {
          await playSyncPurchases(true); await License.refresh(true);
          toast('Bạn đang có gói ' + _playLabel(productId) + ' trên Google Play — đã cập nhật lại trạng thái gói cước');
          return;
        }
        const have = [...new Set(owned.map(p => _playLabel(p.productIdentifier)))].join(', ');
        sheet('Bạn đang có gói khác', `<div class="t-sm" style="line-height:1.6">Tài khoản Google Play trên máy này đang đăng ký gói <b>${esc(have)}</b>. Mua thêm gói <b>${esc(_playLabel(productId))}</b> sẽ bị tính tiền <b>cả hai gói</b> (Google không tự thay thế gói cũ).<br><br>Muốn đổi gói: vào "Quản lý gói trên Google Play" để huỷ gói cũ rồi mua gói mới sau khi gói cũ hết hạn.</div>
          <button class="btn" data-act="c_playManage" style="margin-top:12px">Quản lý gói trên Google Play</button>
          <button class="btn ghost" data-act="c_playBuyAnyway" data-id="${esc(productId)}" style="margin-top:8px">Vẫn mua thêm gói ${esc(_playLabel(productId))}</button>`);
        return;
      }
    }

    // Ưu tiên base plan do chính Google trả về cho gói này; không có thì dùng bảng quy ước PLAY_BASE_PLANS.
    const prod = (_playProducts || []).find(p => playProductId(p) === productId);
    const basePlan = (prod && prod.planIdentifier && prod.identifier) || PLAY_BASE_PLANS[productId];
    if (!basePlan) throw new Error('Không xác định được gói cơ bản của gói này — kiểm tra lại cấu hình gói trên Play Console');
    const tx = await NativeBridge.billing.purchase(productId, ownerId, basePlan);
    const purchaseToken = tx?.purchaseToken || tx?.transactionId || tx?.id;
    if (!purchaseToken) throw new Error('Không nhận được mã giao dịch từ Google — thử lại');

    toast('Đang xác minh với Google…');
    const res = await verifyPlayPurchase(purchaseToken, productId);
    await License.refresh(true);
    toast(res?.pending ? 'Đang chờ Google xác nhận thanh toán — gói sẽ tự kích hoạt khi xong' : 'Đã kích hoạt gói cước thành công');
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (/user.*cancel|cancelled|canceled/i.test(msg)) toast('Đã huỷ');
    else toast(msg || 'Mua gói không thành công, thử lại');
  } finally {
    _playBusy = false; render();
  }
}
async function playRestore() {
  if (_playBusy) return;
  _playBusy = true; render();
  try {
    await NativeBridge.billing.restore();
    toast('Đang kiểm tra lại các giao dịch trước đó…');
    // Gửi từng lượt mua còn trên tài khoản Google lên server xác minh (cài lại app trước khi verify xong vẫn không mất gói).
    await playSyncPurchases(true);
    await License.refresh(true);
    toast('Đã kiểm tra xong');
  } catch (e) { toast('Khôi phục giao dịch không thành công'); }
  finally { _playBusy = false; render(); }
}

/** Màn Gói cước — bản Google Play. Thay cho vSubscription() (bản chuyển khoản tay). */
function vSubscriptionPlay() {
  const st = License.status();
  const tone = st.state === 'expired' ? 'var(--red)' : st.state === 'expiring' ? 'var(--amber)' : 'var(--green)';
  if (!_playProducts && !_playLoading) loadPlayProducts();
  if (!_playSyncing && Date.now() - _playSyncAt > 10 * 60000) playSyncPurchases(false).then(n => { if (n && route.name === 'subscription') License.refresh(true).then(() => render()); });

  const labelOf = _playLabel;

  return `<div class="screen">
    ${hdr('Gói cước')}
    <div class="body">
      <div class="card" style="border-color:${tone}">
        <div class="t-md" style="color:${tone}">${esc(License.describe())}</div>
        <div class="t-xs" style="margin-top:6px">Kiểm tra lần cuối: ${esc(fmtTime(st.checkedAt))}</div>
        <button class="btn sm ghost" data-act="c_licCheck" style="margin-top:10px">Kiểm tra lại</button>
      </div>

      <div class="sec">Chọn gói — thanh toán qua Google Play</div>
      ${_playLoading ? `<div class="t-sm muted">Đang tải danh sách gói…</div>` : ''}
      ${(_playProducts && _playProducts.length === 0 && !_playLoading) ? `
        <div class="card row" style="background:var(--amber-soft);border-color:var(--amber)">
          <span style="color:var(--amber)">${icon('warn')}</span>
          <div style="flex:1"><div class="t-sm" style="color:var(--amber)">Không tải được gói cước — kiểm tra đã đăng nhập tài khoản Google có quyền mua hàng trên thiết bị này chưa, hoặc thử lại sau.</div>
            ${_playError ? `<div class="t-xs" style="color:var(--amber);margin-top:6px;word-break:break-word">Chi tiết: ${esc(_playError)}</div>` : ''}
            <button class="btn sm ghost" data-act="c_playReload" style="margin-top:8px">Thử tải lại</button></div>
        </div>` : ''}
      ${(_playProducts || []).map(p => `
        <button class="card between" data-act="c_playBuy" data-id="${esc(playProductId(p))}" ${_playBusy ? 'disabled' : ''} style="width:100%;text-align:left">
          <div><div class="t-md">${esc(labelOf(playProductId(p)))}</div><div class="t-xs">${esc(p.title || '')}</div></div>
          <div class="t-md" style="color:var(--accent)">${esc(p.priceString || '')}</div>
        </button>`).join('')}

      <button class="btn ghost" data-act="c_playRestore" ${_playBusy ? 'disabled' : ''} style="margin-top:14px">Khôi phục giao dịch đã mua trước đó</button>
      <div class="t-xs" style="margin-top:10px;line-height:1.6">Thanh toán và quản lý gói cước (huỷ, đổi gói) đều thực hiện qua Google Play — đúng theo chính sách của Google, ứng dụng không tự xử lý tiền.</div>
      <button class="btn sm ghost" data-act="c_playManage" style="margin-top:8px">Quản lý gói trên Google Play</button>
    </div>
    ${navBar('admin')}
  </div>`;
}
