# Trả lời các mục khai báo trên Play Console

Đây là câu trả lời **gợi ý** dựa trên đúng những gì app đang làm (đã đối chiếu với mã nguồn). Giao diện Play Console thay đổi thường xuyên nên tên mục có thể lệch đôi chút; nếu câu hỏi nào khác với bên dưới, hãy chọn đáp án đúng với thực tế của app. Bạn là người chịu trách nhiệm cuối cùng với Google về các khai báo này — đọc lại kỹ trước khi gửi.

Đường dẫn: **Play Console → chọn app → Phát triển / Chạy → Nội dung ứng dụng (App content)**.

---

## 1. Chính sách bảo mật
URL: `https://tvtgroupsupport-arch.github.io/quan-ly-nha-hang/chinh-sach-bao-mat.html`
(Trang này được đăng tự động khi workflow "Đăng trang gọi món lên GitHub Pages" chạy — xem README.)

## 2. Quyền truy cập ứng dụng (App access) — QUAN TRỌNG
App cần đăng nhập nên Google bắt buộc đưa tài khoản dùng thử cho người duyệt.
Chọn: **"Một số hoặc tất cả chức năng bị hạn chế"** → thêm hướng dẫn:

```
Ứng dụng có HAI lớp đăng nhập:
1) Màn hình đầu tiên: chọn "Tôi là chủ quán" → "Đăng nhập".
   Email: <EMAIL TÀI KHOẢN DÙNG THỬ>   Mật khẩu lưu trữ: <MẬT KHẨU>
2) Sau đó nhập tài khoản đăng nhập vào app.
   Tên đăng nhập: <TÊN>   Mật khẩu đăng nhập app: <MẬT KHẨU>
Tài khoản dùng thử đã được liên kết sẵn kho dữ liệu mẫu (bàn, thực đơn, đơn hàng) nên mọi chức năng xem được ngay.
Không cần tạo tài khoản mới và không cần xác nhận email.
Gói đăng ký: dùng tài khoản thử nghiệm giấy phép (License testing) của Google để mua thử không mất tiền.
```
**Việc bạn cần làm trước khi gửi:** tạo sẵn một tài khoản riêng cho người duyệt trong app (đã đăng nhập được, đã liên kết kho, còn hạn dùng thử) và điền thông tin vào mẫu trên. **Đừng** để người duyệt tự đăng ký (email xác nhận sẽ làm họ bị kẹt và bị từ chối).
Nên bật gói còn hạn lâu: dùng trang quản trị (`admin/index.html`) → gia hạn cho tài khoản dùng thử vài tháng.

## 3. Quảng cáo (Ads)
**Không**, ứng dụng không chứa quảng cáo.

## 4. Phân loại nội dung (Content rating — IARC)
- Danh mục: **Tiện ích / Năng suất / Công cụ khác** (không phải trò chơi, không phải mạng xã hội).
- Trả lời **Không** cho: bạo lực, nội dung tình dục, ngôn từ thô tục, ma tuý, cờ bạc, nội dung do người dùng tạo chia sẻ công khai, chia sẻ vị trí, mua hàng kỹ thuật số **cho nội dung nhạy cảm**.
- "Ứng dụng có cho phép người dùng mua hàng không?" → **Có** (gói đăng ký).
- Kết quả dự kiến: **Mọi lứa tuổi / 3+** (đối với các xếp hạng khu vực khác nhau có thể khác nhau chút).

## 5. Đối tượng mục tiêu và nội dung
- Nhóm tuổi mục tiêu: **18 tuổi trở lên** (ứng dụng nghiệp vụ cho chủ quán/nhân viên).
- Ứng dụng **không** hướng tới trẻ em → không phải khai báo chương trình "Dành cho gia đình".

## 6. Ứng dụng tin tức / chính phủ / sức khoẻ
Đều trả lời **Không**.

## 7. An toàn dữ liệu (Data safety)
Gợi ý trả lời. Nguyên tắc của Google: "thu thập" = dữ liệu rời khỏi thiết bị tới máy chủ.

### Câu hỏi chung
| Câu hỏi | Trả lời |
|---|---|
| Ứng dụng có thu thập hoặc chia sẻ dữ liệu người dùng? | **Có** |
| Mọi dữ liệu có được mã hoá khi truyền? | **Có** (HTTPS) |
| Có cung cấp cách để người dùng yêu cầu xoá dữ liệu? | **Có** |
| Liên kết xoá tài khoản | `https://tvtgroupsupport-arch.github.io/quan-ly-nha-hang/xoa-tai-khoan.html` |
| Có thể xoá một phần dữ liệu mà không xoá tài khoản? | Có (chủ quán tự xoá dữ liệu trong Supabase riêng của quán) |
| Ứng dụng có tuân thủ chính sách Gia đình? | Không áp dụng |
| Ứng dụng có xác thực độc lập bởi bên thứ ba? | Không |

### Loại dữ liệu thu thập
| Nhóm | Loại | Thu thập? | Chia sẻ với bên thứ ba? | Bắt buộc hay tuỳ chọn | Mục đích |
|---|---|---|---|---|---|
| Thông tin cá nhân | **Địa chỉ email** | Có | Không | Bắt buộc | Chức năng ứng dụng, Quản lý tài khoản |
| Thông tin cá nhân | **Tên** (tên chủ quán/nhân viên, tên nhà hàng) | Có | Không | Bắt buộc | Chức năng ứng dụng, Quản lý tài khoản |
| Thông tin cá nhân | **Số điện thoại** (số quán và số khách đặt bàn, nếu nhập) | Có | Không | Tuỳ chọn | Chức năng ứng dụng |
| Thông tin cá nhân | **ID người dùng** (mã tài khoản, mã thiết bị nhân viên ẩn danh) | Có | Không | Bắt buộc | Chức năng ứng dụng, Quản lý tài khoản |
| Thông tin tài chính | **Lịch sử mua hàng** (gói đăng ký, mã giao dịch Google Play) | Có | Không | Bắt buộc | Chức năng ứng dụng |
| Ảnh và video | **Ảnh** (ảnh món ăn do quán tải lên) | Có | Không | Tuỳ chọn | Chức năng ứng dụng |
| Hoạt động trong ứng dụng | **Nội dung khác do người dùng tạo** (thực đơn, đơn hàng, ghi chú) | Có | Không | Bắt buộc | Chức năng ứng dụng |

### Loại dữ liệu **không** thu thập
Vị trí; danh bạ; tin nhắn; âm thanh/micro; tệp và tài liệu; lịch; nhật ký cuộc gọi; sức khoẻ và thể dục; lịch sử duyệt web; **thông tin thẻ/ngân hàng** (do Google Play xử lý); thông tin hiệu năng/chẩn đoán gửi đi; mã định danh thiết bị quảng cáo.

### Giải thích cho các lựa chọn khó
- **Chia sẻ = Không:** dữ liệu chỉ đi tới (a) máy chủ Supabase của nhà phát triển và (b) dự án Supabase riêng của chủ quán — đều là dịch vụ xử lý thay cho chủ quán/nhà phát triển, không phải "chia sẻ" theo định nghĩa của Google. Thanh toán do Google Play xử lý trực tiếp với người dùng.
- **Đơn hàng/ghi chú:** dù nằm trong kho Supabase do chủ quán sở hữu, vì chúng được gửi khỏi thiết bị nên khai là "thu thập" cho chắc chắn, kèm ghi chú trong chính sách bảo mật rằng nhà phát triển không truy cập được.
- **Phông chữ Google Fonts:** khi tải phông, Google nhận địa chỉ IP. Nếu Play Console hỏi về "dữ liệu nhật ký/IP gửi cho bên thứ ba", đây là điểm cần cân nhắc; cách gọn nhất là đóng gói phông vào app (xem mục "Việc nên làm thêm" trong README).

## 8. Tính năng tài chính (Financial features)
App **không** cung cấp dịch vụ tài chính (không cho vay, không giữ tiền, không chuyển tiền): chỉ hiển thị mã QR chuyển khoản do ngân hàng xử lý. Chọn **"Ứng dụng của tôi không có bất kỳ tính năng tài chính nào"** (hoặc tương đương). Nếu mục này hỏi về "thanh toán" thì mô tả: *"Ứng dụng tạo mã VietQR để khách chuyển khoản trực tiếp tới tài khoản ngân hàng của quán; ứng dụng không xử lý, không giữ và không nhận tiền."*

## 9. Khai báo quyền nhạy cảm
- **CAMERA:** chỉ để quét mã QR liên kết máy nhân viên; không lưu/gửi hình ảnh. (Đây là quyền runtime thông thường, không thuộc nhóm cần mẫu khai báo riêng.)
- Không dùng quyền SMS, cuộc gọi, vị trí, danh bạ, dịch vụ trợ năng, toàn bộ tệp.

## 10. Gói đăng ký (Subscriptions) — các điểm Google kiểm tra
- Giá, chu kỳ gia hạn và cách huỷ phải hiển thị rõ **trước khi** mua: màn *Gói cước* hiện giá lấy trực tiếp từ Google Play và có nút **Quản lý gói trên Google Play**. ✔
- Mô tả trên trang cửa hàng đã nêu: dùng thử 14 ngày, sau đó theo tháng/6 tháng/12 tháng, huỷ trong Google Play. ✔
- Gói cơ bản đặt **tự động gia hạn**, mã gói cơ bản `goi-1-thang`, `goi-6-thang`, `goi-12-thang` (khớp với mã trong app).
- Nên **không** tạo ưu đãi dùng thử miễn phí trong Play Console (app đã có 14 ngày dùng thử riêng).

## 11. Việc cần làm trước khi gửi duyệt (checklist nhanh)
- [ ] Đăng chính sách bảo mật + trang xoá tài khoản lên GitHub Pages và mở thử hai địa chỉ
- [ ] Sửa email liên hệ / tên nhà phát triển trong hai trang web nếu khác
- [ ] Tạo tài khoản dùng thử cho người duyệt (mục 2)
- [ ] Thêm tài khoản thử nghiệm giấy phép (License testers) để mua thử không mất tiền
- [ ] Tải biểu tượng, ảnh bìa, ≥ 2 ảnh chụp điện thoại
- [ ] Điền An toàn dữ liệu, Phân loại nội dung, Đối tượng mục tiêu, Quảng cáo
- [ ] Tải AAB đã ký lên, kiểm tra không còn lỗi nào ở bước "Xem trước và xác nhận"
