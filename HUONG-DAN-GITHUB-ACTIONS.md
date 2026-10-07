# Build APK bằng GitHub Actions

GitHub dựng APK trên máy chủ của họ, bạn không cần cài Android Studio hay Java.
Gói miễn phí có 2.000 phút Actions mỗi tháng cho repo riêng tư; một lần build mất khoảng 8–15 phút.

> **Lưu ý trung thực:** workflow này chưa được chạy thử trên GitHub. Nếu lần đầu bị lỗi, xem mục
> *Xử lý lỗi* cuối tài liệu, hoặc gửi 30 dòng cuối của log cho người hỗ trợ.

## Chuẩn bị
- Tài khoản GitHub (miễn phí).
- Đã dựng xong **Supabase trung tâm** (chạy `supabase/central-setup.sql`) và có sẵn **Project URL** + khoá
  **anon/publishable** của dự án đó. Không dùng khoá `service_role`.
- Giải nén `android-app.zip`.

## Bước 1 — Tạo repo riêng tư
github.com → **New repository** → đặt tên (vd. `quan-ly-nha-hang`) → chọn **Private** → **Create repository**.
Để trống, không tick *Add README*.

## Bước 2 — Đưa mã nguồn lên
Dùng dòng lệnh (khuyên dùng, vì thư mục ẩn `.github` phải lên theo):
```bash
cd android-app
git init
git add .
git commit -m "Quản lý nhà hàng v4"
git branch -M main
git remote add origin https://github.com/TEN-CUA-BAN/quan-ly-nha-hang.git
git push -u origin main
```
Kiểm tra: trên trang repo phải thấy thư mục `.github/workflows/android.yml`. Nếu thiếu, bấm
**Add file → Create new file**, gõ tên `.github/workflows/android.yml` và dán nội dung tệp đó vào.

Lần push đầu sẽ tự chạy một bản build và **sẽ thất bại** vì chưa có Secrets — bình thường, làm bước 3 rồi chạy lại.

## Bước 3 — Khai báo địa chỉ Supabase trung tâm
Repo → **Settings → Secrets and variables → Actions**.

Tab **Secrets** → **New repository secret**, tạo hai mục (đúng từng chữ, phân biệt hoa/thường):

| Name | Value |
|---|---|
| `CENTRAL_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `CENTRAL_SUPABASE_ANON_KEY` | khoá anon/publishable của Supabase trung tâm |

Tab **Variables** → **New repository variable** (không bắt buộc):

| Name | Value |
|---|---|
| `SUPPORT_TEXT` | Hướng dẫn chuyển khoản gói cước hiện trong app, vd. *STK … ngân hàng …, nội dung: email chủ quán. Zalo hỗ trợ 09xx…* |

## Bước 3b — Đăng trang gọi món cho khách (GitHub Pages)
Trang khách quét QR gọi món là **một trang dùng chung cho mọi quán**, đăng **một lần duy nhất**. GitHub
Pages trên gói miễn phí **chỉ chạy được với repo Public** — nếu repo đang Private, cần đổi trước.

1. **Đổi repo sang Public** (bỏ qua nếu đã Public): Repo → **Settings** → cuộn xuống **Danger Zone** →
   **Change visibility** → **Change to public** → gõ lại tên repo để xác nhận. *(Lưu ý: toàn bộ mã nguồn app
   sẽ công khai cho ai cũng xem được — không phải chỉ trang gọi món. Khoá Supabase thật không nằm trong mã
   nguồn nên không bị lộ, nhưng cách code/kiến trúc thì ai cũng xem được.)*
2. Repo → **Settings → Pages** → mục **Build and deployment → Source** → chọn **GitHub Actions**.
3. Tab **Actions** → chọn workflow **"Đăng trang gọi món lên GitHub Pages"** (cột trái) → **Run workflow**.
4. Chạy xong (vài chục giây), vào lại **Settings → Pages** để lấy link vừa đăng — dạng
   `https://TEN-TAI-KHOAN.github.io/TEN-REPO/`.
5. Quay lại **Settings → Secrets and variables → Actions → Variables** → **New repository variable**:
   Name `GUEST_PAGE_URL`, Value là link ở bước 4 (**nhớ giữ dấu `/` ở cuối**).

## Bước 4 — Chạy build
Repo → tab **Actions** → chọn **Build APK Android** (cột trái) → **Run workflow** → **Run workflow**.
Bấm vào lần chạy vừa hiện ra để xem tiến độ; chờ tới khi có dấu tick xanh.

## Bước 5 — Tải APK
Kéo xuống cuối trang của lần chạy thành công, mục **Artifacts** → bấm **quan-ly-nha-hang-apk** để tải về
(một tệp zip, giải nén ra `app-debug.apk`). Tệp được GitHub giữ 90 ngày.

## Bước 6 — Cài lên điện thoại
1. Chuyển `app-debug.apk` sang điện thoại (Zalo, Drive, cáp USB).
2. Mở tệp → khi Android hỏi, cho phép **cài ứng dụng từ nguồn này**.
3. Nếu Google Play Protect cảnh báo "ứng dụng chưa được xác minh" → **Vẫn cài**. Đây là bản ký thử (debug),
   không phải bản phát hành lên Google Play.

## Cập nhật sau này
Sửa mã rồi `git add . && git commit -m "..." && git push` — GitHub tự build lại, tải APK mới ở mục Artifacts.
Cài đè lên bản cũ được, dữ liệu trên máy được giữ nguyên.

---

## Xử lý lỗi thường gặp
Mở lần chạy lỗi → bấm vào bước có dấu ✗ đỏ → đọc những dòng cuối.

| Dấu hiệu trong log | Nguyên nhân và cách xử lý |
|---|---|
| `Thiếu địa chỉ Supabase trung tâm` | Chưa tạo Secrets hoặc gõ sai tên. Kiểm tra bước 3, rồi **Re-run all jobs**. |
| `npm error ETARGET` / `No matching version` / `ERESOLVE` | Phiên bản plugin trong `package.json` (`^7`) không khớp thực tế. Chạy `npm view @capacitor-community/sqlite version` và `npm view @capacitor/core version`, sửa tất cả gói `@capacitor/*` và plugin về **cùng một số major**, commit lại. |
| `Could not find the web assets directory: ./www` | Bước *Build giao diện* đã lỗi trước đó; xem log bước đó. |
| `SDK location not found` hoặc `licenses have not been accepted` | Thêm trước bước *Biên dịch APK*: `- uses: android-actions/setup-android@v3` |
| `Unsupported class file major version` / lỗi Java | Phiên bản Java không khớp với Capacitor; đổi `java-version` trong workflow theo yêu cầu của bản Capacitor bạn dùng. |
| Bước Gradle lỗi `Duplicate class` hoặc `minSdkVersion` | Xung đột plugin; gửi log để xử lý, không đoán mò. |
| Build xanh nhưng không có Artifact | Bước upload lỗi đường dẫn; mở log bước *Biên dịch APK*, tìm dòng `BUILD SUCCESSFUL`. |
| Workflow "Đăng trang gọi món" báo lỗi quyền (403/404) | **Settings → Pages → Source** chưa chọn **GitHub Actions**, hoặc repo còn Private — xem lại Bước 3b. |
| Mã QR gọi món quét không mở được trang / hiện mã nguồn thô thay vì giao diện | Chưa làm Bước 3b, hoặc `GUEST_PAGE_URL` sai/thiếu dấu `/` cuối, hoặc APK đang cài là bản build **trước khi** thêm biến này — build lại APK sau khi đặt `GUEST_PAGE_URL`. |
| Cài được nhưng mở app bị trắng/đứng | Lỗi chạy trên máy thật (chưa được kiểm chứng). Bật *Tuỳ chọn nhà phát triển → Gỡ lỗi USB*, nối máy tính, chạy Chrome `chrome://inspect` để xem lỗi JavaScript, hoặc `adb logcat`. |

## Lên Google Play (chưa có sẵn)
Bản trên là **debug**. Để đưa lên Google Play cần: tạo khoá ký (keystore), lưu vào Secrets, đổi lệnh thành
`./gradlew bundleRelease` rồi ký tệp `.aab`, cộng với tài khoản nhà phát triển Google (phí một lần 25 USD) và
chính sách quyền riêng tư. Phần này chưa được viết — nói nếu cần.
