# BEPO – Quản lý nhà hàng · Báo cáo kiểm thử MVP

Ngày lập: 2026-11-01 · Phạm vi: mã nguồn trên nhánh `main` (commit mới nhất tại thời điểm lập báo cáo) · Người lập: Claude (kiểm thử tự động + đọc mã)

> **Giới hạn quan trọng:** toàn bộ kiểm thử dưới đây chạy **tự động trên máy tính** với Supabase giả, SQLite thật của Node và đồng hồ giả. Chưa có lần chạy nào trên điện thoại Android thật, Google Play thật hay Postgres thật. Những mục này được ghi rõ ở phần "Chưa kiểm chứng".

## 1. Kết luận ngắn

| Hạng mục | Đánh giá |
|---|---|
| Nghiệp vụ lõi (bàn → gọi món → bếp → thu tiền → báo cáo) | **Đạt** trong kiểm thử tự động, không phát hiện sai số tiền, sai ngày, mất dữ liệu trong điều kiện bình thường |
| Độ chính xác báo cáo theo thời gian | **Đạt** (khớp phép tính độc lập ở mọi bộ lọc, biên 0h / 23:59:59.999, 5 múi giờ) |
| Đồng bộ nhiều máy | **Đạt có điều kiện**: dữ liệu hội tụ giống nhau; còn lỗi nghiệp vụ "2 đơn mở cùng ghế" khi hai máy cùng gọi món lúc offline |
| An toàn dữ liệu nhập (XSS, tiền, khuyến mãi biên) | **Đạt** |
| Gói cước / dùng thử / thanh toán Google Play | **Chưa kiểm chứng thật** – phụ thuộc cấu hình Play Console và bản AAB mới |
| **Khuyến nghị** | **Có thể tiếp tục thử nghiệm kín (closed testing). Chưa nên phát hành công khai** cho tới khi xử lý các mục "Chặn phát hành" ở mục 5 |

## 2. Đã chạy những gì

| Bộ kiểm thử | Lệnh | Kết quả |
|---|---|---|
| Chính (87 nhóm: bảo mật, đồng bộ, gói cước, kho, báo cáo, i18n, combo…) | `node --experimental-sqlite --no-warnings test/run-tests.mjs` | **1111 đạt · 0 lỗi** |
| Khách quét QR | `test/run-tests-guest.mjs` | **76 đạt · 0 lỗi** |
| Thời gian & đầy đủ dữ liệu báo cáo (1 năm ≈ 2.650 hoá đơn) | `npm run test:time` (5 múi giờ) | Việt Nam, Hàn Quốc, UTC, Sydney: **145/145**; Los Angeles: 142/145 (lỗi giờ mùa hè, xem mục 4) |
| Thăm dò tìm lỗi (mới) | `npm run test:explore` | **45 đạt · 0 lỗi · 4 ghi nhận** |

Bộ thăm dò mới (`test/run-tests-explore.mjs`) gồm:
- **E1** vẽ 45 màn hình × 5 trạng thái (chủ quán, nhân viên, tiếng Anh, quán trống, đơn rất lớn): không lỗi, không chữ rác `undefined / NaN / [object Object]`.
- **E2** chèn dữ liệu độc (`<img onerror>`, `<script>`, `" onmouseover=`…) vào tên món, danh mục, khu bếp, bàn, combo, khuyến mãi, nhân viên, khách đặt bàn, ghi chú, tên quán: không chuỗi nào chạy được trên giao diện.
- **E3** tiền & khuyến mãi biên: giảm 100%, giảm cố định lớn hơn tạm tính, giảm > 100% bị từ chối, giới hạn lượt, đơn tối thiểu, **bấm thu tiền hai lần đồng thời chỉ ghi một thanh toán**, tổng tiền số lẻ đúng tuyệt đối.
- **E4** hai máy thao tác offline rồi đồng bộ: không mất món, không tính doanh thu hai lần khi cùng thu tiền (phát hiện lỗi mục 4.1).
- **E5** tắt app ngay sau thao tác (phát hiện mục 4.2).
- **E6** 400 thao tác ngẫu nhiên trên hai máy (có lúc offline): bất biến dữ liệu đúng, hai máy hội tụ giống hệt nhau, doanh thu khớp.
- **E7** khách quét QR gửi dữ liệu xấu (rỗng, quá 40 dòng, số lượng 0/âm/1e9/lẻ/chữ, món không tồn tại, giá giả, ghi chú độc).
- **E8** hiệu năng với quán lớn (300 bàn, 800 món, 5.000 đơn): tải bản chụp 51 ms; mọi màn hình chính dưới 400 ms.

## 3. Trạng thái các tính năng MVP

| Tính năng | Kiểm tự động | Kiểm trên máy thật |
|---|:-:|:-:|
| Tạo quán, tài khoản, đăng nhập app, phân quyền nhân viên | ✔ | ✘ |
| Bàn, ghế, mã QR từng ghế, xem / đổi mã QR | ✔ | ✘ |
| Thực đơn, danh mục, khu bếp, công thức trừ kho | ✔ | ✘ |
| **Combo món** (mới): tạo, gọi cho bàn, tách theo khu bếp, trừ kho, đồng bộ | ✔ | ✘ |
| Gọi món (nhân viên), bếp (làm → xong → phục vụ), thu tiền (tiền mặt, chuyển khoản, VietQR) | ✔ | ✘ |
| Khách gọi món bằng QR (cần liên kết Supabase của quán) | ✔ (hàm giả lập) | ✘ |
| Khuyến mãi, đặt bàn, ghép / tách đơn, chuyển ghế | ✔ | ✘ |
| Kho nguyên liệu, nhật ký thao tác (trước/sau), báo cáo, xuất Excel, lưu / mở báo cáo | ✔ | ✘ |
| Đồng bộ nhiều máy, thu hồi máy, khôi phục khi đổi máy | ✔ | ✘ |
| Gói cước: hết hạn **chỉ khoá gọi món** (nhân viên + khách QR) | ✔ | ✘ |
| Mã quyền sử dụng ký Ed25519, ân hạn 3 ngày, server hỏi lại Google | ✔ (logic) | ✘ (hàm server chưa gọi thử bằng người dùng thật) |
| Dùng thử: server 30 ngày + chống lấy lại bằng Android ID | ✔ | ✘ |
| Mua gói Google Play, ưu đãi dùng thử | ✘ | ✘ (ưu đãi đang **tắt** trên Play Console) |
| Máy in Bluetooth, quét camera QR, thông báo, dịch vụ nền | ✘ | ✘ |
| Tiếng Việt / tiếng Anh | ✔ | ✘ |

## 4. Phát hiện (xếp theo mức độ)

### 4.1 [Trung bình] Hai máy cùng gọi món một ghế khi offline tạo 2 đơn mở cho cùng ghế
- **Bằng chứng:** E4, E6. Máy A và máy B cùng mất mạng, cùng gọi món cho Bàn 01 – Ghế 1; sau đồng bộ có hai đơn mở (`#1001` và `#1001-XX`). Khi thử 400 thao tác ngẫu nhiên, 3 ghế bị trùng như vậy.
- **Ảnh hưởng:** **không mất món, không mất tiền** (cả hai đơn đều hiện ở màn Thu ngân của bàn và đều thu được; đã kiểm tra). Nhưng khách bị ra hai hoá đơn, nhân viên dễ nhầm.
- **Khuyến nghị:** khi đồng bộ phát hiện hai đơn mở cùng ghế thì tự gộp vào đơn cũ hơn (giữ nguyên các dòng món), hoặc nhắc nhân viên "Ghép đơn".

### 4.2 [Trung bình] Cửa sổ mất dữ liệu 250 ms
- **Bằng chứng:** E5. Ghi xuống SQLite được điều tiết 250 ms và **không có ghi khi app chuyển nền**. Nếu hệ điều hành tắt tiến trình trong 250 ms sau lúc gửi món / thu tiền, thao tác đó mất.
- **Khuyến nghị:** ghi ngay (flush) khi app chuyển nền / mất tiêu điểm và ngay sau thao tác thu tiền, gửi món. Sửa nhỏ, có thể kiểm thử bằng test E5.

### 4.3 [Trung bình] Lệch giờ máy làm doanh thu rơi sang ngày khác
- **Bằng chứng:** bộ test thời gian (T6). App dùng đồng hồ máy để ghi mốc thời gian; thử máy nhân viên lệch +30 giờ thì hoá đơn ghi sang ngày khác.
- **Khuyến nghị:** so giờ máy với giờ máy chủ lúc đồng bộ; cảnh báo khi lệch quá ngưỡng (ví dụ 5 phút) hoặc dùng giờ máy chủ để ghi mốc.

### 4.4 [Thấp – Trung bình] Khách quét QR có thể gửi đơn dồn dập
- **Bằng chứng:** E7. 60 đơn liên tiếp đều được nhận. Hàm `guest_order` không giới hạn tần suất; số lượng lẻ bị máy chủ kẹp về 1–50 (đúng thiết kế).
- **Khuyến nghị:** giới hạn theo ghế (ví dụ tối đa N lần / phút) hoặc bật "Xác nhận đơn đầu tiên" cho mọi quán mới.

### 4.5 [Thấp] Quy ước doanh thu theo ngày thu tiền, món bán chạy theo ngày gọi món
- Đơn gọi trước 0h, thu sau 0h nằm ở hai ngày khác nhau trong các báo cáo. Đúng thiết kế nhưng cần ghi vào hướng dẫn đối chiếu sổ.

### 4.6 [Thấp] Giờ mùa hè (không ảnh hưởng Việt Nam, Hàn Quốc)
- Bộ lọc "30 ngày" tính một ngày bằng 24 giờ nên lệch 1 giờ khi cửa sổ vắt qua ngày đổi giờ (thử ở Los Angeles). Sửa bằng cách tính mốc theo lịch.

### 4.7 [Thấp] Xuất CSV dự phòng không chặn công thức
- Đọc mã `src/web/reports.js`: `csvCell` không thêm tiền tố an toàn cho ô bắt đầu bằng `= + - @`. Chỉ dùng khi dựng Excel lỗi; Excel thật (ExcelJS) ghi chuỗi, không bị ảnh hưởng. **Chưa kiểm thử trực tiếp.**

### 4.8 Đã sửa trong đợt này
- Lỗi đồng bộ lặp "Hết thời gian chờ máy chủ" với kho lớn (lưu vị trí kéo sau mỗi lô, giới hạn thời gian theo tiến triển).
- Gói hết hạn không còn khoá cả app, chỉ khoá gọi món.
- Plugin SQLite / mạng treo không còn làm treo cả lượt đồng bộ.

## 5. Chặn phát hành công khai (cần làm trước)

1. **Build và cài AAB mới** (workflow "Build bản Google Play (AAB)") rồi chạy kiểm thử thủ công trên điện thoại thật: bản vá plugin `@capgo/native-purchases` (Java) chưa từng được biên dịch thật.
2. **Bật ưu đãi dùng thử `free-trial`** của gói 1 tháng trên Play Console (đang "Không hoạt động") rồi thử mua bằng tài khoản License tester mới.
3. **Chạy lại `supabase/store-setup.sql`** (phiên bản 4) trên kho Supabase của mọi quán đã tạo (combo, chặn QR khi hết hạn).
4. **Gọi thử `license-token` / `verify-purchase` bằng người dùng thật**: hai hàm đã triển khai nhưng chưa có lần gọi thật nào.
5. Xử lý **4.1** và **4.2** (sửa nhỏ, có test).

## 6. Chưa kiểm chứng (rủi ro còn lại)

- Chạy trên Android thật (quyền camera, thông báo, dịch vụ nền Android 15, giới hạn 5,5 giờ, in Bluetooth).
- Google Play Billing thật, RTDN, xác nhận giao dịch trong 3 ngày.
- Postgres thật cho các hàm SQL của kho (`guest_order`, `push_records`…): tests dùng bản mô phỏng bằng JavaScript.
- Hiệu năng trên điện thoại cấu hình thấp; lần đồng bộ đầu với kho hàng chục nghìn bản ghi mất vài phút.
- Thiết kế quan hệ giữa khách quét QR và việc quán chưa liên kết Supabase (khi đó QR không chạy).

## 7. Việc nên làm tiếp (đề xuất thứ tự)

1. Sửa 4.2 (flush khi chuyển nền) và 4.1 (gộp đơn cùng ghế) – ước tính nhỏ.
2. Build AAB, kiểm thử thủ công theo danh sách ở mục 3 cột "máy thật" trên ít nhất 2 điện thoại (một chủ quán, một nhân viên).
3. Bật ưu đãi dùng thử, mua thử, kiểm tra hết hạn chỉ khoá gọi món.
4. Sửa 4.3 (cảnh báo lệch giờ), 4.4 (giới hạn khách), 4.6 (giờ mùa hè) nếu có kế hoạch ra ngoài Việt Nam.
5. Sau đó mới nộp đăng ký phát hành công khai.
