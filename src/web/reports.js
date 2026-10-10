/* ============================================================
   DEMO — xuất báo cáo CSV và chế độ khách quét QR.
   Bản chạy thật để server làm hai việc này; ở đây làm ngay trong trình duyệt.
   ============================================================ */

/* ---------- XUẤT BÁO CÁO CSV ---------- */
function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
/** Báo cáo theo ngôn ngữ đang chọn: tiêu đề cột, nhãn, tên trạng thái... đi qua bộ dịch (trText); tiếng Việt thì giữ nguyên. */
const repLocale = () => (getLang() === 'vi' ? 'vi-VN' : 'en-GB');
const repCur = () => '#,##0" ' + (getLang() === 'vi' ? 'đ' : 'VND') + '"';
/** Mã trạng thái/phương thức/nguồn lưu trong dữ liệu (cash, paid, qr...) → nhãn dễ đọc. Chỉ áp dụng khi KHÔNG phải tiếng Việt, để tệp tiếng Việt giữ nguyên như trước. */
const REP_LABELS = { cash: 'Tiền mặt', vietqr: 'VietQR', open: 'Đang mở', paid: 'Đã thanh toán', void: 'Đã huỷ', merged: 'Đã ghép',
  qr: 'Khách quét QR', staff: 'Nhân viên nhập', grab: 'Grab', shopee: 'ShopeeFood' };
const repCode = v => (getLang() !== 'vi' && REP_LABELS[v] ? REP_LABELS[v] : v);
const repTr = v => (typeof v === 'string' ? trText(v) : v);
const REPORT_TITLES = { revenue:'Báo cáo doanh thu', payments:'Lịch sử thanh toán', orders:'Lịch sử đơn hàng',
  stock:'Lịch sử nhập/xuất kho', inventory:'Tồn kho hiện tại', logs:'Nhật ký hoạt động' };
const REPORT_RANGED = { revenue:true, payments:true, orders:true, stock:true, inventory:false, logs:true };
// Chỉ số cột (0-based) là tiền — dùng để canh phải + định dạng khi xuất Excel
const REPORT_CURRENCY_IDX = { revenue:[2], payments:[6,7,8], orders:[8,9], stock:[], inventory:[], logs:[] };
// Cột nào THỰC SỰ cộng dồn ở dòng Tổng cộng — khác cột tiền khi có đơn giá đơn vị
// (định dạng tiền để dễ đọc, nhưng cộng dồn đơn giá của nhiều dòng khác nhau là vô nghĩa)
const REPORT_SUM_IDX = { revenue:[2], payments:[6,7,8], orders:[9], stock:[], inventory:[], logs:[] };

/** Dữ liệu báo cáo dạng bảng [tiêu đề, ...các dòng]. from/to (mili-giây) lọc theo khoảng
    thời gian cho các báo cáo có mốc thời gian; bỏ qua với tồn kho (số dư tức thời). */
function reportRowsLocal(kind, from, to) {
  const tName = id => (D.tables.find(t => t.id === id) || {}).name || '';
  const sName = id => (D.staff.find(s => s.id === id) || {}).name || '';
  const dt = ts => new Date(ts).toLocaleString(repLocale());
  const inRange = ts => from == null || (ts >= from && ts < to);

  if (kind === 'revenue') {
    const by = {};
    D.payments.filter(p => p.state === 'paid' && inRange(p.paid_at || p.created_at)).forEach(p => {
      const d = new Date(p.paid_at || p.created_at).toLocaleDateString(repLocale());
      by[d] = by[d] || { n: 0, v: 0 }; by[d].n++; by[d].v += p.total;
    });
    return [['Ngày', 'Số hoá đơn', 'Doanh thu'],
      ...Object.entries(by).map(([d, x]) => [d, x.n, x.v])];
  }
  if (kind === 'payments') {
    return [['Mã hoá đơn', 'Mã đơn', 'Thời gian', 'Bàn', 'Ghế', 'Phương thức', 'Tạm tính', 'Giảm giá', 'Thành tiền', 'Thu ngân'],
      ...D.payments.filter(p => p.state === 'paid' && inRange(p.paid_at || p.created_at)).map(p => {
        const o = D.orders.find(x => x.id === p.order_id) || {};
        return [p.id, o.code || '', dt(p.paid_at || p.created_at), tName(o.table_id), o.seat_no || '',
                repCode(p.method), p.subtotal, p.discount, p.total, sName(p.staff_id)];
      })];
  }
  if (kind === 'orders') {
    const rows = [['Mã đơn', 'Thời gian', 'Bàn', 'Ghế', 'Nguồn', 'Trạng thái', 'Món', 'Số lượng', 'Đơn giá', 'Thành tiền']];
    D.orders.filter(o => inRange(o.created_at)).forEach(o => {
      D.orderItems.filter(i => i.order_id === o.id).forEach(i => {
        rows.push([o.code, dt(o.created_at), tName(o.table_id), o.seat_no || '', repCode(o.source), repCode(o.status),
          i.name_snapshot, i.qty, i.price_snapshot, i.qty * i.price_snapshot]);
      });
    });
    return rows;
  }
  if (kind === 'stock') {
    return [['Thời gian', 'Nguyên liệu', 'Loại', 'Số lượng', 'Đơn vị', 'Tồn sau', 'Lý do', 'Người thực hiện'],
      ...D.stockMoves.filter(m => inRange(m.created_at)).map(m => {
        const ing = D.ingredients.find(i => i.id === m.ingredient_id) || {};
        return [dt(m.created_at), ing.name || '', { in: 'Nhập', out: 'Xuất', auto: 'Tự trừ' }[m.type] || m.type,
                m.qty, ing.unit || '', m.qty_after, m.reason, sName(m.staff_id) || 'Hệ thống'];
      })];
  }
  if (kind === 'inventory') {
    return [['Nguyên liệu', 'Tồn kho', 'Đơn vị', 'Ngưỡng cảnh báo', 'Tình trạng'],
      ...D.ingredients.map(i => [i.name, i.qty, i.unit, i.min_qty,
        i.qty < 0 ? 'Âm kho' : i.qty <= i.min_qty ? 'Sắp hết' : 'Bình thường'])];
  }
  if (kind === 'logs') {
    return [['Thời gian', 'Mức', 'Người', 'Hành động', 'Chi tiết'],
      ...D.logs.filter(l => inRange(l.created_at)).map(l => [dt(l.created_at), l.level === 'error' ? 'Lỗi' : l.level === 'warn' ? 'Cảnh báo' : 'Thông tin',
                          l.actor, l.action, l.detail || ''])];
  }
  return [];
}
/** Tải một tệp về máy của người xem.
    Trang chạy trong khung xem của claude.ai (bản dùng thử) không cho anchor tự tải tệp —
    lệnh tải kiểu cũ chạy im re, không báo lỗi mà cũng không ra tệp. Phải xin qua capability
    "downloads" của nền tảng. Trang chạy trên máy chủ thật (ngoài claude.ai) không có
    window.claude nên vẫn dùng cách anchor tải tệp thông thường. */
async function saveFile(filename, blob, mime){
  // Android (Capacitor): webview không tải tệp bằng thẻ <a download> được → ghi vào bộ nhớ rồi mở hộp thoại chia sẻ
  if (typeof NativeBridge !== 'undefined' && NativeBridge.isNative) {
    try { return await NativeBridge.saveFile(filename, blob); } catch (e) { console.warn('Lưu tệp lỗi:', e); return false; }
  }
  if (window.claude && typeof window.claude.use === 'function') {
    try {
      const downloads = await window.claude.use('downloads');
      if (downloads) {
        await downloads.save({ filename, data: blob });
        return true;
      }
    } catch (e) {
      if (e && e.code === 'declined') return false;   // người dùng tự bấm huỷ, không phải lỗi
      console.warn('Không tải được qua downloads capability:', e);
    }
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    return true;
  } catch (e) { return false; }
}

/** CSV thuần — dùng làm phương án dự phòng nếu không dựng được Excel (ví dụ thư viện
    tạo Excel chưa tải xong). CSV không thể tô màu/canh chỉnh như Excel thật. */
function exportCsvFallback(kind, rows) {
  const blob = new Blob(['\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')],
                        { type: 'text/csv;charset=utf-8' });
  return { blob, filename: `${kind}-${new Date().toISOString().slice(0, 10)}.csv` };
}

const BRAND_ARGB = 'FFD9581F';
/** Dựng workbook Excel có trình bày: tên nhà hàng, tiêu đề báo cáo, khoảng thời gian,
    hàng tiêu đề tô màu thương hiệu, cột tiền canh phải có dấu phẩy nghìn, dòng Tổng cộng,
    độ rộng cột tự co theo nội dung, cố định hàng tiêu đề — cùng chuẩn với bản server thật. */
function buildStyledWorkbook(kind, rows, range) {
  const [headers0, ...data0] = rows;
  const headers = headers0.map(repTr), data = data0.map(r => r.map(repTr));
  const currencyIdx = REPORT_CURRENCY_IDX[kind] || [];
  const wb = new ExcelJS.Workbook();
  wb.creator = DB.restaurant.name || trText('Quản Lý Nhà Hàng');
  wb.created = new Date();
  const ws = wb.addWorksheet(trText(REPORT_TITLES[kind]).slice(0, 31), { views: [{ state: 'frozen', ySplit: 5 }] });
  ws.columns = headers.map(() => ({ width: 14 }));

  const titleCell = (row, text, font) => {
    ws.mergeCells(row, 1, row, headers.length);
    const c = ws.getCell(row, 1);
    c.value = text; c.font = font; c.alignment = { horizontal: 'center', vertical: 'middle' };
  };
  titleCell(1, DB.restaurant.name || 'Quản Lý Nhà Hàng', { size: 14, bold: true, color: { argb: BRAND_ARGB } });
  titleCell(2, trText(REPORT_TITLES[kind]), { size: 12, bold: true });
  titleCell(3, REPORT_RANGED[kind]
    ? `${range.label}  ·  ${trText('Xuất lúc')} ${new Date().toLocaleString(repLocale())}`
    : `${trText('Số liệu hiện tại · Xuất lúc')} ${new Date().toLocaleString(repLocale())}`,
    { size: 9, italic: true, color: { argb: 'FF666666' } });
  ws.getRow(4).height = 6;

  const thin = { style: 'thin', color: { argb: 'FFDDDDDD' } };
  const headerRow = ws.getRow(5);
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_ARGB } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = { top: thin, bottom: thin, left: thin, right: thin };
  });
  headerRow.height = 20;

  const setCell = (xr, i, v) => {
    const cell = xr.getCell(i + 1);
    cell.value = repTr(v);
    cell.border = { top: thin, bottom: thin, left: thin, right: thin };
    if (currencyIdx.includes(i)) { cell.numFmt = repCur(); cell.alignment = { horizontal: 'right' }; }
    else if (typeof v === 'number') { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right' }; }
  };
  const shadeRow = (row, on) => { if (on) row.eachCell(c => { if (!c.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFAF7F2' } }; }); };

  let r = 6;
  if (kind === 'orders') {
    // Gộp ô các cột cấp-đơn (mã đơn, thời gian, bàn, ghế, nguồn, trạng thái) theo chiều dọc cho
    // mỗi đơn có nhiều món, rồi chèn dòng "Cộng đơn" — đọc như báo cáo hoá đơn thật thay vì
    // bảng phẳng lặp lại thông tin đơn ở mỗi dòng món.
    const orderColIdx = [0, 1, 2, 3, 4, 5]; // Mã đơn, Thời gian, Bàn, Ghế, Nguồn, Trạng thái
    const groups = new Map();
    data.forEach(row => { const code = row[0]; if (!groups.has(code)) groups.set(code, []); groups.get(code).push(row); });
    let groupIdx = 0;
    for (const [code, items] of groups) {
      const shaded = groupIdx % 2 === 1;
      const startRow = r;
      for (const row of items) {
        const xr = ws.getRow(r);
        row.forEach((v, i) => setCell(xr, i, v));
        shadeRow(xr, shaded);
        r++;
      }
      if (items.length > 1) {
        orderColIdx.forEach(i => {
          ws.mergeCells(startRow, i + 1, r - 1, i + 1);
          ws.getCell(startRow, i + 1).alignment = { horizontal: i >= 2 ? 'center' : 'left', vertical: 'middle' };
        });
      }
      const subtotal = items.reduce((s, row) => s + (Number(row[9]) || 0), 0);
      const tr = ws.getRow(r);
      ws.mergeCells(r, 1, r, headers.length - 1);
      const lbl = tr.getCell(1);
      lbl.value = trText(`Cộng đơn ${code} (${items.length} món)`);
      lbl.font = { bold: true, italic: true, size: 10 };
      lbl.alignment = { horizontal: 'right' };
      lbl.border = { top: { style: 'thin', color: { argb: 'FF999999' } } };
      const sumCell = tr.getCell(headers.length);
      sumCell.value = subtotal; sumCell.numFmt = repCur(); sumCell.font = { bold: true };
      sumCell.alignment = { horizontal: 'right' };
      sumCell.border = { top: { style: 'thin', color: { argb: 'FF999999' } } };
      shadeRow(tr, shaded);
      r++;
      groupIdx++;
    }
  } else {
    for (const row of data) {
      const xr = ws.getRow(r);
      row.forEach((v, i) => setCell(xr, i, v));
      shadeRow(xr, r % 2 === 1);
      r++;
    }
  }

  const sumIdx = REPORT_SUM_IDX[kind] || [];
  if (data.length && sumIdx.length) {
    const tr = ws.getRow(r);
    if (kind === 'orders') ws.mergeCells(r, 1, r, headers.length - 1);
    const lbl = tr.getCell(1);
    lbl.value = trText('Tổng cộng'); lbl.font = { bold: true, size: 12 };
    lbl.alignment = { horizontal: kind === 'orders' ? 'right' : 'left' };
    sumIdx.forEach(i => {
      const sum = data.reduce((s, row) => s + (Number(row[i]) || 0), 0);
      const cell = tr.getCell(i + 1);
      cell.value = sum; cell.numFmt = repCur(); cell.font = { bold: true, size: 12 };
      cell.alignment = { horizontal: 'right' }; cell.border = { top: { style: 'double' } };
    });
  }

  headers.forEach((h, i) => {
    let maxLen = h.length;
    data.forEach(row => { const s = String(row[i] ?? ''); if (s.length > maxLen) maxLen = s.length; });
    ws.getColumn(i + 1).width = Math.min(40, Math.max(10, maxLen + 2));
  });
  return wb;
}

/** Xuất báo cáo. Ưu tiên Excel có trình bày (cần thư viện ExcelJS tải từ CDN xong);
    nếu vì lý do gì đó thư viện chưa sẵn sàng, rơi về CSV thuần để người dùng vẫn có dữ liệu. */
async function exportExcelLocal(kind, from, to) {
  const rows = reportRowsLocal(kind, REPORT_RANGED[kind] ? from : null, REPORT_RANGED[kind] ? to : null);
  const rowsOut = rows.map(r => r.map(repTr));   // CSV dự phòng cũng theo ngôn ngữ
  if (rows.length < 2) { toast('Chưa có dữ liệu để xuất trong khoảng đã chọn'); return; }

  const rangeLabel = from != null
    ? `${trText('Từ')} ${new Date(from).toLocaleDateString(repLocale())} ${trText('đến')} ${new Date(to - 1).toLocaleDateString(repLocale())}`
    : trText('Toàn bộ');

  let blob, filename;
  if (typeof ExcelJS !== 'undefined') {
    try {
      const wb = buildStyledWorkbook(kind, rows, { label: rangeLabel });
      const buf = await wb.xlsx.writeBuffer();
      blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      filename = `${kind}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    } catch (e) { console.warn('Dựng Excel thất bại, dùng CSV thay thế:', e); }
  }
  if (!blob) {
    const fb = exportCsvFallback(kind, rowsOut);
    blob = fb.blob; filename = fb.filename;
    toast('Chưa tải được bộ định dạng Excel — xuất tạm bằng CSV');
  }

  const ok = await saveFile(filename, blob);
  if (!ok) { toast('Thiết bị không hỗ trợ tải tệp'); return; }
  addLog(ME ? ME.name : 'Hệ thống', 'Xuất báo cáo', `${kind} · ${rows.length - 1} dòng`);
  saveD();
  toast(`Đã xuất ${rows.length - 1} dòng`);
}

/* ---------- CHẾ ĐỘ KHÁCH (quét QR) ----------
   Mở bằng #g=<token>. Dùng đúng các endpoint khách của bản thật. */

/* ============================================================
   XUẤT TRANG THỰC ĐƠN TĨNH — thay cho việc khách gọi món qua QR.
   Vì v3.0 chạy trên một điện thoại, không có server nào để điện
   thoại của khách kết nối vào — nên QR không thể "gọi món" được
   nữa. Thay vào đó: xuất ra một trang HTML độc lập, tự chứa toàn
   bộ ảnh món (base64) và giá — khách chỉ XEM, không đặt được.
   Bạn tự đăng trang này lên bất kỳ đâu (Google Drive chia sẻ công
   khai, Google Sites, GitHub Pages...) rồi tạo mã QR trỏ tới đó
   trong mục "Mã QR thực đơn". Cập nhật giá/món thì xuất lại và
   đăng đè lên chỗ cũ — mã QR không cần đổi. */
function buildMenuPageHtml() {
  const rest = DB.restaurant || {};
  const cats = DB.categories.map(name => ({
    name,
    items: DB.menu.filter(m => m.cat === name && m.stock !== 'out')
  })).filter(c => c.items.length);

  const esc2 = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt2 = n => (Math.round(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';

  return `<!doctype html>
<html lang="${getLang()}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc2(rest.name || trText('Thực đơn'))}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#FBF8F3;color:#1A1613}
  .hdr{background:#D9581F;color:#fff;padding:28px 20px 22px;text-align:center}
  .hdr h1{margin:0;font-size:22px}
  .hdr .sub{margin-top:6px;font-size:13px;opacity:.9}
  .cats{display:flex;gap:8px;overflow-x:auto;padding:14px 16px;background:#fff;position:sticky;top:0;box-shadow:0 1px 0 #eee}
  .cats button{flex:none;padding:8px 16px;border-radius:999px;border:1px solid #ddd;background:#fff;font-size:13.5px;font-weight:600;color:#555}
  .cats button.on{background:#D9581F;border-color:#D9581F;color:#fff}
  .cat-block{padding:18px 16px 4px}
  .cat-block h2{font-size:15px;margin:0 0 10px;color:#D9581F}
  .item{display:flex;gap:12px;background:#fff;border-radius:14px;padding:12px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .item .thumb{width:64px;height:64px;border-radius:10px;flex:none;overflow:hidden;background:#F3EEE6;display:flex;align-items:center;justify-content:center;font-size:28px}
  .item .thumb img{width:100%;height:100%;object-fit:cover}
  .item .body{flex:1;min-width:0}
  .item .name{font-weight:700;font-size:15px}
  .item .desc{font-size:12.5px;color:#777;margin-top:2px}
  .item .price{font-family:monospace;font-weight:700;color:#D9581F;margin-top:6px;font-size:14.5px}
  .low{color:#B08900;font-size:11.5px;margin-left:6px}
  .foot{text-align:center;padding:24px 16px;font-size:12px;color:#999}
</style>
</head>
<body>
  <div class="hdr">
    <h1>${esc2(rest.name || trText('Thực đơn'))}</h1>
    <div class="sub">${rest.phone ? esc2(rest.phone) : ''}</div>
  </div>
  <div class="cats">
    ${cats.map((c, i) => `<button class="${i === 0 ? 'on' : ''}" onclick="showCat(${i})">${esc2(c.name)}</button>`).join('')}
  </div>
  ${cats.map((c, i) => `<div class="cat-block" id="cat${i}" style="${i === 0 ? '' : 'display:none'}">
    <h2>${esc2(c.name)}</h2>
    ${c.items.map(m => `<div class="item">
      <div class="thumb">${m.image ? `<img src="${m.image}">` : (m.emoji || '🍽️')}</div>
      <div class="body">
        <div class="name">${esc2(m.name)}</div>
        ${m.desc ? `<div class="desc">${esc2(m.desc)}</div>` : ''}
        <div class="price">${fmt2(m.price)}${m.stock === 'low' ? `<span class="low">· ${trText('sắp hết')}</span>` : ''}</div>
      </div>
    </div>`).join('')}
  </div>`).join('')}
  <div class="foot">${trText('Thực đơn có thể thay đổi — vui lòng hỏi nhân viên để biết giá và món mới nhất.')}</div>
  <script>
    function showCat(i){
      document.querySelectorAll('.cat-block').forEach((el,j)=>el.style.display = j===i?'':'none');
      document.querySelectorAll('.cats button').forEach((b,j)=>b.classList.toggle('on', j===i));
    }
  <\/script>
</body>
</html>`;
}

/** Xuất trang thực đơn ra tệp HTML để đăng lên nơi lưu trữ công khai (Google Drive chia sẻ
    công khai, Google Sites, GitHub Pages...). Xem hướng dẫn ngắn trong màn "Mã QR thực đơn". */
async function exportMenuPage() {
  const html = buildMenuPageHtml();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const filename = `thuc-don-${new Date().toISOString().slice(0, 10)}.html`;
  const ok = await saveFile(filename, blob);
  if (!ok) { toast('Thiết bị không hỗ trợ tải tệp'); return; }
  addLog(ME ? ME.name : 'Hệ thống', 'Xuất trang thực đơn', `${DB.menu.filter(m => m.stock !== 'out').length} món`);
  saveD();
  toast('Đã xuất trang thực đơn — đăng tệp này lên nơi lưu trữ công khai rồi làm mới mã QR');
}
