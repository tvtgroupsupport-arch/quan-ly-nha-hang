/* ============================================================
   IN HOÁ ĐƠN — dựng nội dung hoá đơn từ đơn hàng, gửi máy in nhiệt Bluetooth (58/80mm) hoặc lưu PDF khi chưa có máy in.
   Cài đặt máy in là RIÊNG TỪNG MÁY (mỗi điện thoại ghép với máy in của mình) nên lưu cục bộ, không đồng bộ giữa các máy.
   Địa chỉ quán và lời cảm ơn cuối hoá đơn là cài đặt chung của quán (đồng bộ).
   ============================================================ */
const PRINTER_KEY = 'printer_cfg';
const BILL_FOOTER_DEFAULT = 'Cảm ơn quý khách — hẹn gặp lại!';

function printerCfg() {
  const dflt = { address: '', name: '', width: 58 };
  try { return Object.assign(dflt, JSON.parse(localStorage.getItem(PRINTER_KEY) || '{}')); } catch (e) { return dflt; }
}
function setPrinterCfg(patch) {
  const cfg = Object.assign(printerCfg(), patch || {});
  try { localStorage.setItem(PRINTER_KEY, JSON.stringify(cfg)); } catch (e) {}
  return cfg;
}
const billMoney = n => trText(fmt(n));

/** Dựng nội dung hoá đơn. src: { kind:'temp'|'paid', code, where, ts, cashier, items:[{name,qty,price,note}],
    subtotal, discount, promoName, total, method, given, change } — chuỗi hiển thị đều đi qua trText (theo ngôn ngữ đang chọn). */
function receiptModel(src) {
  const rest = DB.restaurant || {};
  const paid = src.kind === 'paid';
  const rows = [{ label: trText('Tạm tính'), value: billMoney(src.subtotal) }];
  if (src.discount) rows.push({ label: src.promoName ? `${trText('Giảm giá')} (${src.promoName})` : trText('Giảm giá'), value: '−' + billMoney(src.discount) });
  rows.push({ label: trText('Tổng cộng').toUpperCase(), value: billMoney(src.total), big: true });
  if (paid) {
    if (src.method) rows.push({ label: trText('Phương thức'), value: trText(src.method) });
    if (src.given) rows.push({ label: trText('Khách đưa'), value: billMoney(src.given) });
    if (src.change) rows.push({ label: trText('Tiền thừa trả khách'), value: billMoney(src.change) });
  } else rows.push({ label: trText('Chưa thanh toán').toUpperCase(), value: '', bold: true });
  return {
    shop: rest.name || '', address: rest.address || '', phone: rest.phone ? `${trText('SĐT:')} ${rest.phone}` : '',
    title: (paid ? trText('Hoá đơn thanh toán') : trText('Hoá đơn tạm tính')).toUpperCase(),
    labels: { code: trText('Mã đơn'), where: trText('Bàn'), time: trText('Thời gian'), cashier: trText('Thu ngân') },
    code: src.code || '', where: trText(src.where || ''), time: src.ts ? new Date(src.ts).toLocaleString(typeof repLocale === 'function' ? repLocale() : 'vi-VN') : '',
    cashier: src.cashier || '',
    items: (src.items || []).map(i => ({ name: i.name, qty: i.qty, unit: billMoney(i.price), amount: billMoney(i.price * i.qty), note: i.note || '' })),
    rows,
    footer: (DB.settings && DB.settings.billFooter != null ? DB.settings.billFooter : trText(BILL_FOOTER_DEFAULT)) || ''
  };
}
/** Nơi ngồi hiển thị trên hoá đơn: "Bàn 04 · Ghế 2", hoá đơn gộp, hoặc giao hàng */
function billWhere(o) {
  if (isMerged(o)) return `Hoá đơn gộp · ${o.seats.length} ghế`;
  const t = o.tableId ? tableById(o.tableId) : null;
  return t ? `${t.name} · Ghế ${o.seatNo}` : 'Giao hàng';
}
function modelFromOrder(o, extra) {
  const tt = orderTotal(o);
  return receiptModel(Object.assign({
    kind: 'temp', code: o.code || '', where: billWhere(o), ts: now(), cashier: ME ? ME.name : '',
    items: o.items.map(i => ({ name: i.name, qty: i.qty, price: i.price, note: i.note })),
    subtotal: tt.sub, discount: tt.disc, promoName: tt.promo ? tt.promo.name : '', total: tt.total
  }, extra || {}));
}
/** Hoá đơn từ chi tiết đơn trong Lịch sử (đơn đã thanh toán — in lại) */
function modelFromDetail(d) {
  const pay = (d.payments || []).find(p => p.state === 'paid') || (d.payments || [])[0];
  const items = (d.items || []).filter(i => i.status !== 'cancelled');
  const gw = pay ? (DB.gateways.find(g => g.id === pay.method) || {}).name || pay.method : '';
  return receiptModel({
    kind: pay && pay.state === 'paid' ? 'paid' : 'temp', code: d.code || '',
    where: d.table_name ? `${d.table_name}${d.seat_no ? ` · Ghế ${d.seat_no}` : ''}` : 'Giao hàng',
    ts: (pay && pay.paid_at) || d.created_at, cashier: pay && pay.staff_id ? ((DB.staff.find(s => s.id === pay.staff_id) || {}).name || '') : '',
    items: items.map(i => ({ name: i.name_snapshot, qty: i.qty, price: i.price_snapshot, note: i.note })),
    subtotal: d.subtotal, discount: d.discount, promoName: d.promo ? d.promo.name : '', total: d.total, method: gw
  });
}

/** In hoá đơn. forcePdf = true: luôn lưu PDF (để gửi khách / in bằng ứng dụng khác). Trả về 'printer' | 'pdf' | null. */
async function printBill(model, forcePdf) {
  const cfg = printerCfg();
  const canPrint = !forcePdf && cfg.address && typeof NativeBridge !== 'undefined' && NativeBridge.printer;
  if (canPrint) {
    try {
      toast('Đang in hoá đơn…');
      const img = await RECEIPT.render(model, cfg.width);
      await NativeBridge.printer.printImage(img.dataUrl, RECEIPT.PAPER[cfg.width].mm, cfg.address);
      toast('Đã gửi hoá đơn tới máy in');
      return 'printer';
    } catch (e) {
      console.warn('Printer error:', e);
      toast('Không in được — kiểm tra máy in đã bật và ghép đôi Bluetooth. Đang lưu hoá đơn thành PDF…');
    }
  }
  try {
    const blob = await RECEIPT.renderPdf(model, cfg.width);
    const ok = await saveFile(`hoa-don-${String(model.code || Date.now()).replace(/[^\w-]+/g, '')}.pdf`, blob, 'application/pdf');
    toast(ok ? 'Đã tạo PDF hoá đơn — mở file để in hoặc gửi cho khách' : 'Thiết bị không hỗ trợ tải tệp');
    return ok ? 'pdf' : null;
  } catch (e) { console.warn('Receipt PDF error:', e); toast('Không tạo được hoá đơn'); return null; }
}
