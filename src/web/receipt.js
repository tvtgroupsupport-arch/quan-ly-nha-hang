/* ============================================================
   HOÁ ĐƠN IN — dựng hoá đơn thành ẢNH rồi gửi máy in nhiệt Bluetooth (khổ 58mm hoặc 80mm), hoặc lưu thành PDF khi chưa có máy in.
   In dạng ảnh (không in chữ bằng lệnh ESC/POS) vì phần lớn máy in nhiệt giá rẻ KHÔNG có bảng mã tiếng Việt: in chữ sẽ vỡ dấu.
   Ảnh vẽ bằng canvas với phông của điện thoại nên mọi dấu tiếng Việt đều đúng, dùng chung cho mọi hãng máy in.
   Bố cục tính bằng hàm thuần (layoutReceipt) nên kiểm thử được mà không cần canvas.
   ============================================================ */
const RECEIPT = (() => {
  const PAPER = {
    58: { dots: 384, mm: 48, font: 22 },     // giấy 58mm: vùng in rộng ~48mm = 384 điểm ở 203dpi
    80: { dots: 576, mm: 72, font: 24 }      // giấy 80mm: vùng in rộng ~72mm = 576 điểm
  };
  const MARGIN = 6;                           // lề hai bên (điểm ảnh)
  const FONT_STACK = '"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  /** Tách chữ thành các dòng vừa bề rộng maxW (px); từ quá dài thì cắt theo ký tự. */
  function wrap(measure, text, maxW) {
    const words = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
    const lines = []; let cur = '';
    for (const w of words) {
      if (measure(w) > maxW) {
        if (cur) { lines.push(cur); cur = ''; }
        let piece = '';
        for (const ch of w) { if (measure(piece + ch) > maxW && piece) { lines.push(piece); piece = ch; } else piece += ch; }
        cur = piece; continue;
      }
      const next = cur ? cur + ' ' + w : w;
      if (measure(next) <= maxW) cur = next; else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [''];
  }

  /** Dựng danh sách lệnh vẽ + chiều cao. measure(text, px, weight) → bề rộng px.
      model: { shop, address, phone, title, code, where, time, cashier, items:[{name, qty, unit, amount, note}],
               rows:[{label, value, bold, big}], footer, labels:{code,where,time,cashier} } — mọi chuỗi đã dịch/định dạng sẵn. */
  function layoutReceipt(measure, model, paperKey) {
    const P = PAPER[paperKey] || PAPER[58], W = P.dots, F = P.font, inner = W - MARGIN * 2;
    const ops = []; let y = 6;
    const m = (px, wt) => t => measure(t, px, wt);
    const lh = px => Math.round(px * 1.28);
    const text = (t, px, wt, align, extra) => { ops.push({ t: 'text', text: t, px, wt, align: align || 'left', y, ...(extra || {}) }); };
    const para = (t, px, wt, align) => { for (const ln of wrap(m(px, wt), t, inner)) { text(ln, px, wt, align); y += lh(px); } };
    const sep = (style) => { y += 4; ops.push({ t: 'line', y, style: style || 'dash' }); y += 8; };
    const kv = (label, value) => {                      // "Nhãn: giá trị" — xuống dòng nếu dài
      const t = label ? `${label}: ${value}` : value;
      para(t, F * 0.92, 400, 'left');
    };

    if (model.shop) para(model.shop, Math.round(F * 1.3), 800, 'center');
    if (model.address) para(model.address, Math.round(F * 0.82), 400, 'center');
    if (model.phone) para(model.phone, Math.round(F * 0.82), 400, 'center');
    sep('dash');
    para(model.title, Math.round(F * 1.12), 800, 'center');
    y += 2;
    const L = model.labels || {};
    if (model.code) kv(L.code, model.code);
    if (model.where) kv(L.where, model.where);
    if (model.time) kv(L.time, model.time);
    if (model.cashier) kv(L.cashier, model.cashier);
    sep('dash');

    for (const it of model.items) {
      para(it.name, F, 700, 'left');                    // tên món (đậm), xuống dòng nếu dài
      if (it.note) para('  · ' + it.note, Math.round(F * 0.8), 400, 'left');
      // dòng "SL x đơn giá ........ thành tiền"
      const left = `${it.qty} x ${it.unit}`, px = Math.round(F * 0.95);
      text(left, px, 400, 'left', { x: MARGIN + Math.round(F * 0.6) });
      text(it.amount, px, 400, 'right');
      y += lh(px) + 3;
    }
    sep('dash');

    for (const r of model.rows) {
      const px = r.big ? Math.round(F * 1.3) : F, wt = r.bold || r.big ? 800 : 400;
      // nhãn bên trái, giá trị bên phải; nhãn dài thì xuống dòng riêng
      if (measure(r.label, px, wt) + measure(r.value, px, wt) + 12 > inner) {
        para(r.label, px, wt, 'left'); text(r.value, px, wt, 'right'); y += lh(px);
      } else { text(r.label, px, wt, 'left'); text(r.value, px, wt, 'right'); y += lh(px) + (r.big ? 4 : 0); }
    }
    if (model.footer) { sep('dash'); para(model.footer, Math.round(F * 0.9), 400, 'center'); }
    y += 18;                                            // chừa giấy trắng cuối hoá đơn trước khi cắt
    return { ops, height: y, width: W, paper: P };
  }

  /** Vẽ lên canvas → PNG (data URL). Trả về { dataUrl, width, height, mmH } (mmH: chiều cao thực khi in, để làm PDF). */
  async function render(model, paperKey) {
    const P = PAPER[paperKey] || PAPER[58];
    const probe = document.createElement('canvas').getContext('2d');
    try { if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('700 16px "Be Vietnam Pro"'), new Promise(r => setTimeout(r, 1200))]); } catch (e) {}
    const fontOf = (px, wt) => `${wt} ${px}px ${FONT_STACK}`;
    const measure = (t, px, wt) => { probe.font = fontOf(px, wt); return probe.measureText(t).width; };
    const lay = layoutReceipt(measure, model, paperKey);
    const cv = document.createElement('canvas'); cv.width = lay.width; cv.height = lay.height;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#000'; ctx.textBaseline = 'top';
    for (const op of lay.ops) {
      if (op.t === 'line') {
        ctx.save(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5; ctx.setLineDash(op.style === 'dash' ? [6, 4] : []);
        ctx.beginPath(); ctx.moveTo(MARGIN, op.y + 0.5); ctx.lineTo(cv.width - MARGIN, op.y + 0.5); ctx.stroke(); ctx.restore();
      } else {
        ctx.font = fontOf(op.px, op.wt);
        ctx.textAlign = op.align === 'center' ? 'center' : op.align === 'right' ? 'right' : 'left';
        const x = op.align === 'center' ? cv.width / 2 : op.align === 'right' ? cv.width - MARGIN : (op.x != null ? op.x : MARGIN);
        ctx.fillText(op.text, x, op.y);
      }
    }
    const mmPerDot = P.mm / P.dots;
    return { dataUrl: cv.toDataURL('image/png'), width: cv.width, height: cv.height, mmH: cv.height * mmPerDot };
  }

  /** PDF một trang đúng khổ cuộn giấy (rộng 58/80mm, dài theo hoá đơn) — để lưu/chia sẻ khi chưa có máy in nhiệt */
  async function renderPdf(model, paperKey) {
    const P = PAPER[paperKey] || PAPER[58];
    const img = await render(model, paperKey);
    // PNG → JPEG nền trắng (bộ ghi PDF dùng JPEG)
    const src = new Image(); src.src = img.dataUrl; await new Promise((res, rej) => { src.onload = res; src.onerror = rej; });
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(src, 0, 0);
    const b64 = cv.toDataURL('image/jpeg', 0.92).split(',')[1];
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    // Trang rộng đúng 58/80mm (vùng in + lề giấy 5mm hai bên) để máy in/ứng dụng in nhận đúng khổ cuộn
    const paperMm = Number(paperKey) === 80 ? 80 : 58, scale = paperMm / P.mm;
    const pdf = QRPDF.pdfFromJpegs([{ w: img.width, h: img.height, bytes, mmW: paperMm, mmH: img.mmH * scale }]);
    return new Blob([pdf], { type: 'application/pdf' });
  }
  return { PAPER, layoutReceipt, wrap, render, renderPdf };
})();
