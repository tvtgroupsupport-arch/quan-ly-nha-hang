// ============================================================
// keepalive.mjs — "đánh thức" tất cả dự án Supabase (trung tâm + của TỪNG quán đã liên kết)
// để tránh bị tự tạm ngừng sau 7 ngày không hoạt động (giới hạn gói miễn phí). Chạy định kỳ qua
// GitHub Actions (xem .github/workflows/keepalive.yml) — mỗi 3 ngày, đủ an toàn dưới mốc 7 ngày.
//
// Cách lấy danh sách MỌI quán: đọc thẳng bảng store_links trên Supabase TRUNG TÂM bằng khoá
// service_role (bỏ qua RLS — khoá này KHÔNG BAO GIỜ được đưa vào app, chỉ nằm trong GitHub Secret).
// Với từng quán, chỉ cần một yêu cầu đọc nhẹ bằng khoá anon của chính quán đó (không cần biết mật
// khẩu/khoá service_role riêng của từng quán) — một yêu cầu bị RLS từ chối VẪN tính là có hoạt động
// trong mắt Supabase, không cần đọc thành công.
// ============================================================
const CENTRAL_URL = process.env.CENTRAL_SUPABASE_URL;
const CENTRAL_SERVICE_KEY = process.env.CENTRAL_SUPABASE_SERVICE_ROLE_KEY;

if (!CENTRAL_URL || !CENTRAL_SERVICE_KEY) {
  console.error('✗ Thiếu CENTRAL_SUPABASE_URL hoặc CENTRAL_SUPABASE_SERVICE_ROLE_KEY (xem GitHub Secrets).');
  process.exit(1);
}

// Supabase đang chuyển từ khoá service_role (dạng JWT, bắt đầu "eyJ...") sang khoá "Secret key" mới
// (dạng sb_secret_..., KHÔNG phải JWT). Khoá mới bắt buộc gửi ở header apikey — gửi nó ở Authorization:
// Bearer (kiểu cũ) sẽ bị từ chối vì không phải JWT. Tự nhận diện để dùng đúng cả hai kiểu khoá.
function authHeaders(key) {
  const isLegacyJwt = key.startsWith('eyJ');
  return isLegacyJwt ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

async function ping(label, url, apikey) {
  try {
    const r = await fetch(url, { headers: authHeaders(apikey) });
    // Coi mọi phản hồi HTTP (kể cả 401/403 do RLS chặn) là "còn sống" — chỉ lỗi MẠNG (không kết nối
    // được tới máy chủ) mới tính là thất bại thật sự. Dự án đã bị tạm ngừng thường trả lỗi mạng hẳn,
    // hoặc một trang lỗi đặc thù — không phải 401/403 bình thường.
    console.log(`  ${r.ok || r.status < 500 ? '✓' : '✗'} ${label} — HTTP ${r.status}`);
    return r.status < 500;
  } catch (e) {
    console.log(`  ✗ ${label} — lỗi mạng: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log('Đánh thức Supabase trung tâm...');
  const centralOk = await ping('Supabase trung tâm', `${CENTRAL_URL}/rest/v1/`, CENTRAL_SERVICE_KEY);

  console.log('Lấy danh sách quán đã liên kết...');
  const r = await fetch(`${CENTRAL_URL}/rest/v1/store_links?select=owner_id,url,anon_key`, {
    headers: authHeaders(CENTRAL_SERVICE_KEY),
  });
  if (!r.ok) { console.error(`✗ Không đọc được store_links (HTTP ${r.status}) — dừng, chỉ kịp đánh thức trung tâm.`); process.exit(centralOk ? 0 : 1); }
  const stores = await r.json();
  console.log(`Tìm thấy ${stores.length} quán đã liên kết. Đánh thức từng quán...`);

  let ok = 0, fail = 0;
  for (const s of stores) {
    const good = await ping(`Quán (owner ${s.owner_id.slice(0, 8)}…)`, `${s.url}/rest/v1/`, s.anon_key);
    if (good) ok++; else fail++;
  }
  console.log(`\nXong: ${ok}/${stores.length} quán đánh thức được, ${fail} thất bại (kiểm tra mạng/url nếu có lỗi).`);
  if (!centralOk) { console.error('✗ Supabase trung tâm không đánh thức được — kiểm tra lại CENTRAL_SUPABASE_URL.'); process.exit(1); }
}

main().catch(e => { console.error('✗ Lỗi không mong đợi:', e); process.exit(1); });
