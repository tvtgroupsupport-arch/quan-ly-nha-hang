# Tự tạo Supabase cho quán (phương án A — OAuth)

Chủ quán bấm **"Tạo tự động bằng Supabase"** ở màn *Liên kết Supabase của quán*. App mở trang Supabase để họ đồng ý
**một lần**, rồi máy chủ trung tâm tự tạo dự án, chạy `store-setup.sql`, bật đăng nhập ẩn danh, tắt xác nhận email
và trả địa chỉ + khoá `anon` về app để liên kết như cách làm tay.

```
App ──provision-start──▶ trả đường dẫn uỷ quyền ──▶ trình duyệt: chủ quán Authorize
Supabase ──▶ provision-callback (đổi code lấy token bằng client secret, cất tạm trong provision_jobs)
App ──provision-step (lặp 3–5 giây/lần)──▶ tạo dự án → chờ khởi động → lấy khoá anon → chạy SQL → bật cấu hình → done
App nhận url + anon_key → Cloud.linkStoreAsOwner() (luồng sẵn có)
```

Token của Supabase **chỉ nằm trên máy chủ trung tâm** (bảng `provision_jobs`, không client nào đọc được) và bị
xoá ngay khi xong. App không bao giờ cầm token này.

## Thiết lập (làm một lần, bởi nhà cung cấp phần mềm)

### 1. Chạy lại script SQL trung tâm
Supabase **trung tâm** → SQL Editor → chạy lại toàn bộ `supabase/central-setup.sql` (chạy lại nhiều lần vẫn an toàn).
Việc này tạo bảng `provision_jobs`.

### 2. Đăng ký "OAuth App" trên Supabase
supabase.com → chọn **tổ chức** của bạn → **OAuth Apps** → **Add application**:

| Mục | Giá trị |
|---|---|
| Name | Tên phần mềm (chủ quán sẽ thấy tên này khi đồng ý) |
| Website URL | Trang giới thiệu của bạn |
| Redirect URIs | `https://<project-ref>.supabase.co/functions/v1/provision-callback` (project-ref của Supabase **trung tâm**) |
| Scopes | Organizations: **Read** · Projects: **Read, Write** · Database: **Write** · Auth: **Write** · Secrets: **Read** |

Supabase hiện **Client ID** và **Client Secret** — chép lại ngay (secret chỉ hiện một lần).

### 3. Đặt secret cho Edge Function
```bash
supabase secrets set SB_OAUTH_CLIENT_ID=<client id>
supabase secrets set SB_OAUTH_CLIENT_SECRET=<client secret>
```
(Tên **không** được bắt đầu bằng `SUPABASE_` — Supabase dành riêng tiền tố đó.)

### 4. Deploy 3 hàm
```bash
supabase functions deploy provision-start
supabase functions deploy provision-callback --no-verify-jwt
supabase functions deploy provision-step
```
`provision-callback` **bắt buộc** `--no-verify-jwt` vì trình duyệt quay về từ Supabase không mang JWT của app.

### 5. Build lại app
Phiên bản này thêm plugin `@capacitor/browser` (`npm install` tự lấy khi build trên GitHub Actions).

## Khi sửa `store-setup.sql`
Hàm `provision-step` dùng bản nhúng sẵn ở `supabase/functions/_shared/store-sql.ts`. Sau khi sửa `store-setup.sql`:
```bash
node scripts/gen-store-sql.mjs
supabase functions deploy provision-step
```
(Test `30d` sẽ báo lỗi nếu quên.)

## Giới hạn cần biết
- Chủ quán vẫn phải **có tài khoản Supabase** (đăng ký bằng GitHub hoặc email, khoảng 1 phút) — bước này không tự động hoá được.
- Gói Free của Supabase giới hạn số dự án đang hoạt động trên mỗi tài khoản/tổ chức. Nếu đã đủ, app báo rõ và
  chủ quán phải tạm dừng/xoá một dự án cũ (hoặc nâng cấp) rồi bấm **Tiếp tục** — không tạo trùng.
- Dự án mới mất khoảng 1–2 phút để khởi động; app hiện thanh tiến trình.
- Chủ quán có thể thu hồi quyền của phần mềm bất cứ lúc nào trong Supabase → Account → Authorized apps (dự án đã tạo vẫn là của họ).
- Mật khẩu cơ sở dữ liệu của dự án được sinh ngẫu nhiên và **không lưu ở đâu cả** (app chỉ dùng khoá `anon`);
  chủ quán đặt lại được trong Supabase → Database settings nếu cần.
- Nếu app bị tắt giữa chừng: mở lại màn Liên kết, nhập mật khẩu, bấm **Tạo tự động** — máy chủ nối lại đúng phiên dở dang.

## Xử lý sự cố
| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| "Máy chủ chưa cấu hình kết nối Supabase" | Chưa đặt `SB_OAUTH_CLIENT_ID`/`SB_OAUTH_CLIENT_SECRET` (bước 3) |
| Trang Supabase báo `redirect_uri` không hợp lệ | Redirect URI khai báo ở bước 2 không khớp **từng ký tự** với `…/functions/v1/provision-callback` |
| "Supabase từ chối quyền" | Thiếu scope ở bước 2, hoặc chủ quán chưa bấm Authorize |
| "Đã đủ số dự án miễn phí" | Tài khoản Supabase của chủ quán đã dùng hết dự án Free |
| Dừng ở "Đang dựng bảng dữ liệu" | Dự án vừa khởi động chưa nhận kết nối; app tự thử lại, chờ thêm 1–2 phút |
