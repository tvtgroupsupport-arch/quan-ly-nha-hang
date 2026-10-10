/* ============================================================
   TẠO FILE PDF TEM MÃ QR (khổ A4) — thay cho việc mở hộp thoại in của hệ thống.
   App vẽ từng trang A4 lên canvas ở 300 dpi (chữ có dấu tiếng Việt dùng phông của máy nên luôn đúng), nén JPEG, rồi ghép thành
   MỘT tệp PDF bằng bộ ghi PDF tối giản bên dưới (không cần thư viện ngoài). Người dùng nhận tệp qua hộp thoại Lưu/Chia sẻ và tự in.
   Kích thước tem giữ nguyên 50×60mm, xếp 3 cột × 4 hàng = 12 tem/trang, cách nhau 4mm, viền đứt để cắt.
   Tên quán dài tự xuống dòng (và thu nhỏ chữ dần, tối thiểu 5pt) để không bị cắt mất.
   ============================================================ */
const QRPDF = (() => {
  const A4 = { w: 210, h: 297 };                       // mm
  const TAG = { w: 50, h: 60, pad: 2.5, qr: 36 };       // mm — đúng như tem in trước đây
  const GRID = { cols: 3, rows: 4, gap: 4 };
  const PER_PAGE = GRID.cols * GRID.rows;
  const DPI = 300, PX_MM = DPI / 25.4;
  const PT = 25.4 / 72;                                  // 1pt = 0.3528mm

  /** Tách chữ thành các dòng vừa bề rộng maxW (mm). Từ quá dài thì cắt theo ký tự. measure(text) trả về bề rộng mm. */
  function wrap(measure, text, maxW) {
    const words = String(text == null ? '' : text).split(/\s+/).filter(Boolean);
    const lines = []; let cur = '';
    const push = () => { if (cur) lines.push(cur); cur = ''; };
    for (const w of words) {
      if (measure(w) > maxW) {                           // một từ dài hơn cả dòng: cắt theo ký tự
        push();
        let piece = '';
        for (const ch of w) { if (measure(piece + ch) > maxW && piece) { lines.push(piece); piece = ch; } else piece += ch; }
        cur = piece; continue;
      }
      const next = cur ? cur + ' ' + w : w;
      if (measure(next) <= maxW) cur = next; else { push(); cur = w; }
    }
    push();
    return lines.length ? lines : [''];
  }
  function ellipsize(measure, line, maxW) {
    if (measure(line) <= maxW) return line;
    let s = line;
    while (s.length > 1 && measure(s + '…') > maxW) s = s.slice(0, -1);
    return s + '…';
  }

  /** Sắp xếp nội dung một tem (đơn vị mm/pt) — hàm thuần, không đụng canvas, nên kiểm thử được.
      measure(text, pt, weight) → bề rộng (mm). Trả về { blocks:[{text,pt,weight,color,lines:[..],lineH,top}], qrTop }. */
  function layoutTag(measure, tag) {
    const W = TAG.w - TAG.pad * 2, H = TAG.h - TAG.pad * 2;
    const lh = (pt, k) => pt * PT * (k || 1.2);
    const fit1 = (text, pt, weight, minPt) => {         // thu nhỏ để vừa MỘT dòng, không được thì cắt "…"
      let p = pt;
      while (p > minPt && measure(text, p, weight) > W) p -= 0.25;
      return { pt: p, lines: [ellipsize(t => measure(t, p, weight), text, W)] };
    };
    const wrapAt = (text, pt, weight, maxLines) => {
      const ls = wrap(t => measure(t, pt, weight), text, W);
      return ls.length <= maxLines ? ls : null;
    };

    // Tiêu đề "bàn · ghế": 10pt đậm, vừa một dòng; quá dài thì xuống tối đa 2 dòng
    let where = fit1(tag.where, 10, 800, 7.5);
    if (measure(tag.where, where.pt, 800) > W) {
      const two = wrapAt(tag.where, 8, 800, 2);
      where = two ? { pt: 8, lines: two } : { pt: 7.5, lines: wrap(t => measure(t, 7.5, 800), tag.where, W).slice(0, 2).map(l => ellipsize(t => measure(t, 7.5, 800), l, W)) };
    }
    const whereH = where.lines.length * lh(where.pt, 1.15) + 2;      // + lề trên/dưới 1mm

    const build = (hintLines, withArea) => {
      let hint = wrapAt(tag.hint, 6.5, 400, hintLines);
      let hintPt = 6.5;
      if (!hint) {                                        // không vừa số dòng cho phép: thu nhỏ chữ dần
        for (let p = 6; p >= 5 && !hint; p -= 0.25) { hint = wrapAt(tag.hint, p, 400, hintLines); hintPt = p; }
        if (!hint) { hintPt = 5; hint = wrap(t => measure(t, 5, 400), tag.hint, W).slice(0, hintLines).map(l => ellipsize(t => measure(t, 5, 400), l, W)); }
      }
      const hintH = 1 + hint.length * lh(hintPt);
      const area = withArea && tag.area ? fit1(tag.area, 6, 400, 5) : null;
      const areaH = area ? 0.5 + lh(area.pt) : 0;
      const avail = H - TAG.qr - whereH - hintH - areaH;     // chỗ còn lại cho tên quán
      return { hint, hintPt, hintH, area, areaH, avail };
    };
    let b = build(2, true);
    const shopTry = (avail) => {                           // tên quán: 7pt → 5pt, nhiều dòng nếu cần, vừa chỗ còn lại
      for (let p = 7; p >= 5; p -= 0.25) {
        const ls = wrap(t => measure(t, p, 700), tag.shop, W);
        if (ls.length * lh(p) <= avail + 1e-6) return { pt: p, lines: ls };
      }
      return null;
    };
    let shop = tag.shop ? shopTry(b.avail) : { pt: 7, lines: [] };
    if (!shop) { b = build(1, false); shop = shopTry(b.avail); }   // vẫn dài: gọn phần chú thích (1 dòng, bỏ tên khu) để dành chỗ
    if (!shop) {                                                   // cực dài: 5pt, cắt "…" ở dòng cuối
      const maxLines = Math.max(1, Math.floor(b.avail / lh(5)));
      const ls = wrap(t => measure(t, 5, 700), tag.shop, W);
      const cut = ls.slice(0, maxLines);
      if (ls.length > maxLines) cut[cut.length - 1] = ellipsize(t => measure(t, 5, 700), cut[cut.length - 1] + '…', W);
      shop = { pt: 5, lines: cut };
    }
    const shopH = shop.lines.length * lh(shop.pt);

    // Xếp từ trên xuống
    let y = TAG.pad;
    const blocks = [];
    if (shop.lines.length) { blocks.push({ kind: 'shop', lines: shop.lines, pt: shop.pt, weight: 700, color: '#111', lineH: lh(shop.pt), top: y }); y += shopH; }
    y += 1; blocks.push({ kind: 'where', lines: where.lines, pt: where.pt, weight: 800, color: '#111', lineH: lh(where.pt, 1.15), top: y }); y += whereH - 1;
    const qrTop = y; y += TAG.qr;
    y += 1; blocks.push({ kind: 'hint', lines: b.hint, pt: b.hintPt, weight: 400, color: '#555', lineH: lh(b.hintPt), top: y }); y += b.hint.length * lh(b.hintPt);
    if (b.area) { y += 0.5; blocks.push({ kind: 'area', lines: b.area.lines, pt: b.area.pt, weight: 400, color: '#888', lineH: lh(b.area.pt), top: y }); y += lh(b.area.pt); }
    return { blocks, qrTop, bottom: y };
  }

  /** Vị trí góc trên-trái (mm) của tem thứ i (0..11) trong một trang */
  function tagOrigin(i) {
    const gridW = GRID.cols * TAG.w + (GRID.cols - 1) * GRID.gap, gridH = GRID.rows * TAG.h + (GRID.rows - 1) * GRID.gap;
    const x0 = (A4.w - gridW) / 2, y0 = (A4.h - gridH) / 2;
    return { x: x0 + (i % GRID.cols) * (TAG.w + GRID.gap), y: y0 + Math.floor(i / GRID.cols) * (TAG.h + GRID.gap) };
  }

  /** Vẽ một trang lên canvas 2D. tags: tối đa 12 tem { shop, where, hint, area, matrix } (matrix = QR.matrix()). */
  function drawPage(ctx, tags, fontStack) {
    const W = Math.round(A4.w * PX_MM), H = Math.round(A4.h * PX_MM);
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    const fontOf = (pt, weight) => `${weight} ${pt * PT * PX_MM}px ${fontStack}`;
    const measure = (text, pt, weight) => { ctx.font = fontOf(pt, weight); return ctx.measureText(text).width / PX_MM; };
    tags.forEach((tag, i) => {
      const o = tagOrigin(i), px = v => v * PX_MM;
      // viền đứt bo góc 2mm để cắt
      ctx.save(); ctx.strokeStyle = '#bbb'; ctx.lineWidth = 2; ctx.setLineDash([9, 7]);
      const r = px(2), x = px(o.x), y = px(o.y), w = px(TAG.w), h = px(TAG.h);
      ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.stroke(); ctx.restore();

      const lay = layoutTag(measure, tag);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const cx = px(o.x + TAG.w / 2);
      for (const b of lay.blocks) {
        ctx.font = fontOf(b.pt, b.weight); ctx.fillStyle = b.color;
        b.lines.forEach((ln, k) => ctx.fillText(ln, cx, px(o.y + b.top + k * b.lineH + (b.lineH - b.pt * PT) / 2 - 0.1)));
      }
      // mã QR: ô vuông nguyên số điểm ảnh → nét sắc; vùng trắng bao quanh 4 ô theo chuẩn
      const m = tag.matrix, n = m.length, total = n + 8;
      const box = Math.floor(px(TAG.qr)), cell = Math.max(1, Math.floor(box / total));
      const size = cell * total, qx = Math.round(cx - size / 2), qy = Math.round(px(o.y + lay.qrTop) + (box - size) / 2);
      ctx.fillStyle = '#fff'; ctx.fillRect(qx, qy, size, size); ctx.fillStyle = '#1A1613';
      for (let rr = 0; rr < n; rr++) for (let cc = 0; cc < n; cc++) if (m[rr][cc]) ctx.fillRect(qx + (cc + 4) * cell, qy + (rr + 4) * cell, cell, cell);
    });
  }

  /** Ghép các trang JPEG thành một tệp PDF. pages: [{ w, h, bytes:Uint8Array }] (w,h tính bằng điểm ảnh). Trả về Uint8Array. */
  function pdfFromJpegs(pages) {
    const enc = new TextEncoder(), chunks = [], offsets = [];
    let len = 0;
    const push = x => { const b = typeof x === 'string' ? enc.encode(x) : x; chunks.push(b); len += b.length; };
    const MW = (A4.w / 25.4 * 72).toFixed(2), MH = (A4.h / 25.4 * 72).toFixed(2);
    push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34, 0x0A, 0x25, 0xE2, 0xE3, 0xCF, 0xD3, 0x0A]));   // %PDF-1.4 + dấu nhị phân
    const obj = (n, body, stream) => {
      offsets[n] = len;
      push(`${n} 0 obj\n${body}\n`);
      if (stream) { push('stream\n'); push(stream); push('\nendstream\n'); }
      push('endobj\n');
    };
    const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`);
    pages.forEach((p, i) => {
      const pg = 3 + i * 3, ct = pg + 1, im = pg + 2;
      // mặc định A4; trang có mmW/mmH (hoá đơn cuộn 58/80mm) dùng khổ riêng
      const pw = p.mmW ? (p.mmW / 25.4 * 72).toFixed(2) : MW, ph = p.mmH ? (p.mmH / 25.4 * 72).toFixed(2) : MH;
      obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pw} ${ph}] /Resources << /XObject << /Im0 ${im} 0 R >> >> /Contents ${ct} 0 R >>`);
      const content = enc.encode(`q ${pw} 0 0 ${ph} 0 0 cm /Im0 Do Q`);
      obj(ct, `<< /Length ${content.length} >>`, content);
      obj(im, `<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bytes.length} >>`, p.bytes);
    });
    const count = 3 + pages.length * 3;
    const xref = len;
    let x = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let n = 1; n < count; n++) x += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
    push(x + `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    const out = new Uint8Array(len); let pos = 0;
    for (const c of chunks) { out.set(c, pos); pos += c.length; }
    return out;
  }

  /** Dựng PDF từ danh sách tem. Cần canvas (có trong WebView). Trả về Blob application/pdf. */
  async function build(tags) {
    const W = Math.round(A4.w * PX_MM), H = Math.round(A4.h * PX_MM);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const stack = `"Be Vietnam Pro", system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`;
    try { if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load('700 16px "Be Vietnam Pro"'), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
    const pages = [];
    for (let i = 0; i < tags.length; i += PER_PAGE) {
      drawPage(ctx, tags.slice(i, i + PER_PAGE), stack);
      const b64 = cv.toDataURL('image/jpeg', 0.88).split(',')[1];
      const bin = atob(b64), bytes = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
      pages.push({ w: W, h: H, bytes });
      await new Promise(r => setTimeout(r, 0));          // nhường luồng giao diện giữa các trang
    }
    return new Blob([pdfFromJpegs(pages)], { type: 'application/pdf' });
  }
  return { A4, TAG, GRID, PER_PAGE, wrap, layoutTag, tagOrigin, pdfFromJpegs, build };
})();
