/* ============================================================
   GÓI CƯỚC QUA GOOGLE PLAY — chỉ dùng ở bản app "Google Play" (APP_CONFIG.billingMode === 'play').
   App KHÔNG tự quyết định "đã mua thành công" — chỉ Edge Function verify-purchase (chạy trên máy
   chủ, tự hỏi lại Google) mới có quyền nói vậy. App chỉ đưa purchaseToken lên, chờ kết quả.
   ============================================================ */

const PLAY_PRODUCT_IDS = ['goi_1_thang', 'goi_6_thang', 'goi_12_thang'];   // phải khớp đúng mã đã tạo trên Play Console
const PLAY_MONTHS = { goi_1_thang: 1, goi_6_thang: 6, goi_12_thang: 12 };

let _playProducts = null, _playLoading = false, _playBusy = false;

async function loadPlayProducts() {
  if (_playProducts || _playLoading) return;
  _playLoading = true;
  try {
    const ok = await NativeBridge.billing.isSupported();
    if (!ok) { _playProducts = []; return; }
    _playProducts = await NativeBridge.billing.getProducts(PLAY_PRODUCT_IDS);
  } catch (e) { _playProducts = []; }
  finally { _playLoading = false; if (route.name === 'subscription') render(); }
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

async function playPurchase(productId) {
  if (_playBusy) return;
  _playBusy = true; render();
  try {
    const { data: userRes } = await Cloud.central().auth.getUser();
    const ownerId = userRes?.user?.id;
    if (!ownerId) throw new Error('Chưa đăng nhập tài khoản chủ quán');

    const tx = await NativeBridge.billing.purchase(productId, ownerId);
    const purchaseToken = tx?.purchaseToken || tx?.transactionId || tx?.id;
    if (!purchaseToken) throw new Error('Không nhận được mã giao dịch từ Google — thử lại');

    toast('Đang xác minh với Google…');
    await verifyPlayPurchase(purchaseToken, productId);
    await License.refresh(true);
    toast('Đã kích hoạt gói cước thành công');
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

  const labelOf = (id) => ({ goi_1_thang: '1 tháng', goi_6_thang: '6 tháng', goi_12_thang: '12 tháng' }[id] || id);

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
          <div class="t-sm" style="color:var(--amber);flex:1">Không tải được gói cước — kiểm tra đã đăng nhập tài khoản Google có quyền mua hàng trên thiết bị này chưa, hoặc thử lại sau.</div>
        </div>` : ''}
      ${(_playProducts || []).map(p => `
        <button class="card between" data-act="c_playBuy" data-id="${esc(p.identifier)}" ${_playBusy ? 'disabled' : ''} style="width:100%;text-align:left">
          <div><div class="t-md">${esc(labelOf(p.identifier))}</div><div class="t-xs">${esc(p.title || '')}</div></div>
          <div class="t-md" style="color:var(--accent)">${esc(p.priceString || '')}</div>
        </button>`).join('')}

      <button class="btn ghost" data-act="c_playRestore" ${_playBusy ? 'disabled' : ''} style="margin-top:14px">Khôi phục giao dịch đã mua trước đó</button>
      <div class="t-xs" style="margin-top:10px;line-height:1.6">Thanh toán và quản lý gói cước (huỷ, đổi gói) đều thực hiện qua Google Play — đúng theo chính sách của Google, ứng dụng không tự xử lý tiền.</div>
      <button class="btn sm ghost" data-act="c_playManage" style="margin-top:8px">Quản lý gói trên Google Play</button>
    </div>
    ${navBar('admin')}
  </div>`;
}
