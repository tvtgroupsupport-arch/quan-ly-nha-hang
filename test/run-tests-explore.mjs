/* Kiểm thử THĂM DÒ (tìm lỗi): render mọi màn hình ở nhiều trạng thái, chèn dữ liệu độc (XSS), tiền/khuyến mãi biên, đồng thời hai máy offline,
   mất điện giữa chừng, bất biến dữ liệu sau chuỗi thao tác ngẫu nhiên, hiệu năng. Chạy: node --experimental-sqlite --no-warnings test/run-tests-explore.mjs
   Kiểm tra KHÔNG đạt = nghi lỗi thật; "ghi nhận" (note) = rủi ro/giới hạn cần biết nhưng không chặn. */
import { newWorld, newDevice, suite, STORE_URL, ANON } from './harness.mjs';

const t = suite();
const notes = [];
const note = (sev, msg) => { notes.push([sev, msg]); console.log(`   ⚑ [${sev}] ${msg}`); };
const world = () => { const w = newWorld(); w.central.trialDays = 3650; return w; };
function rng(seed) { let x = seed >>> 0; return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; }; }

async function setupOwner(w, { link = true, sample = true, name = 'owner' } = {}) {
  const A = await newDevice(w, name);
  await A.Cloud.ownerSignUp('chu@quan.vn', 'matkhau1', 'Quán A');
  await A.License.refresh(true);
  await A.createStore({ shopName: 'Quán A', ownerName: 'Chủ Quán', username: 'chuquan', appPassword: 'chuquan123', sample });
  await A.Cloud.saveCfg({ role: 'owner' });
  await A.Persist.flush();
  if (link) { await A.Cloud.linkStoreAsOwner({ url: STORE_URL, anonKey: ANON, email: 'chu@quan.vn', password: 'matkhau1' }); await A.sync(); }
  await A.login('chuquan', 'chuquan123');
  return A;
}
async function addStaffDevice(w, owner, name) {
  const inv = await owner.Cloud.createInvite();
  const S = await newDevice(w, name);
  await S.Cloud.joinAsStaff(inv.payload, name);
  await S.sync();
  return S;
}
const menuId = (dev, n) => dev.D.menu.find(m => m.name === n).id;
const tbl = (dev, n) => dev.D.tables.find(x => x.name === n);
async function order(dev, table, seat, lines) {
  return dev.api('/orders/items', { method: 'POST', body: { tableId: tbl(dev, table).id, seatNo: seat, lines: lines.map(([n, q]) => ({ menuItemId: menuId(dev, n), qty: q })) } });
}
async function serveAll(dev, oid) {
  for (const it of dev.D.orderItems.filter(i => i.order_id === oid && i.status !== 'cancelled')) {
    await dev.api(`/kds/items/${it.id}/start`, { method: 'POST' }); await dev.api(`/kds/items/${it.id}/done`, { method: 'POST' });
  }
}
const pay = async (dev, oid, method = 'cash') => dev.api(`/orders/${oid}/payments`, { method: 'POST', body: { method } });

/** Bất biến phải luôn đúng với dữ liệu của một máy */
function invariants(dev) {
  const D = dev.D, bad = [];
  const paidPay = D.payments.filter(p => p.state === 'paid');
  const perOrder = {};
  paidPay.forEach(p => { perOrder[p.order_id] = (perOrder[p.order_id] || 0) + 1; });
  Object.entries(perOrder).forEach(([oid, n]) => { if (n > 1) bad.push(`đơn ${oid} có ${n} thanh toán 'paid'`); });
  D.orders.filter(o => o.status === 'paid').forEach(o => { if (!perOrder[o.id]) bad.push(`đơn ${o.code} đã 'paid' nhưng không có thanh toán`); });
  paidPay.forEach(p => {
    const o = D.orders.find(x => x.id === p.order_id);
    if (!o) { bad.push(`thanh toán ${p.id} không có đơn`); return; }
    if (!(p.total >= 0) || !Number.isFinite(p.total)) bad.push(`thanh toán ${p.id} số tiền không hợp lệ ${p.total}`);
    if (p.discount > p.subtotal) bad.push(`thanh toán ${p.id}: giảm giá ${p.discount} > tạm tính ${p.subtotal}`);
    if (p.subtotal - p.discount !== p.total) bad.push(`thanh toán ${p.id}: tạm tính − giảm ≠ thành tiền`);
  });
  D.orderItems.forEach(i => { if (!Number.isInteger(i.qty) || i.qty < 1) bad.push(`món ${i.id} số lượng ${i.qty}`); if (!(i.price_snapshot >= 0)) bad.push(`món ${i.id} giá ${i.price_snapshot}`); });
  D.seats.forEach(s => { if (s.bound_order_id) { const o = D.orders.find(x => x.id === s.bound_order_id); if (!o || o.status === 'paid') bad.push(`ghế ${s.table_id}#${s.seat_no} gắn với đơn đã đóng/không có`); } });
  D.ingredients.forEach(i => {
    const sum = D.stockMoves.filter(m => m.ingredient_id === i.id).reduce((s, m) => s + (m.type === 'in' ? m.qty : -Math.abs(m.qty)), 0);
    void sum;   // tồn = qty0 + tổng phiếu: kiểm ở nhóm riêng
  });
  return bad;
}

/** Số ghế đang có nhiều hơn 1 đơn mở (không phải lỗi dữ liệu — cả hai đơn vẫn thu được — nhưng gây rối khi thu tiền) */
const dupSeats = (dev, withPending = false) => { const c = {}; dev.D.orders.filter(o => o.status === 'open' && o.table_id).forEach(o => { const k = o.table_id + '#' + o.seat_no; (c[k] = c[k] || []).push(o); }); return Object.values(c).filter(l => l.length > 1 && (withPending || !l.some(o => dev.D.payments.some(p => p.order_id === o.id && p.state === 'pending')))).length; };
const HOSTILE = ['<img src=x onerror=alert(1)>', '"><script>alert(1)</script>', '" onmouseover="alert(1)', "'; alert(1); //", '<svg/onload=alert(1)>', '${7*7}', '{{7*7}}'];
const BAD_PAT = [/<img src=x onerror/i, /<script>alert/i, /" onmouseover="alert/, /<svg\/onload/i];

/* ============================================================ */
t.group('E1. Vẽ mọi màn hình ở nhiều trạng thái: không lỗi, không "undefined / NaN / [object Object]" trên giao diện');
{
  const w = world(); const A = await setupOwner(w); const S = await addStaffDevice(w, A, 'nv'); await S.login('chuquan', 'chuquan123');
  await A.api('/settings', { method: 'PATCH', body: { autoLock: false } });
  // dựng trạng thái phong phú
  const o1 = await order(A, 'Bàn 01', 1, [['Phở bò tái', 2], ['Trà đá', 3]]); await serveAll(A, o1.id); await pay(A, o1.id, 'cash');
  const o2 = await order(A, 'Bàn 02', 1, [['Cơm tấm sườn bì', 1]]);
  const o3 = await order(A, 'Bàn 02', 2, [['Bia Sài Gòn', 2]]); await serveAll(A, o3.id);
  await A.api('/promos', { method: 'POST', body: { name: 'Giảm 10%', type: 'pct', value: 10, minTotal: 0, useLimit: 0, expiresOn: null } });
  await A.api('/reservations', { method: 'POST', body: { name: 'Khách đặt', phone: '0900000000', guests: 4, tableId: tbl(A, 'Bàn 03').id, startAt: Date.now() + 3600000, durationMin: 90, seatNos: [1, 2, 3, 4], note: 'tiệc' } }).catch(e => note('thấp', 'không tạo được lịch đặt bàn mẫu để thử: ' + e.message));
  await A.api('/orders/items', { method: 'POST', body: { tableId: tbl(A, 'Bàn 04').id, seatNo: 1, lines: [{ comboId: A.D.combos[0].id, qty: 1 }] } });
  await A.sync(); await S.sync(); await A.refresh(); await S.refresh();
  const params = dev => ({ id: (dev.D.orders.find(o => o.status === 'open') || {}).id, t: (dev.D.tables[1] || dev.D.tables[0] || {}).id, s: 1, k: 'all', cat: (dev.D.categories[0] || {}).name, period: 'week', area: (dev.D.areas[0] || {}).name, from: 'cashier', mode: 'merge', o: (dev.D.orders[0] || {}).id });
  const BAD_TEXT = [/\bundefined\b/, /\bNaN\b/, /\[object Object\]/, /\bnull\b(?![-_"'a-zA-Z])/];
  const scan = async (label, dev, lang) => {
    let n = 0, errs = 0, dirty = 0;
    for (const name of Object.keys(dev.VIEWS)) {
      dev.route = { name, params: params(dev) };
      let html = '';
      try { html = String(dev.VIEWS[name]()); n++; } catch (e) { errs++; t.ok(false, `${label}: màn "${name}" ném lỗi: ${e.message}`); continue; }
      const text = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]*>/g, ' ');
      const hit = BAD_TEXT.find(re => re.test(text));
      if (hit) { dirty++; t.ok(false, `${label}: màn "${name}" có chữ rác ${hit} → "${(text.match(hit) || [''])[0]}"`); }
    }
    t.ok(errs === 0 && dirty === 0, `${label}: ${n} màn hình vẽ được, không lỗi, không chữ rác`);
  };
  await scan('chủ quán (VI)', A, 'vi');
  await scan('nhân viên (VI)', S, 'vi');
  A.setLang && A.setLang('en'); await scan('chủ quán (EN)', A, 'en'); A.setLang && A.setLang('vi');
  // trạng thái hiếm: kho rỗng, không bàn, không món
  const w2 = world(); const E = await setupOwner(w2, { link: false, sample: false }); await E.refresh();
  await scan('quán trống (không dữ liệu mẫu)', E, 'vi');
  // đơn rất lớn
  const big = await order(A, 'Bàn 05', 1, Array.from({ length: 12 }, (_, i) => [A.D.menu[i % A.D.menu.length].name, 999 - i]).filter((x, i, arr) => arr.findIndex(y => y[0] === x[0]) === i));
  await A.refresh(); await scan('đơn nhiều món, số lượng lớn', A, 'vi');
}

t.group('E2. Dữ liệu độc (XSS): tên món / bàn / danh mục / khách / ghi chú / combo / nhân viên không chạy được mã trên giao diện');
{
  const w = world(); const A = await setupOwner(w);
  await A.api('/settings', { method: 'PATCH', body: { autoLock: false } });
  const [h1, h2, h3, h4, h5] = HOSTILE;
  const cat = (await A.api('/categories', { method: 'POST', body: { name: h1 + 'C' } })).id;
  const kit = (await A.api('/kitchens', { method: 'POST', body: { name: h2 + 'K' } })).id;
  await A.api('/menu', { method: 'POST', body: { name: h3, price: 1000, categoryId: cat, kitchenId: kit, description: h4, emoji: h5 } });
  const m = A.D.menu.find(x => x.name === h3);
  await A.api('/areas', { method: 'POST', body: { name: h2 + 'A' } });
  const area = A.D.areas.find(a => a.name === h2 + 'A');
  await A.api('/tables', { method: 'POST', body: { name: h4 + 'T', areaId: area.id, seats: 2 } }).catch(() => {});
  const tb = A.D.tables.find(x => x.name === h4 + 'T') || A.D.tables[0];
  await A.api('/orders/items', { method: 'POST', body: { tableId: tb.id, seatNo: 1, lines: [{ menuItemId: m.id, qty: 1, note: h1 }] } });
  await A.api('/combos', { method: 'POST', body: { name: h5 + 'combo', description: h3, items: [{ menuItemId: m.id, qty: 1 }] } });
  await A.api('/promos', { method: 'POST', body: { name: h2 + 'KM', type: 'pct', value: 5, minTotal: 0, useLimit: 0, expiresOn: null } });
  await A.api('/staff', { method: 'POST', body: { name: h1 + 'NV', role: 'Phục vụ', username: 'nv' + Date.now().toString(36) } }).catch(() => {});
  await A.api('/reservations', { method: 'POST', body: { name: h1 + 'Khách', phone: h2, guests: 2, tableId: tb.id, startAt: Date.now() + 7200000, durationMin: 60, seatNos: [1], note: h3 } }).catch(() => {});
  await A.api('/restaurant', { method: 'PATCH', body: { name: h4 + 'Quán', phone: h5 } }).catch(() => {});
  await A.refresh();
  let leaks = 0, views = 0;
  for (const name of Object.keys(A.VIEWS)) {
    A.route = { name, params: { id: A.D.orders.find(o => o.status === 'open')?.id, t: tb.id, s: 1, k: 'all', cat: h1 + 'C', area: h2 + 'A' } };
    let html = ''; try { html = String(A.VIEWS[name]()); views++; } catch (e) { continue; }
    for (const re of BAD_PAT) if (re.test(html)) { leaks++; t.ok(false, `màn "${name}" để lọt dữ liệu độc: ${re}`); }
  }
  t.ok(leaks === 0, `${views} màn hình: không có chuỗi độc nào được chèn thành mã chạy được`);
}

t.group('E3. Tiền & khuyến mãi biên: không âm, không giảm quá tạm tính, không dùng lại, đúng thứ tự');
{
  const w = world(); const A = await setupOwner(w);
  await A.api('/settings', { method: 'PATCH', body: { autoLock: false } });
  const P = async (b, tb, seat, items = [['Phở bò tái', 1]]) => {
    const pr = await A.api('/promos', { method: 'POST', body: { name: 'KM' + Math.random(), type: 'pct', value: 10, minTotal: 0, useLimit: 0, expiresOn: null, ...b } });
    const promo = A.D.promos[A.D.promos.length - 1];
    const o = await order(A, tb, seat, items); await serveAll(A, o.id);
    await A.api(`/orders/${o.id}/promo`, { method: 'POST', body: { promoId: promo.id } });
    const p = await pay(A, o.id); void pr;
    return { o, p, promo };
  };
  let r = await P({ type: 'pct', value: 100 }, 'Bàn 01', 1);
  t.eq(r.p.total, 0, 'giảm 100% → thành tiền 0 (không âm)');
  r = await P({ type: 'amt', value: 999999999 }, 'Bàn 01', 2);
  t.ok(r.p.total === 0 && r.p.discount === r.p.subtotal, 'giảm cố định lớn hơn tạm tính → chỉ giảm tối đa bằng tạm tính, thành tiền 0');
  await t.rejects(async () => { await A.api('/promos', { method: 'POST', body: { name: 'x', type: 'pct', value: 150, minTotal: 0, useLimit: 0, expiresOn: null } }); }, /.+/, 'giảm 150% bị từ chối khi tạo');
  await t.rejects(async () => { await A.api('/promos', { method: 'POST', body: { name: 'x', type: 'amt', value: -5, minTotal: 0, useLimit: 0, expiresOn: null } }); }, /.+/, 'giảm số tiền âm bị từ chối');
  // giới hạn lượt
  const lim = await A.api('/promos', { method: 'POST', body: { name: 'Chỉ 1 lượt', type: 'amt', value: 5000, minTotal: 0, useLimit: 1, expiresOn: null } });
  const pl = A.D.promos.find(x => x.name === 'Chỉ 1 lượt'); void lim;
  const oa = await order(A, 'Bàn 02', 1, [['Trà đá', 2]]), ob = await order(A, 'Bàn 03', 1, [['Trà đá', 2]]);
  await serveAll(A, oa.id); await serveAll(A, ob.id);
  await A.api(`/orders/${oa.id}/promo`, { method: 'POST', body: { promoId: pl.id } }); await pay(A, oa.id);
  await t.rejects(() => A.api(`/orders/${ob.id}/promo`, { method: 'POST', body: { promoId: pl.id } }), /hết lượt/, 'khuyến mãi giới hạn 1 lượt: lần dùng thứ hai bị từ chối');
  // đơn tối thiểu
  const mn = await A.api('/promos', { method: 'POST', body: { name: 'Tối thiểu 500k', type: 'pct', value: 10, minTotal: 500000, useLimit: 0, expiresOn: null } }); void mn;
  const pm = A.D.promos.find(x => x.name === 'Tối thiểu 500k');
  await t.rejects(() => A.api(`/orders/${ob.id}/promo`, { method: 'POST', body: { promoId: pm.id } }), /tối thiểu/, 'đơn chưa đủ điều kiện tối thiểu bị từ chối');
  // thu tiền hai lần / khi chưa phục vụ xong / đơn đã đóng
  const oc = await order(A, 'Bàn 04', 1, [['Bia Sài Gòn', 1]]);
  await t.rejects(() => pay(A, oc.id), /chưa phục vụ/, 'thu tiền khi còn món chưa phục vụ bị từ chối');
  await serveAll(A, oc.id);
  const [x1, x2] = await Promise.allSettled([pay(A, oc.id), pay(A, oc.id)]);
  t.ok([x1, x2].filter(x => x.status === 'fulfilled').length === 1, 'bấm thu tiền hai lần liên tiếp (đồng thời) → chỉ MỘT thanh toán được ghi');
  t.eq(A.D.payments.filter(p => p.order_id === oc.id && p.state === 'paid').length, 1, 'đơn chỉ có đúng 1 thanh toán paid');
  // tổng tiền với số lẻ
  const od = await order(A, 'Bàn 05', 1, [['Trà đá', 3], ['Phở bò tái', 7], ['Chè thái', 13]]); await serveAll(A, od.id);
  const exp = A.D.orderItems.filter(i => i.order_id === od.id).reduce((s, i) => s + i.qty * i.price_snapshot, 0);
  const pd = await pay(A, od.id, 'vietqr');
  t.eq(pd.total, exp, 'tổng tiền đơn nhiều món/số lượng lẻ đúng tuyệt đối');
  t.eq(invariants(A), [], 'bất biến dữ liệu sau các thao tác tiền');
}

t.group('E4. Hai máy cùng thao tác OFFLINE rồi đồng bộ: không mất món, không trùng thanh toán, không đơn mồ côi');
{
  const w = world(); const A = await setupOwner(w); const S = await addStaffDevice(w, A, 'nv'); await S.login('chuquan', 'chuquan123');
  await A.api('/settings', { method: 'PATCH', body: { autoLock: false } }); await A.sync(); await S.sync();
  // (a) hai máy cùng gọi món cho CÙNG ghế khi offline
  A.setOnline(false); S.setOnline(false);
  const ra = await order(A, 'Bàn 01', 1, [['Phở bò tái', 1]]);
  const rs = await order(S, 'Bàn 01', 1, [['Trà đá', 2]]);
  A.setOnline(true); S.setOnline(true);
  await A.sync(); await S.sync(); await A.sync(); await S.sync();
  const itemsA = A.D.orderItems.filter(i => i.status !== 'cancelled'), itemsS = S.D.orderItems.filter(i => i.status !== 'cancelled');
  t.ok(itemsA.some(i => i.name_snapshot === 'Phở bò tái') && itemsA.some(i => i.name_snapshot === 'Trà đá'), 'cùng ghế, cùng offline: sau đồng bộ máy chủ quán có đủ món của cả hai máy');
  t.ok(itemsS.some(i => i.name_snapshot === 'Phở bò tái') && itemsS.some(i => i.name_snapshot === 'Trà đá'), '…và máy nhân viên cũng đủ');
  const openOnSeat = d => d.D.orders.filter(o => o.status === 'open' && o.table_id === tbl(d, 'Bàn 01').id && o.seat_no === 1);
  t.eq(openOnSeat(A).length, 1, 'sau đồng bộ chỉ còn MỘT đơn mở cho ghế (tự gộp, không mất món)');
  t.eq(openOnSeat(S).length, 1, 'máy nhân viên cũng chỉ còn một đơn mở cho ghế');
  t.ok(A.D.orderItems.length === S.D.orderItems.length, 'hai máy cùng số dòng món sau đồng bộ');
  // (b) hai máy cùng thu tiền một đơn khi offline
  const o2 = await order(A, 'Bàn 02', 1, [['Trà đá', 1]]); await serveAll(A, o2.id); await A.sync(); await S.sync();
  A.setOnline(false); S.setOnline(false);
  const p1 = await pay(A, o2.id, 'cash'); const p2 = await pay(S, o2.id, 'vietqr').catch(e => ({ err: e.message }));
  A.setOnline(true); S.setOnline(true);
  for (let i = 0; i < 3; i++) { await A.sync(); await S.sync(); }
  const paid = A.D.payments.filter(p => p.order_id === o2.id && p.state === 'paid');
  t.eq(paid.length, 1, 'cùng thu tiền một đơn khi offline: sau đồng bộ chỉ còn MỘT thanh toán paid (không tính doanh thu hai lần)');
  t.eq(S.D.payments.filter(p => p.order_id === o2.id && p.state === 'paid').length, 1, 'máy nhân viên cũng chỉ thấy một');
  void p1; void p2;
  // (c) bất biến
  t.eq(invariants(A), [], 'bất biến dữ liệu máy chủ quán sau xung đột');
  t.eq(invariants(S), [], 'bất biến dữ liệu máy nhân viên sau xung đột');
  // (d) sửa giá món trên máy chủ quán trong lúc nhân viên gọi món cũ
  A.setOnline(false); S.setOnline(false);
  await A.api('/menu/' + menuId(A, 'Trà đá'), { method: 'PATCH', body: { price: 99000 } });
  const oc = await order(S, 'Bàn 03', 1, [['Trà đá', 1]]);
  A.setOnline(true); S.setOnline(true); await A.sync(); await S.sync(); await A.sync();
  const it = A.D.orderItems.find(i => i.order_id === oc.id);
  t.ok(it && (it.price_snapshot === 10000 || it.price_snapshot === 99000), 'giá món được chụp lại lúc gọi (không biến thành giá ngẫu nhiên): ' + (it && it.price_snapshot));
}

t.group('E5. Mất điện / app bị hệ điều hành tắt ngay sau thao tác: dữ liệu đã lưu hay mất?');
{
  const w = world(); const A = await setupOwner(w, { link: false });
  await A.api('/settings', { method: 'PATCH', body: { autoLock: false } }); await A.save();
  const before = A.D.orders.length;
  const o = await order(A, 'Bàn 01', 1, [['Phở bò tái', 1]]);          // KHÔNG gọi save()/flush()
  const A2 = await newDevice(w, 'sau-khi-tat', { dbFile: A.file });   // máy "mở lại" ngay, chưa kịp chờ 250 ms
  const lost = !A2.D.orders.some(x => x.id === o.id);
  t.ok(!lost, 'đơn vừa gửi bếp đã được ghi xuống SQLite NGAY (app bị tắt liền sau đó vẫn không mất)');
  await A.save();
  const A3 = await newDevice(w, 'sau-khi-ghi', { dbFile: A.file });
  t.ok(A3.D.orders.length === before + 1, 'sau khi đã ghi xong: mở lại thấy đủ đơn');
}

t.group('E6. Chuỗi thao tác NGẪU NHIÊN trên hai máy (400 bước): bất biến dữ liệu luôn đúng, hai máy hội tụ giống nhau');
{
  const w = world(); const A = await setupOwner(w); const S = await addStaffDevice(w, A, 'nv'); await S.login('chuquan', 'chuquan123');
  await A.api('/settings', { method: 'PATCH', body: { autoLock: false } }); await A.sync(); await S.sync();
  const R = rng(424242), devs = [A, S], tables = A.D.tables.map(x => x.name), dishes = A.D.menu.map(m => m.name);
  let errors = {}, steps = 0;
  const pick = a => a[Math.floor(R() * a.length)];
  for (let step = 0; step < 400; step++) {
    const d = pick(devs), op = R();
    try {
      if (op < 0.35) await order(d, pick(tables), 1 + Math.floor(R() * 2), [[pick(dishes), 1 + Math.floor(R() * 3)], [pick(dishes), 1]].filter((x, i, a) => a.findIndex(y => y[0] === x[0]) === i));
      else if (op < 0.55) { const o = pick(d.D.orders.filter(x => x.status === 'open')); if (o) await serveAll(d, o.id); }
      else if (op < 0.7) { const o = pick(d.D.orders.filter(x => x.status === 'open' && d.D.orderItems.filter(i => i.order_id === x.id && i.status !== 'cancelled').every(i => i.status === 'served') && d.D.orderItems.some(i => i.order_id === x.id))); if (o) await pay(d, o.id, pick(['cash', 'vietqr', 'transfer'])); }
      else if (op < 0.8) { const it = pick(d.D.orderItems.filter(i => ['queued', 'pending'].includes(i.status) && d.D.orders.find(o => o.id === i.order_id && o.status === 'open'))); if (it) await d.api('/order-items/' + it.id, { method: 'PATCH', body: { qty: 1 + Math.floor(R() * 5) } }); }
      else if (op < 0.86) { const it = pick(d.D.orderItems.filter(i => ['queued', 'pending'].includes(i.status) && d.D.orders.find(o => o.id === i.order_id && o.status === 'open'))); if (it) await d.api('/order-items/' + it.id, { method: 'DELETE' }); }
      else if (op < 0.92) { await d.sync(); }
      else { d.setOnline(R() < 0.5); }
      steps++;
    } catch (e) { const k = String(e.message).slice(0, 70); errors[k] = (errors[k] || 0) + 1; }
  }
  A.setOnline(true); S.setOnline(true);
  for (let i = 0; i < 4; i++) { await A.sync(); await S.sync(); }
  const errList = Object.entries(errors).sort((a, b) => b[1] - a[1]);
  console.log('   ℹ ' + steps + ' bước thành công; lỗi nghiệp vụ gặp (bình thường): ' + errList.map(([k, n]) => `${n}× ${k}`).join(' | ').slice(0, 400));
  const unexpected = errList.filter(([k]) => !/không còn mở|Còn món|đã được xoá|Đơn đã đóng|vào bếp|hết hàng|không tồn tại|Món này|Đơn không còn|đã bị|chưa phục vụ|Chưa chọn|Không giảm|Không sửa|đã đóng|Gói cước/i.test(k));
  t.ok(unexpected.length === 0, 'mọi lỗi gặp đều là lỗi nghiệp vụ hợp lệ, không có lỗi bất ngờ: ' + unexpected.map(([k, n]) => n + '× ' + k).join(' | '));
  t.eq(dupSeats(A), 0, 'sau 400 thao tác ngẫu nhiên: không ghế nào còn 2 đơn mở (trừ đơn đang chờ xác nhận chuyển khoản, cố ý để nguyên: ' + (dupSeats(A, true) - dupSeats(A)) + ' ghế)');
  t.eq(dupSeats(S), 0, 'máy nhân viên cũng không còn ghế trùng đơn');
  t.eq(invariants(A), [], 'bất biến dữ liệu máy chủ quán sau 400 thao tác ngẫu nhiên');
  t.eq(invariants(S), [], 'bất biến dữ liệu máy nhân viên');
  const sig = d => JSON.stringify({ o: d.D.orders.map(o => [o.id, o.status]).sort(), i: d.D.orderItems.map(i => [i.id, i.qty, i.status]).sort(), p: d.D.payments.map(p => [p.id, p.state, p.total]).sort() });
  t.ok(sig(A) === sig(S), 'sau đồng bộ đủ, hai máy có dữ liệu GIỐNG HỆT nhau (đơn, món, thanh toán)');
  // doanh thu trên hai máy khớp
  const revA = A.D.payments.filter(p => p.state === 'paid').reduce((s, p) => s + p.total, 0), revS = S.D.payments.filter(p => p.state === 'paid').reduce((s, p) => s + p.total, 0);
  t.eq(revA, revS, 'tổng doanh thu hai máy bằng nhau: ' + revA);
}

t.group('E7. Khách quét QR (hàm máy chủ giả lập): đầu vào xấu, giá không do khách quyết định, ghi chú độc không chạy được ở máy nhân viên');
{
  const w = world(); const A = await setupOwner(w);
  const token = A.D.seats.find(s => s.table_id === tbl(A, 'Bàn 01').id && s.seat_no === 1).qr_token;
  const { makeSupabase } = await import('./fake-supabase.mjs');
  const g = makeSupabase(w.registry, {}).createClient(STORE_URL, ANON, { auth: { storageKey: 'guest-x' } });
  const tra = menuId(A, 'Trà đá');
  for (const [label, lines, re] of [
    ['danh sách rỗng', [], /Chưa chọn/], ['quá 40 dòng', Array(41).fill({ menuItemId: tra, qty: 1 }), /Chưa chọn|không hợp lệ/],
    ['món không tồn tại', [{ menuItemId: 'khong-co', qty: 1 }], /./],
  ]) {
    const r = await g.rpc('guest_order', { p_seat_token: token, p_lines: lines });
    t.ok(r.error && re.test(r.error.message || ''), `khách gửi ${label} → bị từ chối` + (r.error ? ' [' + r.error.message + ']' : ' (KHÔNG bị từ chối!)'));
  }
  for (const [label, q] of [['0', 0], ['âm (−3)', -3], ['1e9', 1e9], ['lẻ 1.5', 1.5], ['chuỗi "abc"', 'abc']]) {
    const before = w.store.colRows('orderItems').length, r = await g.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: tra, qty: q }] });
    const rows = w.store.colRows('orderItems'), added = rows.length > before ? rows.reduce((a, b) => (b.seq > a.seq ? b : a)) : null;
    t.ok(!!r.error || (added && added.data.qty >= 1 && added.data.qty <= 50), `khách gửi số lượng ${label} → bị từ chối hoặc kẹp về 1–50 (không tạo số lượng vô lý)` + (added ? ' [qty=' + added.data.qty + ']' : r.error ? ' [' + r.error.message + ']' : ''));
  }
  const evil = await g.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: tra, qty: 1, price: 1, note: HOSTILE[0] }] });
  t.ok(!evil.error, 'khách gửi kèm trường "price" giả + ghi chú độc: đơn vẫn được nhận');
  await A.sync(); await A.refresh();
  const it = A.D.orderItems.find(i => i.name_snapshot === 'Trà đá' && i.note);
  t.ok(it && it.price_snapshot === A.D.menu.find(m => m.id === tra).price, 'giá món lấy từ thực đơn của quán, không theo giá khách gửi (' + (it && it.price_snapshot) + ')');
  A.route = { name: 'kds', params: { k: 'all' } }; const kds = A.VIEWS.kds();
  A.route = { name: 'order', params: { id: it.order_id } }; const ord = A.VIEWS.order();
  t.ok(!BAD_PAT.some(re => re.test(kds) || re.test(ord)), 'ghi chú độc của khách hiện ở Bếp/Đơn đã được escape');
  // dồn dập: 60 lần gọi liên tiếp
  let ok = 0; for (let i = 0; i < 60; i++) { const r = await g.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: tra, qty: 1 }] }); if (!r.error) ok++; }
  note('thấp', `Khách (không đăng nhập) gửi 60 đơn liên tiếp: ${ok}/60 được nhận — không có giới hạn tần suất / chống spam ở hàm guest_order (Postgres thật cũng vậy). Nên thêm giới hạn theo ghế (vd. tối đa N lần/phút) hoặc bắt nhân viên duyệt đơn đầu.`);
}

t.group('E8. Hiệu năng: vẽ màn hình & tính toán với quán lớn (300 bàn, 800 món, 5.000 đơn mở/đã đóng)');
{
  const w = world(); const A = await setupOwner(w, { link: false });
  const ownerId = A.D.staff[0].id;
  const cat = A.D.categories[0].id, kit = A.D.kitchens[0].id, area = A.D.areas[0].id;
  for (let i = 0; i < 800; i++) A.D.menu.push({ id: 'pm' + i, name: 'Món số ' + i, description: 'mô tả ' + i, emoji: '🍽️', image: null, price: 10000 + i * 100, category_id: cat, kitchen_id: kit, stock_state: 'ok', active: 1, updated_at: Date.now() });
  for (let i = 0; i < 300; i++) { const id = 'pt' + i; A.D.tables.push({ id, name: 'Bàn P' + i, area_id: area, seats: 4, layout: 'auto', active: 1, updated_at: Date.now() }); for (let s = 1; s <= 4; s++) A.D.seats.push({ table_id: id, seat_no: s, qr_token: 'tk' + i + '-' + s, locked: 0, calling: 0, bound_order_id: null, updated_at: Date.now() }); }
  const now = Date.now();
  for (let i = 0; i < 5000; i++) {
    const ts = now - i * 60000 * 3, oid = 'po' + i, paid = i % 10 !== 0;
    A.D.orders.push({ id: oid, code: '#P' + i, table_id: 'pt' + (i % 300), seat_no: 1 + (i % 4), source: 'staff', status: paid ? 'paid' : 'open', promo_id: null, created_at: ts, updated_at: ts });
    A.D.orderItems.push({ id: 'pi' + i, order_id: oid, menu_item_id: 'pm' + (i % 800), name_snapshot: 'Món số ' + (i % 800), price_snapshot: 10000 + (i % 800) * 100, qty: 1 + (i % 3), status: paid ? 'served' : 'queued', batch: 1, created_at: ts, updated_at: ts });
    if (paid) A.D.payments.push({ id: 'pp' + i, order_id: oid, method: 'cash', subtotal: 10000, discount: 0, total: 10000, state: 'paid', staff_id: ownerId, created_at: ts, paid_at: ts });
    else A.D.seats.find(s => s.table_id === 'pt' + (i % 300) && s.seat_no === 1 + (i % 4)).bound_order_id = oid;
  }
  let t0 = performance.now(); await A.refresh(); const msRefresh = performance.now() - t0;
  const slow = [];
  for (const name of ['tables', 'cashier', 'kds', 'menu', 'newOrder', 'reports', 'stock', 'admin', 'history', 'tablesAdmin', 'reservations', 'logs']) {
    A.route = { name, params: { t: 'pt1', s: 1, cat: cat ? A.D.categories[0].name : '', period: 'month', k: 'all' } };
    t0 = performance.now(); try { A.VIEWS[name](); } catch (e) { slow.push(name + ' LỖI ' + e.message); continue; } const ms = performance.now() - t0;
    if (ms > 400) slow.push(`${name} ${Math.round(ms)} ms`);
  }
  t.ok(msRefresh < 2500, `tải lại toàn bộ bản chụp dữ liệu (5.000 đơn): ${Math.round(msRefresh)} ms < 2500`);
  t.ok(slow.length === 0, 'mọi màn hình chính vẽ dưới 400 ms với quán lớn' + (slow.length ? ' — CHẬM: ' + slow.join(', ') : ''));
  if (slow.length) note('thấp', 'Màn hình chậm với quán lớn: ' + slow.join(', '));
}

/* ============================================================ */
const { pass, fail, failures } = t.results;
console.log(`\n${'='.repeat(60)}\n${pass} đạt · ${fail} lỗi · ${pass + fail} kiểm tra · ${notes.length} ghi nhận`);
if (notes.length) { console.log('\nGhi nhận (rủi ro / giới hạn):'); notes.forEach(([s, m]) => console.log(` - [${s}] ${m}`)); }
if (fail) { console.log('\nCác kiểm tra lỗi:'); failures.forEach(f => console.log(' - ' + f)); process.exit(1); }
