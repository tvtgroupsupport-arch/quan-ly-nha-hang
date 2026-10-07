# Quản Lý Nhà Hàng — app Android (v4.0)

Lưu dữ liệu **cục bộ trên điện thoại** (SQLite), khi có mạng **tự đồng bộ** lên Supabase **riêng của quán**
để chia sẻ với các máy khác. Gói cước do **một Supabase trung tâm của bạn** quản lý.

```
┌──────────────────────┐        ┌──────────────────────────┐
│  Supabase TRUNG TÂM  │        │  Supabase CỦA TỪNG QUÁN  │
│  (của bạn)           │        │  (chủ quán tự tạo)       │
│  • tài khoản chủ quán│        │  • toàn bộ dữ liệu bán   │
│  • gói cước, gia hạn │        │    hàng (bảng `records`) │
│  • địa chỉ Supabase  │        │  • máy nhân viên, mã mời │
│    của từng quán     │        │  Bạn KHÔNG truy cập được │
└──────────▲───────────┘        └───────────▲──────────────┘
           │ chỉ máy chủ quán               │ máy chủ quán: toàn quyền
           │                                │ máy nhân viên: chỉ vận hành
      ┌────┴────────────────────────────────┴────┐
      │  App Android — SQLite cục bộ, chạy offline │
      └──────────────────────────────────────────┘
```

## Phần bạn làm một lần

### 1. Dựng Supabase trung tâm
1. Tạo dự án Supabase của bạn → **SQL Editor** → dán toàn bộ `supabase/central-setup.sql` → Run.
2. Số ngày dùng thử tài khoản mới: sửa `trial_days` trong script (đặt `0` để tắt).
3. Mở `admin/index.html` bằng trình duyệt → điền **Project URL** + **khoá anon** (xem bước 4 bên dưới
   để biết lấy ở đâu) → bấm **"Chưa có tài khoản? Tạo mới"** → điền email + mật khẩu của bạn → **Tạo tài
   khoản**. Trang tự hiện sẵn đúng dòng SQL cần chạy — copy, dán vào SQL Editor của Supabase trung tâm,
   Run (hoặc gõ tay nếu quên, nhớ thay đúng email):
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'email-cua-ban@example.com';
   ```
   Chạy xong quay lại `admin/index.html`, bấm **"Đã có tài khoản? Đăng nhập"**, đăng nhập lại — vào được
   trang quản trị là xong.
4. Chép **Project URL** và khoá **anon** (dự án mới gọi là **Publishable key**) — KHÔNG phải khoá
   `service_role`/**Secret key** (khoá toàn quyền, chỉ dùng cho mục 5 bên dưới, không đưa vào app).

### 2. Cấu hình app
```bash
cp app.config.example.json app.config.json
# điền centralUrl, centralAnonKey, supportText (hướng dẫn chuyển khoản gói cước hiện trong app)
```

### 3. Build APK (chọn một cách)
Cần Node 20+, Java 21 và Android SDK — hoặc dùng cách (a) để không phải cài gì.

**a) GitHub Actions** — xem hướng dẫn từng bước và bảng xử lý lỗi trong `HUONG-DAN-GITHUB-ACTIONS.md`.
Tóm tắt: đẩy thư mục này lên repo riêng tư → Settings → Secrets: `CENTRAL_SUPABASE_URL`, `CENTRAL_SUPABASE_ANON_KEY`
(biến tuỳ chọn `SUPPORT_TEXT`) → Actions → *Build APK Android* → Run workflow → tải `app-debug.apk` ở mục Artifacts.

**b) Máy có Android Studio / Claude Code:**
```bash
npm install
npx cap add android      # lần đầu
npm run apk              # build giao diện → cap sync → vá Manifest → gradlew assembleDebug
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
Đưa lên Google Play cần thêm khoá ký (keystore) và build `bundleRelease` — chưa làm sẵn trong dự án này.

### 4. Trang duyệt gia hạn
Mở `admin/index.html` bằng trình duyệt (chỉ cần tệp, không cần máy chủ), đăng nhập tài khoản admin.
Khi chủ quán gửi yêu cầu gia hạn và bạn đã nhận tiền → **Duyệt**. Hạn mới = hạn cũ (hoặc hôm nay nếu đã hết) + số tháng.

### 5. Giữ Supabase không bị tạm ngừng (gói miễn phí tự tạm ngừng sau 7 ngày không hoạt động)
Workflow `.github/workflows/keepalive.yml` tự chạy mỗi 3 ngày, "đánh thức" Supabase trung tâm **và mọi quán
đã liên kết** (tự đọc danh sách từ bảng `store_links`, không cần biết trước có bao nhiêu quán). Chỉ cần làm
một lần: GitHub → **Settings → Secrets and variables → Actions → Secrets** → thêm `CENTRAL_SUPABASE_SERVICE_ROLE_KEY`
(lấy ở Supabase trung tâm → Settings → API — Supabase đang đổi tên khoá: dự án mới chỉ còn mục
**"Secret keys"** (dạng `sb_secret_...`), dự án cũ hơn có thể vẫn hiện `service_role` (dạng JWT dài,
bắt đầu `eyJ...`) — **dùng khoá nào có sẵn trong mục đó cũng được**, script tự nhận diện đúng cách gửi
cho từng kiểu. **Giữ kín, tuyệt đối không đưa vào app** — khoá này có toàn quyền trên CSDL, bỏ qua mọi
RLS). Muốn chạy thử ngay: tab Actions → *"Đánh thức Supabase..."* → Run workflow.

### 6. Dọn dữ liệu cũ tự động (tránh CSDL 500MB đầy dần)
Không cần làm gì — mỗi quán tự dọn (hàm `cleanup_old_data`, chạy ngay trong lúc máy chủ quán đồng bộ bình
thường, tối đa 1 lần/ngày): xoá đơn **đã thanh toán xong** quá cũ (mặc định giữ 24 tháng, không bao giờ đụng
đơn còn đang mở), dọn "bia mộ" (bản ghi đã xoá) quá 30 ngày, nhật ký hoạt động quá 6 tháng, lịch sử kho quá
12 tháng. Quán nào đã liên kết Supabase **từ trước khi có tính năng này** cần chạy lại script SQL mới nhất
(xem mục 2 — chạy lại không mất dữ liệu cũ) để có đủ hàm này.

## Hướng dẫn cho chủ quán (app tự dẫn từng bước)
1. Mở app → **Tôi là chủ quán** → tạo tài khoản (email + mật khẩu) → đặt tên quán và **mật khẩu đăng nhập app**
   (khác mật khẩu tài khoản).
2. **Liên kết Supabase** (làm được sau, dùng một máy trước cũng được):
   tạo dự án Supabase miễn phí → *Authentication → Sign In / Providers*: bật **Allow anonymous sign-ins**, tắt
   **Confirm email** → nút **Sao chép script SQL** trong app → dán vào SQL Editor → Run → chép Project URL và
   khoá anon dán vào app.
3. **Quản lý → Đồng bộ & thiết bị → Thêm thiết bị nhân viên** → máy nhân viên chọn **Đây là máy nhân viên** và
   quét mã QR (hết hạn sau 5 phút, dùng một lần). Thu hồi từng máy ngay trong màn này.
4. **Mã QR cho khách gọi món** — không cần làm gì thêm. Trang gọi món là **một trang dùng chung cho mọi
   quán**, do nhà cung cấp phần mềm đăng sẵn một lần (xem mục dành cho nhà cung cấp bên dưới) — ngay khi
   bước 2 xong (đã liên kết Supabase), vào **Quản lý → Mã QR gọi món → In tem mã QR theo từng ghế** là dùng
   được luôn. Đổi món/giá không cần làm lại gì — trang tự lấy thực đơn mới nhất mỗi lần khách mở. Nghi mã bị
   lộ: dùng **Đổi mã QR mới** cho đúng ghế đó, in lại tem.

### Dành cho nhà cung cấp phần mềm (chỉ làm một lần, không phải việc của từng quán)
Trang gọi món (`src/cloud/guest-page.js`) là **một trang tĩnh, dùng chung cho mọi quán** — không chứa thông
tin riêng của quán nào, nên chỉ cần đăng **một lần duy nhất** lên GitHub Pages của chính repo này.

**Lưu ý quan trọng:** GitHub Pages trên gói miễn phí **chỉ chạy được với repo Public** — không chạy được với
repo Private. Việc chuyển sang Public nghĩa là **toàn bộ mã nguồn app** (không chỉ trang gọi món) sẽ công khai
cho bất kỳ ai xem được trên GitHub. Khoá Supabase thật không nằm trong mã nguồn (nằm trong GitHub Secrets),
nên việc công khai code không làm lộ bí mật nào — nhưng cách làm/kiến trúc app sẽ ai cũng xem được.

1. **Đổi repo sang Public** (nếu đang Private): repo trên GitHub → **Settings** → cuộn xuống cuối tới mục
   **Danger Zone** → **Change visibility** → **Change to public** → gõ lại tên repo để xác nhận.
2. **Settings → Pages** → mục **Build and deployment → Source**, chọn **GitHub Actions**
   (không chọn "Deploy from a branch").
3. Vào tab **Actions** → chọn workflow **"Đăng trang gọi món lên GitHub Pages"** → **Run workflow**.
4. Chạy xong, link trang hiện ở đúng ngay trang Settings → Pages đó (dạng
   `https://TEN-TAI-KHOAN.github.io/TEN-REPO/`).
5. Vào **Settings → Secrets and variables → Actions → Variables** → **New repository variable**: tên
   `GUEST_PAGE_URL`, giá trị là link ở bước 4 (nhớ có dấu `/` ở cuối).
6. Build lại APK (Actions → *Build APK Android* → Run workflow) để địa chỉ này được "nướng" vào app.
Từ sau bước này, **tất cả các quán dùng chung một APK** đều tự động có mã QR gọi món hoạt động — không
quán nào phải tự đăng gì cả. Sửa giao diện trang gọi món sau này chỉ cần sửa file nguồn rồi đẩy code lên,
workflow tự đăng lại — mọi quán nhận bản mới cùng lúc.

## Quyền hạn
| | Máy chủ quán | Máy nhân viên |
|---|---|---|
| Gọi món, bếp, thanh toán, kho, đặt bàn | ✓ | ✓ |
| Đổi tình trạng còn/hết món | ✓ | ✓ |
| Sửa thực đơn, giá, bàn, khuyến mãi, cài đặt | ✓ | ✗ |
| Tạo/sửa nhân viên và quyền | ✓ | ✗ |
| **Xoá** bất kỳ dữ liệu nào | ✓ | ✗ |
| Mời/thu hồi thiết bị, gói cước | ✓ | ✗ |

Chặn nằm trong Postgres (`push_records`, không có quyền ghi trực tiếp vào bảng) nên sửa mã app cũng không vượt qua.
Máy nhân viên vẫn **huỷ được món trong đơn** (đặt trạng thái `cancelled`, không xoá bản ghi) vì đó là thao tác vận hành.

## Cách đồng bộ xử lý xung đột
- Mỗi bản ghi mang mốc `updated_at`; bản mới hơn thắng. Chủ quán xoá → bản ghi thành "bia mộ" lan sang các máy.
- **Kho**: không đồng bộ số tồn trực tiếp; đồng bộ tồn đầu + các phiếu nhập/xuất, tồn = tồn đầu + tổng phiếu → hai máy
  cùng trừ kho không đè nhau.
- **Thanh toán**: máy chủ chỉ cho một thanh toán "paid" cho mỗi đơn. Máy đến sau được đánh dấu *trùng*, không cộng
  doanh thu, kèm cảnh báo kiểm tra tiền mặt.
- **Ghép/tách bàn** đồng thời trên hai máy offline: bản ghi sau cùng thắng, nhân viên sửa tay nếu cần.
- Đồng hồ hai máy lệch nhau nhiều có thể làm "bản mới hơn" bị chọn sai; nên để điện thoại tự cập nhật giờ.

## Kiểm thử
```bash
npm test      # 181 kiểm tra: nghiệp vụ, SQLite, đồng bộ nhiều máy, quyền, thanh toán trùng, thu hồi, gói cước, QR,
              # và toàn bộ luồng khách quét QR gọi món (xem/khoá/gọi nhân viên/gọi món/xác nhận/từ chối/đổi mã)
```

## Giới hạn đã biết — đọc trước khi dùng thật
- **Script SQL chưa được chạy trên Postgres thật** khi viết (môi trường phát triển không có Postgres). Bộ kiểm thử
  dùng Supabase giả viết theo đúng luật của script, nên chứng minh phía app chứ không chứng minh SQL. Hãy chạy thử trên
  hai dự án Supabase trống trước và kiểm tra: ghi bằng máy nhân viên bị chặn, thanh toán trùng bị từ chối, **khách
  quét QR gọi món được mà không cần đăng nhập gì cả**.
- **Trang gọi món cho khách** (`guest-page.js`) chưa mở thử trên trình duyệt điện thoại thật hay quét QR bằng camera
  thật — chỉ mới kiểm chứng được bằng mô phỏng. Trước khi in tem hàng loạt, hãy tự quét thử 1 mã, gọi 1 món,
  xác nhận bếp thấy đúng. (Lưu ý: bản đầu tiên của tính năng này định để mỗi quán tự đăng trang lên Supabase
  Storage của mình — phát hiện Supabase **cố tình** không phục vụ file `.html` như trang web thật (luôn trả về
  dạng văn bản thô, vì lý do bảo mật của chính Supabase), nên đã đổi sang cách trang dùng chung qua GitHub Pages
  như mô tả ở mục "Dành cho nhà cung cấp phần mềm" bên trên.)
- **Chưa build APK thật**: phiên bản plugin Capacitor (`^7`, riêng `@capacitor-community/screen-brightness` là `^8`) chưa
  kiểm chứng với npm; nếu `npm install` báo lệch, đồng bộ các gói `@capacitor/*` và plugin về cùng một major. Cách gọi
  plugin SQLite, quét QR (ML Kit), Filesystem/Share, và **tăng độ sáng màn hình lúc phóng to mã QR thanh toán** chưa
  chạy trên máy thật — nếu máy nào chặn quyền chỉnh độ sáng, mã QR vẫn phóng to được, chỉ là không sáng hơn.
- **Khoá gói cước chỉ là rào cản cơ bản**: mã nguồn nằm trên máy khách, người rành kỹ thuật vẫn gỡ được đoạn kiểm tra.
  Hết hạn → khoá mềm (vẫn xem/xuất báo cáo, vào được màn gia hạn). Có chống chỉnh lùi đồng hồ (nhớ mốc thời gian lớn nhất).
- Giao diện vẫn nạp phông chữ từ Google Fonts khi có mạng; offline dùng phông hệ thống (chức năng không ảnh hưởng).
- Ảnh món giờ tải thẳng lên Supabase Storage (bucket `menu-images`, tạo tự động khi chạy script SQL) thay vì
  nhúng base64 vào dữ liệu — giảm hẳn dung lượng CSDL và băng thông. Quán liên kết **từ trước khi có tính
  năng này** cần chạy lại script SQL mới (mục 2) để có bucket; chưa chạy lại thì ảnh vẫn lưu tạm kiểu cũ
  (base64), không có gì bị hỏng, chỉ là chưa tối ưu. Ảnh món **cũ** (đã lưu base64 từ trước) vẫn hiển thị
  bình thường, không tự chuyển sang Storage — chỉ ảnh **mới chọn sau khi chạy lại SQL** mới dùng Storage.
- Mật khẩu app (băm PBKDF2) được đồng bộ xuống mọi máy để đăng nhập offline; mật khẩu yếu có thể bị dò nếu máy
  nhân viên bị chiếm — dùng mật khẩu đủ mạnh cho tài khoản chủ quán.
