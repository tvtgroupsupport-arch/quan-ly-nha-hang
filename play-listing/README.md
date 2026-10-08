# Bộ hồ sơ đưa app lên Google Play

Thư mục này gom mọi thứ cần có để điền Play Console. Làm theo thứ tự dưới đây.

## Các tệp trong thư mục
| Tệp / thư mục | Dùng để làm gì |
|---|---|
| `bai-dang-cua-hang.md` | Tên, mô tả ngắn/đầy đủ, "có gì mới" (tiếng Việt + Anh) và thông tin trang cửa hàng — dán vào Play Console |
| `khai-bao-play-console.md` | Câu trả lời gợi ý cho **An toàn dữ liệu**, Phân loại nội dung, Quyền truy cập, Quảng cáo, Tài chính, Gói đăng ký |
| `chinh-sach-bao-mat.html` | Chính sách bảo mật (bắt buộc có địa chỉ web công khai) |
| `xoa-tai-khoan.html` | Trang hướng dẫn xoá tài khoản (bắt buộc với app cho tạo tài khoản) |
| `bieu-tuong-512.png`, `bieu-tuong-1024.png` | Biểu tượng cho trang cửa hàng |
| `anh-bia-1024x500.png` | Ảnh bìa (Feature graphic) |
| `anh-chup-man-hinh/` | 6 ảnh chụp màn hình điện thoại (900×1800) dựng từ giao diện thật của app + dữ liệu mẫu |
| `tools/` | Công cụ để **làm lại** ảnh và biểu tượng khi giao diện đổi (xem mục cuối) |
| `../assets/icon-*.png` | Nguồn biểu tượng thật của app trên điện thoại; workflow tự sinh ra các kích thước (`@capacitor/assets`) |

## Địa chỉ web cần có (điền vào Play Console)
Sau khi đẩy mã lên GitHub, workflow **"Đăng trang gọi món lên GitHub Pages"** tự chạy (hoặc bấm *Run workflow* một lần) và đăng:
- Chính sách bảo mật: `https://tvtgroupsupport-arch.github.io/quan-ly-nha-hang/chinh-sach-bao-mat.html`
- Xoá tài khoản: `https://tvtgroupsupport-arch.github.io/quan-ly-nha-hang/xoa-tai-khoan.html`

Mở thử cả hai địa chỉ trên trình duyệt trước khi điền vào Play Console.

## Thứ tự làm
1. **Đăng hai trang web** (mục trên) và kiểm tra mở được.
2. **Tạo app** trên Play Console: tên, ngôn ngữ mặc định tiếng Việt, loại Ứng dụng, Miễn phí; package `vn.quanly.nhahang.play`.
3. **Trang cửa hàng:** dán chữ từ `bai-dang-cua-hang.md`, tải biểu tượng / ảnh bìa / ảnh chụp.
4. **Nội dung ứng dụng:** làm từng mục theo `khai-bao-play-console.md`.
5. **Gói đăng ký:** tạo 3 gói `goi_1_thang`, `goi_6_thang`, `goi_12_thang` với gói cơ bản tự gia hạn (xem `HUONG-DAN-GOOGLE-PLAY.md`).
6. **Tải AAB đã ký** (workflow *Build bản Google Play (AAB)*) lên Kiểm thử nội bộ, thử mua gói bằng tài khoản License tester.
7. Sau khi mọi thứ ổn, tạo **bản phát hành chính thức**.

## Lưu ý quan trọng về lịch phát hành
- Với **tài khoản nhà phát triển cá nhân tạo mới**, Google hiện yêu cầu chạy **kiểm thử kín với một số tester tối thiểu trong khoảng 14 ngày liên tục** trước khi được xin phát hành công khai (con số và điều kiện có thể thay đổi — xem mục *Kiểm thử và phát hành* trong Play Console để biết yêu cầu chính xác cho tài khoản của bạn). Tài khoản tổ chức thường không bị áp dụng. Hãy mời tester sớm.
- Sau khi xuất bản lần đầu, thời gian Google xét duyệt có thể từ vài giờ tới vài ngày.

## Việc nên làm thêm (không bắt buộc ngay)
- **Đóng gói phông chữ vào app** thay vì tải từ Google Fonts: giúp app chạy đẹp cả khi mất mạng và gọn phần khai báo dữ liệu.
- **Ảnh chụp máy tính bảng 7"/10"** nếu muốn app hiện tốt trên mục máy tính bảng của Play (tuỳ chọn).
- **Bản dịch tiếng Anh** của trang cửa hàng (đã có sẵn trong `bai-dang-cua-hang.md`).

## Làm lại ảnh / biểu tượng khi giao diện đổi
Cần Node 20+ và PowerShell (Windows):
```bash
# 1) Biểu tượng + ảnh bìa + ảnh nguồn biểu tượng Android (đọc ảnh chụp trong anh-chup-man-hinh/)
powershell -File play-listing/tools/make-graphics.ps1

# 2) Dựng lại HTML các màn hình bằng dữ liệu mẫu (rồi chụp ở khổ 450×900 để ra ảnh 900×1800)
node play-listing/tools/make-screens.mjs
```
Bước 2 ghi các trang HTML vào `play-listing/tools/_shots/` (thư mục tạm, không cần giữ); mở từng trang ở khung trình duyệt 450×900 và chụp lại.
