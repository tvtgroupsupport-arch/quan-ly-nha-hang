# Gói cước qua Google Play Billing — hướng dẫn thiết lập

Đây là bản riêng, tách biệt hoàn toàn với bản chuyển khoản tay hiện có. **Chưa làm được gì tới khi
bạn tự hoàn thành đủ các bước dưới đây** — phần việc của tôi (code) đã xong, nhưng phần lớn các bước
sau đây chỉ bạn mới làm được (cần tài khoản Google Play Developer, Google Cloud của chính bạn).

**Trạng thái thật:** toàn bộ code đã viết xong và rà soát kỹ bằng mắt, nhưng **chưa từng chạy thử một
lần nào với Google thật** — vì môi trường tôi làm việc không có mạng ra ngoài để gọi API Google, không
cài được Deno để tự kiểm tra cú pháp 2 Edge Function, và dĩ nhiên không thể tự mua hàng thật trên điện
thoại thật. Có thể còn lỗi chưa phát hiện ra. Làm theo đúng thứ tự dưới đây, thử ở **Internal testing**
(không mất tiền thật) trước khi phát hành rộng.

## Tổng quan luồng hoạt động

```
Điện thoại khách            Supabase TRUNG TÂM              Google
──────────────────          ───────────────────             ──────
App bấm "Mua gói"
  → Play Billing  ────────────────────────────────────→  Hộp thoại mua hàng Google
  ← purchaseToken ←─────────────────────────────────────  (khách xác nhận thanh toán)
  → gửi token lên
    Edge Function
    verify-purchase  ──→  tự gọi Google Play Developer API xác minh token thật hay giả
                     ←──  Google trả về: gói nào, còn hạn tới khi nào
                     ──→  ghi vào bảng subscriptions (nếu hợp lệ)
  ← "đã kích hoạt"

                                                          (sau này: gia hạn/huỷ tự động)
                     ←──────────────────────────────────  Google gửi RTDN qua Pub/Sub
                     rtdn-webhook tự cập nhật lại subscriptions
```

## Bước 1 — Google Play Console: tạo app riêng + 3 gói đăng ký

1. Tạo một ứng dụng MỚI trên Play Console (khác với bản chuyển khoản — không dùng chung).
2. Ghi lại **package name** app đó dùng — mặc định code đang dùng `vn.quanly.nhahang.play`
   (sửa trong GitHub → Settings → Secrets and variables → Actions → **Variables** → `PLAY_APP_ID`
   nếu bạn đặt tên khác).
3. Vào **Monetize → Subscriptions** → tạo đúng 3 gói với **Product ID** (mã sản phẩm) sau — bắt buộc
   gõ đúng chữ, viết hoa/thường, dấu gạch dưới:
   - `goi_1_thang` — 1 tháng
   - `goi_6_thang` — 6 tháng
   - `goi_12_thang` — 12 tháng
   (Muốn đổi mã khác hoặc thêm gói: sửa bảng `play_products` trong `supabase/central-setup.sql`
   và đổi `PLAY_PRODUCT_IDS` trong `src/cloud/play-billing.js` cho khớp.)
4. Mỗi gói cần ít nhất một **base plan** còn hiệu lực (Active) thì mới hiện giá/mua được.
   **Base plan ID bắt buộc đặt đúng** (plugin yêu cầu khi mua gói đăng ký trên Android; chỉ gồm chữ thường, số, gạch ngang):
   `goi-1-thang`, `goi-6-thang`, `goi-12-thang` (tương ứng từng gói ở trên). Muốn đặt khác thì sửa `PLAY_BASE_PLANS`
   trong `src/cloud/play-billing.js`.

## Bước 2 — Google Cloud: tài khoản dịch vụ (service account)

1. Play Console → **Setup → API access** → liên kết với một dự án Google Cloud (tạo mới nếu chưa có).
2. Bật **Google Play Android Developer API** cho dự án đó (Google Cloud Console → APIs & Services).
3. Quay lại Play Console → **API access** → mục tài khoản dịch vụ → **Create new service account**
   (mở Google Cloud Console, tạo ở đó) → quay lại Play Console bấm **Grant access** cho tài khoản vừa
   tạo, cấp quyền **Financial data** (xem giao dịch) và **View app information** (ở mục quyền của app
   bạn vừa tạo ở Bước 1).
4. Trong Google Cloud Console → IAM → Service accounts → tài khoản vừa tạo → tab **Keys** →
   **Add key → Create new key → JSON** → tải file JSON về. **File này mở ra được toàn quyền xem/xử lý
   giao dịch thật — giữ cẩn thận, không commit vào git, không gửi qua kênh không an toàn.**

## Bước 3 — Supabase: chạy lại script SQL trung tâm

Vào Supabase **trung tâm** (không phải Supabase của từng quán) → SQL Editor → chạy lại toàn bộ
`supabase/central-setup.sql` mới nhất (script chạy lại nhiều lần vẫn an toàn, không mất dữ liệu cũ).
Việc này tạo thêm bảng `play_purchases`, `play_products` và các hàm `record_play_purchase`,
`find_play_purchase_owner` mà 2 Edge Function bên dưới cần dùng.

## Bước 4 — Deploy 2 Edge Function (cần cài Supabase CLI — công cụ mới, chưa dùng tới trước đây)

Trên máy tính (không làm được trên điện thoại/Termux — cần Supabase CLI):

```bash
npm install -g supabase
supabase login
cd android-app
supabase link --project-ref <mã-dự-án-Supabase-trung-tâm>
```

Đặt các secret (giá trị bí mật, không nằm trong code — thay đúng giá trị của bạn):

```bash
supabase secrets set PLAY_PACKAGE_NAME=vn.quanly.nhahang.play
supabase secrets set PLAY_SERVICE_ACCOUNT_JSON="$(cat duong-dan-toi-file-json-buoc-2.json)"
supabase secrets set RTDN_SECRET="$(openssl rand -hex 24)"
```
(Dòng `RTDN_SECRET` tự sinh một chuỗi ngẫu nhiên dài — ghi lại giá trị này, cần dùng ở Bước 5.
Xem lại bất cứ lúc nào bằng `supabase secrets list`.)

Deploy:
```bash
supabase functions deploy verify-purchase
supabase functions deploy rtdn-webhook --no-verify-jwt
```
(`rtdn-webhook` bắt buộc cờ `--no-verify-jwt` vì Google Pub/Sub không gửi JWT đăng nhập Supabase —
hàm tự kiểm bằng `RTDN_SECRET` trong đường dẫn thay vì cơ chế JWT thông thường.)

## Bước 5 — Google Cloud Pub/Sub: nhận thông báo real-time (RTDN)

1. Google Cloud Console → **Pub/Sub → Topics → Create topic**, đặt tên bất kỳ (vd. `play-rtdn`).
2. Play Console → app Bước 1 → **Monetize setup** → mục **Real-time developer notifications** →
   dán đúng tên đầy đủ topic (`projects/<project-id>/topics/play-rtdn`) → Save.
3. Quay lại Pub/Sub → topic vừa tạo → **Create subscription**:
   - Delivery type: **Push**
   - Endpoint URL: `https://<project-ref>.functions.supabase.co/rtdn-webhook?secret=<RTDN_SECRET>`
     (lấy `<project-ref>` từ URL Supabase trung tâm, `<RTDN_SECRET>` từ Bước 4)

## Bước 6 — Build bản Google Play

GitHub → **Settings → Secrets and variables → Actions**:
- **Variables** → thêm `PLAY_APP_ID` nếu đổi khác `vn.quanly.nhahang.play`
- (Tạo khoá ký — xem mục riêng bên dưới — rồi mới build ra bản dùng mua được thật)

Tab **Actions → "Build bản Google Play (AAB)" → Run workflow**.

### Tạo khoá ký (bắt buộc mới mua thật được — Play Billing không chạy trên bản chưa ký đúng cách)

Trên máy tính có cài Java:
```bash
keytool -genkey -v -keystore release.keystore -alias quanlynhahang -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 release.keystore > release.keystore.b64   # Windows: dùng certutil -encode
```
GitHub → Secrets → thêm 4 secret:
- `ANDROID_KEYSTORE_BASE64` — nội dung file `release.keystore.b64`
- `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (= `quanlynhahang` ở trên), `ANDROID_KEY_PASSWORD`

**Giữ file `release.keystore` cẩn thận — mất file này là mất khả năng cập nhật app đã phát hành,
Google không cấp lại được.**

## Bước 7 — Thử ở Internal testing (KHÔNG mất tiền thật)

1. Tải file `.aab` từ Artifacts của workflow Bước 6, tải lên Play Console → **Testing → Internal
   testing** → tạo bản phát hành.
2. Thêm chính email Google của bạn vào danh sách **testers**.
3. Cài app qua đúng link Internal testing (không sideload — Play Billing CHỈ chạy khi app cài qua
   chính Play Store, kể cả kênh thử nội bộ).
4. Vào Play Console → **Setup → License testing**, thêm tài khoản Google đang thử vào danh sách —
   các giao dịch của tài khoản này sẽ hiện "giao dịch thử", không bị trừ tiền thật.
5. Mở app → Quản lý → Gói cước → thử mua từng gói, xác nhận "Đã kích hoạt" hiện đúng.
6. Thử huỷ gói trên Google Play (app riêng "Google Play" → quản lý gói) → vài phút sau kiểm tra bảng
   `play_purchases`/`subscriptions` trên Supabase trung tâm tự cập nhật đúng (nhờ RTDN ở Bước 5) —
   đây là bước quan trọng nhất để biết toàn bộ chuỗi đã thông hay chưa.

## Nếu gặp lỗi

- **"Không xác minh được với Google"**: kiểm tra lại `PLAY_SERVICE_ACCOUNT_JSON` dán đúng nguyên
  văn file JSON (kể cả dấu ngoặc), và tài khoản dịch vụ đã được **Grant access** đúng app ở Bước 2.3.
- **Mua xong app báo lỗi nhưng Google đã trừ tiền thử**: vào Play Console xem giao dịch, có thể cần
  **Refund** tay (môi trường thử đôi khi vẫn tạo giao dịch thật tuỳ cấu hình tài khoản) — kiểm tra kỹ
  đã thêm đúng **License testing** ở Bước 7.4 chưa.
- **`play_purchases` không tự cập nhật khi huỷ gói**: kiểm tra Pub/Sub subscription ở Bước 5 còn active
  không (Google Cloud Console → Pub/Sub → Subscriptions → xem mục "Unacked messages" có dồn lại không,
  nghĩa là endpoint đang lỗi) — xem log hàm `rtdn-webhook` qua `supabase functions logs rtdn-webhook`.
- Mọi lỗi khác: `supabase functions logs verify-purchase` / `supabase functions logs rtdn-webhook` để
  xem chi tiết lỗi thật từ máy chủ — các thông báo lỗi tôi viết trong code đều cố tình mô tả rõ nguyên
  nhân, không chỉ "có lỗi xảy ra" chung chung.
