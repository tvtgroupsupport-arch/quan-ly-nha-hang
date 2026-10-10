/* Bản dịch tiếng Anh — phần 4/4: trang gọi món của khách (guest-page.js) và thông báo lỗi từ máy chủ Supabase của quán (store-setup.sql). */
const I18N_EN_4 = [
  ['Đang tải thực đơn…', 'Loading the menu…'], ['🔔 Gọi nhân viên', '🔔 Call staff'],
  ['Mã QR không hợp lệ hoặc thiếu thông tin — quét lại mã QR dán tại bàn.', 'Invalid or incomplete QR code — please scan the QR code on your table again.'],
  ['Mã QR không hợp lệ — quét lại mã QR dán tại bàn.', 'Invalid QR code — please scan the QR code on your table again.'], ['Không tải được thực đơn', 'Could not load the menu'],
  ['Mã QR của bàn này đã khoá.', 'This table’s QR code is locked.'], ['Vui lòng gọi nhân viên để được hỗ trợ.', 'Please call a staff member for help.'], ['Đơn của tôi —', 'My order —'],
  ['Thực đơn hiện chưa có món nào.', 'The menu has no dishes yet.'], ['Tạm hết món', 'Temporarily sold out'], ['‹ Quay lại thực đơn', '‹ Back to the menu'], ['Đơn của tôi', 'My order'],
  ['món đã chọn', 'dishes selected'], ['Xem lại & gửi', 'Review & send'], ['Món đã chọn', 'Selected dishes'], ['Gửi món xuống bếp', 'Send to the kitchen'], ['Đang gửi…', 'Sending…'],
  ['Không gửi được, thử lại', 'Could not send, please try again'], ['Đã gửi', 'Sent'], ['món — đang chờ nhân viên xác nhận', 'dishes — waiting for staff confirmation'], ['✓ Đã báo nhân viên', '✓ Staff notified'],
  // lỗi từ máy chủ Supabase của quán (hàm SQL)
  ['Mã QR không hợp lệ', 'Invalid QR code'],
  ['Tài khoản ẩn danh không thể làm chủ quán', 'An anonymous account cannot be the owner'], ['Dự án Supabase này đã có chủ quán khác', 'This Supabase project already has another owner'], ['Chỉ chủ quán được tạo mã mời', 'Only the owner can create invitation codes'],
  ['Máy của chủ quán không cần liên kết như máy nhân viên', 'The owner’s device does not need to be linked like a staff device'], ['Mã không hợp lệ hoặc đã hết hạn', 'The code is invalid or has expired'],
  ['Chỉ chủ quán được thu hồi thiết bị', 'Only the owner can revoke devices'], ['Chỉ chủ quán được xoá thiết bị', 'Only the owner can delete devices'], ['Thiết bị chưa được liên kết hoặc đã bị thu hồi', 'The device is not linked or has been revoked'],
  ['Dữ liệu đồng bộ không hợp lệ', 'Invalid sync data'], ['Bản ghi thiếu trường bắt buộc', 'A record is missing a required field'], ['Loại dữ liệu không được hỗ trợ:', 'Unsupported data type:'], ['Bản ghi quá lớn', 'The record is too large'],
  ['Máy nhân viên không được xoá dữ liệu', 'Staff devices cannot delete data'], ['Máy nhân viên chỉ được đổi tình trạng còn/hết món', 'Staff devices can only change a dish’s in-stock / sold-out status'],
  ['Máy nhân viên chỉ được ghi lượt dùng khuyến mãi', 'Staff devices can only record promotion usage'], ['Chỉ máy chủ quán được thay đổi mục này', 'Only the owner’s device can change this item'],
  ['Mã QR không hợp lệ hoặc đã bị đổi', 'The QR code is invalid or has been changed'], ['Bàn này đã khoá mã QR — vui lòng gọi nhân viên', 'This table’s QR code is locked — please call a staff member'],
  ['Chỉ chủ quán được dọn dữ liệu', 'Only the owner can clear data'],
  // form thêm/sửa món, ảnh món
  ['Chọn ảnh', 'Choose photo'], ['Xoá ảnh', 'Remove photo'], ['Ảnh sẽ tự thu nhỏ để không chiếm nhiều bộ nhớ máy. Không chọn ảnh thì vẫn dùng biểu tượng', 'The photo is shrunk automatically so it does not use much device storage. Without a photo, the icon is used:'],
  ['Nút', 'The'], ['không mở được hộp thoại trên máy này? Dán liên kết ảnh vào đây thay thế:', 'button does not open a dialog on this device? Paste an image link here instead:'], ['Dùng ảnh này', 'Use this photo'],
  ['Tên món', 'Dish name'], ['vd. Bún bò Huế', 'e.g. Hue beef noodle soup'], ['Giá bán (đ)', 'Selling price (VND)'], ['Mô tả', 'Description'], ['Danh mục', 'Category'], ['Công thức (', 'Recipe ('], ['nguyên liệu)', 'ingredients)'],
  ['Xoá món khỏi thực đơn', 'Remove dish from the menu'], ['Cần link ảnh hợp lệ, kết thúc bằng .jpg .png .webp hoặc .gif', 'A valid image link ending in .jpg, .png, .webp or .gif is required'], ['Đã dùng ảnh từ liên kết', 'Using the photo from the link'],
  // cầu nối native
  ['Quét QR chỉ chạy trên ứng dụng Android — hãy dán mã vào ô bên dưới', 'QR scanning only works in the Android app — paste the code into the box below'], ['Cần cấp quyền camera để quét mã', 'Camera permission is needed to scan the code'],
  ['Lưu hoặc gửi tệp', 'Save or share file'], ['Chỉ mở được địa chỉ https', 'Only https addresses can be opened'], ['Âm báo', 'Alert sound'], ['(có rung)', '(with vibration)'], ['(không rung)', '(no vibration)'],
  ['Khách gọi nhân viên, món mới cho bếp', 'Guest calls, new dishes for the kitchen'], ['Đang chạy nền', 'Running in background'], ['Giữ app nhận thông báo khi ở chế độ nền', 'Keeps the app receiving notifications in the background'], ['Đang nhận thông báo khách gọi và món mới', 'Receiving guest calls and new dishes'],
  ['Thêm:', 'Add:'], ['Xoá:', 'Delete:'], ['Bật:', 'Turn on:'], ['Sửa:', 'Edit:'],
];
