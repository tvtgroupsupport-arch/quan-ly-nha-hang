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
];
