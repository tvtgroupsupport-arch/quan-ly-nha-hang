/* Kiểm thử ĐỘ CHÍNH XÁC THỜI GIAN & ĐẦY ĐỦ DỮ LIỆU của báo cáo (chạy riêng: `node --experimental-sqlite --no-warnings test/run-tests-time.mjs`).
   Chạy lại dưới nhiều múi giờ bằng test/run-tests-time-all.mjs (đặt biến TZ cho từng lượt).
   Đối chiếu app với phép tính ĐỘC LẬP (duyệt từng bản ghi, dùng mốc 0h theo lịch của múi giờ máy) thay vì dùng chính hàm của app để tự kiểm. */
import { newWorld, newDevice, suite, STORE_URL, ANON } from './harness.mjs';

const t = suite();
const warnings = [];
const world = () => { const w = newWorld(); w.central.trialDays = 3650; return w; };     // gói dùng thử rất dài để đồng hồ giả nhảy xa không bị khoá gói cước
const warn = msg => { warnings.push(msg); console.log('   ⚠ ' + msg); };
const TZ_NAME = Intl.DateTimeFormat().resolvedOptions().timeZone;
const MIN = 60000, H = 3600000, DAY = 86400000;
const at = (y, m, d, h = 0, mi = 0, s = 0, ms = 0) => new Date(y, m - 1, d, h, mi, s, ms).getTime();       // mốc theo giờ ĐỊA PHƯƠNG của máy chạy test
const ymd = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const nextMidnight = ts => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime(); };   // theo lịch (đúng cả ngày đổi giờ mùa hè)
const setNow = (dev, ts) => { dev.clockOffset = 0; dev.clockOffset = ts - Date.now(); };
function rng(seed) { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }

async function setupOwner(world, { link = true, name = 'owner' } = {}) {
  const A = await newDevice(world, name);
  await A.Cloud.ownerSignUp('chu@quan.vn', 'matkhau1', 'Quán A');
  await A.License.refresh(true);
  await A.createStore({ shopName: 'Quán A', ownerName: 'Chủ Quán', username: 'chuquan', appPassword: 'chuquan123', sample: true });
  await A.Cloud.saveCfg({ role: 'owner' });
  await A.Persist.flush();
  if (link) { await A.Cloud.linkStoreAsOwner({ url: STORE_URL, anonKey: ANON, email: 'chu@quan.vn', password: 'matkhau1' }); await A.sync(); }
  await A.login('chuquan', 'chuquan123');
  return A;
}
async function addStaffDevice(world, owner, name) {
  const inv = await owner.Cloud.createInvite();
  const S = await newDevice(world, name);
  await S.Cloud.joinAsStaff(inv.payload, name);
  await S.sync();
  return S;
}
const menuId = (dev, name) => dev.D.menu.find(m => m.name === name).id;
async function serveAll(dev, orderId) {
  for (const it of dev.D.orderItems.filter(i => i.order_id === orderId && i.status !== 'cancelled')) {
    await dev.api(`/kds/items/${it.id}/start`, { method: 'POST' });
    await dev.api(`/kds/items/${it.id}/done`, { method: 'POST' });
  }
}
/** Bán một đơn đúng quy trình thật của app tại thời điểm ts: gọi món → bếp làm → thu tiền */
async function sell(dev, ts, tableName, seat, lines, method = 'cash') {
  const tb = dev.D.tables.find(x => x.name === tableName);
  setNow(dev, ts);
  const o = await dev.api('/orders/items', { method: 'POST', body: { tableId: tb.id, seatNo: seat, lines: lines.map(([n, q]) => ({ menuItemId: menuId(dev, n), qty: q })) } });
  setNow(dev, ts + 10 * MIN); await serveAll(dev, o.id);
  setNow(dev, ts + 20 * MIN);
  const p = await dev.api(`/orders/${o.id}/payments`, { method: 'POST', body: { method } });
  return { orderId: o.id, paymentId: p.paymentId, total: p.total };
}

/* ============================================================ */
console.log(`Múi giờ chạy kiểm thử: ${TZ_NAME} (UTC${-new Date().getTimezoneOffset() / 60 >= 0 ? '+' : ''}${-new Date().getTimezoneOffset() / 60})`);

t.group('T1. Thời điểm ghi nhận: đơn / món / thanh toán lấy đúng giờ máy lúc thao tác (kể cả qua nửa đêm)');
{
  const w = world(); const A = await setupOwner(w, { link: false });
  await A.api('/settings', { method: 'PATCH', body: { autoLock: false } });
  const t1 = at(2026, 3, 15, 23, 50, 0);                  // 23h50 — gọi món, thu tiền sau nửa đêm (00h10 hôm sau)
  const r = await sell(A, t1, 'Bàn 01', 1, [['Phở bò tái', 2], ['Trà đá', 1]]);
  const o = A.D.orders.find(x => x.id === r.orderId), p = A.D.payments.find(x => x.id === r.paymentId);
  const near = (a, b, tol = 5000) => Math.abs(a - b) <= tol;
  t.ok(near(o.created_at, t1), `đơn tạo lúc 23:50 ngày 15/03 → created_at = ${new Date(o.created_at).toLocaleString('vi-VN')}`);
  t.ok(near(p.paid_at, t1 + 20 * MIN), `thu tiền sau nửa đêm → paid_at = ${new Date(p.paid_at).toLocaleString('vi-VN')} (ngày 16/03)`);
  t.eq(ymd(p.paid_at), '2026-03-16', 'thanh toán sau 0h tính vào NGÀY HÔM SAU (doanh thu theo ngày thu tiền)');
  t.eq(ymd(o.created_at), '2026-03-15', 'đơn hàng vẫn thuộc ngày gọi món (báo cáo đơn hàng theo ngày tạo)');
  t.ok(A.D.orderItems.filter(i => i.order_id === o.id).every(i => near(i.created_at, t1)), 'các món có created_at = lúc gọi món');
  // báo cáo từng ngày
  const day15 = await A.api(`/report-range?from=${at(2026, 3, 15)}&to=${at(2026, 3, 16)}`);
  const day16 = await A.api(`/report-range?from=${at(2026, 3, 16)}&to=${at(2026, 3, 17)}`);
  t.eq(day15.payments.length, 0, 'ngày 15/03: KHÔNG có doanh thu (tiền thu sau 0h)');
  t.eq(day16.payments.length, 1, 'ngày 16/03: có 1 hoá đơn');
  t.eq(day15.top['Phở bò tái'] || 0, 2, 'món bán chạy tính theo ngày gọi món (15/03)');
  t.eq(day16.top['Phở bò tái'] || 0, 0, '…và không lọt sang ngày 16/03');
  warn('Quy ước hiện tại: doanh thu tính theo NGÀY THU TIỀN, món bán chạy / báo cáo đơn theo NGÀY GỌI MÓN — đơn gọi trước 0h, thu sau 0h sẽ nằm ở hai ngày khác nhau (đúng thiết kế, cần biết khi đối chiếu).');
  setNow(A, Date.now()); A.clockOffset = 0;
}

t.group('T2. Lưu bền: đóng/mở lại app (SQLite) và đồng bộ sang máy khác KHÔNG làm đổi mốc thời gian nào');
{
  const w = world(); const A = await setupOwner(w);
  await A.api('/settings', { method: 'PATCH', body: { autoLock: false } });
  const times = [at(2026, 1, 31, 23, 59, 59, 900), at(2026, 2, 1, 0, 0, 0, 100), at(2026, 6, 30, 12, 0, 0), at(2026, 12, 31, 23, 40)];
  const sold = [];
  for (let i = 0; i < times.length; i++) sold.push(await sell(A, times[i], 'Bàn 0' + (i + 1), 1, [['Trà đá', i + 1]]));
  setNow(A, Date.now()); A.clockOffset = 0;
  await A.sync();
  const snap = dev => JSON.stringify({
    o: dev.D.orders.map(x => [x.id, x.created_at, x.updated_at, x.status]).sort(),
    i: dev.D.orderItems.map(x => [x.id, x.created_at, x.qty, x.price_snapshot]).sort(),
    p: dev.D.payments.map(x => [x.id, x.created_at, x.paid_at, x.total, x.state]).sort(),
  });
  const before = snap(A);
  await A.Persist.flush(); await A.Persist.idle();
  const A2 = await newDevice(w, 'owner-reopen', { dbFile: A.file });
  t.ok(A2.D.payments.length === A.D.payments.length && snap(A2) === before, 'mở lại app từ SQLite: toàn bộ mốc thời gian, số tiền, số lượng giống hệt trước khi đóng');
  const S = await addStaffDevice(w, A, 'nv'); await S.sync();
  t.ok(snap(S) === before, 'máy nhân viên (đồng bộ qua Supabase): mốc thời gian giống hệt máy chủ quán');
  for (const s of sold) {
    const pa = A.D.payments.find(x => x.id === s.paymentId), pb = S.D.payments.find(x => x.id === s.paymentId);
    t.ok(pa && pb && pa.paid_at === pb.paid_at, `hoá đơn ${s.paymentId}: paid_at trùng hai máy (${new Date(pa.paid_at).toLocaleString('vi-VN')})`);
  }
  // kho Supabase giữ nguyên số đo
  const rec = w.store.records.get('payments|' + sold[0].paymentId);
  t.ok(rec && rec.data.paid_at === A.D.payments.find(x => x.id === sold[0].paymentId).paid_at, 'bản ghi trên kho Supabase mang đúng paid_at (không bị làm tròn / đổi múi giờ)');
  // báo cáo hai máy giống nhau
  const rg = [at(2026, 1, 1), at(2027, 1, 1)];
  const ra = await A.api(`/report-range?from=${rg[0]}&to=${rg[1]}`), rb = await S.api(`/report-range?from=${rg[0]}&to=${rg[1]}`);
  t.ok(JSON.stringify(ra) === JSON.stringify(rb), 'báo cáo cả năm trên hai máy cho kết quả giống hệt nhau');
}

t.group('T3. Biên khoảng lọc: bản ghi đúng 0h00:00.000 và 23:59:59.999 vào đúng ngày; bộ lọc [từ, đến) không sót, không trùng');
{
  const w = world(); const A = await setupOwner(w, { link: false });
  const ownerId = A.D.staff.find(s => s.role === 'Chủ quán').id, tid = A.D.tables[0].id;
  const specs = [];     // [paid_at, total, nhãn]
  const days = [[2026, 2, 28], [2026, 3, 1], [2026, 3, 31], [2026, 4, 1], [2026, 12, 31], [2027, 1, 1]];
  let n = 0;
  for (const [y, m, d] of days) for (const [h, mi, s, ms] of [[0, 0, 0, 0], [0, 0, 0, 1], [12, 0, 0, 0], [23, 59, 59, 999]]) specs.push([at(y, m, d, h, mi, s, ms), 10000 + (++n) * 1000]);
  specs.forEach(([ts, total], i) => {
    const oid = 'tb' + i;
    A.D.orders.push({ id: oid, code: '#T' + i, table_id: tid, seat_no: 1, source: 'staff', status: 'paid', promo_id: null, created_at: ts - MIN, updated_at: ts });
    A.D.orderItems.push({ id: 'ti' + i, order_id: oid, menu_item_id: A.D.menu[0].id, name_snapshot: 'Món biên', price_snapshot: total, qty: 1, status: 'served', batch: 1, created_at: ts - MIN, updated_at: ts });
    A.D.payments.push({ id: 'tp' + i, order_id: oid, method: 'cash', subtotal: total, discount: 0, total, state: 'paid', staff_id: ownerId, created_at: ts, paid_at: ts });
  });
  const brute = (from, to) => specs.filter(([ts]) => ts >= from && ts < to);
  let bad = 0, checked = 0;
  for (const [y, m, d] of days) {
    for (const [from, to, label] of [[at(y, m, d), nextMidnight(at(y, m, d)), 'ngày ' + y + '-' + m + '-' + d]]) {
      const r = await A.api(`/report-range?from=${from}&to=${to}`), exp = brute(from, to);
      checked++;
      const ok = r.payments.length === exp.length && r.payments.reduce((s, p) => s + p.total, 0) === exp.reduce((s, e) => s + e[1], 0);
      if (!ok) { bad++; console.log('   ✗ ' + label + ': app ' + r.payments.length + ' vs đúng ' + exp.length); }
    }
  }
  t.eq(bad, 0, `${checked} khoảng "1 ngày" (có bản ghi sát 0h và 23:59:59.999): app khớp phép tính độc lập từng bản ghi`);
  // khoảng nhiều ngày + ghép liền nhau không trùng không sót
  const a = at(2026, 2, 28), b = at(2026, 4, 1), c = at(2027, 1, 2);
  const [r1, r2, rAll] = await Promise.all([A.api(`/report-range?from=${a}&to=${b}`), A.api(`/report-range?from=${b}&to=${c}`), A.api(`/report-range?from=${a}&to=${c}`)]);
  t.eq(r1.payments.length + r2.payments.length, rAll.payments.length, 'hai khoảng liền nhau [a,b) + [b,c) = khoảng [a,c): không sót, không trùng bản ghi sát mốc b');
  const ids = new Set([...r1.payments, ...r2.payments].map(p => p.id));
  t.eq(ids.size, rAll.payments.length, 'không có hoá đơn nào nằm ở cả hai khoảng');
  t.eq(rAll.payments.length, specs.length, 'khoảng bao trùm toàn bộ → đủ ' + specs.length + ' hoá đơn');
  // 3 bộ lọc của giao diện: today/week/month/custom tính ĐÚNG mốc 0h theo lịch
  for (const [nowTs, label] of [[at(2026, 3, 15, 0, 0, 0, 1), '00:00:00.001'], [at(2026, 3, 15, 12, 0), '12:00'], [at(2026, 3, 15, 23, 59, 59, 999), '23:59:59.999']]) {
    setNow(A, nowTs);
    const pr = k => A.periodRange(typeof k === 'string' ? { period: k } : k);
    const today = pr('today'), week = pr('week'), month = pr('month');
    t.eq([today.from, today.to], [at(2026, 3, 15), at(2026, 3, 16)], `lúc ${label}: "Hôm nay" = đúng 0h15/03 → 0h16/03`);
    t.eq(week.to, at(2026, 3, 16), `lúc ${label}: "7 ngày" kết thúc hết ngày hôm nay`);
    t.eq(week.from, at(2026, 3, 9), `lúc ${label}: "7 ngày" bắt đầu 0h ngày 09/03 (đủ 7 ngày lịch: 09…15)`);
    t.eq(month.from, at(2026, 2, 14), `lúc ${label}: "30 ngày" bắt đầu 0h ngày 14/02 (đủ 30 ngày lịch: 14/02…15/03)`);
    const cu = pr({ period: 'custom', pf: '2026-02-28', pt: '2026-03-02' });
    t.eq([cu.from, cu.to], [at(2026, 2, 28), at(2026, 3, 3)], `lúc ${label}: khoảng tuỳ chọn 28/02→02/03 gồm CẢ ngày cuối (hết 2/3)`);
  }
  A.clockOffset = 0;
}

t.group('T4. Bộ dữ liệu 1 năm: mọi bộ lọc khớp phép tính độc lập; biểu đồ theo ngày/tuần cộng lại đúng tổng; báo cáo xuất file đủ dòng');
{
  const w = world(); const A = await setupOwner(w, { link: false });
  const ownerId = A.D.staff.find(s => s.role === 'Chủ quán').id, tid = A.D.tables[0].id;
  const rand = rng(20261016), menu = A.D.menu;
  const NOW = at(2026, 10, 16, 14, 30);
  const truth = [];      // { oid, created, paid, total, items:[{name,qty}] }
  let id = 0;
  for (let d = 0; d < 365; d++) {
    const day0 = new Date(NOW); day0.setHours(0, 0, 0, 0); day0.setDate(day0.getDate() - d);
    const cnt = 4 + Math.floor(rand() * 7);
    const stamps = [];
    for (let k = 0; k < cnt; k++) stamps.push(day0.getTime() + Math.floor((8 + rand() * 14) * H));
    if (d % 7 === 3) stamps.push(day0.getTime(), day0.getTime() + DAY - 1);             // sát biên ngày
    for (const created of stamps) {
      if (created > NOW - 30 * MIN) continue;                                           // chưa tới thời điểm "hiện tại"
      const n = ++id, oid = 'bo' + n, paid = created + (30 + Math.floor(rand() * 60)) * MIN;
      if (paid > NOW) continue;
      const lines = [], nl = 1 + Math.floor(rand() * 4); let sub = 0;
      for (let l = 0; l < nl; l++) { const m = menu[Math.floor(rand() * menu.length)], q = 1 + Math.floor(rand() * 3); lines.push({ name: m.name, qty: q, price: m.price }); sub += q * m.price; }
      A.D.orders.push({ id: oid, code: '#B' + n, table_id: tid, seat_no: 1, source: 'staff', status: 'paid', promo_id: null, created_at: created, updated_at: paid });
      lines.forEach((ln, i) => A.D.orderItems.push({ id: 'bi' + n + '-' + i, order_id: oid, menu_item_id: menu[0].id, name_snapshot: ln.name, price_snapshot: ln.price, qty: ln.qty, status: 'served', batch: 1, created_at: created, updated_at: paid }));
      A.D.payments.push({ id: 'bp' + n, order_id: oid, method: ['cash', 'transfer', 'vietqr'][n % 3], subtotal: sub, discount: 0, total: sub, state: 'paid', staff_id: ownerId, created_at: paid, paid_at: paid });
      truth.push({ oid, created, paid, total: sub, lines });
    }
  }
  setNow(A, NOW);
  const truthPaid = (from, to) => truth.filter(x => x.paid >= from && x.paid < to);
  const truthCreated = (from, to) => truth.filter(x => x.created >= from && x.created < to);
  const ranges = [
    ['Hôm nay', A.periodRange({ period: 'today' })], ['7 ngày', A.periodRange({ period: 'week' })], ['30 ngày', A.periodRange({ period: 'month' })],
    ['Tuỳ chọn 1 ngày', A.periodRange({ period: 'custom', pf: '2026-09-30', pt: '2026-09-30' })],
    ['Tuỳ chọn giáp tháng', A.periodRange({ period: 'custom', pf: '2026-09-30', pt: '2026-10-01' })],
    ['Tháng 01/2026', A.periodRange({ period: 'custom', pf: '2026-01-01', pt: '2026-01-31' })],
    ['Tháng 02/2026', A.periodRange({ period: 'custom', pf: '2026-02-01', pt: '2026-02-28' })],
    ['Quý 1/2026', A.periodRange({ period: 'custom', pf: '2026-01-01', pt: '2026-03-31' })],
    ['Cả năm 2026 tới nay', A.periodRange({ period: 'custom', pf: '2026-01-01', pt: '2026-10-16' })],
    ['365 ngày qua', A.periodRange({ period: 'custom', pf: '2025-10-17', pt: '2026-10-16' })],
    ['Ngược (từ > đến) bị sắp lại', A.periodRange({ period: 'custom', pf: '2026-10-10', pt: '2026-10-05' })],
  ];
  for (const [label, rg] of ranges) {
    const r = await A.api(`/report-range?from=${rg.from}&to=${rg.to}`);
    const exp = truthPaid(rg.from, rg.to), expTotal = exp.reduce((s, x) => s + x.total, 0);
    const got = r.payments.reduce((s, p) => s + p.total, 0);
    t.ok(r.payments.length === exp.length && got === expTotal, `${label}: ${r.payments.length}/${exp.length} hoá đơn, doanh thu ${got}/${expTotal} (app/đúng)`);
    // món bán chạy theo ngày gọi món
    const topExp = {}; truthCreated(rg.from, rg.to).forEach(x => x.lines.forEach(l => { topExp[l.name] = (topExp[l.name] || 0) + l.qty; }));
    t.ok(JSON.stringify(Object.entries(r.top).sort()) === JSON.stringify(Object.entries(topExp).sort()), `${label}: món bán chạy khớp (${Object.keys(topExp).length} món)`);
    // biểu đồ: cộng các cột = tổng, mỗi hoá đơn đúng 1 cột
    const buckets = A.reportBuckets(rg.from, rg.to);
    let inBuckets = 0, dupe = 0;
    r.payments.forEach(p => { const c = buckets.filter(b => p.ts >= b.start && p.ts < b.end).length; inBuckets += c; if (c > 1) dupe++; });
    t.ok(inBuckets === r.payments.length && dupe === 0, `${label}: ${buckets.length} cột biểu đồ chứa đủ ${r.payments.length} hoá đơn, không cột nào trùng`);
    t.ok(buckets[0].start === rg.from && buckets[buckets.length - 1].end >= rg.to, `${label}: cột biểu đồ phủ kín khoảng chọn (từ ${ymd(buckets[0].start)} tới ${ymd(buckets[buckets.length - 1].end - 1)})`);
    // báo cáo xuất file
    const rows = A.reportRowsLocal('revenue', rg.from, rg.to).slice(1);
    const byDay = {}; exp.forEach(x => { const k = new Date(x.paid).toLocaleDateString(A.repLocale ? A.repLocale() : undefined); byDay[k] = byDay[k] || [0, 0]; byDay[k][0]++; byDay[k][1] += x.total; });
    t.ok(rows.reduce((s, x) => s + x[1], 0) === exp.length && rows.reduce((s, x) => s + x[2], 0) === expTotal, `${label}: báo cáo Doanh thu (xuất file) cộng lại = ${exp.length} hoá đơn / ${expTotal}`);
    t.eq(rows.length, new Set(exp.map(x => ymd(x.paid))).size, `${label}: số dòng theo ngày của báo cáo xuất file = số ngày có doanh thu`);
    const pay = A.reportRowsLocal('payments', rg.from, rg.to).slice(1);
    t.eq(pay.length, exp.length, `${label}: báo cáo Thanh toán (xuất file) đủ ${exp.length} dòng`);
    t.eq(pay.reduce((s, x) => s + x[8], 0), expTotal, `${label}: báo cáo Thanh toán cộng "Thành tiền" = ${expTotal}`);
    const ord = A.reportRowsLocal('orders', rg.from, rg.to).slice(1);
    const expLines = truthCreated(rg.from, rg.to).reduce((s, x) => s + x.lines.length, 0);
    t.eq(ord.length, expLines, `${label}: báo cáo Đơn hàng (xuất file) đủ ${expLines} dòng món`);
  }
  // doanh thu từng ngày trong 60 ngày gần nhất: app = đúng
  let badDays = 0;
  for (let d = 0; d < 60; d++) {
    const from = at(2026, 10, 16 - d), to = nextMidnight(from);
    const r = await A.api(`/report-range?from=${from}&to=${to}`), exp = truthPaid(from, to);
    if (r.payments.length !== exp.length || r.payments.reduce((s, p) => s + p.total, 0) !== exp.reduce((s, x) => s + x.total, 0)) badDays++;
  }
  t.eq(badDays, 0, '60 ngày liên tiếp: doanh thu từng ngày khớp 100% phép tính độc lập');
  // tổng 12 tháng cộng lại = tổng cả năm
  let monthsSum = 0, monthsCnt = 0;
  for (let k = 0; k < 13; k++) {
    const from = at(2025, 10 + k, 1), to = at(2025, 11 + k, 1);
    const r = await A.api(`/report-range?from=${from}&to=${to}`); monthsSum += r.payments.reduce((s, p) => s + p.total, 0); monthsCnt += r.payments.length;
  }
  t.ok(monthsCnt === truth.length && monthsSum === truth.reduce((s, x) => s + x.total, 0), `13 tháng (10/2025→10/2026) cộng lại = toàn bộ ${truth.length} hoá đơn, không sót không trùng`);
  // màn Thu ngân "Đã thu hôm nay" = đúng, kể cả khi hôm nay có nhiều hơn 200 hoá đơn
  const todayStart = at(2026, 10, 16);
  for (let i = 0; i < 260; i++) {
    const ts = todayStart + 60000 + i * 1000, oid = 'bt' + i;
    A.D.orders.push({ id: oid, code: '#BT' + i, table_id: tid, seat_no: 1, source: 'staff', status: 'paid', promo_id: null, created_at: ts, updated_at: ts });
    A.D.payments.push({ id: 'btp' + i, order_id: oid, method: 'cash', subtotal: 5000, discount: 0, total: 5000, state: 'paid', staff_id: ownerId, created_at: ts, paid_at: ts });
  }
  await A.refresh();
  const todayTruth = [...truth.filter(x => x.paid >= todayStart).map(x => x.total), ...Array(260).fill(5000)].reduce((s, x) => s + x, 0);
  A.route = { name: 'cashier', params: {} };
  const html = A.VIEWS.cashier();
  const shown = Number((/Đã thu hôm nay<\/div>\s*<div class="mono"[^>]*>([^<]+)</.exec(html) || [])[1]?.replace(/\D/g, '') || -1);
  t.eq(shown, todayTruth, `màn Thu ngân "Đã thu hôm nay" = ${todayTruth} (đúng cả khi hôm nay có > 200 hoá đơn)`);
  A.clockOffset = 0;
}

t.group('T5. Đồng bộ 1 năm dữ liệu: kho Supabase ↔ hai máy — đủ số bản ghi, báo cáo hai máy giống nhau');
{
  const w = world(); const A = await setupOwner(w);
  const ownerId = A.D.staff.find(s => s.role === 'Chủ quán').id, tid = A.D.tables[0].id;
  const rand = rng(77), NOW = at(2026, 10, 16, 14, 30);
  let n = 0;
  for (let d = 0; d < 365; d++) {
    const day0 = new Date(NOW); day0.setHours(0, 0, 0, 0); day0.setDate(day0.getDate() - d);
    for (let k = 0; k < 3 + Math.floor(rand() * 3); k++) {
      const created = day0.getTime() + Math.floor((9 + rand() * 12) * H); if (created > NOW - H) continue;
      const i = ++n, oid = 'so' + i, paid = created + 45 * MIN, total = 20000 + Math.floor(rand() * 300) * 1000;
      A.D.orders.push({ id: oid, code: '#S' + i, table_id: tid, seat_no: 1, source: 'staff', status: 'paid', promo_id: null, created_at: created, updated_at: paid });
      A.D.orderItems.push({ id: 'si' + i, order_id: oid, menu_item_id: A.D.menu[0].id, name_snapshot: 'Món S', price_snapshot: total, qty: 1, status: 'served', batch: 1, created_at: created, updated_at: paid });
      A.D.payments.push({ id: 'sp' + i, order_id: oid, method: 'cash', subtotal: total, discount: 0, total, state: 'paid', staff_id: ownerId, created_at: paid, paid_at: paid });
    }
  }
  await A.Persist.flush(); await A.sync(); await A.sync();
  const cnt = (name) => [...w.store.records.values()].filter(r => r.collection === name && !r.deleted && String(r.id).match(/^s[oip]\d/)).length;
  t.eq([cnt('orders'), cnt('orderItems'), cnt('payments')], [n, n, n], `kho Supabase nhận ĐỦ ${n} đơn / ${n} món / ${n} thanh toán từ máy chủ quán`);
  const S = await addStaffDevice(w, A, 'nv-nam');
  await S.sync(); await S.sync();
  const mine = dev => dev.D.payments.filter(p => /^sp\d/.test(p.id));
  t.eq(mine(S).length, n, `máy nhân viên kéo về ĐỦ ${n} hoá đơn (không sót khi kho lớn)`);
  const sameTs = mine(A).every(p => { const q = S.D.payments.find(x => x.id === p.id); return q && q.paid_at === p.paid_at && q.total === p.total; });
  t.ok(sameTs, 'mọi hoá đơn trên hai máy: paid_at và số tiền giống hệt');
  setNow(S, NOW); setNow(A, NOW);
  for (const [label, pf, pt] of [['Tháng 3/2026', '2026-03-01', '2026-03-31'], ['Quý 2/2026', '2026-04-01', '2026-06-30'], ['30 ngày qua', '2026-09-17', '2026-10-16']]) {
    const ra = A.periodRange({ period: 'custom', pf, pt }), rs = S.periodRange({ period: 'custom', pf, pt });
    const [xa, xs] = [await A.api(`/report-range?from=${ra.from}&to=${ra.to}`), await S.api(`/report-range?from=${rs.from}&to=${rs.to}`)];
    const exp = mine(A).filter(p => p.paid_at >= ra.from && p.paid_at < ra.to);
    t.ok(xa.payments.length === xs.payments.length && xa.payments.length >= exp.length && JSON.stringify(xa.top) === JSON.stringify(xs.top), `${label}: báo cáo máy chủ quán = máy nhân viên (${xa.payments.length} hoá đơn)`);
  }
  A.clockOffset = 0; S.clockOffset = 0;
}

t.group('T6. Lệch giờ máy: máy nhân viên đặt sai ngày ghi nhận thao tác sai ngày (kiểm tra mức độ ảnh hưởng)');
{
  const w = world(); const A = await setupOwner(w);
  await A.api('/settings', { method: 'PATCH', body: { autoLock: false } }); await A.sync();
  const S = await addStaffDevice(w, A, 'nv-lech');
  const real = Date.now();
  const r = await sell(A, real, 'Bàn 02', 1, [['Trà đá', 1]]);        // đúng giờ
  // máy nhân viên lệch +30 giờ (đặt nhầm ngày): tạo & thu một đơn
  await S.sync();
  S.clockOffset = 30 * H;
  let rs = null;
  try { rs = await sell(S, real + 30 * H, 'Bàn 03', 1, [['Trà đá', 1]]); } catch (e) { warn('Máy nhân viên lệch +30 giờ không thao tác được: ' + e.message); }
  if (rs) {
    const pay = S.D.payments.find(p => p.id === rs.paymentId);
    const diff = pay.paid_at - Date.now();
    if (diff > 12 * H) warn(`Máy lệch giờ +30 giờ: hoá đơn ghi nhận ngày ${ymd(pay.paid_at)} thay vì ${ymd(real)} (app dùng đồng hồ máy; chưa có cảnh báo lệch giờ với máy chủ) — doanh thu sẽ rơi sang NGÀY KHÁC.`);
    t.ok(true, 'đã đo mức ảnh hưởng của lệch giờ máy (xem cảnh báo)');
  }
  S.clockOffset = 0; A.clockOffset = 0;
}

/* ============================================================ */
const { pass, fail, failures } = t.results;
console.log(`\n${'='.repeat(60)}\n[${TZ_NAME}] ${pass} đạt · ${fail} lỗi · ${pass + fail} kiểm tra · ${warnings.length} cảnh báo`);
if (fail) { console.log('\nCác kiểm tra lỗi:'); failures.forEach(f => console.log(' - ' + f)); process.exit(1); }
