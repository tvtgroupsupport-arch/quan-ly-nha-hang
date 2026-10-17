// ============================================================
// license-token — chủ quán (đã đăng nhập tài khoản BEPO) hỏi "gói cước của tôi còn hạn không" và nhận về MÃ QUYỀN SỬ DỤNG
// KÝ Ed25519: { p: chuỗi JSON { v, o: mã chủ quán, pm: số tháng, st: trạng thái, ex: hết hạn, lk: khoá mềm lúc, sa: bắt đầu, iat: cấp lúc }, s: chữ ký base64 }.
// App kiểm tra chữ ký bằng KHOÁ CÔNG KHAI nên: (1) chủ quán không tự sửa được hạn ở bộ nhớ máy hay trong kho Supabase của quán (máy nhân viên
// cũng kiểm tra được chữ ký), (2) dùng offline tới hết hạn + ngày ân hạn mà không phải tin dữ liệu chưa ký.
//
// Đồng thời là chỗ SERVER kiểm tra lại với Google: giao dịch còn hiệu lực mà lần xác minh cuối đã quá 6 giờ (hoặc đã tới hạn mà chưa thấy gia hạn)
// thì hỏi lại Google (subscriptionsv2) rồi ghi nhận lại — không phụ thuộc app có gửi mã lên hay RTDN có tới.
//
// Triển khai: supabase functions deploy license-token
// Secret: LICENSE_PRIVATE_KEY (hex 32 byte, khoá bí mật Ed25519), cùng PLAY_PACKAGE_NAME / PLAY_SERVICE_ACCOUNT_JSON như verify-purchase.
// ============================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ed25519 } from 'npm:@noble/curves@2.4.0/ed25519.js';
import { fetchSubscription, isActiveState } from '../_shared/google-play.ts';

const PACKAGE_NAME = Deno.env.get('PLAY_PACKAGE_NAME') ?? '';
const SA_JSON = Deno.env.get('PLAY_SERVICE_ACCOUNT_JSON') ?? '';
const PRIV_HEX = Deno.env.get('LICENSE_PRIVATE_KEY') ?? '';

const STALE_MS = 6 * 3600_000;      // quá 6 giờ chưa hỏi Google thì hỏi lại
const MIN_GAP_MS = 2 * 60_000;      // nhưng không hỏi dồn dập: tối thiểu 2 phút / giao dịch
const GRACE_MS = 3 * 86400_000;     // ân hạn sau hạn cho gói TRẢ PHÍ (phòng Google chậm gia hạn / thẻ lỗi); gói dùng thử không có ân hạn
const MAX_RECHECK = 3;              // tối đa số giao dịch hỏi lại Google trong 1 lượt

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS } });
const hexToBytes = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
const toB64 = (u: Uint8Array) => { let s = ''; for (const b of u) s += String.fromCharCode(b); return btoa(s); };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST' }, 405);
  if (!/^[0-9a-f]{64}$/i.test(PRIV_HEX)) return json({ error: 'Máy chủ chưa cấu hình khoá ký (LICENSE_PRIVATE_KEY)' }, 500);

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: 'Chưa đăng nhập hoặc phiên đã hết hạn' }, 401);
  const ownerId = userData.user.id;
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // 1) Hỏi lại Google các giao dịch còn hiệu lực mà đã cũ. Lỗi ở bước này không chặn việc cấp mã (dùng dữ liệu đã có).
  if (PACKAGE_NAME && SA_JSON) {
    try {
      const sa = JSON.parse(SA_JSON);
      const now = Date.now();
      const { data: rows } = await admin.from('play_purchases')
        .select('purchase_token, product_id, state, expires_at, last_verified').eq('owner_id', ownerId).eq('state', 'active');
      const due = (rows ?? []).filter((r: { expires_at: string; last_verified: string }) => {
        const age = now - Date.parse(r.last_verified);
        return age > MIN_GAP_MS && (age > STALE_MS || Date.parse(r.expires_at) <= now);
      }).slice(0, MAX_RECHECK);
      for (const r of due as Array<{ purchase_token: string; product_id: string }>) {
        try {
          const sub = await fetchSubscription(sa, PACKAGE_NAME, r.purchase_token);
          const line = sub.lineItems?.find((l) => l.productId === r.product_id) ?? sub.lineItems?.[0];
          if (!line) continue;
          await admin.rpc('record_play_purchase', {
            p_owner: ownerId, p_purchase_token: r.purchase_token, p_product_id: line.productId, p_expires_at: line.expiryTime,
            p_state: isActiveState(sub.subscriptionState) ? 'active' : 'expired', p_raw: { ...sub, _recheck: 'license-token' },
          });
        } catch (e) { console.error('license-token: hỏi lại Google thất bại:', (e as Error).message); }
      }
    } catch (e) { console.error('license-token: bước kiểm tra lại bị bỏ qua:', (e as Error).message); }
  }

  // 2) Đọc gói hiện tại và ký
  const { data: sub, error } = await admin.from('subscriptions').select('plan_months, status, expires_at, started_at').eq('owner_id', ownerId).maybeSingle();
  if (error) return json({ error: `Không đọc được gói cước: ${error.message}` }, 500);
  const now = Date.now();
  if (!sub) return json({ ok: true, token: null, server_now: now });
  const ex = Date.parse(sub.expires_at);
  const lk = sub.status === 'active' ? ex + GRACE_MS : ex;
  const p = JSON.stringify({ v: 1, o: ownerId, pm: sub.plan_months, st: sub.status, ex, lk, sa: Date.parse(sub.started_at), iat: now });
  const s = toB64(ed25519.sign(new TextEncoder().encode(p), hexToBytes(PRIV_HEX)));
  return json({ ok: true, token: { p, s }, server_now: now });
});
