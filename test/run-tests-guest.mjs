/* Kiểm thử luồng khách quét QR gọi món — chạy tách riêng khỏi run-tests.mjs vì cần thêm
   một "khách" không đăng nhập gì cả, gọi thẳng 3 hàm guest_* trên Supabase giả. */
import { newWorld, newDevice, suite, STORE_URL, ANON } from './harness.mjs';
import { makeSupabase } from './fake-supabase.mjs';

const t = suite();

async function setupOwner(world, { sample = true, link = true } = {}) {
  const A = await newDevice(world, 'owner');
  await A.Cloud.ownerSignUp('chu@quan.vn', 'matkhau1', 'Quán A');
  await A.License.refresh(true);
  await A.createStore({ shopName: 'Quán A', ownerName: 'Chủ Quán', username: 'chuquan', appPassword: 'chuquan123', sample });
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
/** "Khách" — không phải thiết bị cài app, chỉ là trình duyệt gọi thẳng 3 hàm guest_*, không đăng nhập gì cả */
function guestBrowser(world) {
  const client = makeSupabase(world.registry, {}).createClient(STORE_URL, ANON, { auth: { storageKey: 'guest-never-used' } });
  return client; // không gọi auth.signIn* — mọi rpc() đi với session = null, đúng như khách thật
}
const menuId = (dev, name) => dev.D.menu.find(m => m.name === name).id;
const tableOf = (dev, name) => dev.D.tables.find(x => x.name === name);
const ing = (dev, name) => dev.D.ingredients.find(i => i.name === name);
async function serveAll(dev, orderId) {
  for (const it of dev.D.orderItems.filter(i => i.order_id === orderId && i.status !== 'cancelled')) {
    await dev.api(`/kds/items/${it.id}/start`, { method: 'POST' });
    await dev.api(`/kds/items/${it.id}/done`, { method: 'POST' });
  }
}

/* ============================================================ */
t.group('G1. Khách lấy mã QR, xem thực đơn, mã sai/ghế khoá bị từ chối đúng cách');
{
  const w = newWorld(); const A = await setupOwner(w);
  const t8 = tableOf(A, 'Bàn 02');
  const seatRow = A.Cloud.store; // chỉ để lấy token qua app chủ quán
  const token = A.D.seats.find(s => s.table_id === t8.id && s.seat_no === 1).qr_token;
  t.ok(!!token, 'ghế có sẵn mã QR riêng ngay từ lúc tạo bàn: ' + token);

  const guest = guestBrowser(w);
  const r1 = await guest.rpc('guest_menu', { p_seat_token: token });
  t.ok(!r1.error, 'khách xem được thực đơn mà không cần đăng nhập gì cả');
  t.eq(r1.data.table_name, 'Bàn 02', 'đúng tên bàn');
  t.eq(r1.data.seat_no, 1, 'đúng số ghế');
  t.ok(r1.data.menu.length === A.D.menu.filter(m => m.active).length, 'đủ món đang bán');
  t.eq(r1.data.locked, false, 'ghế chưa khoá');

  const bad = await guest.rpc('guest_menu', { p_seat_token: 'ma-khong-ton-tai-xyz' });
  t.ok(bad.error && bad.error.code === '22023', 'mã QR sai bị từ chối rõ ràng');

  // chủ quán khoá ghế
  await A.api('/seats/bulk-lock', { method: 'POST', body: { seats: [{ tableId: t8.id, seatNo: 1 }], locked: true } });
  await A.sync();
  const r2 = await guest.rpc('guest_menu', { p_seat_token: token });
  t.eq(r2.data.locked, true, 'khách vẫn xem được thực đơn khi ghế đã khoá (để biết lý do), nhưng cờ locked=true');
  const callLocked = await guest.rpc('guest_call', { p_seat_token: token });
  t.ok(callLocked.error && callLocked.error.code === '42501', 'ghế đã khoá: khách không gọi nhân viên được');
  const orderLocked = await guest.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: menuId(A, 'Trà đá'), qty: 1 }] });
  t.ok(orderLocked.error && orderLocked.error.code === '42501', 'ghế đã khoá: khách không gọi món được');
  await A.api('/seats/bulk-lock', { method: 'POST', body: { seats: [{ tableId: t8.id, seatNo: 1 }], locked: false } });
  await A.sync();
}

t.group('G2. Khách gọi món — đơn/món hiện đúng trên máy chủ quán, trừ kho đúng');
{
  const w = newWorld(); const A = await setupOwner(w);
  const t8 = tableOf(A, 'Bàn 02'), token = A.D.seats.find(s => s.table_id === t8.id && s.seat_no === 1).qr_token;
  const boBefore = ing(A, 'Thịt bò').qty;
  const guest = guestBrowser(w);

  const r = await guest.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: menuId(A, 'Phở bò tái'), qty: 2 }] });
  t.ok(!r.error, 'khách gửi món thành công');
  t.ok(/^#G\d+$/.test(r.data.order_code), 'mã đơn khách tạo có tiền tố #G riêng, không trùng kiểu mã máy tự sinh: ' + r.data.order_code);
  t.eq(r.data.status, 'queued', 'chưa bật xác nhận đơn đầu → món vào thẳng hàng đợi bếp');

  await A.sync();
  const o = A.D.orders.find(x => x.id === r.data.order_id);
  t.ok(!!o, 'đơn của khách xuất hiện trên máy chủ quán qua đồng bộ');
  t.eq(o.source, 'qr', 'nguồn đơn ghi đúng là "qr"');
  t.eq(o.table_id, t8.id, 'đúng bàn'); t.eq(o.seat_no, 1, 'đúng ghế');
  const item = A.D.orderItems.find(i => i.order_id === o.id);
  t.eq(item.name_snapshot, 'Phở bò tái', 'đúng tên món'); t.eq(item.qty, 2, 'đúng số lượng'); t.eq(item.status, 'queued', 'vào thẳng bếp');
  t.eq(Math.round((boBefore - ing(A, 'Thịt bò').qty) * 1000) / 1000, Math.round(0.15 * 2 * 1000) / 1000, 'kho trừ đúng theo công thức');

  // gọi thêm lần 2 — vào chung đơn cũ, tách đợt mới
  const r2 = await guest.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: menuId(A, 'Trà đá'), qty: 1 }] });
  t.eq(r2.data.order_id, r.data.order_id, 'gọi thêm lần 2 vào ĐÚNG đơn cũ, không tạo đơn mới');
  await A.sync();
  t.eq(A.D.orderItems.filter(i => i.order_id === o.id).length, 2, 'đơn giờ có 2 món (2 đợt gọi khác nhau)');
  const batches = new Set(A.D.orderItems.filter(i => i.order_id === o.id).map(i => i.batch));
  t.eq(batches.size, 2, 'hai đợt gọi có số đợt (batch) khác nhau — không gộp lẫn');
}

t.group('G3. Nhân viên thấy đơn khách gần như ngay lập tức (qua đồng bộ, không cần làm gì thêm)');
{
  const w = newWorld(); const A = await setupOwner(w); const S = await addStaffDevice(w, A, 'bep');
  const t12 = tableOf(A, 'Bàn 01'), token = A.D.seats.find(s => s.table_id === t12.id && s.seat_no === 1).qr_token;
  const guest = guestBrowser(w);
  await guest.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: menuId(A, 'Chả giò hải sản'), qty: 1 }] });
  await S.sync();
  const o = S.D.orders.find(x => x.source === 'qr' && x.table_id === t12.id);
  t.ok(!!o, 'máy nhân viên (chưa từng mở đơn này) nhận được đơn khách qua đồng bộ bình thường, không cần xử lý riêng');
  t.eq(S.D.orderItems.find(i => i.order_id === o.id).status, 'queued', 'món hiện đúng trạng thái trên máy nhân viên');
}

t.group('G4. Bật "Xác nhận đơn đầu tiên" — món khách gọi lần đầu chờ duyệt, lần sau đi thẳng');
{
  const w = newWorld(); const A = await setupOwner(w);
  await A.api('/settings', { method: 'PATCH', body: { confirmFirstOrder: true } });
  await A.sync();
  const t3 = tableOf(A, 'Bàn 03'), token = A.D.seats.find(s => s.table_id === t3.id && s.seat_no === 1).qr_token;
  const guest = guestBrowser(w);

  const r1 = await guest.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: menuId(A, 'Cơm tấm sườn bì'), qty: 1 }] });
  t.eq(r1.data.status, 'pending', 'lần gọi ĐẦU TIÊN của ghế → chờ xác nhận');
  await A.sync(); await A.refresh();
  A.route = { name: 'tables', params: {} };
  t.ok(A.VIEWS.tables().includes('đơn khách chờ bạn xác nhận'), 'banner "đơn khách chờ xác nhận" hiện ở Sơ đồ bàn');
  A.route = { name: 'order', params: { id: r1.data.order_id } };
  const ov = A.VIEWS.order();
  t.ok(ov.includes('Xác nhận gửi bếp') && ov.includes('Khách vừa gọi'), 'màn chi tiết đơn có nút xác nhận/từ chối');

  const r2 = await guest.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: menuId(A, 'Trà đá'), qty: 1 }] });
  t.eq(r2.data.status, 'queued', 'lần gọi THÊM (ghế đã có đơn mở) → đi thẳng bếp, không chờ duyệt lại');

  // nhân viên bấm xác nhận
  const o = A.D.orders.find(x => x.id === r1.data.order_id);
  const pendingItem = A.D.orderItems.find(i => i.order_id === o.id && i.status === 'pending');
  await A.api(`/orders/${o.id}/approve`, { method: 'POST' });
  await A.refresh();
  t.eq(A.D.orderItems.find(i => i.id === pendingItem.id).status, 'queued', 'xác nhận xong → món chuyển sang hàng đợi bếp');
}

t.group('G5. Nhân viên từ chối đơn chờ xác nhận — hoàn kho, không lưu vết đơn rác');
{
  const w = newWorld(); const A = await setupOwner(w);
  await A.api('/settings', { method: 'PATCH', body: { confirmFirstOrder: true } });
  await A.sync();
  const t4 = tableOf(A, 'Bàn 04'), token = A.D.seats.find(s => s.table_id === t4.id && s.seat_no === 1).qr_token;
  const boBefore = ing(A, 'Thịt bò').qty;
  const guest = guestBrowser(w);
  const r = await guest.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: menuId(A, 'Phở bò tái'), qty: 1 }] });
  await A.sync();
  t.ok(ing(A, 'Thịt bò').qty < boBefore, 'kho đã trừ tạm khi món còn pending');
  await A.api(`/orders/${r.data.order_id}/reject`, { method: 'POST' });
  await A.refresh();
  t.eq(ing(A, 'Thịt bò').qty, boBefore, 'từ chối xong → kho được hoàn lại đúng số đã trừ');
  const o = A.D.orders.find(x => x.id === r.data.order_id);
  t.eq(o.status, 'void', 'đơn bị huỷ (void), không còn hiện là đơn mở');
  const seat = A.D.seats.find(s => s.table_id === t4.id && s.seat_no === 1);
  t.ok(!seat.bound_order_id, 'ghế được giải phóng, không còn dính vào đơn đã huỷ');
}

t.group('G6. Khách bấm "Gọi nhân viên" — hiện đúng trên Sơ đồ bàn và biểu tượng bàn');
{
  const w = newWorld(); const A = await setupOwner(w);
  const t5 = tableOf(A, 'Bàn 05'), token = A.D.seats.find(s => s.table_id === t5.id && s.seat_no === 1).qr_token;
  const guest = guestBrowser(w);
  const r = await guest.rpc('guest_call', { p_seat_token: token });
  t.ok(!r.error && r.data === true, 'gọi nhân viên thành công');
  await A.sync(); await A.refresh();
  A.route = { name: 'tables', params: {} };
  const tv = A.VIEWS.tables();
  t.ok(tv.includes('ghế đang gọi nhân viên'), 'banner gọi nhân viên hiện trên Sơ đồ bàn');
  const svg = A.tableChairsSvg(t5);
  t.ok(svg.includes('var(--amber)'), 'biểu tượng bàn đánh dấu đúng ghế đang gọi (chấm vàng)');
}

t.group('G7. Hai khách cùng gọi món đồng thời vào hai ghế khác nhau — không đè đơn của nhau');
{
  const w = newWorld(); const A = await setupOwner(w);
  const t6 = tableOf(A, 'Bàn 06');
  const tok1 = A.D.seats.find(s => s.table_id === t6.id && s.seat_no === 1).qr_token;
  const tok2 = A.D.seats.find(s => s.table_id === t6.id && s.seat_no === 2).qr_token;
  const g1 = guestBrowser(w), g2 = guestBrowser(w);
  const [r1, r2] = await Promise.all([
    g1.rpc('guest_order', { p_seat_token: tok1, p_lines: [{ menuItemId: menuId(A, 'Bia Sài Gòn'), qty: 2 }] }),
    g2.rpc('guest_order', { p_seat_token: tok2, p_lines: [{ menuItemId: menuId(A, 'Nước cam ép'), qty: 1 }] })
  ]);
  t.ok(r1.data.order_id !== r2.data.order_id, 'hai ghế khác nhau → hai đơn riêng biệt, không trộn lẫn');
  await A.sync();
  t.eq(A.D.orders.find(x => x.id === r1.data.order_id).seat_no, 1, 'đơn ghế 1 đúng ghế');
  t.eq(A.D.orders.find(x => x.id === r2.data.order_id).seat_no, 2, 'đơn ghế 2 đúng ghế');
}

t.group('G8. Đổi mã QR (rotate) — mã cũ bị vô hiệu ngay, mã mới hoạt động');
{
  const w = newWorld(); const A = await setupOwner(w);
  const t7 = tableOf(A, 'Bàn 01'), oldToken = A.D.seats.find(s => s.table_id === t7.id && s.seat_no === 1).qr_token;
  await A.api(`/seats/${t7.id}/1/rotate`, { method: 'POST' });
  await A.sync();
  const newToken = A.D.seats.find(s => s.table_id === t7.id && s.seat_no === 1).qr_token;
  t.ok(newToken !== oldToken, 'mã QR đã đổi sang giá trị khác');
  const guest = guestBrowser(w);
  const rOld = await guest.rpc('guest_menu', { p_seat_token: oldToken });
  t.ok(rOld.error, 'mã QR cũ (đã in trước đó) không dùng được nữa');
  const rNew = await guest.rpc('guest_menu', { p_seat_token: newToken });
  t.ok(!rNew.error, 'mã QR mới hoạt động bình thường');
}

t.group('G9. Màn "Mã QR gọi món" và in tem — trang dùng chung, sẵn sàng ngay khi đã liên kết Supabase, không cần xuất/lưu link gì nữa');
{
  // Chưa liên kết Supabase của quán → chưa in tem được
  const w0 = newWorld(); const A0 = await setupOwner(w0, { link: false });
  A0.route = { name: 'guestPage', params: {} };
  const gv0 = A0.VIEWS.guestPage();
  t.ok(gv0.includes('liên kết Supabase của quán') && !gv0.includes('In tem mã QR theo từng ghế'), 'chưa liên kết Supabase → chưa cho vào in tem');
  A0.route = { name: 'qrPrint', params: {} };
  t.ok(A0.VIEWS.qrPrint().includes('Chưa đủ điều kiện in tem'), 'vào thẳng màn in tem khi chưa đủ điều kiện → báo rõ, không crash');

  // Đã liên kết (setupOwner mặc định link:true) → sẵn sàng NGAY, không cần thao tác gì thêm
  const w = newWorld(); const A = await setupOwner(w);
  A.route = { name: 'guestPage', params: {} };
  const gv = A.VIEWS.guestPage();
  t.ok(gv.includes('In tem mã QR theo từng ghế') && !gv.includes('Xuất tệp'), 'đã liên kết Supabase → sẵn sàng in tem ngay, không còn bước xuất file/dán link nào');

  A.route = { name: 'qrPrint', params: {} };
  const qv = A.VIEWS.qrPrint();
  t.ok(qv.includes('Chọn tất cả bàn') && qv.includes('khổ 50×60mm') === false, 'màn chọn tem hiện đúng, chưa chọn ghế thì chưa có nút in');
  A.handleAct({ dataset: { act: 'qrSelAll' } });
  A.route = { name: 'qrPrint', params: {} };
  t.ok(A.VIEWS.qrPrint().includes('Tạo file PDF · ') && A.VIEWS.qrPrint().includes('A4'), 'chọn hết bàn xong → hiện nút tạo file PDF (khổ A4)');
}

t.group('G10. Máy nhân viên không sửa được cài đặt liên quan tới mã QR/thanh toán (chặn cả UI lẫn Postgres)');
{
  const w = newWorld(); const A = await setupOwner(w); const S = await addStaffDevice(w, A, 'pv');
  await S.login('chuquan', 'chuquan123');
  t.ok(!S.can('tablesAdmin'), 'máy phụ không vào được mục Quản lý bàn/QR trên giao diện');
  await t.rejects(() => S.api('/settings', { method: 'PATCH', body: { vietqrAccount: '999999' } }),
    /Chỉ máy của chủ quán/, 'và bị chặn ở engine nếu cố gọi thẳng API đổi cài đặt (vd. tài khoản nhận tiền)');
}

t.group('G11. Khách tự xem được "Đơn của tôi" — guest_menu trả kèm đơn + trạng thái từng món');
{
  const w = newWorld(); const A = await setupOwner(w);
  const t2 = tableOf(A, 'Bàn 02'), token = A.D.seats.find(s => s.table_id === t2.id && s.seat_no === 1).qr_token;
  const guest = guestBrowser(w);

  const r0 = await guest.rpc('guest_menu', { p_seat_token: token });
  t.eq(r0.data.order, null, 'chưa gọi món gì → order là null, không có gì để hiện');

  await guest.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: menuId(A, 'Phở bò tái'), qty: 2 }] });
  const r1 = await guest.rpc('guest_menu', { p_seat_token: token });
  t.ok(!!r1.data.order, 'gọi món xong → guest_menu trả kèm đơn hiện tại');
  t.eq(r1.data.order.items.length, 1, 'đúng 1 món trong đơn');
  t.eq(r1.data.order.items[0], { name: 'Phở bò tái', qty: 2, note: '', status: 'queued', price: 75000 }, 'đủ thông tin món: tên, số lượng, ghi chú, trạng thái, giá');

  // nhân viên chuyển món sang "đang làm" — khách gọi lại guest_menu phải thấy đúng trạng thái mới
  await A.sync();
  const o = A.D.orders.find(x => x.id === r1.data.order.id);
  const item = A.D.orderItems.find(i => i.order_id === o.id);
  await A.api(`/kds/items/${item.id}/start`, { method: 'POST' });
  await A.sync();
  const r2 = await guest.rpc('guest_menu', { p_seat_token: token });
  t.eq(r2.data.order.items[0].status, 'cooking', 'khách tự thấy món chuyển "đang làm" mà không cần hỏi nhân viên');

  // gọi thêm lần 2 — đơn vẫn là MỘT đơn, có đủ cả 2 món (không ghi đè món cũ)
  await guest.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: menuId(A, 'Trà đá'), qty: 1 }] });
  const r3 = await guest.rpc('guest_menu', { p_seat_token: token });
  t.eq(r3.data.order.items.length, 2, 'gọi thêm lần 2 → đơn có đủ 2 món, không mất món cũ');
  t.eq(r3.data.order.id, r1.data.order.id, 'vẫn cùng một đơn (cùng mã), không tách đơn mới');
}

t.group('G12. Thanh toán xong → đơn đóng, "Đơn của tôi" của khách tự biến mất (order=null)');
{
  const w = newWorld(); const A = await setupOwner(w);
  const t3 = tableOf(A, 'Bàn 03'), token = A.D.seats.find(s => s.table_id === t3.id && s.seat_no === 1).qr_token;
  const guest = guestBrowser(w);
  const r = await guest.rpc('guest_order', { p_seat_token: token, p_lines: [{ menuItemId: menuId(A, 'Trà đá'), qty: 1 }] });
  await A.sync();
  const o = A.D.orders.find(x => x.id === r.data.order_id);
  await serveAll(A, o.id);
  await A.api(`/orders/${o.id}/payments`, { method: 'POST', body: { method: 'cash' } });
  await A.sync();
  const after = await guest.rpc('guest_menu', { p_seat_token: token });
  t.eq(after.data.order, null, 'đơn đã thanh toán (không còn "open") → guest_menu không còn trả về nữa');
}

/* ============================================================ */
const { pass, fail, failures } = t.results;
console.log(`\n${'='.repeat(60)}\n${pass} đạt · ${fail} lỗi · ${pass + fail} kiểm tra`);
if (fail) { console.log('\nCác kiểm tra lỗi:'); failures.forEach(f => console.log(' - ' + f)); process.exit(1); }
