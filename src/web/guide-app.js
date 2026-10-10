/* ============================================================
   HƯỚNG DẪN SỬ DỤNG APP — một trang trong app (Quản lý → Hướng dẫn sử dụng), trình bày giống phần "Hướng dẫn liên kết Supabase":
   các bước đánh số, ảnh chụp màn hình THẬT của app kèm khung đỏ chỉ chỗ cần bấm, hộp lưu ý, mục "Gặp lỗi?" bấm để mở.
   Ảnh nằm trong gói app (www/guide/app-*.jpg, nguồn src/assets/guide/) nên xem được cả khi mất mạng.
   Nội dung có SONG NGỮ ngay trong file (Tiếng Việt / English) chọn theo ngôn ngữ đang dùng của app — nên file này không đi qua bảng dịch
   (xem scripts/extract-vi.mjs) và vùng nội dung gắn data-notr để bộ dịch tự động không đụng vào.
   Toạ độ khung đỏ tính theo ảnh gốc 900x1800 (đổi sang % nên đúng ở mọi cỡ màn hình).
   ============================================================ */
const GA_IW = 900, GA_IH = 1800;
const GA = (vi, en) => (typeof getLang === 'function' && getLang() === 'en' ? en : vi);

/** Dải ảnh vuốt ngang: mỗi ảnh có khung đỏ + chú thích. figs: [{ img, cap:[vi,en], marks:[{x,y,w,h,label:[vi,en],below}] }] */
function gaGallery(figs) {
  const pct = (v, total) => (v / total * 100).toFixed(2);
  return `<div class="gd-gallery">${figs.map(f => {
    const cap = GA(f.cap[0], f.cap[1]);
    return `<figure class="gd-fig"><div class="gd-pic">
      <img src="guide/${f.img}" alt="${cap.replace(/<[^>]+>/g, '')}" loading="lazy">${(f.marks || []).map(m =>
        `<span class="gd-mark${m.below ? ' below' : ''}" style="left:${pct(m.x, GA_IW)}%;top:${pct(m.y, GA_IH)}%;width:${pct(m.w, GA_IW)}%;height:${pct(m.h, GA_IH)}%">${m.label ? `<i>${GA(m.label[0], m.label[1])}</i>` : ''}</span>`).join('')}
    </div><figcaption>${cap}</figcaption></figure>`;
  }).join('')}</div>`;
}

function gaStep(n, title, body, figs, note) {
  return `<div class="card gd-step">
    <div class="gd-step-head"><div class="gd-num">${n}</div><div><div class="t-md">${title}</div>${note ? `<div class="t-xs">${note}</div>` : ''}</div></div>
    ${body}${figs ? gaGallery(figs) : ''}
  </div>`;
}
/** Nút mở thẳng màn hình liên quan — chỉ hiện khi tài khoản đang đăng nhập có quyền vào màn đó */
function gaOpen(route, perm, labelVi, labelEn) {
  if (perm && !can(perm)) return '';
  return `<button class="btn ghost sm" data-go="${route}" style="margin-top:6px;margin-right:6px;width:auto">${GA(labelVi, labelEn)} ›</button>`;
}
const gaDet = (titleVi, titleEn, vi, en) => `<details class="card gd-det"><summary>${GA(titleVi, titleEn)}</summary><div class="t-sm" style="line-height:1.6;margin-top:8px">${GA(vi, en)}</div></details>`;

const GA_FIGS = {
  home: [
    { img: 'app-06-quan-ly.jpg', cap: ['Màn <b>Quản lý</b>: mọi chức năng nằm ở đây. Chạm vào ô để mở.', 'The <b>Manage</b> screen: every feature lives here. Tap a tile to open it.'],
      marks: [{ x: 36, y: 700, w: 402, h: 258, label: ['Bàn & mã QR', 'Tables & QR'] }, { x: 462, y: 700, w: 402, h: 258, label: ['Thực đơn', 'Menu'] }, { x: 36, y: 983, w: 402, h: 258, label: ['Kho', 'Stock'] }, { x: 462, y: 983, w: 402, h: 258, label: ['Khuyến mãi', 'Promotions'] }] },
  ],
  menu: [
    { img: 'app-06-quan-ly.jpg', cap: ['Vào <b>Quản lý bàn & mã QR</b> để thêm bàn, <b>Thực đơn</b> để thêm món.', 'Open <b>Tables & QR codes</b> to add tables, <b>Menu</b> to add dishes.'],
      marks: [{ x: 36, y: 700, w: 402, h: 258, label: ['Thêm bàn', 'Add tables'] }, { x: 462, y: 700, w: 402, h: 258, label: ['Thêm món', 'Add dishes'] }] },
  ],
  order: [
    { img: 'app-01-so-do-ban.jpg', cap: ['<b>Sơ đồ bàn</b>: chạm một ghế (ô tròn có số) hoặc bấm <b>Gọi món</b>.', '<b>Floor plan</b>: tap a seat (numbered square) or press <b>Order</b>.'],
      marks: [{ x: 628, y: 552, w: 72, h: 72, label: ['Chạm ghế', 'Tap a seat'] }, { x: 36, y: 1465, w: 402, h: 80, label: ['Gọi món', 'Order'], below: true }] },
    { img: 'app-02-goi-mon.jpg', cap: ['Trong đơn: <b>+ / −</b> đổi số lượng, <b>Gọi thêm món</b> để thêm, thùng rác để bỏ món.', 'In the order: <b>+ / −</b> change quantity, <b>Add dishes</b> to add more, the bin removes a dish.'],
      marks: [{ x: 66, y: 272, w: 190, h: 72 }, { x: 36, y: 665, w: 828, h: 96, label: ['Gọi thêm món', 'Add dishes'] }, { x: 36, y: 865, w: 828, h: 100, label: ['Khuyến mãi', 'Promotion'], below: true }] },
  ],
  kitchen: [
    { img: 'app-03-bep.jpg', cap: ['Màn <b>Bếp</b>: chọn khu bếp ở trên, món xong thì bấm <b>Hoàn tất vé này</b>.', 'The <b>Kitchen</b> screen: pick a station on top; when done press <b>Complete this ticket</b>.'],
      marks: [{ x: 36, y: 210, w: 760, h: 70, label: ['Chọn khu bếp', 'Pick station'] }, { x: 62, y: 1012, w: 776, h: 82, label: ['Hoàn tất vé', 'Complete'] }] },
  ],
  pay: [
    { img: 'app-04-thu-ngan.jpg', cap: ['Màn <b>Thu ngân</b>: chạm bàn có khách (ghế xanh lá = chờ thu tiền).', 'The <b>Cashier</b> screen: tap a table with guests (green seat = waiting to pay).'],
      marks: [{ x: 36, y: 510, w: 402, h: 430, label: ['Bàn chờ thu', 'Table to pay'] }, { x: 36, y: 172, w: 828, h: 158, label: ['Đã thu hôm nay', 'Collected today'], below: true }] },
    { img: 'app-05-vietqr.jpg', cap: ['<b>VietQR</b>: khách quét mã, rồi bấm <b>Xác nhận đã nhận tiền</b>. Chạm mã để phóng to.', '<b>VietQR</b>: the guest scans the code, then press <b>Confirm payment received</b>. Tap the code to enlarge.'],
      marks: [{ x: 36, y: 246, w: 546, h: 94, label: ['VietQR / Tiền mặt', 'VietQR / Cash'] }, { x: 305, y: 505, w: 292, h: 292, label: ['Chạm để phóng to', 'Tap to enlarge'] }, { x: 36, y: 1556, w: 828, h: 94, label: ['Xác nhận', 'Confirm'] }] },
  ],
  actions: [
    { img: 'app-01-so-do-ban.jpg', cap: ['Phía dưới sơ đồ bàn: <b>Ghép đơn</b>, <b>Chuyển chỗ</b>, <b>Dọn bàn</b>.', 'Under the floor plan: <b>Merge orders</b>, <b>Move seats</b>, <b>Clear table</b>.'],
      marks: [{ x: 462, y: 1465, w: 402, h: 80, label: ['Ghép đơn', 'Merge'] }, { x: 36, y: 1568, w: 402, h: 80, label: ['Chuyển chỗ', 'Move'] }, { x: 462, y: 1568, w: 402, h: 80, label: ['Dọn bàn', 'Clear'] }] },
  ],
};

function vUserGuide() {
  const lang = GA('vi', 'en');
  return `<div class="screen">
    ${hdr(GA('Hướng dẫn sử dụng', 'User guide'), GA('BEPO – Quản lý nhà hàng', 'BEPO – Restaurant manager'))}
    <div class="body gd" data-notr>
      <div class="t-sm" style="line-height:1.6">${GA(
        'Trang này hướng dẫn cách dùng BEPO từ lúc bắt đầu tới việc hằng ngày của quán. Làm lần lượt theo các bước, hoặc kéo xuống phần <b>Gặp lỗi?</b> khi cần. Ảnh minh hoạ nằm trong app nên xem được cả khi mất mạng.',
        'This page shows how to use BEPO from the very start to the daily routine of your restaurant. Follow the steps in order, or jump to <b>Having problems?</b> when needed. The pictures are built into the app, so they work offline too.')}</div>

      <div class="gd-box ok">${GA('<b>Cốt lõi chỉ có 3 việc:</b> (1) Phục vụ gọi món và gửi bếp → (2) Bếp làm xong bấm hoàn tất → (3) Thu ngân thu tiền. Mọi thứ khác (kho, khuyến mãi, báo cáo…) là phần thêm.',
        '<b>The core is just 3 things:</b> (1) Waiters take orders and send them to the kitchen → (2) The kitchen marks them done → (3) The cashier takes payment. Everything else (stock, promotions, reports…) is extra.')}</div>

      <div class="card">
        <div class="t-md" style="margin-bottom:6px">${GA('Ai làm gì?', 'Who does what?')}</div>
        <table class="gd-two">
          <tr><th></th><th>${GA('Chủ quán', 'Owner')}</th><th>${GA('Thu ngân', 'Cashier')}</th><th>${GA('Phục vụ', 'Waiter')}</th><th>${GA('Bếp', 'Kitchen')}</th></tr>
          <tr><td>${GA('Dùng', 'Uses')}</td><td>${GA('Mọi màn hình', 'Every screen')}</td><td>${GA('Thu ngân, in hoá đơn', 'Cashier, receipts')}</td><td>${GA('Sơ đồ bàn, gọi món', 'Floor plan, ordering')}</td><td>${GA('Bảng đơn bếp', 'Kitchen board')}</td></tr>
          <tr><td>${GA('Cấp quyền ở', 'Set in')}</td><td colspan="4">${GA('<b>Quản lý → Nhân viên</b> (mỗi người chỉ thấy các màn được cấp quyền)', '<b>Manage → Staff</b> (each person only sees the screens they are allowed)')}</td></tr>
        </table>
      </div>

      ${gaStep(1, GA('Bắt đầu dùng ngay', 'Start right away'), `<ol>
        <li>${GA('Mở app lần đầu, chọn <b>ngôn ngữ</b> (Tiếng Việt hoặc English).', 'Open the app for the first time and choose the <b>language</b> (Tiếng Việt or English).')}</li>
        <li>${GA('Chọn <span class="k">Bắt đầu dùng ngay</span> → nhập <b>tên quán</b>, <b>tên bạn</b> và <b>mật khẩu</b> (tối thiểu 6 ký tự).', 'Choose <span class="k">Start right away</span> → enter the <b>restaurant name</b>, <b>your name</b> and a <b>password</b> (at least 6 characters).')}</li>
        <li>${GA('Nên bật <b>Nạp dữ liệu mẫu</b> nếu muốn thử ngay (vài bàn, thực đơn, kho). Xoá sau được.', 'Keep <b>Load sample data</b> on if you want to try right away (a few tables, a menu, stock). You can delete it later.')}</li>
        <li>${GA('Bấm <span class="k">Bắt đầu</span> — app vào luôn màn <b>Sơ đồ bàn</b>. Dùng thử <b>14 ngày</b>, không cần email.', 'Press <span class="k">Start</span> — the app opens the <b>Floor plan</b> at once. <b>14-day</b> free trial, no email needed.')}</li></ol>
        <div class="gd-box warn">${GA('Dữ liệu lúc này chỉ nằm trên điện thoại. Muốn <b>thêm máy nhân viên</b> hoặc <b>sao lưu</b>, làm Bước 9.', 'Right now the data lives only on this phone. To <b>add staff devices</b> or <b>back up</b>, do Step 9.')}</div>`,
        null, GA('Tên đăng nhập mặc định là chuquan (đổi được trong mục Nhân viên).', 'The default username is chuquan (you can change it under Staff).'))}

      ${gaStep(2, GA('Thiết lập bàn, ghế và thực đơn', 'Set up tables, seats and the menu'), `<ol>
        <li>${GA('<b>Quản lý → Quản lý bàn & mã QR</b>: bấm <span class="k">+ Khu vực</span> (ví dụ Tầng 1), rồi <span class="k">Thêm bàn</span>: tên bàn, <b>số ghế (tối đa 8)</b>, hướng bố trí ghế.', '<b>Manage → Tables & QR codes</b>: press <span class="k">+ Area</span> (e.g. Floor 1), then <span class="k">Add table</span>: table name, <b>number of seats (max 8)</b>, seat layout.')}</li>
        <li>${GA('<b>Quản lý → Thực đơn</b>: tạo <b>danh mục</b> (Món chính, Đồ uống…) và <b>khu bếp</b> (Bếp chính, Quầy pha chế…).', '<b>Manage → Menu</b>: create <b>categories</b> (Main dishes, Drinks…) and <b>kitchen stations</b> (Main kitchen, Bar…).')}</li>
        <li>${GA('Bấm <span class="k">+</span> để thêm món: tên, <b>giá</b>, mô tả, danh mục, <b>khu bếp</b>, tình trạng (còn hàng / sắp hết / hết hàng) và <b>ảnh món</b> (không bắt buộc).', 'Press <span class="k">+</span> to add a dish: name, <b>price</b>, description, category, <b>kitchen station</b>, status (in stock / running low / sold out) and a <b>photo</b> (optional).')}</li>
        <li>${GA('Muốn tự trừ kho khi bán: mở món → <b>Công thức</b> → thêm nguyên liệu và định lượng cho 1 phần.', 'To deduct stock automatically when selling: open the dish → <b>Recipe</b> → add ingredients and quantity per portion.')}</li></ol>
        ${gaOpen('tablesAdmin', 'tablesAdmin', 'Mở Quản lý bàn & mã QR', 'Open Tables & QR codes')}${gaOpen('menu', 'menu', 'Mở Thực đơn', 'Open Menu')}`,
        GA_FIGS.menu)}

      ${gaStep(3, GA('Gọi món và gửi xuống bếp', 'Take an order and send it to the kitchen'), `<ol>
        <li>${GA('Mở <b>Phục vụ</b> (Sơ đồ bàn). Màu ghế: <b>xám</b> = trống, <b>cam</b> = đang phục vụ, <b>xanh lá</b> = chờ thanh toán, <b>xanh dương</b> = đã đặt trước.', 'Open <b>Service</b> (floor plan). Seat colours: <b>grey</b> = free, <b>orange</b> = in service, <b>green</b> = awaiting payment, <b>blue</b> = reserved.')}</li>
        <li>${GA('Chạm <b>ghế</b> → <span class="k">Gọi món</span>. Chọn món (có ô tìm kiếm, vuốt để đổi danh mục), chỉnh số lượng, ghi chú nếu cần.', 'Tap a <b>seat</b> → <span class="k">Order</span>. Pick dishes (there is a search box; swipe to change category), adjust quantities, add a note if needed.')}</li>
        <li>${GA('Bấm <span class="k">Gửi xuống bếp</span>. Món hiện ở màn Bếp ngay, kèm chuông báo.', 'Press <span class="k">Send to kitchen</span>. The dishes appear on the Kitchen screen at once, with a chime.')}</li>
        <li>${GA('Khách gọi thêm: mở lại ghế → <span class="k">Gọi thêm món</span> → gửi tiếp (hiện thành một đợt mới).', 'The guest wants more: open the seat again → <span class="k">Add dishes</span> → send (shown as a new round).')}</li></ol>
        <div class="gd-box ok">${GA('<b>Khách tự gọi bằng QR:</b> in mã QR dán ở bàn (Quản lý → Quản lý bàn & mã QR → In mã QR → Tạo file PDF). Khách quét, chọn món rồi gửi; nếu bật <i>Nhân viên xác nhận đơn đầu tiên</i> thì nhân viên bấm <b>Xác nhận gửi bếp</b>.', '<b>Guests ordering by QR:</b> print the QR codes and stick them on the tables (Manage → Tables & QR codes → Print QR codes → Create PDF file). Guests scan, pick dishes and send; if <i>Staff confirms the first order</i> is on, staff presses <b>Confirm and send to kitchen</b>.')}</div>
        ${gaOpen('tables', 'tables', 'Mở Phục vụ', 'Open Service')}`,
        GA_FIGS.order)}

      ${gaStep(4, GA('Bếp nhận và hoàn tất món', 'The kitchen receives and completes dishes'), `<ol>
        <li>${GA('Mở <b>Bếp</b>. Chọn <b>khu bếp</b> của bạn ở hàng trên cùng (hoặc xem <b>Tất cả</b>).', 'Open <b>Kitchen</b>. Choose <b>your station</b> in the top row (or view <b>All</b>).')}</li>
        <li>${GA('Mỗi vé là một ghế. Tick từng món khi làm xong, hoặc bấm <span class="k">Bắt đầu làm</span> rồi <span class="k">Hoàn tất vé này</span>.', 'Each ticket is one seat. Tick each dish when ready, or press <span class="k">Start cooking</span> then <span class="k">Complete this ticket</span>.')}</li>
        <li>${GA('Tab <b>Tổng hợp theo món</b> cho biết cần làm tổng cộng bao nhiêu phần mỗi món — tiện khi đông khách.', 'The <b>Totals by dish</b> tab shows how many portions of each dish are needed — handy when it is busy.')}</li>
        <li>${GA('Có vé mới thì máy kêu chuông (chọn kiểu chuông, âm lượng ở Bước 10).', 'A new ticket makes the device chime (choose the tone and volume in Step 10).')}</li></ol>
        <div class="gd-box warn">${GA('Dùng một <b>máy tính bảng riêng làm máy bếp</b>: đăng nhập tài khoản có quyền Bếp, mở sẵn màn Bếp và để máy luôn sáng.', 'Use a <b>separate tablet as the kitchen device</b>: log in with an account that has Kitchen permission, keep the Kitchen screen open and the device awake.')}</div>
        ${gaOpen('kds', 'kds', 'Mở Bếp', 'Open Kitchen')}`,
        GA_FIGS.kitchen)}

      ${gaStep(5, GA('Thu tiền: tiền mặt và VietQR', 'Take payment: cash and VietQR'), `<ol>
        <li>${GA('Mở <b>Thu ngân</b> → chọn <b>bàn</b> → chọn <b>ghế</b>. Món phải được phục vụ xong mới thanh toán được.', 'Open <b>Cashier</b> → choose the <b>table</b> → the <b>seat</b>. Every dish must be served before you can take payment.')}</li>
        <li>${GA('Cần giảm giá: bấm <span class="k">Chọn khuyến mãi</span> trước khi thanh toán.', 'Need a discount: press <span class="k">Choose promotion</span> before paying.')}</li>
        <li>${GA('Bấm <span class="k">Thanh toán</span>. Vuốt trái/phải để đổi <b>VietQR</b> hoặc <b>Tiền mặt</b>.', 'Press <span class="k">Pay</span>. Swipe left/right to switch between <b>VietQR</b> and <b>Cash</b>.')}</li>
        <li>${GA('<b>Tiền mặt:</b> nhập số tiền khách đưa, app tính tiền thừa. <b>VietQR:</b> chạm mã để phóng to cho khách quét → <span class="k">Xác nhận đã nhận tiền</span>.', '<b>Cash:</b> enter the amount the guest gives and the app works out the change. <b>VietQR:</b> tap the code to enlarge it for the guest to scan → <span class="k">Confirm payment received</span>.')}</li></ol>
        <div class="gd-box warn">${GA('<b>Cài VietQR một lần:</b> Quản lý → Thanh toán & hoá đơn → <b>Tài khoản nhận tiền — VietQR</b>: chọn ngân hàng, nhập số tài khoản và tên chủ tài khoản (không dấu, IN HOA). Mã được tạo ngay trong app, <b>dùng được cả khi không có mạng</b>.', '<b>Set up VietQR once:</b> Manage → Payments & invoices → <b>Receiving account — VietQR</b>: choose the bank, enter the account number and holder name (no accents, UPPERCASE). The code is generated inside the app and <b>works without internet</b>.')}</div>
        ${gaOpen('cashier', 'pos', 'Mở Thu ngân', 'Open Cashier')}${gaOpen('billing', 'billing', 'Mở Thanh toán & hoá đơn', 'Open Payments & invoices')}`,
        GA_FIGS.pay)}

      ${gaStep(6, GA('Ghép đơn, chuyển chỗ, dọn bàn', 'Merge orders, move seats, clear tables'), `<ol>
        <li>${GA('<b>Ghép đơn</b> (gộp nhiều ghế/bàn vào một hoá đơn): Phục vụ → <span class="k">Ghép đơn</span> → tick các ghế (chọn được ở <b>nhiều bàn, nhiều khu</b>) → <span class="k">Gộp thành một hoá đơn</span>. Thu ngân cũng có nút <b>Ghép đơn</b>.', '<b>Merge orders</b> (combine several seats/tables into one bill): Service → <span class="k">Merge orders</span> → tick the seats (you can pick them at <b>several tables and areas</b>) → <span class="k">Combine into one bill</span>. The Cashier screen also has a <b>Merge orders</b> button.')}</li>
        <li>${GA('<b>Chuyển chỗ</b>: <span class="k">Chuyển chỗ</span> → tick nhiều ghế hoặc <b>Chọn cả bàn</b> → chọn các ghế trống mới (có nút <i>Điền ghế trống</i>) → <span class="k">Chuyển</span>.', '<b>Move seats</b>: <span class="k">Move seats</span> → tick several seats or <b>Select whole table</b> → choose the new free seats (there is a <i>Fill free seats</i> button) → <span class="k">Move</span>.')}</li>
        <li>${GA('<b>Tách ghế</b> khỏi hoá đơn gộp: mở hoá đơn gộp → <span class="k">Tách một ghế ra hoá đơn riêng</span>.', '<b>Split a seat</b> off a merged bill: open the merged bill → <span class="k">Split one seat onto its own bill</span>.')}</li>
        <li>${GA('<b>Dọn bàn</b> sau khi khách về: ghế được dọn và mã QR tự mở lại.', '<b>Clear the table</b> after guests leave: seats are cleared and the QR code reopens.')}</li></ol>`,
        GA_FIGS.actions)}

      ${gaStep(7, GA('In hoá đơn', 'Print bills'), `<ol>
        <li>${GA('Trước khi thu tiền: mở đơn → <span class="k">In tạm tính</span>. Sau khi thu: màn <b>Thanh toán thành công</b> → <span class="k">In hoá đơn</span>. In lại hoá đơn cũ: <b>Báo cáo → Lịch sử đơn</b> → mở đơn → <span class="k">In lại hoá đơn</span>.', 'Before payment: open the order → <span class="k">Print provisional bill</span>. After payment: on the <b>Payment successful</b> screen → <span class="k">Print bill</span>. Reprint an old bill: <b>Reports → Order history</b> → open the order → <span class="k">Reprint bill</span>.')}</li>
        <li>${GA('<b>Cài máy in nhiệt Bluetooth</b> (khổ 58mm hoặc 80mm): bật máy in → ghép đôi trong Cài đặt Bluetooth của điện thoại (mã thường 0000 hoặc 1234) → Quản lý → Thanh toán & hoá đơn → <b>Máy in hoá đơn</b> → <span class="k">Tìm máy in Bluetooth</span> → chọn máy → <span class="k">In thử</span>.', '<b>Set up a Bluetooth thermal printer</b> (58 mm or 80 mm paper): turn it on → pair it in the phone’s Bluetooth settings (PIN usually 0000 or 1234) → Manage → Payments & invoices → <b>Receipt printer</b> → <span class="k">Search for Bluetooth printers</span> → pick it → <span class="k">Test print</span>.')}</li>
        <li>${GA('<b>Chưa có máy in:</b> bấm <span class="k">Lưu PDF / gửi khách</span> để lưu hoá đơn thành file PDF, in bằng ứng dụng khác hoặc gửi khách qua Zalo.', '<b>No printer yet:</b> press <span class="k">Save PDF / send to guest</span> to save the bill as a PDF, print it with another app or send it to the guest by chat.')}</li>
        <li>${GA('Bật <b>Tự in hoá đơn sau khi thanh toán</b> để in ngay khi thu tiền xong. Nhập <b>địa chỉ quán</b> ở <i>Thông tin nhà hàng</i> và <b>lời cảm ơn</b> ngay trong mục máy in.', 'Turn on <b>Print the bill automatically after payment</b> to print as soon as payment is taken. Enter the <b>restaurant address</b> under <i>Restaurant info</i> and the <b>thank-you note</b> right in the printer section.')}</li></ol>`, null)}

      ${gaStep(8, GA('Kho, khuyến mãi, đặt bàn và báo cáo', 'Stock, promotions, reservations and reports'), `<ol>
        <li>${GA('<b>Kho nguyên liệu:</b> <span class="k">Nhập kho</span> khi mua hàng, <span class="k">Xuất kho</span> khi hỏng/trả. Nguyên liệu dưới ngưỡng sẽ được cảnh báo; món có công thức tự trừ kho khi bán.', '<b>Ingredient stock:</b> use <span class="k">Stock in</span> when buying, <span class="k">Stock out</span> for spoilage/returns. Ingredients below the threshold are flagged; dishes with a recipe deduct stock automatically when sold.')}</li>
        <li>${GA('<b>Khuyến mãi:</b> <span class="k">+</span> tạo chương trình (giảm %, hoặc số tiền cố định; đơn tối thiểu; giới hạn lượt; ngày hết hạn). Bật/tắt bất cứ lúc nào.', '<b>Promotions:</b> <span class="k">+</span> create a programme (percentage or fixed amount; minimum order; usage limit; expiry date). Turn on/off any time.')}</li>
        <li>${GA('<b>Đặt bàn trước:</b> nhập tên, số khách, giờ đến, chọn bàn/ghế giữ chỗ. Bàn được giữ từ <b>30 phút trước giờ hẹn</b>; khách đến thì bấm <span class="k">Khách đã đến</span>.', '<b>Reservations:</b> enter the name, number of guests, arrival time and the table/seats to hold. The table is held from <b>30 minutes before</b> the booking; when the guest arrives press <span class="k">Guest arrived</span>.')}</li>
        <li>${GA('<b>Báo cáo:</b> chọn Hôm nay / 7 ngày / 30 ngày / Tuỳ chọn để xem doanh thu, món bán chạy, doanh thu theo thu ngân. <span class="k">Xuất báo cáo</span> ra file Excel (theo ngôn ngữ app đang chọn).', '<b>Reports:</b> choose Today / 7 days / 30 days / Custom to see revenue, best sellers, revenue by cashier. <span class="k">Export reports</span> as an Excel file (in the app’s current language).')}</li></ol>
        ${gaOpen('stock', 'stock', 'Mở Kho', 'Open Stock')}${gaOpen('promos', 'promo', 'Mở Khuyến mãi', 'Open Promotions')}${gaOpen('reservations', 'reservations', 'Mở Đặt bàn', 'Open Reservations')}${gaOpen('reports', 'report', 'Mở Báo cáo', 'Open Reports')}`,
        GA_FIGS.home)}

      ${gaStep(9, GA('Thêm máy nhân viên và bật đồng bộ', 'Add staff devices and turn on sync'), `<ol>
        <li>${GA('<b>Bật đồng bộ</b> (làm một lần, chỉ chủ quán trên điện thoại gốc): Quản lý → <b>Đồng bộ dữ liệu</b> → <span class="k">Tạo tài khoản & bật đồng bộ</span>, rồi làm theo màn hình (có <i>Hướng dẫn liên kết Supabase</i> kèm ảnh). Dữ liệu đang có được giữ nguyên.', '<b>Turn on sync</b> (once, owner only, on the main phone): Manage → <b>Data sync</b> → <span class="k">Create account & turn on sync</span>, then follow the screens (there is a <i>Supabase linking guide</i> with pictures). Your existing data is kept.')}</li>
        <li>${GA('Tạo tài khoản cho từng người: <b>Quản lý → Nhân viên → Thêm nhân viên</b>, chọn vai trò và các màn hình được vào. Mật khẩu tạm thời được cấp, nhân viên đổi ở lần đăng nhập đầu.', 'Create an account for each person: <b>Manage → Staff → Add staff</b>, choose the role and the screens they may open. A temporary password is issued and the staff member changes it at first login.')}</li>
        <li>${GA('Thêm máy: <b>Đồng bộ & thiết bị → Thêm thiết bị nhân viên (mã QR)</b>. Trên máy nhân viên chọn <span class="k">Đây là máy nhân viên</span> → quét mã (dùng một lần, hết hạn sau 5 phút).', 'Add a device: <b>Sync & devices → Add a staff device (QR code)</b>. On the staff device choose <span class="k">This is a staff device</span> → scan the code (single use, expires after 5 minutes).')}</li>
        <li>${GA('Máy nhân viên bị mất? <b>Thu hồi</b> thiết bị ngay trong cùng màn hình — dữ liệu trên máy đó bị xoá.', 'Staff device lost? <b>Revoke</b> it on the same screen — the data on that device is erased.')}</li></ol>
        <div class="gd-box warn">${GA('Chỉ <b>tài khoản Chủ quán trên máy gốc</b> mới thêm/thu hồi máy nhân viên, xem gói cước, gỡ liên kết kho và xoá tài khoản lưu trữ.', 'Only the <b>Owner account on the main device</b> can add/revoke staff devices, see the subscription, unlink the data store and delete the storage account.')}</div>
        ${gaOpen('cloud', null, 'Mở Đồng bộ & thiết bị', 'Open Sync & devices')}${gaOpen('staff', 'staff', 'Mở Nhân viên', 'Open Staff')}`, null)}

      ${gaStep(10, GA('Gói cước, ngôn ngữ, âm báo và cỡ chữ', 'Subscription, language, alert sounds and text size'), `<ol>
        <li>${GA('<b>Gói cước</b> (chủ quán): Quản lý → <b>Gói cước</b> xem hạn dùng, mua gói 1/6/12 tháng qua <b>Google Play</b>, bấm <span class="k">Kiểm tra lại</span> sau khi mua. Gia hạn tự động do Google Play xử lý.', '<b>Subscription</b> (owner): Manage → <b>Subscription plan</b> to see the expiry, buy a 1/6/12-month plan through <b>Google Play</b>, and press <span class="k">Check again</span> after buying. Renewals are handled automatically by Google Play.')}</li>
        <li>${GA('<b>Ngôn ngữ:</b> Quản lý → <b>Hiển thị trên máy này → Ngôn ngữ hiển thị</b> (Tiếng Việt / English). Chỉ đổi cho máy đang cầm.', '<b>Language:</b> Manage → <b>Display on this device → Display language</b> (Tiếng Việt / English). It only changes the device in your hand.')}</li>
        <li>${GA('<b>Âm báo và rung:</b> Quản lý → Thanh toán & hoá đơn → <b>Âm báo & âm lượng</b>: chọn 1 trong 5 kiểu chuông, kéo âm lượng, bật <b>Rung</b> và <b>Nhận thông báo khi chạy nền</b>, rồi bấm <span class="k">Gửi thông báo thử</span>. Tăng cả âm lượng điện thoại.', '<b>Alert sound and vibration:</b> Manage → Payments & invoices → <b>Sound & volume</b>: pick one of 5 tones, drag the volume, turn on <b>Vibrate</b> and <b>Notifications while in background</b>, then press <span class="k">Send a test notification</span>. Also turn up the phone volume.')}</li>
        <li>${GA('<b>Cỡ chữ:</b> Quản lý → Hiển thị trên máy này → chọn Nhỏ/Vừa/Lớn (riêng từng máy).', '<b>Text size:</b> Manage → Display on this device → choose Small/Medium/Large (per device).')}</li></ol>`, null)}

      <div class="sec" style="margin-top:12px">${GA('Gặp lỗi?', 'Having problems?')}</div>
      ${gaDet('Mất mạng thì sao?', 'What if the internet is down?',
        'Vẫn gọi món, gửi bếp, thu tiền và tạo mã VietQR bình thường vì dữ liệu lưu ngay trên máy. Khi có mạng, các máy tự cập nhật cho nhau. Riêng việc đồng bộ giữa các máy và mua gói cước cần có mạng.',
        'You can still take orders, send them to the kitchen, take payment and generate VietQR codes, because data is stored on the device. When the internet returns, devices update each other automatically. Only syncing between devices and buying a plan need internet.')}
      ${gaDet('Đồng bộ không chạy / máy nhân viên không thấy đơn', 'Sync is not working / staff device does not see orders',
        'Vào <b>Quản lý → Đồng bộ dữ liệu</b>: xem trạng thái, bấm <span class="k">Đồng bộ ngay</span>. Nếu vẫn lỗi bấm <span class="k">Chẩn đoán</span> — app kiểm tra từng bước và báo ✓/✗ kèm lý do; bấm <b>Sao chép báo cáo</b> gửi cho nhà phát triển. Kho dữ liệu cũ có nhiều dữ liệu thì lần đầu tải sẽ lâu (có hiển thị số bản ghi đang tải).',
        'Go to <b>Manage → Data sync</b>: check the status, press <span class="k">Sync now</span>. If it still fails press <span class="k">Diagnose</span> — the app checks each step and reports ✓/✗ with the reason; press <b>Copy report</b> and send it to the developer. A store with a lot of old data takes longer the first time (the number of records being loaded is shown).')}
      ${gaDet('Báo “Gói cước đã hết hạn”', 'It says “Subscription has expired”',
        'Bạn vẫn xem và xuất được báo cáo, nhưng không gọi món/thu tiền được. Chủ quán vào <b>Gói cước</b> (hoặc bấm <b>Tạo tài khoản & gia hạn</b> nếu đang dùng thử không có tài khoản) để mua/gia hạn, rồi bấm <b>Kiểm tra lại</b>. Máy nhân viên tự mở lại khi nhận được gói mới từ máy gốc.',
        'You can still view and export reports, but you cannot take orders or payments. The owner opens <b>Subscription plan</b> (or presses <b>Create account & renew</b> if still on a trial without an account) to buy/renew, then presses <b>Check again</b>. Staff devices unlock once they receive the new plan from the main device.')}
      ${gaDet('Quên mật khẩu đăng nhập app', 'Forgot the app password',
        'Nhân viên: nhờ chủ quán vào <b>Quản lý → Nhân viên</b> chọn tài khoản → <b>Cấp lại mật khẩu</b>. Tài khoản bị khoá 15 phút sau 5 lần nhập sai. Chủ quán quên mật khẩu: nếu đã bật đồng bộ, cài lại app và khôi phục bằng <b>tài khoản BEPO (email)</b>.',
        'Staff: ask the owner to open <b>Manage → Staff</b>, choose the account → <b>Reset password</b>. An account is locked for 15 minutes after 5 wrong attempts. If the owner forgets the password: if sync was turned on, reinstall the app and restore with the <b>BEPO account (email)</b>.')}
      ${gaDet('Không nghe chuông / không rung khi chạy nền', 'No chime / no vibration in the background',
        'Bật quyền <b>Thông báo</b> cho app, tắt <b>Tối ưu hoá pin</b> cho app trong Cài đặt điện thoại, tăng âm lượng <b>thông báo</b> và <b>đa phương tiện</b>, bật <b>Nhận thông báo khi chạy nền</b> rồi thử <span class="k">Gửi thông báo thử</span>.',
        'Allow <b>Notifications</b> for the app, turn off <b>Battery optimization</b> for it in the phone’s Settings, raise the <b>notification</b> and <b>media</b> volumes, turn on <b>Notifications while in background</b>, then try <span class="k">Send a test notification</span>.')}
      ${gaDet('Không in được hoá đơn', 'The bill will not print',
        'Kiểm tra máy in đã bật, đủ giấy, đã ghép đôi Bluetooth và đúng khổ 58/80mm; bấm <b>In thử</b>. Không thấy máy in khi quét thì nhập địa chỉ <span class="k">AA:BB:CC:DD:EE:FF</span> thủ công. Khi in lỗi, app tự lưu hoá đơn thành <b>PDF</b> để không mất.',
        'Check the printer is on, has paper, is paired over Bluetooth and the 58/80 mm width is right; press <b>Test print</b>. If the printer does not appear when scanning, type its address <span class="k">AA:BB:CC:DD:EE:FF</span> manually. When printing fails the app saves the bill as a <b>PDF</b> so nothing is lost.')}
      ${gaDet('Gọi nhầm món / xoá món', 'Wrong dish / remove a dish',
        'Món <b>chưa vào bếp</b> giảm được số lượng hoặc xoá bằng biểu tượng thùng rác. Món <b>đã vào bếp</b> không giảm được, chỉ xoá toàn bộ món (kho được hoàn lại và có ghi nhật ký). Xem lại ở <b>Quản lý → Nhật ký hoạt động</b>.',
        'A dish that has <b>not reached the kitchen</b> can be reduced or removed with the bin icon. A dish <b>already in the kitchen</b> cannot be reduced, only removed entirely (stock is returned and it is logged). Review it under <b>Manage → Activity log</b>.')}
      ${gaDet('Khách bấm “Gọi nhân viên”', 'A guest pressed “Call staff”',
        'Máy chủ quán kêu chuông và hiện 🔔 ở ghế đó trên sơ đồ bàn. Xử lý xong bấm <b>Xử lý</b> để tắt báo.',
        'The owner’s device chimes and shows 🔔 on that seat in the floor plan. When handled, press <b>Handle</b> to clear the alert.')}
      ${gaDet('Đổi máy hoặc cài lại app', 'Changing phones or reinstalling',
        'Nếu đã bật đồng bộ: mở app → <b>Tôi đã có tài khoản BEPO</b> → đăng nhập email, nhập <b>mật khẩu lưu trữ</b> → <b>Khôi phục</b>. Nếu chưa bật đồng bộ, dữ liệu chỉ có trên máy cũ — hãy bật đồng bộ trước khi đổi máy.',
        'If sync was turned on: open the app → <b>I already have a BEPO account</b> → log in with the email, enter the <b>storage password</b> → <b>Restore</b>. If sync was not turned on, the data exists only on the old phone — turn on sync before changing phones.')}

      <div class="gd-box ok">${GA('<b>Cần hỗ trợ thêm?</b> Bấm <b>Chẩn đoán</b> để sao chép báo cáo lỗi và gửi cho nhà phát triển, kèm ảnh chụp màn hình.', '<b>Need more help?</b> Press <b>Diagnose</b> to copy the error report and send it to the developer, with a screenshot.')}</div>
      <button class="btn pri" data-act="back">${GA('Quay lại', 'Back')}</button>
    </div>
    ${navBar('admin')}
  </div>`;
}
