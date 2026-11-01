import fs from 'node:fs';
let s = fs.readFileSync('test/run-tests-explore.mjs', 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
const rep = (a, b) => { if (!s.includes(a)) throw new Error('missing ' + a.slice(0, 70)); s = s.replace(a, () => b); };
// 1) "mỗi ghế một đơn mở" không phải bất biến của app (app cho phép, hai đơn đều thu được) → chuyển thành ghi nhận
rep("  const open = D.orders.filter(o => o.status === 'open');\n  const seatCount = {};\n  open.forEach(o => { if (o.table_id) { const k = o.table_id + '#' + o.seat_no; seatCount[k] = (seatCount[k] || 0) + 1; } });\n  Object.entries(seatCount).forEach(([k, n]) => { if (n > 1) bad.push(`ghế ${k} có ${n} đơn đang mở`); });\n", "");
rep("const HOSTILE = [", "/** Số ghế đang có nhiều hơn 1 đơn mở (không phải lỗi dữ liệu — cả hai đơn vẫn thu được — nhưng gây rối khi thu tiền) */\nconst dupSeats = dev => { const c = {}; dev.D.orders.filter(o => o.status === 'open' && o.table_id).forEach(o => { const k = o.table_id + '#' + o.seat_no; c[k] = (c[k] || 0) + 1; }); return Object.values(c).filter(n => n > 1).length; };\nconst HOSTILE = [");
rep("  t.eq(invariants(A), [], 'bất biến dữ liệu máy chủ quán sau 400 thao tác ngẫu nhiên');", "  if (dupSeats(A)) note('trung bình', `Sau 400 thao tác ngẫu nhiên trên 2 máy (có lúc offline) có ${dupSeats(A)} ghế bị tạo 2 đơn mở cùng lúc — đúng lỗi gộp đơn cùng ghế ở trên.`);\n  t.eq(invariants(A), [], 'bất biến dữ liệu máy chủ quán sau 400 thao tác ngẫu nhiên');");
// 2) khách gửi số lượng xấu: máy chủ KẸP về 1..50 (thiết kế), không từ chối
rep("    ['số lượng 0', [{ menuItemId: tra, qty: 0 }], /./],\n    ['số lượng âm', [{ menuItemId: tra, qty: -3 }], /./], ['số lượng 1e9', [{ menuItemId: tra, qty: 1e9 }], /./], ['số lượng lẻ 1.5', [{ menuItemId: tra, qty: 1.5 }], /./], ['món không tồn tại'", "    ['món không tồn tại'");
rep("  const evil = await g.rpc('guest_order'", "  for (const [label, q] of [['0', 0], ['âm (−3)', -3], ['1e9', 1e9], ['lẻ 1.5', 1.5], ['chuỗi \"abc\"', 'abc']]) {\n    const before = w.store.colRows('orderItems').length, r = await g.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: tra, qty: q }] });\n    const rows = w.store.colRows('orderItems'), added = rows.length > before ? rows.reduce((a, b) => (b.seq > a.seq ? b : a)) : null;\n    t.ok(!!r.error || (added && added.data.qty >= 1 && added.data.qty <= 50), `khách gửi số lượng ${label} → bị từ chối hoặc kẹp về 1–50 (không tạo số lượng vô lý)` + (added ? ' [qty=' + added.data.qty + ']' : r.error ? ' [' + r.error.message + ']' : ''));\n  }\n  const evil = await g.rpc('guest_order'");
// 3) dọn đoạn thử CSV dở dang trong E2
const i0 = s.indexOf("  // CSV / Excel: ô bắt đầu bằng"), i1 = s.indexOf("  void hasGuard;\n") + "  void hasGuard;\n".length;
if (i0 < 0 || i1 < i0) throw new Error('csv block');
s = s.slice(0, i0) + s.slice(i1);
fs.writeFileSync('test/run-tests-explore.mjs', s);
console.log('ok');
