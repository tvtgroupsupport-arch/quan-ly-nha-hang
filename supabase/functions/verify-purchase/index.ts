// ============================================================
// verify-purchase — app (bản Google Play) gọi hàm này NGAY SAU KHI mua gói thành công.
// Nhận vào purchaseToken + productId do Play Billing trả về trên máy khách — đây là dữ
// liệu CHƯA ĐÁNG TIN (app có thể bị sửa để gửi giả), nên việc đầu tiên luôn là tự hỏi
// lại GOOGLE xem token đó có thật không, KHÔNG BAO GIỜ tin thẳng dữ liệu app gửi lên.
//
// Triển khai: supabase functions deploy verify-purchase
// Cần đặt trước các secret (supabase secrets set ...): xem HUONG-DAN-GOOGLE-PLAY.md
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { fetchSubscription, acknowledgeSubscription, isActiveState } from '../_shared/google-play.ts';

const PACKAGE_NAME = Deno.env.get('PLAY_PACKAGE_NAME') ?? '';
const SA_JSON = Deno.env.get('PLAY_SERVICE_ACCOUNT_JSON') ?? '';

// App chạy trong WebView (origin https://localhost) gọi hàm này khác nguồn → trình duyệt gửi OPTIONS "preflight"
// trước; thiếu các header CORS này thì fetch báo "Failed to fetch" và việc xác minh gói không bao giờ chạy.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405);
  if (!PACKAGE_NAME || !SA_JSON) return json({ error: 'Máy chủ chưa cấu hình đủ (thiếu PLAY_PACKAGE_NAME/PLAY_SERVICE_ACCOUNT_JSON)' }, 500);

  // Xác định ĐÚNG người đang gọi — dùng chính token đăng nhập của họ, không tự suy diễn từ body
  const authHeader = req.headers.get('Authorization') ?? '';
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn' }, 401);
  const ownerId = userData.user.id;

  let body: { purchaseToken?: string; productId?: string };
  try { body = await req.json(); } catch { return json({ error: 'Dữ liệu gửi lên không hợp lệ' }, 400); }
  const { purchaseToken, productId } = body;
  if (!purchaseToken || !productId) return json({ error: 'Thiếu purchaseToken hoặc productId' }, 400);

  let sa: { client_email: string; private_key: string };
  try { sa = JSON.parse(SA_JSON); } catch { return json({ error: 'Máy chủ cấu hình sai định dạng khoá dịch vụ' }, 500); }

  let sub;
  try { sub = await fetchSubscription(sa, PACKAGE_NAME, purchaseToken); }
  catch (e) { return json({ error: `Không xác minh được với Google: ${(e as Error).message}` }, 502); }

  const line = sub.lineItems?.find((l) => l.productId === productId);
  if (!line) return json({ error: 'Giao dịch không có gói nào khớp' }, 400);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Đối chiếu đúng người. Mua TRONG app: app gửi kèm obfuscatedAccountId = chính ownerId (xem src/cloud/play-billing.js) →
  // có thì BẮT BUỘC khớp người gọi.
  const tokenOwner = sub.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  let claimedWithoutAccountId = false;
  if (tokenOwner) {
    if (tokenOwner !== ownerId) return json({ error: 'Giao dịch này không thuộc về tài khoản đang đăng nhập' }, 403);
  } else {
    // Giao dịch tạo THẲNG TRÊN GOOGLE PLAY (nút "Đăng ký lại", khôi phục gói…) KHÔNG mang mã tài khoản của app. Không thể từ chối hết
    // — khách đã trả tiền nhưng app sẽ báo hết hạn mãi. Cách xử lý an toàn:
    //  • Nếu giao dịch này nối tiếp một mã cũ (linkedPurchaseToken) đã có chủ → chỉ chủ đó mới được nhận.
    //  • Không thì "ai gửi trước được trước": mã giao dịch là bí mật của riêng tài khoản Google đó (app chỉ lấy được từ chính máy của họ),
    //    và record_play_purchase từ chối mọi lần đổi chủ về sau.
    if (sub.linkedPurchaseToken) {
      const { data: lineageOwner } = await admin.rpc('find_play_purchase_owner', { p_purchase_token: sub.linkedPurchaseToken });
      if (lineageOwner && lineageOwner !== ownerId) return json({ error: 'Giao dịch này không thuộc về tài khoản đang đăng nhập' }, 403);
    }
    claimedWithoutAccountId = true;
  }

  if (sub.subscriptionState === 'SUBSCRIPTION_STATE_PENDING') return json({ error: 'Giao dịch đang chờ thanh toán — sẽ tự kích hoạt khi Google xác nhận', pending: true }, 202);

  if (sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING') {
    try { await acknowledgeSubscription(sa, PACKAGE_NAME, line.productId, purchaseToken); }
    catch (e) { return json({ error: `Xác nhận với Google thất bại: ${(e as Error).message}` }, 502); }
  }

  const { error: rpcErr } = await admin.rpc('record_play_purchase', {
    p_owner: ownerId, p_purchase_token: purchaseToken, p_product_id: line.productId,
    p_expires_at: line.expiryTime, p_state: isActiveState(sub.subscriptionState) ? 'active' : 'expired',
    p_raw: { ...sub, _claimed_without_account_id: claimedWithoutAccountId },
  });
  if (rpcErr) {
    // 42501 = mã giao dịch đã thuộc về tài khoản khác (record_play_purchase không cho đổi chủ)
    if (rpcErr.code === '42501') return json({ error: 'Giao dịch này không thuộc về tài khoản đang đăng nhập' }, 403);
    return json({ error: `Ghi nhận thất bại: ${rpcErr.message}` }, 500);
  }

  return json({ ok: true, state: sub.subscriptionState, expires_at: line.expiryTime });
});
