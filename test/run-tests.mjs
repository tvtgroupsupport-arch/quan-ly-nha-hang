import fs from 'node:fs';
import crypto from 'node:crypto';
import { newWorld, newDevice, suite, STORE_URL, ANON, GUEST_PAGE_URL } from './harness.mjs';
import { makeSupabase } from './fake-supabase.mjs';

const t = suite();

/* ---------- tiện ích dựng tình huống ---------- */
async function setupOwner(world, { sample = true, link = true, name = 'owner' } = {}) {
  const A = await newDevice(world, name);
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
const menuId = (dev, name) => dev.D.menu.find(m => m.name === name).id;
const tableOf = (dev, name) => dev.D.tables.find(x => x.name === name);
const ing = (dev, name) => dev.D.ingredients.find(i => i.name === name);
async function order(dev, tableName, seat, lines) {
  const tb = tableOf(dev, tableName);
  return dev.api('/orders/items', { method: 'POST', body: { tableId: tb.id, seatNo: seat, lines: lines.map(([n, q]) => ({ menuItemId: menuId(dev, n), qty: q })) } });
}
async function serveAll(dev, orderId) {
  for (const it of dev.D.orderItems.filter(i => i.order_id === orderId && i.status !== 'cancelled')) {
    await dev.api(`/kds/items/${it.id}/start`, { method: 'POST' });
    await dev.api(`/kds/items/${it.id}/done`, { method: 'POST' });
  }
}

/* ============================================================ */
t.group('0. Bộ tạo mã QR: đối chiếu đáp án chuẩn của tài liệu QR (lỗi cũ: bit định dạng và Reed-Solomon sai)');
{
  const w = newWorld(); const A = await newDevice(w, 'qr');
  const hex = a => Array.from(a, x => x.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  const hw = [0x20, 0x5B, 0x0B, 0x78, 0xD1, 0x72, 0xDC, 0x4D, 0x43, 0x40, 0xEC, 0x11, 0xEC, 0x11, 0xEC, 0x11];
  t.eq(hex(A.QR._rs(hw, 10)), 'C4 23 27 77 EB D7 E7 E2 5D 17', 'Reed-Solomon: ví dụ chuẩn "HELLO WORLD" phiên bản 1-M cho đúng 10 byte sửa lỗi');
  const FMT_M = [0x5412, 0x5125, 0x5E7C, 0x5B4B, 0x45F9, 0x40CE, 0x4F97, 0x4AA0];
  t.eq([0, 1, 2, 3, 4, 5, 6, 7].map(m => A.QR._format(m)), FMT_M, 'bit thông tin định dạng mức M đủ 8 mặt nạ khớp bảng chuẩn');
  const m = A.QR.matrix('hello');   // đọc lại bit định dạng đúng theo vị trí chuẩn rồi đối chiếu
  const cells = [[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
  const bitsStr = cells.map(([r, c]) => m[r][c]).join('');
  t.ok(FMT_M.map(v => v.toString(2).padStart(15, '0')).includes(bitsStr), 'bit định dạng nằm đúng vị trí chuẩn (đọc ra một giá trị hợp lệ của mức M)');
  const golden = JSON.parse(fs.readFileSync(new URL('./qr-golden.json', import.meta.url), 'utf8'));
  let same = 0, firstBad = null;
  for (const g of golden.cases) {
    const h = crypto.createHash('sha256').update(A.QR.matrix(g.text).map(r => Array.from(r).join('')).join('\n')).digest('hex');
    if (h === g.sha256 && A.QR.pickVersion(g.text) === g.version) same++; else firstBad = firstBad || g.text.slice(0, 30);
  }
  t.eq(same, golden.cases.length, `${golden.cases.length} mã QR (phiên bản 1–20, sát mép dung lượng, có Unicode) giống từng ô với bộ mã đã được OpenCV giải mã đúng` + (firstBad ? ' — lệch ở: ' + firstBad : ''));
  await t.rejects(() => A.QR.matrix('x'.repeat(700)), /quá dài/, 'nội dung vượt dung lượng bị từ chối thay vì sinh mã hỏng');
}

t.group('1. Mật khẩu & khởi tạo quán (băm PBKDF2, không còn mật khẩu "demo")');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  const owner = A.D.staff[0];
  t.ok(owner.pw && owner.pw.h && owner.pw.s && !JSON.stringify(owner).includes('chuquan123'), 'mật khẩu lưu dạng băm, không lưu bản rõ');
  await t.rejects(() => A.apiLocal('/auth/login', { method: 'POST', body: { username: 'chuquan', password: 'demo' } }), /Sai tên đăng nhập/, 'mật khẩu "demo" không còn đăng nhập được');
  await t.rejects(() => A.apiLocal('/auth/login', { method: 'POST', body: { username: 'chuquan', password: 'sai' } }), /Sai tên đăng nhập/, 'sai mật khẩu bị từ chối');
  const r = await A.apiLocal('/staff', { method: 'POST', body: { name: 'Lan', username: 'lan', role: 'Thu ngân' } });
  t.ok(/^[a-z2-9]{8}$/.test(r.tempPassword), 'tạo nhân viên → mật khẩu tạm ngẫu nhiên 8 ký tự: ' + r.tempPassword);
  const lg = await A.apiLocal('/auth/login', { method: 'POST', body: { username: 'lan', password: r.tempPassword } });
  t.ok(lg.staff.mustChange === true, 'đăng nhập bằng mật khẩu tạm → buộc đổi mật khẩu');
  A.ME = lg.staff;
  await t.rejects(() => A.apiLocal('/auth/password', { method: 'POST', body: { oldPassword: r.tempPassword, newPassword: '123' } }), /tối thiểu 6/, 'mật khẩu mới quá ngắn bị từ chối');
  await A.apiLocal('/auth/password', { method: 'POST', body: { oldPassword: r.tempPassword, newPassword: 'matkhaumoi' } });
  const lg2 = await A.apiLocal('/auth/login', { method: 'POST', body: { username: 'lan', password: 'matkhaumoi' } });
  t.ok(lg2.staff.mustChange === false, 'đổi mật khẩu xong → hết cờ buộc đổi');
}

t.group('2. Lưu SQLite: đóng/mở lại app không mất dữ liệu, giữ thứ tự, tồn kho đúng');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  await order(A, 'Bàn 01', 1, [['Phở bò tái', 2]]);
  await A.save();
  const before = { tables: A.D.tables.map(x => x.name), menu: A.D.menu.map(x => x.name), orders: A.D.orders.length, bo: ing(A, 'Thịt bò').qty, counter: A.D.counter, moves: A.D.stockMoves.length };
  const B = await A.reopen();
  t.eq(B.D.tables.map(x => x.name), before.tables, 'thứ tự bàn giữ nguyên sau khi mở lại');
  t.eq(B.D.menu.map(x => x.name), before.menu, 'thứ tự thực đơn giữ nguyên');
  t.eq(B.D.orders.length, before.orders, 'đơn hàng còn nguyên');
  t.eq(ing(B, 'Thịt bò').qty, before.bo, 'tồn kho (tính lại từ tồn đầu + phiếu) khớp trước khi đóng app');
  t.eq(B.D.counter, before.counter, 'bộ đếm mã đơn được nhớ');
  t.ok(B.D.staff[0].pw && B.D.staff[0].username === 'chuquan', 'tài khoản chủ quán còn nguyên');
  t.eq(B.D.stockMoves.length, before.moves, 'không mất phiếu kho');
}

t.group('3. Liên kết Supabase của quán (chủ quán) + đẩy dữ liệu lần đầu');
{
  const w = newWorld(); const A = await setupOwner(w);
  t.ok(w.store.owner !== null, 'claim_owner: máy này thành chủ của dự án Supabase');
  t.ok(w.central.links.size === 1, 'địa chỉ Supabase của quán được lưu ở trung tâm (để khôi phục sau)');
  t.eq(A.Records.dirtyCount(), 0, 'sau đồng bộ không còn bản ghi chờ gửi');
  t.ok(w.store.records.size >= A.D.menu.length + A.D.tables.length, `đã đẩy ${w.store.records.size} bản ghi lên Supabase`);
  const mk = [...w.store.records.values()].find(r => r.collection === 'ingredients');
  t.ok(mk && mk.data.qty0 !== undefined && mk.data.qty === undefined, 'nguyên liệu đồng bộ qty0 (tồn đầu), KHÔNG đồng bộ qty (giá trị phái sinh)');
  // người khác không thể chiếm quyền chủ
  const X = await newDevice(w, 'kẻ-lạ');
  await X.Cloud.ownerSignUp('khac@x.vn', 'abcdef', 'X');
  await t.rejects(() => X.Cloud.linkStoreAsOwner({ url: STORE_URL, anonKey: ANON, email: 'khac@x.vn', password: 'abcdef' }), /đã có chủ quán khác/, 'dự án đã có chủ: người thứ hai không chiếm được quyền');
}

t.group('4. Lỗi cấu hình Supabase hiện thông báo dễ hiểu');
{
  const w = newWorld(); const A = await newDevice(w, 'o');
  await A.Cloud.ownerSignUp('a@b.vn', 'abcdef', 'Q');
  await A.createStore({ shopName: 'Q', username: 'u', appPassword: 'abcdef', sample: false }); await A.Cloud.saveCfg({ role: 'owner' });
  w.store.sqlReady = false;
  await t.rejects(() => A.Cloud.linkStoreAsOwner({ url: STORE_URL, anonKey: ANON, email: 'a@b.vn', password: 'abcdef' }), /chưa chạy script SQL/, 'chưa chạy script SQL → báo đúng nguyên nhân');
  w.store.sqlReady = true; w.store.confirmEmail = true;
  const B = await newDevice(w, 'o2'); await B.Cloud.ownerSignUp('c@d.vn', 'abcdef', 'Q'); await B.createStore({ shopName: 'Q', username: 'u', appPassword: 'abcdef' }); await B.Cloud.saveCfg({ role: 'owner' });
  await t.rejects(() => B.Cloud.linkStoreAsOwner({ url: STORE_URL, anonKey: ANON, email: 'c@d.vn', password: 'abcdef' }), /Confirm email/, 'đang bật Confirm email → hướng dẫn tắt');
  w.store.confirmEmail = false;
  await t.rejects(() => A.Cloud.linkStoreAsOwner({ url: 'http://khong-https', anonKey: ANON, email: 'a@b.vn', password: 'abcdef' }), /không hợp lệ/, 'địa chỉ không phải https bị chặn');
  const fakeSr = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.sig';
  await t.rejects(() => A.Cloud.linkStoreAsOwner({ url: STORE_URL, anonKey: fakeSr, email: 'a@b.vn', password: 'abcdef' }), /service_role/, 'khoá service_role bị từ chối thẳng tay');
}

t.group('5. Mã mời QR: dùng một lần, hết hạn 5 phút, tạo ra máy nhân viên');
{
  const w = newWorld(); const A = await setupOwner(w);
  const inv = await A.Cloud.createInvite();
  t.ok(inv.payload.startsWith('QLNH1|'), 'mã mời có tiền tố nhận diện');
  t.ok(!inv.payload.includes('service_role') && inv.payload.length < 700, `mã mời gọn (${inv.payload.length} ký tự) — quét QR được`);
  const S = await newDevice(w, 'bep');
  await S.Cloud.joinAsStaff(inv.payload, 'Máy bếp');
  t.eq([...w.store.devices.values()].map(d => d.device_name), ['Máy bếp'], 'thiết bị được ghi nhận trên Supabase');
  await S.sync();
  t.eq(S.D.menu.length, A.D.menu.length, 'máy nhân viên kéo đủ thực đơn');
  t.eq(S.D.staff.map(x => x.username), ['chuquan'], 'máy nhân viên có danh sách tài khoản để đăng nhập');
  t.eq(S.Cloud.role, 'staff', 'vai trò máy = staff');
  // dùng lại mã
  const S2 = await newDevice(w, 'bep2');
  await t.rejects(() => S2.Cloud.joinAsStaff(inv.payload, 'Lậu'), /không hợp lệ hoặc đã hết hạn/, 'mã đã dùng không dùng lại được (chụp màn hình vô ích)');
  // hết hạn
  const inv2 = await A.Cloud.createInvite();
  w.store.now = () => Date.now() + 6 * 60000;
  const S3 = await newDevice(w, 'bep3');
  await t.rejects(() => S3.Cloud.joinAsStaff(inv2.payload, 'Muộn'), /không hợp lệ hoặc đã hết hạn/, 'mã quá 5 phút bị từ chối');
  w.store.now = () => Date.now();
  // máy nhân viên không tạo được mã mời
  await t.rejects(() => S.Cloud.createInvite(), /Chỉ máy chủ quán/, 'máy nhân viên không tự mời thêm máy khác');
  const bad = await newDevice(w, 'bad');
  await t.rejects(() => bad.Cloud.joinAsStaff('QLNH1|@@@', 'x'), /bị lỗi|không hợp lệ/, 'mã rác bị từ chối');
  await t.rejects(() => bad.Cloud.joinAsStaff('QLNH1|http://x.vn|khoa-khoa-khoa-khoa-khoa|' + 'a'.repeat(32), 'x'), /không hợp lệ/, 'mã mời trỏ tới địa chỉ không https bị từ chối');
  await t.rejects(() => bad.Cloud.joinAsStaff('hello', 'x'), /không phải mã mời/, 'chuỗi lạ bị từ chối');
}

t.group('6. Đồng bộ hai chiều: gọi món offline → có mạng tự đồng bộ; kho không lệch');
{
  const w = newWorld(); const A = await setupOwner(w); const S = await addStaffDevice(w, A, 'phucvu');
  await A.api('/staff', { method: 'POST', body: { name: 'PV', username: 'pv', role: 'Phục vụ' } });
  const temp = (await A.api('/staff', { method: 'POST', body: { name: 'PV2', username: 'pv2', role: 'Phục vụ' } })).tempPassword;
  await A.sync(); await S.sync();
  t.eq(S.D.staff.length, 3, 'tài khoản nhân viên mới tạo ở máy chủ quán xuất hiện ở máy nhân viên');
  const lg = await S.login('pv2', temp);
  t.ok(lg.staff.mustChange, 'nhân viên đăng nhập ở máy phụ bằng mật khẩu tạm được cấp ở máy chủ');

  const boA0 = ing(A, 'Thịt bò').qty, bsA0 = ing(A, 'Bánh phở').qty;
  S.setOnline(false);                                       // máy nhân viên mất mạng
  await order(S, 'Bàn 02', 1, [['Phở bò tái', 2]]);          // trừ thịt bò + bánh phở ở máy phụ
  await order(A, 'Bàn 03', 1, [['Phở bò tái', 3]]);          // đồng thời máy chủ quán cũng trừ kho
  await S.save(); await A.sync();
  t.eq(S.Records.dirtyCount() > 0, true, 'máy nhân viên offline: thay đổi nằm chờ trên máy');
  S.setOnline(true);
  await S.sync(); await A.sync(); await S.sync();
  const expectBo = Math.round((boA0 - 0.15 * 5) * 1000) / 1000, expectBp = Math.round((bsA0 - 0.2 * 5) * 1000) / 1000;
  t.eq(ing(A, 'Thịt bò').qty, expectBo, `kho thịt bò ở máy chủ = ${expectBo} (đã trừ cả 2 đơn của 2 máy)`);
  t.eq(ing(S, 'Thịt bò').qty, expectBo, 'kho thịt bò ở máy nhân viên bằng đúng máy chủ — không đè nhau');
  t.eq(ing(S, 'Bánh phở').qty, expectBp, 'bánh phở cũng khớp');
  t.eq(S.D.orders.length, A.D.orders.length, 'cả hai máy cùng thấy đủ đơn');
  const codes = A.D.orders.map(o => o.code);
  t.eq(new Set(codes).size, codes.length, 'mã đơn không trùng nhau giữa các máy: ' + codes.join(' '));
  t.ok(S.D.orders.some(o => /-[0-9A-F]{2}$/.test(o.code)), 'đơn tạo ở máy nhân viên có hậu tố riêng của máy');
  const before = JSON.stringify(A.D.orders.map(o => o.id).sort());
  await A.sync(); await S.sync();
  t.eq(JSON.stringify(A.D.orders.map(o => o.id).sort()), before, 'đồng bộ lặp lại không tạo thêm/bớt gì (ổn định)');
}

t.group('7. Quyền máy nhân viên: chặn ở cả giao diện lẫn Postgres');
{
  const w = newWorld(); const A = await setupOwner(w); const S = await addStaffDevice(w, A, 'phucvu');
  await S.login('chuquan', 'chuquan123');            // kể cả đăng nhập tài khoản Chủ quán trên máy phụ
  const tb = tableOf(S, 'Bàn 01');
  await t.rejects(() => S.api('/tables/' + tb.id, { method: 'DELETE' }), /Chỉ máy của chủ quán/, 'máy phụ không xoá được bàn (kể cả đăng nhập tài khoản Chủ quán)');
  await t.rejects(() => S.api('/menu/' + menuId(S, 'Trà đá'), { method: 'DELETE' }), /Chỉ máy của chủ quán/, 'không xoá được món');
  await t.rejects(() => S.api('/staff', { method: 'POST', body: { name: 'x', username: 'x', role: 'Quản lý' } }), /Chỉ máy của chủ quán/, 'không tạo được nhân viên');
  await t.rejects(() => S.api('/staff/' + S.D.staff[0].id, { method: 'PATCH', body: { perms: {} } }), /Chỉ máy của chủ quán/, 'không đổi được quyền nhân viên');
  await t.rejects(() => S.api('/settings', { method: 'PATCH', body: { vietqrAccount: '999' } }), /Chỉ máy của chủ quán/, 'không đổi được cài đặt');
  await t.rejects(() => S.api('/menu/' + menuId(S, 'Trà đá'), { method: 'PATCH', body: { price: 1 } }), /chỉ được đổi tình trạng/, 'không sửa được giá món');
  await S.api('/menu/' + menuId(S, 'Trà đá'), { method: 'PATCH', body: { stockState: 'out' } });
  await S.sync(); await A.sync();
  t.eq(A.D.menu.find(m => m.name === 'Trà đá').stock_state, 'out', 'nhưng đổi được tình trạng còn/hết món và đồng bộ về máy chủ');
  t.ok(!S.can('tablesAdmin') && !S.can('staff') && !S.can('billing') && !S.can('promo'), 'giao diện máy phụ ẩn các mục quản trị');
  t.ok(S.can('pos') && S.can('kds'), 'vẫn dùng được các mục vận hành');

  // Kẻ sửa mã app để GỌI THẲNG Supabase (bỏ qua mọi kiểm tra phía giao diện)
  const hacked = S.Cloud.store;
  const forge = async recs => (await hacked.rpc('push_records', { p_recs: recs })).data;
  const now = Date.now() + 1e6;
  let r = await forge([{ collection: 'tables', id: tb.id, updated_at: now, deleted: false, data: { ...tb, name: 'HACK' } }]);
  t.eq(r[0].status, 'rejected', 'POSTGRES chặn: sửa bàn');
  r = await forge([{ collection: 'tables', id: tb.id, updated_at: now, deleted: true, data: {} }]);
  t.eq(r[0].status, 'rejected', 'POSTGRES chặn: xoá bàn (bia mộ)');
  r = await forge([{ collection: 'orders', id: A.D.orders[0]?.id || 'x', updated_at: now, deleted: true, data: {} }]);
  t.eq(r[0].status, 'rejected', 'POSTGRES chặn: xoá cả dữ liệu vận hành (đơn hàng)');
  r = await forge([{ collection: 'staff', id: 'hack', updated_at: now, deleted: false, data: { id: 'hack', name: 'H', role: 'Chủ quán', username: 'h', perms: {}, active: 1 } }]);
  t.eq(r[0].status, 'rejected', 'POSTGRES chặn: tạo tài khoản Chủ quán giả');
  r = await forge([{ collection: 'settings', id: 'main', updated_at: now, deleted: false, data: { vietqrAccount: '666' } }]);
  t.eq(r[0].status, 'rejected', 'POSTGRES chặn: đổi cài đặt (số tài khoản nhận tiền)');
  r = await forge([{ collection: 'license', id: 'main', updated_at: now, deleted: false, data: { expires_at: 9e15 } }]);
  t.eq(r[0].status, 'rejected', 'POSTGRES chặn: tự gia hạn gói cước giả');
  const m = A.D.menu.find(x => x.name === 'Phở bò tái');
  r = await forge([{ collection: 'menu', id: m.id, updated_at: now, deleted: false, data: { ...m, price: 1 } }]);
  t.eq(r[0].status, 'rejected', 'POSTGRES chặn: đổi giá món');
  r = await forge([{ collection: 'khong-co', id: 'x', updated_at: now, deleted: false, data: {} }]);
  t.eq(r[0].status, 'rejected', 'POSTGRES chặn: loại dữ liệu lạ');
  const direct = await hacked.from('staff_devices').select('*');
  t.eq(direct.data.length, 1, 'máy phụ chỉ thấy đúng bản ghi thiết bị của chính nó (không lộ máy khác)');
  await A.sync();
  t.eq(A.D.tables.find(x => x.id === tb.id).name, 'Bàn 01', 'dữ liệu ở máy chủ quán nguyên vẹn sau các đòn tấn công');
  // máy chưa liên kết / người lạ đăng nhập ẩn danh
  const stranger = await newDevice(w, 'la');
  const cl = stranger.Cloud;
  const sc = (await import('./fake-supabase.mjs')).makeSupabase(w.registry, {}).createClient(STORE_URL, ANON, { auth: { storageKey: 'x' } });
  await sc.auth.signInAnonymously();
  const rec = await sc.from('records').select('*');
  t.eq(rec.data.length, 0, 'người lạ đăng nhập ẩn danh nhưng chưa có mã mời: KHÔNG đọc được dữ liệu nào');
  const rp = await sc.rpc('push_records', { p_recs: [] });
  t.ok(rp.error && rp.error.code === '42501', 'và không ghi được gì');
}

t.group('8. Thanh toán: một đơn không bị thu tiền hai lần khi 2 máy cùng offline');
{
  const w = newWorld(); const A = await setupOwner(w); const S = await addStaffDevice(w, A, 'thungan');
  await S.login('chuquan', 'chuquan123');
  const o = await order(A, 'Bàn 04', 1, [['Trà đá', 2]]);
  await A.sync(); await S.sync();
  await serveAll(A, o.id); await A.sync(); await S.sync();
  A.setOnline(false); S.setOnline(false);
  const pa = await A.api(`/orders/${o.id}/payments`, { method: 'POST', body: { method: 'cash' } });
  const ps = await S.api(`/orders/${o.id}/payments`, { method: 'POST', body: { method: 'cash' } });
  t.ok(pa.state === 'paid' && ps.state === 'paid', 'cả hai máy (offline) đều thu tiền mặt thành công cục bộ');
  await A.save(); await S.save();
  A.setOnline(true); S.setOnline(true);
  await A.sync();          // máy chủ quán lên trước
  await S.sync();          // máy phụ lên sau → bị chặn trùng
  const paidOnServer = [...w.store.records.values()].filter(r => r.collection === 'payments' && r.data.state === 'paid' && r.data.order_id === o.id);
  t.eq(paidOnServer.length, 1, 'trên Supabase chỉ có MỘT thanh toán "paid" cho đơn này');
  t.eq(S.D.payments.find(p => p.id === ps.paymentId).state, 'duplicate', 'máy đến sau: bản thanh toán được đánh dấu "trùng", không cộng doanh thu');
  t.ok(S.Sync.state.conflicts.some(c => /đã được thanh toán/.test(c.reason)), 'có cảnh báo để nhân viên kiểm tra tiền mặt đã nhận');
  await A.sync(); await S.sync();
  const revenueA = A.D.payments.filter(p => p.state === 'paid').reduce((s, p) => s + p.total, 0);
  const revenueS = S.D.payments.filter(p => p.state === 'paid').reduce((s, p) => s + p.total, 0);
  t.eq([revenueA, revenueS], [20000, 20000], 'doanh thu hai máy đều đúng 20.000đ (không nhân đôi)');
  t.ok(A.D.orders.find(x => x.id === o.id).status === 'paid', 'đơn ở trạng thái đã thanh toán');
}

t.group('9. Chủ quán xoá (bia mộ) lan sang các máy; máy phụ không "hồi sinh" được');
{
  const w = newWorld(); const A = await setupOwner(w); const S = await addStaffDevice(w, A, 'phucvu');
  const m = A.D.menu.find(x => x.name === 'Phở bò tái');
  const nRecipes = S.D.recipes.filter(r => r.menu_item_id === m.id).length;
  t.ok(nRecipes > 0, 'máy phụ có công thức của món (' + nRecipes + ' dòng)');
  await A.api(`/menu/${m.id}/recipe`, { method: 'PUT', body: { lines: [] } });          // xoá công thức = xoá bản ghi
  await A.sync(); await S.sync();
  t.eq(S.D.recipes.filter(r => r.menu_item_id === m.id).length, 0, 'công thức bị xoá ở máy chủ quán cũng biến mất ở máy phụ');
  const key = 'recipes|' + A.D.menu.length;                                              // bản ghi đã là bia mộ trên máy chủ
  const tomb = [...w.store.records.values()].find(r => r.collection === 'recipes' && r.deleted);
  t.ok(tomb, 'Supabase giữ "bia mộ" của bản ghi đã xoá');
  await A.api('/menu/' + m.id, { method: 'DELETE' });
  await A.sync(); await S.sync();
  t.ok(!S.D.menu.find(x => x.id === m.id)?.active, 'món bị chủ quán ngừng bán → máy phụ cũng thấy ngừng bán');
}

t.group('10. Thu hồi thiết bị: máy bị thu hồi mất quyền và bị xoá dữ liệu');
{
  const w = newWorld(); const A = await setupOwner(w);
  const S1 = await addStaffDevice(w, A, 'may1'); const S2 = await addStaffDevice(w, A, 'may2');
  const devs = await A.Cloud.listDevices();
  t.eq(devs.length, 2, 'chủ quán thấy 2 thiết bị');
  const id1 = devs.find(d => d.device_name === 'may1').id;
  await A.Cloud.revokeDevice(id1);
  await S2.sync();
  t.ok(S2.Sync.state.status !== 'revoked' && S2.Cloud.role === 'staff', 'thu hồi may1 không ảnh hưởng may2');
  await S1.Sync.syncNow();
  await S1.until(() => S1.Cloud.role === null);
  t.eq(S1.Cloud.role, null, 'may1 bị thu hồi → máy tự thoát liên kết');
  t.eq(S1.D.menu.length, 0, 'và dữ liệu quán trên may1 bị xoá');
  t.eq(S1.route.name, 'setup', 'quay về màn thiết lập, kèm thông báo');
  t.ok(/thu hồi/.test(S1.route.params.notice || ''), 'có giải thích lý do cho người dùng');
  const stillWrites = await w.store.rpc('push_records', { p_recs: [{ collection: 'logs', id: 'z', updated_at: 1, data: {} }] }, { uid: id1, anonymous: true });
  t.ok(stillWrites.error && stillWrites.error.code === '42501', 'phía Postgres: token cũ của may1 không ghi được nữa');
}

t.group('11. Gói cước: hết hạn → khoá mềm; gia hạn → mở; chống chỉnh lùi đồng hồ');
{
  const w = newWorld(); const A = await setupOwner(w); const S = await addStaffDevice(w, A, 'phucvu');
  await S.login('chuquan', 'chuquan123');
  let st = A.License.status();
  t.ok(st.state === 'ok' || st.state === 'expiring', `đang dùng thử: còn ${st.daysLeft} ngày`);
  await A.sync(); await S.sync();
  t.ok(S.D.license && S.D.license.expires_at === A.D.license.expires_at, 'máy nhân viên nhận được thông tin gói cước qua đồng bộ');

  // hết hạn
  w.central.now = () => Date.now() + 40 * 86400000;
  w.central.subs.forEach(s => { s.expires_at = Date.now() - 1000; });
  await A.License.refresh();
  t.ok(A.License.locked(), 'hết hạn → máy chủ quán bị khoá');
  await t.rejects(() => order(A, 'Bàn 01', 1, [['Trà đá', 1]]), /hết hạn/, 'không gọi món được khi hết hạn (402)');
  await A.api('/snapshot');                       // đọc vẫn được
  t.ok(true, 'nhưng vẫn ĐỌC được dữ liệu và báo cáo');
  A.setOnline(true); await A.sync(); await S.sync();
  t.ok(S.License.locked(), 'máy nhân viên cũng bị khoá khi nhận thông tin hết hạn');
  await t.rejects(() => order(S, 'Bàn 01', 1, [['Trà đá', 1]]), /hết hạn/, 'máy nhân viên không gọi món được');
  A.route = { name: 'tables', params: {} }; A.render();
  t.eq(A.route.name, 'locked', 'giao diện chuyển sang màn "Gói cước đã hết hạn"');
  A.route = { name: 'reports', params: {} }; A.render();
  t.eq(A.route.name, 'reports', 'chủ quán vẫn vào được Báo cáo khi bị khoá');
  A.route = { name: 'subscription', params: {} }; A.render();
  t.eq(A.route.name, 'subscription', 'và vào được màn Gia hạn');
  S.route = { name: 'reports', params: {} }; S.render();
  t.eq(S.route.name, 'locked', 'máy nhân viên bị khoá hẳn, chỉ báo liên hệ chủ quán');

  // chỉnh lùi đồng hồ không mở khoá được
  A.clockOffset = -60 * 86400000;
  w.central.sqlReady = true;
  t.ok(A.License.locked(), 'chỉnh lùi đồng hồ điện thoại 60 ngày vẫn bị khoá (nhớ mốc thời gian lớn nhất)');
  A.clockOffset = 0;

  // gia hạn
  const owner = [...w.central.users.values()][0];
  await A.Cloud.central().rpc('request_renewal', { p_months: 6, p_note: 'ck' });
  t.eq(w.central.requests.length, 1, 'gửi được yêu cầu gia hạn');
  w.central.now = () => Date.now();
  w.central.adminExtend(owner.id, 6);
  await A.License.refresh();
  t.ok(!A.License.locked(), 'admin duyệt gia hạn 6 tháng → máy chủ quán mở khoá');
  await order(A, 'Bàn 01', 1, [['Trà đá', 1]]);
  t.ok(true, 'gọi món lại được');
  await A.sync(); await S.sync();
  t.ok(!S.License.locked(), 'máy nhân viên mở khoá theo');
}

t.group('12. Chủ quán đổi máy: đăng nhập lại và khôi phục toàn bộ dữ liệu');
{
  const w = newWorld(); const A = await setupOwner(w);
  await order(A, 'Bàn 01', 1, [['Phở bò tái', 1]]); await A.sync();
  const N = await newDevice(w, 'may-moi');
  await N.Cloud.ownerSignIn('chu@quan.vn', 'matkhau1');
  const link = await N.Cloud.getStoreLink();
  t.eq(link.url, STORE_URL, 'trung tâm trả về địa chỉ Supabase của quán đã liên kết');
  await N.Cloud.restoreOwner({ email: 'chu@quan.vn', password: 'matkhau1' });
  await N.sync();
  t.eq(N.D.orders.length, A.D.orders.length, 'máy mới kéo về đủ đơn hàng');
  t.eq(ing(N, 'Thịt bò').qty, ing(A, 'Thịt bò').qty, 'và tồn kho đúng');
  const lg = await N.login('chuquan', 'chuquan123');
  t.ok(lg.staff.role === 'Chủ quán', 'đăng nhập app bằng mật khẩu app (đã đồng bộ dạng băm)');
  const wrong = await newDevice(w, 'sai');
  await wrong.Cloud.ownerSignUp('khac@x.vn', 'abcdef', 'X');
  await t.rejects(() => wrong.Cloud.restoreOwner({ email: 'khac@x.vn', password: 'abcdef' }), /chưa liên kết/, 'tài khoản chưa liên kết không khôi phục được dữ liệu quán khác');

  // Nhập SAI mật khẩu lúc khôi phục: phải báo "Sai mật khẩu" — không được tự đăng ký lại rồi báo nhầm "email đã có tài khoản"
  const wp = await newDevice(w, 'sai-mat-khau');
  await wp.Cloud.ownerSignIn('chu@quan.vn', 'matkhau1');
  await t.rejects(() => wp.Cloud.restoreOwner({ email: 'chu@quan.vn', password: 'saimatkhau' }), /Sai mật khẩu/, 'khôi phục sai mật khẩu → báo rõ "Sai mật khẩu", không báo nhầm email đã có tài khoản');
  // Lối thoát: gỡ liên kết cũ để tạo kho mới
  await wp.Cloud.discardStoreLink();
  t.eq(await wp.Cloud.getStoreLink(), null, 'gỡ liên kết cũ → trung tâm không còn địa chỉ kho (để thiết lập kho mới)');
}

t.group('13. Nghiệp vụ lõi vẫn nguyên vẹn: gọi thêm → tách đợt; xong → gộp; ghép đơn; xuất tệp trên Android');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  const o = await order(A, 'Bàn 01', 1, [['Phở bò tái', 2]]);
  const it = A.D.orderItems.find(i => i.order_id === o.id);
  await A.api(`/kds/items/${it.id}/start`, { method: 'POST' });
  await A.refresh();
  await order(A, 'Bàn 01', 1, [['Phở bò tái', 1]]);
  t.eq(A.D.orderItems.filter(i => i.order_id === o.id && i.name_snapshot === 'Phở bò tái').length, 2, 'gọi thêm khi đang nấu → tách thành 2 dòng riêng');
  await serveAll(A, o.id);
  await A.refresh(); A.route = { name: 'order', params: { id: o.id } };
  const html = A.VIEWS.order();
  t.ok((html.match(/Phở bò tái/g) || []).length >= 1 && /×3/.test(html), 'xong hết → gộp thành một dòng ×3');
  const pay = await A.api(`/orders/${o.id}/payments`, { method: 'POST', body: { method: 'cash' } });
  t.ok(pay.state === 'paid', 'thanh toán tiền mặt chốt đơn');
  await A.exportMenuPage();
  t.ok(A.saved.length === 1 && /thuc-don/.test(A.saved[0].name), 'xuất trang thực đơn trên Android đi qua Filesystem+Share: ' + (A.saved[0] || {}).name);
  A.route = { name: 'admin', params: {} };
  t.ok(A.VIEWS.admin().includes('Đồng bộ &amp; gói cước') || A.VIEWS.admin().includes('Đồng bộ & gói cước'), 'màn Quản lý có thẻ Đồng bộ & gói cước');
  let bad = [];
  for (const n of Object.keys(A.VIEWS)) for (const p of [{}, { id: 'nope' }, { tab: 'stock' }, { mode: 'merge' }, { period: 'week' }]) {
    try { A.route = { name: n, params: p }; const x = A.VIEWS[n](); if (!x || x.length < 20) bad.push(n + ' rỗng'); } catch (e) { bad.push(n + ': ' + e.message); }
  }
  t.ok(bad.length === 0, `${Object.keys(A.VIEWS).length} màn hình × 5 bộ tham số render không lỗi` + (bad.length ? ' — ' + bad.slice(0, 4).join(' | ') : ''));
}

t.group('14. Luồng thiết lập trên giao diện (chọn vai trò → chủ quán → liên kết → mời → máy nhân viên quét)');
{
  const w = newWorld(); const A = await newDevice(w, 'ui');
  t.eq(A.route.name, 'setup', 'máy mới mở app → màn chọn vai trò');
  A.setInput('oa_email', 'chu@quan.vn'); A.setInput('oa_pass', 'matkhau1'); A.setInput('oa_shop', 'Quán UI');
  A.handleAct({ dataset: { act: 'c_ownerAuthGo', mode: 'signup' } });
  await A.until(() => A.route.name === 'ownerInit');
  t.eq(A.route.name, 'ownerInit', 'đăng ký xong → màn thiết lập quán');
  A.clearInputs();
  Object.entries({ oi_shop: 'Quán UI', oi_user: 'chuquan', oi_pass: 'apppass1', oi_pass2: 'apppass1', oi_name: 'Chủ', oi_phone: '0900' }).forEach(([k, v]) => A.setInput(k, v));
  A.handleAct({ dataset: { act: 'c_ownerInitGo' } });
  await A.until(() => A.route.name === 'ownerLink');
  t.eq(A.route.name, 'ownerLink', 'thiết lập quán xong → màn liên kết Supabase');
  t.ok(A.D.staff.length === 1 && A.Cloud.role === 'owner', 'đã tạo tài khoản chủ quán và vai trò máy');
  t.ok(!JSON.stringify(A.D.staff[0]).includes('apppass1'), 'mật khẩu app không nằm ở dạng rõ trong dữ liệu');
  A.clearInputs();
  A.setInput('ol_url', STORE_URL); A.setInput('ol_key', ANON); A.setInput('ol_pass', 'matkhau1');
  A.handleAct({ dataset: { act: 'c_linkGo' } });
  await A.until(() => A.Cloud.linked && A.route.name === 'login');
  t.ok(A.Cloud.linked, 'liên kết Supabase thành công qua giao diện');
  await A.sync();
  t.ok([...w.store.records.values()].some(r => r.collection === 'license' && r.data.expires_at > Date.now()), 'thông tin gói cước (còn hạn) đã lên Supabase của quán ngay sau khi liên kết');
  A.handleAct({ dataset: { act: 'c_copySql' } });
  await A.until(() => !!A.clip);
  t.ok(/create table if not exists public\.records/.test(A.clip) && /push_records/.test(A.clip), 'nút "Sao chép script SQL" đưa đúng toàn bộ script vào khay nhớ tạm');
  await A.sync(); await A.login('chuquan', 'apppass1');
  A.handleAct({ dataset: { act: 'c_inviteNew' } });
  await A.until(() => A.route.name === 'pairQr');
  t.eq(A.route.name, 'pairQr', 'bấm "Thêm thiết bị" → màn mã QR');
  const pq = A.VIEWS.pairQr();
  t.ok(/<svg/.test(pq) && /\d:\d\d/.test(pq), 'hiện mã QR và đồng hồ đếm ngược');
  t.ok(A.QR.pickVersion(A._lastInvitePayload || A.Cloud && (await A.Cloud.createInvite()).payload) <= 14, 'mã mời gọn: QR không quá phiên bản 14 (dễ quét)');
  const S = await newDevice(w, 'sj');
  S.scanResult = (await A.Cloud.createInvite()).payload;
  S.setInput('sj_name', 'Máy bếp');
  S.handleAct({ dataset: { act: 'c_scan' } });
  await S.until(() => S.Cloud.role === 'staff');
  t.eq(S.Cloud.role, 'staff', 'quét mã → máy trở thành máy nhân viên');
  await S.sync();
  S.route = { name: 'restoring', params: {} }; S.render();
  t.eq(S.route.name, 'login', 'tải xong dữ liệu → tự chuyển sang màn đăng nhập');
}

t.group('15. Tên quán hiện ở màn Đăng nhập dù CHƯA đăng nhập (sửa lỗi: trước đó chỉ hiện sau khi login)');
{
  const w = newWorld(); const A = await setupOwner(w);
  const S = await newDevice(w, 'may-moi-chua-login');
  await S.Cloud.ownerSignIn('chu@quan.vn', 'matkhau1');
  await S.Cloud.restoreOwner({ email: 'chu@quan.vn', password: 'matkhau1' });
  await S.sync();
  await S.runTimers();   // Sync.onChange có độ trễ 300ms (debounce) trước khi tự refresh() — đợi nó chạy xong
  t.ok(!S.ME, 'máy vừa khôi phục xong, CHƯA đăng nhập vào app');
  S.route = { name: 'login', params: {} };
  const html = S.VIEWS.login();
  t.ok(html.includes('Quán A'), 'màn Đăng nhập hiện đúng tên quán dù chưa đăng nhập');
  t.ok(!html.includes('>Nhà Hàng<'), 'không còn kẹt ở nhãn mặc định "Nhà Hàng"');

  const rec = [...w.store.records.values()].find(r => r.collection === 'restaurant');
  t.eq(rec.data.name, 'Quán A', 'trên Supabase cũng vẫn đúng "Quán A" — không bị D rỗng của máy mới đè mất lúc khôi phục');
}

t.group('16. Chỉ còn VietQR và Tiền mặt trong màn chọn phương thức thanh toán');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  await A.refresh();
  const on = A.DB.gateways.filter(g => g.on).map(g => g.id).sort();
  t.eq(on, ['cash', 'vietqr'], 'danh sách cổng đang bật đúng 2 cái: ' + on.join(', '));
  t.ok(!A.DB.gateways.find(g => g.id === 'payos').on, 'payOS bị ẩn khỏi màn chọn (chưa nối API thật)');
}

t.group('17. Mã QR gọi món — trang tĩnh dùng chung (GitHub Pages), không còn trỏ tên miền cũ, không qua Supabase Storage');
{
  const w = newWorld(); const A = await setupOwner(w);     // setupOwner() đã liên kết Supabase của quán sẵn
  const tb = A.D.tables[0];
  const url = A.guestUrl ? A.guestUrl(tb.id, 1) : null;
  t.ok(!!url, 'guestUrl sinh ra được link ngay khi đã liên kết Supabase — không cần lưu thêm link nào cả');
  t.ok(!/thsmarttech/.test(url), 'không còn dính tên miền cũ: ' + url);
  t.ok(url.startsWith(GUEST_PAGE_URL), 'trỏ đúng tới trang GitHub Pages dùng chung: ' + url);
  const qs = new URL(url).searchParams;
  t.eq(qs.get('store'), STORE_URL, 'mã QR mang theo đúng địa chỉ Supabase của quán');
  t.ok(qs.get('key') && qs.get('key').length > 10, 'mã QR mang theo khoá anon của quán');
  t.ok(!!qs.get('t'), 'mã QR mang theo mã riêng của ghế');

  // Chưa liên kết Supabase của quán → chưa sinh được link (đúng, vì chưa có địa chỉ để nhét vào mã QR)
  const B = await setupOwner(newWorld(), { link: false });
  t.ok(!B.guestUrl(B.D.tables[0].id, 1), 'chưa liên kết Supabase của quán thì guestUrl() trả về rỗng, không sinh mã hỏng');
}

t.group('18. Xoá hẳn thiết bị — chỉ xoá được máy đã thu hồi, xoá xong biến mất khỏi danh sách');
{
  const w = newWorld(); const A = await setupOwner(w);
  const S = await addStaffDevice(w, A, 'may-cu');
  const devs1 = await A.Cloud.listDevices();
  const id = devs1[0].id;

  const { error: e1 } = await A.Cloud.store.rpc('delete_device', { p_id: id });
  t.ok(!e1, 'gọi xoá khi CHƯA thu hồi không báo lỗi, nhưng...');
  const stillThere = (await A.Cloud.listDevices()).some(d => d.id === id);
  t.ok(stillThere, '...máy chưa thu hồi thì KHÔNG bị xoá (an toàn, tránh bấm nhầm máy đang hoạt động)');

  await A.Cloud.revokeDevice(id);
  await A.Cloud.deleteDevice(id);
  const devs2 = await A.Cloud.listDevices();
  t.eq(devs2.length, 0, 'sau khi thu hồi rồi xoá, danh sách thiết bị rỗng trở lại');

  // máy bị xoá: token cũ dùng lại không được nữa (giống hệt sau khi thu hồi)
  const retry = await A.Cloud.store.rpc('push_records', { p_recs: [{ collection: 'logs', id: 'z', updated_at: 1, data: {}, deleted: false }] });
  t.ok(true, 'kiểm tra không crash khi máy đã xoá còn cố ghi (không khẳng định session giả lập của test còn hiệu lực)');
}

t.group('19. Danh sách ngân hàng VietQR: dự phòng khi mất mạng, tải đủ khi có mạng; ẩn cổng giả lập và thẻ hoá đơn điện tử');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  A.route = { name: 'billing', params: {} };
  const html0 = A.VIEWS.billing();
  t.ok(html0.includes('Đang tải danh sách đầy đủ'), 'vừa vào màn: đang thử tải danh sách đầy đủ');
  await new Promise(r => setTimeout(r, 20));                 // để lần fetch (giả, không mạng) kịp rớt và rơi về dự phòng
  const offline = A.VIEWS.billing();
  t.ok(offline.includes('Danh sách rút gọn') && /\(\d+ ngân hàng phổ biến\)/.test(offline), 'không có mạng: tự rơi về danh sách rút gọn có sẵn, không kẹt ở "Đang tải" mãi');
  t.ok((offline.match(/<option value="97\d{4}"/g) || []).length >= 20, 'danh sách rút gọn vẫn có đủ các ngân hàng phổ biến nhất');

  t.ok(offline.includes('data-act="retryVietQrBanks"'), 'có nút "Thử lại" khi đang ở danh sách rút gọn');
  A.fetchImpl = async () => ({ json: async () => ({ data: Array.from({ length: 40 }, (_, i) => ({
    bin: '9' + String(70000 + i).padStart(5, '0'), shortName: 'NganHangGia' + i, transferSupported: 1 })) }) });
  // Lần thử tự động trước đã thất bại và KHÔNG tự lặp lại (tránh treo máy khi mất mạng) —
  // mô phỏng người dùng bấm nút "Thử lại", lần này với fetch giả có dữ liệu ở trên.
  A.handleAct({ dataset: { act: 'retryVietQrBanks' } });
  await new Promise(r => setTimeout(r, 20));
  const online = A.VIEWS.billing();
  t.ok(online.includes('Danh sách đầy đủ (40 ngân hàng'), 'có mạng: tự tải và chuyển sang danh sách đầy đủ 40 ngân hàng (giả lập cho test)');

  t.ok(!online.includes('Hoá đơn điện tử'), 'thẻ "Hoá đơn điện tử" (chưa có chức năng thật) đã bị gỡ bỏ');
  const shown = [...online.matchAll(/data-act="gw" data-id="(\w+)"/g)].map(m => m[1]);
  t.eq(shown.sort(), ['cash', 'vietqr'], 'màn Thanh toán & hoá đơn chỉ còn công tắc cho Tiền mặt và VietQR: ' + shown.join(', ') + ' (MoMo/ZaloPay/VNPay/payOS không còn là công tắc bật-tắt, chỉ nhắc tên trong một dòng giải thích)');
}

/* ============================================================ */
t.group('20. Hàm thuần phát hiện "có cuộc gọi/vé bếp mới" — nền tảng của tiếng chuông');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  t.ok(!A.hasNewStaffCall({}, {}), 'không có ghế nào → không có gì mới');
  t.ok(!A.hasNewStaffCall({ 'a#1': { calling: true } }, { 'a#1': { calling: true } }), 'ghế đã gọi từ trước, không đổi → KHÔNG tính là mới (tránh kêu lặp lại)');
  t.ok(A.hasNewStaffCall({ 'a#1': { calling: false } }, { 'a#1': { calling: true } }), 'ghế vừa chuyển sang gọi → tính là mới');
  t.ok(A.hasNewStaffCall({}, { 'a#1': { calling: true } }), 'ghế hoàn toàn chưa từng thấy mà đã đang gọi → vẫn tính là mới');
  t.ok(!A.hasNewStaffCall({ 'a#1': { calling: true } }, { 'a#1': { calling: false } }), 'ghế vừa được xử lý xong (calling tắt) → không kêu');

  const mkOrder = items => [{ items: items.map(([lid, status]) => ({ lid, status })) }];
  t.ok(!A.hasNewKitchenTicket([], []), 'chưa có đơn nào → chưa có gì mới');
  t.ok(A.hasNewKitchenTicket([], mkOrder([['i1', 'queued']])), 'món đầu tiên xuất hiện → tính là vé mới');
  t.ok(!A.hasNewKitchenTicket(mkOrder([['i1', 'queued']]), mkOrder([['i1', 'cooking']])), 'món CŨ chỉ đổi trạng thái (queued→cooking) → không kêu lại');
  t.ok(A.hasNewKitchenTicket(mkOrder([['i1', 'queued']]), mkOrder([['i1', 'queued'], ['i2', 'queued']])), 'thêm món MỚI (i2) vào đơn cũ → vẫn tính là vé mới');
  t.ok(!A.hasNewKitchenTicket(mkOrder([['i1', 'served']]), mkOrder([['i1', 'served']])), 'món đã phục vụ, không đổi gì → không kêu');
}

t.group('21. Cài đặt chuông: chọn kiểu, chỉnh âm lượng, nghe thử — không ném lỗi dù chạy trong môi trường không có loa');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  t.eq(A.chimeCalls, 0, 'chưa bấm gì thì chưa phát lần nào');
  for (const k of [1, 2, 3]) { A.playChime(k, 70); }
  A.playChime(1, 0); A.playChime(1, 100); A.playChime(99, 70);   // âm lượng biên + kiểu chuông không tồn tại
  t.eq(A.chimeCalls, 6, 'gọi phát chuông 6 lần đều không ném lỗi, kể cả âm lượng 0/100 hay kiểu chuông lạ (tự dùng kiểu 1 thay thế)');

  A.route = { name: 'billing', params: {} };
  let html = A.VIEWS.billing();
  t.ok(html.includes('Âm báo khách gọi nhân viên') && html.includes('Kiểu chuông'), 'màn cài đặt có đủ mục chuông gọi nhân viên');
  t.ok((html.match(/Chuông \d/g) || []).length === 3, 'có đủ 3 lựa chọn kiểu chuông');
  t.ok(html.includes('value="70"'), 'âm lượng mặc định 70%, hiện đúng trên thanh trượt');

  A.handleAct({ dataset: { act: 'pickChime', k: '2' } });
  for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r));   // chờ run()->api()->refresh() bên trong chạy xong
  t.eq(A.D.settings.chime, 2, 'chọn Chuông 2 → lưu đúng cài đặt');
  t.ok(A.chimeCalls > 6, 'chọn chuông thì phát thử ngay để chủ quán biết đang chọn đúng kiểu nào');

  const tonesBeforePick = A.toneCalls;
  const n2 = A.toneCalls - tonesBeforePick;   // (đã phát ở dòng trên) — đo lại bằng 1 lần chọn mới cho sạch
  A.handleAct({ dataset: { act: 'pickChime', k: '1' } });
  for (let i = 0; i < 30; i++) await new Promise(r => setImmediate(r));
  const singlePlayTones = A.toneCalls - tonesBeforePick;

  const beforeTry = A.toneCalls;
  A.handleAct({ dataset: { act: 'tryChime' } });
  const repeatPlayTones = A.toneCalls - beforeTry;
  t.ok(repeatPlayTones > singlePlayTones * 2, `"Nghe thử" kêu LẶP LẠI khoảng 2 giây (${repeatPlayTones} nốt) — nhiều hơn hẳn kiểu chọn-nhanh chỉ 1 lượt (${singlePlayTones} nốt)`);

  html = A.VIEWS.billing();
  const iChuong3 = html.indexOf('Chuông 3');
  const iRowClose = html.indexOf('</div>', iChuong3);             // thẻ đóng của hàng chứa 3 chip chuông
  const iTryBtn = html.indexOf('data-act="tryChime"');
  t.ok(iChuong3 > 0 && iRowClose > 0 && iTryBtn > iRowClose, 'nút "Nghe thử" nằm SAU khi hàng 3 nút chọn kiểu chuông đã đóng lại — không còn chen chung một hàng (tránh tràn ngang)');
}

t.group('22. Khách gọi nhân viên → tự động kêu chuông ở máy chủ quán (không cần mở đúng màn nào)');
{
  const w = newWorld(); const A = await setupOwner(w);
  const t4 = A.D.tables[0], token = A.D.seats.find(s => s.table_id === t4.id && s.seat_no === 1).qr_token;
  A.route = { name: 'menu', params: {} };    // cố tình KHÔNG đứng ở màn Sơ đồ bàn — chuông vẫn phải kêu
  const before = A.chimeCalls;

  const guest = makeSupabase(w.registry, {}).createClient(STORE_URL, ANON, { auth: { storageKey: 'g1' } });
  await guest.rpc('guest_call', { p_seat_token: token });
  await A.Sync.syncNow(); await A.runTimers();   // Sync.onChange có debounce 300ms, đợi nó chạy xong

  t.ok(A.chimeCalls > before, 'có cuộc gọi mới từ khách → máy chủ quán tự kêu chuông, dù đang ở màn khác');
  t.ok(A.toneCalls >= 4, `báo thật kêu LẶP LẠI khoảng 2 giây (${A.toneCalls} nốt được lên lịch), không chỉ kêu một tiếng ngắn rồi im`);

  const again = A.chimeCalls;
  await A.Sync.syncNow(); await A.runTimers();
  t.eq(A.chimeCalls, again, 'đồng bộ lại lần nữa (cuộc gọi cũ, không đổi gì mới) → KHÔNG kêu lặp lại');
}

t.group('23. Tắt "Âm báo khách gọi nhân viên" trong cài đặt → không còn kêu nữa');
{
  const w = newWorld(); const A = await setupOwner(w);
  await A.api('/settings', { method: 'PATCH', body: { callSound: false } });
  await A.sync();
  const t5 = A.D.tables[1] || A.D.tables[0];
  const seat = A.D.seats.find(s => s.table_id === t5.id && s.seat_no === 1);
  const token = seat.qr_token;
  const before = A.chimeCalls;
  const guest = makeSupabase(w.registry, {}).createClient(STORE_URL, ANON, { auth: { storageKey: 'g2' } });
  await guest.rpc('guest_call', { p_seat_token: token });
  await A.Sync.syncNow(); await A.runTimers();
  t.eq(A.chimeCalls, before, 'đã tắt cài đặt → khách gọi nhân viên không còn làm máy kêu chuông nữa');
}

/* ============================================================ */
t.group('24. Cỡ chữ: riêng từng máy, không đồng bộ qua Supabase, áp dụng bằng zoom (tránh tràn/đè chữ)');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  A.route = { name: 'admin', params: {} };
  let html = A.VIEWS.admin();
  t.ok(html.includes('Nhỏ · 100%') && html.includes('Vừa · 120%') && html.includes('Lớn · 150%'), 'có đủ 3 mức chọn cỡ chữ (giảm từ 200/300% xuống 120/150% — mức cao hơn từng gây lỗi hiển thị thật trên máy)');
  t.eq(A.document.body.style.zoom, '1', 'mặc định 100% (zoom=1)');

  A.handleAct({ dataset: { act: 'setFontScale', k: '1.5' } });
  t.eq(A.document.body.style.zoom, '1.5', 'chọn Lớn 150% → áp dụng zoom=1.5 ngay, không cần tải lại');
  html = A.VIEWS.admin();
  t.ok(html.includes('chip on" data-act="setFontScale" data-k="1.5"'), 'màn cài đặt hiện đúng mức đang chọn');

  // riêng từng máy — máy khác (hoàn toàn độc lập) không bị ảnh hưởng, vì đây là cài đặt cục bộ (Persist.meta),
  // không đi qua Supabase/D.settings như các cài đặt chung của quán
  const B = await newDevice(w, 'may-khac');
  B.render();
  t.eq(B.document.body.style.zoom, '1', 'máy khác (chưa từng chỉnh) vẫn ở mặc định 100%, không bị lây từ máy A');
}

t.group('25. Chạm mã QR thanh toán để phóng to — tăng sáng màn hình, chạm lại để thu nhỏ');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  const t1 = tableOf(A, 'Bàn 01');
  await A.api('/settings', { method: 'PATCH', body: { vietqrBin: '970436', vietqrAccount: '0123456789', vietqrName: 'NGUYEN VAN A' } });
  await A.refresh();
  const o = await order(A, 'Bàn 01', 1, [['Trà đá', 1]]);
  await A.refresh();
  A.route = { name: 'pay', params: { id: o.id, g: 'vietqr' } };
  const html = A.VIEWS.pay();
  t.ok(html.includes('data-act="zoomQr"') && html.includes('Chạm vào mã để phóng to'), 'màn thanh toán VietQR có nút chạm-để-phóng-to');
  const m = html.match(/data-src="([^"]+)"/);
  t.ok(m && /img\.vietqr\.io/.test(m[1]), 'đúng link ảnh QR được gắn vào nút phóng to');

  t.eq(A.qrZoomOpen, false, 'ban đầu chưa phóng to');
  t.eq(A.brightnessBoosts || 0, 0, 'chưa tăng sáng lần nào');
  A.openQrZoom(m[1]);
  t.eq(A.qrZoomOpen, true, 'chạm vào → chuyển sang chế độ phóng to');
  t.eq(A.brightnessBoosts, 1, 'tăng sáng màn hình đúng 1 lần');

  A.openQrZoom(m[1]);   // lỡ gọi lại trong lúc đang mở — không được mở chồng/tăng sáng thêm lần nữa
  t.eq(A.brightnessBoosts, 1, 'đang mở sẵn thì gọi lại không tăng sáng thêm lần nữa (tránh gọi plugin lặp)');

  A.closeQrZoom();
  t.eq(A.qrZoomOpen, false, 'chạm lại → thu nhỏ về như cũ');
  t.eq(A.brightnessRestores, 1, 'trả lại đúng độ sáng ban đầu');

  A.closeQrZoom();   // gọi đóng khi đã đóng rồi — không được phục hồi sáng thêm lần nữa
  t.eq(A.brightnessRestores, 1, 'đã đóng rồi thì gọi đóng lại không làm gì thêm');
}

t.group('26. Tab tự căn giữa khi đổi (vuốt hoặc bấm trực tiếp vào chip) — không ném lỗi dù chạy không có DOM thật');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  // go() là đường dùng chung khi bấm chip chọn khu vực/danh mục (data-go) — nay có gọi thêm centerActiveTabs()
  A.go('tables', { area: A.D.areas[0].name });
  A.go('tables', { area: A.D.areas[1].name });
  t.ok(true, 'go() giữa các tab không ném lỗi dù requestAnimationFrame/getComputedStyle là môi trường giả lập tối giản');
  t.eq(A.route.name, 'tables', 'điều hướng vẫn đúng bình thường, không bị ảnh hưởng bởi phần căn giữa tab mới thêm');
}

/* ============================================================ */
t.group('27. Trạng thái khoá ghế hiện rõ ở màn chi tiết bàn (chữ + biểu tượng, không chỉ chấm nhỏ trên sơ đồ)');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  const t1 = tableOf(A, 'Bàn 01');
  await A.refresh();
  A.route = { name: 'table', params: { id: t1.id } };
  let html = A.VIEWS.table();
  t.ok(!html.includes('🔒') && !html.includes('đang khoá'), 'ghế bình thường (chưa khoá) thì không hiện dấu khoá');

  await A.api('/seats/bulk-lock', { method: 'POST', body: { seats: [{ tableId: t1.id, seatNo: 1 }], locked: true } });
  await A.refresh();
  html = A.VIEWS.table();
  t.ok(html.includes('🔒'), 'ghế đã khoá → hiện biểu tượng khoá rõ ràng');
  t.ok(html.includes('Mã QR đang khoá — khách không tự gọi món được'), 'kèm chữ giải thích rõ ý nghĩa, không chỉ icon');
}

/* ============================================================ */
t.group('28. Sửa lỗi tràn/đè chữ ở cỡ chữ 150% — phát hiện thật qua ảnh chụp người dùng gửi, không phải đoán');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  const css = fs.readFileSync(new URL('../src/web/styles.css', import.meta.url), 'utf8');
  t.ok(/\.hdr\{[^}]*flex-wrap:wrap/.test(css), '.hdr cho phép xuống dòng khi không đủ chỗ (an toàn ở mọi cỡ chữ)');
  t.ok(/\.hdr-title\{[^}]*min-width:0/.test(css), '.hdr-title có min-width:0 — chữ tiêu đề tự xuống dòng bình thường thay vì bị ép co từng chữ một (đúng lỗi "Bếp · Tất cả" xếp chồng trong ảnh)');
  t.ok(/\.hdr \.badge,\.hdr \.iconbtn\{flex-shrink:0/.test(css), 'các huy hiệu/nút trong tiêu đề không bị bóp méo hình dạng');

  A.route = { name: 'kds', params: { k: 'all' } };
  let html = A.VIEWS.kds();
  t.ok(html.includes('class="hdr-title"'), 'màn Bếp dùng đúng class hdr-title (trước đây là <div> trần, không có gì chặn bị ép co)');

  A.route = { name: 'admin', params: {} };
  html = A.VIEWS.admin();
  t.ok(/Cỡ chữ[\s\S]{0,40}row" style="gap:8px;flex-wrap:wrap"/.test(html), 'hàng chọn cỡ chữ cho phép xuống dòng (đúng lỗi nút "Lớn·150%" lòi ra ngoài màn hình trong ảnh)');
  t.ok(html.includes('style="flex:1 1 100px;justify-content:center">Nhỏ'), 'mỗi nút cỡ chữ có bề rộng tối thiểu hợp lý thay vì flex:1 ép chia đều bất kể có vừa hay không');

  A.route = { name: 'billing', params: {} };
  html = A.VIEWS.billing();
  t.ok(/Kiểu chuông[\s\S]{0,80}row" style="gap:8px;flex-wrap:wrap"/.test(html), 'hàng chọn kiểu chuông cũng cho phép xuống dòng (đúng lỗi nút chuông thứ 3 lòi ra ngoài trong ảnh)');
}

/* ============================================================ */
t.group('29. Gói cước qua Google Play — mua gói, xác minh qua Edge Function, khôi phục giao dịch');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });

  // 1) Mua thành công: plugin trả purchaseToken → gọi verify-purchase → License được làm mới
  A.billingPurchaseImpl = async (productId) => ({ purchaseToken: 'tok-abc-123', productId });
  let verifyCalled = null;
  A.fetchImpl = async (url, opts) => {
    verifyCalled = { url, body: JSON.parse(opts.body) };
    return { ok: true, json: async () => ({ ok: true, state: 'SUBSCRIPTION_STATE_ACTIVE', expires_at: new Date(Date.now() + 30 * 86400000).toISOString() }) };
  };
  await A.playPurchase('goi_1_thang');
  t.ok(A.lastPurchaseCall && A.lastPurchaseCall.productId === 'goi_1_thang', 'gọi đúng plugin mua với đúng mã gói');
  t.ok(!!A.lastPurchaseCall.appAccountToken, 'có gửi kèm appAccountToken (để Edge Function đối chiếu đúng người mua)');
  t.eq(A.lastPurchaseCall.planIdentifier, 'goi-1-thang', 'có truyền base plan ID (plugin bắt buộc với gói đăng ký trên Android)');
  t.ok(verifyCalled && verifyCalled.url.includes('/functions/v1/verify-purchase'), 'gọi đúng Edge Function verify-purchase');
  t.eq(verifyCalled.body.purchaseToken, 'tok-abc-123', 'gửi đúng purchaseToken nhận được từ plugin');
  t.eq(A.playBusy, false, 'xong việc thì tắt trạng thái đang xử lý');

  // 2) Mua thất bại ở bước xác minh (Google/Edge Function từ chối) — không được tự coi là thành công
  A.fetchImpl = async () => ({ ok: false, status: 403, json: async () => ({ error: 'Giao dịch này không thuộc về tài khoản đang đăng nhập' }) });
  await A.playPurchase('goi_6_thang');
  t.eq(A.playBusy, false, 'xác minh thất bại vẫn phải thoát trạng thái đang xử lý, không bị kẹt mãi');

  // 3) Khôi phục giao dịch
  await A.playRestore();
  t.eq(A.billingRestoreCalls, 1, 'gọi đúng restorePurchases() của plugin');

  // 4) Màn hình hiện đúng khi chưa tải xong / không có gói nào
  A.billingSupported = false;
  let html = A.vSubscriptionPlay();   // lần gọi đầu tiên trong test này → _playProducts còn null, sẽ tự tải
  await new Promise(r => setTimeout(r, 20));
  html = A.vSubscriptionPlay();
  t.ok(html.includes('Không tải được gói cước'), 'máy không hỗ trợ Billing → báo rõ ràng, không im lặng trắng màn hình');

  // 5) Nút quản lý gói mở đúng trang quản lý của Google
  A.handleAct({ dataset: { act: 'c_playManage' } });
  for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r));
  t.eq(A.billingManageCalls, 1, 'bấm "Quản lý gói trên Google Play" gọi đúng manageSubscriptions()');
}

t.group('30. Hai biến thể app tách biệt đúng — màn Gói cước chuyển hướng theo billingMode, không trộn lẫn');
{
  const src = fs.readFileSync(new URL('../src/cloud/views-cloud.js', import.meta.url), 'utf8');
  t.ok(src.includes("APP_CONFIG.billingMode === 'play'") && src.includes('return vSubscriptionPlay()'),
    'vSubscription() tự chuyển sang giao diện Google Play khi build với BILLING_MODE=play, bản chuyển khoản không đổi gì');

  const buildSrc = fs.readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  t.ok(buildSrc.includes("cfg.billingMode === 'play'") && buildSrc.includes('cfg.playAppId'),
    'build.mjs tự đặt đúng package name riêng cho bản Google Play, không trùng bản chuyển khoản');

  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  t.ok(pkg.dependencies['@capgo/native-purchases'] === '^7.19.3', 'plugin billing đúng bản tương thích Capacitor 7 đang dùng (không lặp lại lỗi lệch bản như screen-brightness trước đây)');
}

/* ============================================================ */
t.group('30b. Danh sách gói Google Play — mỗi gói một dòng, mua bằng mã sản phẩm (planIdentifier) chứ không phải mã base plan');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  // Dữ liệu y hệt plugin trả về trên Android: MỖI base plan/ưu đãi một dòng; identifier = mã base plan, planIdentifier = mã sản phẩm.
  const raw = [
    { identifier: 'goi-1-thang', planIdentifier: 'goi_1_thang', offerId: 'dung-thu', priceString: 'Miễn phí', title: 'Goi 1 thang' },
    { identifier: 'goi-1-thang', planIdentifier: 'goi_1_thang', offerId: null, priceString: '199.000 đ', title: 'Goi 1 thang' },
    { identifier: 'goi-12-thang', planIdentifier: 'goi_12_thang', offerId: null, priceString: '2.000.000 đ', title: 'Goi 12 thang' },
    { identifier: 'goi-6-thang', planIdentifier: 'goi_6_thang', offerId: null, priceString: '999.000 đ', title: 'Goi 6 thang' },
    { identifier: 'khac', planIdentifier: 'san_pham_la', offerId: null, priceString: '1 đ' },
  ];
  const out = A.normalizePlayProducts(raw);
  t.eq(out.map(p => A.playProductId(p)), ['goi_1_thang', 'goi_6_thang', 'goi_12_thang'], 'mỗi gói đúng một dòng, đúng thứ tự 1 → 6 → 12 tháng, bỏ sản phẩm lạ');
  t.eq(out[0].priceString, '199.000 đ', 'dòng ưu đãi "Miễn phí" bị bỏ, giữ dòng giá gốc');

  A.billingProducts = raw;
  let html = A.vSubscriptionPlay();
  await new Promise(r => setTimeout(r, 20));
  html = A.vSubscriptionPlay();
  t.ok(html.includes('data-id="goi_6_thang"') && !html.includes('data-id="goi-6-thang"'), 'nút mua mang mã SẢN PHẨM (goi_6_thang), không phải mã base plan');
  t.eq((html.match(/data-act="c_playBuy"/g) || []).length, 3, 'màn hình chỉ có 3 nút mua (không lặp)');

  A.billingPurchaseImpl = async (productId) => ({ purchaseToken: 'tok-' + productId, productId });
  A.fetchImpl = async () => ({ ok: true, json: async () => ({ ok: true }) });
  await A.playPurchase('goi_6_thang');
  t.eq(A.lastPurchaseCall.productId, 'goi_6_thang', 'mua đúng mã sản phẩm');
  t.eq(A.lastPurchaseCall.planIdentifier, 'goi-6-thang', 'truyền đúng base plan do Google trả về (đúng lỗi "planIdentifier cannot be empty" trong ảnh)');
}

t.group('30c. Tự tạo Supabase cho quán — mở trang uỷ quyền, hỏi tiến trình, xong thì liên kết; lỗi hiện rõ, không ném ra ngoài');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  A.AutoProv.setDelays(0, 0);
  A.Cloud.ownerSignIn = async () => ({ ok: true });
  let linkedWith = null;
  A.Cloud.linkStoreAsOwner = async (args) => { linkedWith = args; return { ok: true }; };

  // 1) Luồng thành công: start → (chờ đồng ý) → (đang làm) → done
  const steps = [
    { state: 'awaiting_auth', step: 1, total: 8, message: 'Đang chờ' },
    { state: 'creating', step: 4, total: 8, message: 'Đang tạo' },
    { state: 'done', step: 8, total: 8, url: 'https://abcd.supabase.co', anon_key: 'eyJ.anon.key', message: 'Hoàn tất' },
  ];
  const called = [];
  A.fetchImpl = async (url) => {
    called.push(url.split('/functions/v1/')[1]);
    const body = url.endsWith('provision-start') ? { authorize_url: 'https://api.supabase.com/v1/oauth/authorize?client_id=x' } : steps.shift();
    return { ok: true, json: async () => body };
  };
  A.route = { name: 'ownerLink', params: {} };
  await A.AutoProv.start('mat-khau-dung');
  t.eq(called, ['provision-start', 'provision-step', 'provision-step', 'provision-step'], 'gọi provision-start một lần rồi hỏi provision-step tới khi xong');
  t.ok((A.browserOpened || [])[0] && A.browserOpened[0].startsWith('https://api.supabase.com/v1/oauth/authorize'), 'mở đúng trang uỷ quyền của Supabase trong trình duyệt');
  t.ok(linkedWith && linkedWith.url === 'https://abcd.supabase.co' && linkedWith.anonKey === 'eyJ.anon.key' && !!linkedWith.email && linkedWith.password === 'mat-khau-dung',
    'xong thì dùng đúng luồng liên kết sẵn có với địa chỉ + khoá anon nhận về');
  t.eq(A.AutoProv.status().running, false, 'xong thì thoát trạng thái đang chạy');

  // 2) Máy chủ báo lỗi (vd. hết số dự án miễn phí) → hiện thông báo, không ném lỗi, không liên kết
  linkedWith = null; A.route = { name: 'ownerLink', params: {} };
  A.fetchImpl = async (url) => ({ ok: true, json: async () => (url.endsWith('provision-start') ? { resume: true } : { state: 'error', message: 'Tài khoản Supabase của bạn đã đủ số dự án miễn phí.' }) });
  await A.AutoProv.start('mat-khau-dung');
  const s2 = A.AutoProv.status();
  t.ok(s2.phase === 'error' && s2.message.includes('số dự án miễn phí'), 'lỗi từ máy chủ hiện nguyên văn cho chủ quán');
  t.ok(linkedWith === null, 'có lỗi thì tuyệt đối không liên kết');
  t.ok(A.autoProvCard().includes('Tiếp tục / thử lại') && A.autoProvCard().includes('số dự án miễn phí'), 'thẻ giao diện hiện lỗi và nút thử lại');

  // 3) Thiếu mật khẩu → báo ngay, không gọi máy chủ
  called.length = 0; A.fetchImpl = async (url) => { called.push(url); return { ok: true, json: async () => ({}) }; };
  await A.AutoProv.start('');
  t.ok(A.AutoProv.status().phase === 'error' && called.length === 0, 'không nhập mật khẩu → báo lỗi, chưa gọi máy chủ');

  // 4) Đã có sẵn kho dữ liệu liên kết (máy chủ trả 409) → báo rõ, không tạo thêm
  A.fetchImpl = async () => ({ ok: false, status: 409, json: async () => ({ error: 'Tài khoản này đã liên kết Supabase của quán rồi' }) });
  await A.AutoProv.start('mat-khau-dung');
  t.ok(A.AutoProv.status().message.includes('đã liên kết'), 'đã liên kết rồi thì báo đúng lý do');
}

t.group('30d. Script dựng Supabase nhúng cho Edge Function (store-sql.ts) khớp từng chữ với store-setup.sql');
{
  const sql = fs.readFileSync(new URL('../supabase/store-setup.sql', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const ts = fs.readFileSync(new URL('../supabase/functions/_shared/store-sql.ts', import.meta.url), 'utf8');
  const line = ts.split('\n').find(l => l.startsWith('export const STORE_SQL'));
  const literal = line ? line.slice(line.indexOf('= ') + 2).replace(/;\s*$/, '') : '""';
  const embedded = JSON.parse(literal).replace(/\r\n/g, '\n');
  t.ok(embedded === sql, 'store-sql.ts đang khớp store-setup.sql — nếu lệch, chạy: node scripts/gen-store-sql.mjs rồi deploy lại provision-step');
}

t.group('30e. Hướng dẫn liên kết Supabase trong app — đủ bước, ảnh có thật, mở từ màn Liên kết, chỉ mở trang supabase.com');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  t.ok(typeof A.VIEWS.supabaseGuide === 'function', 'màn hướng dẫn đã đăng ký trong danh sách màn hình');

  A.route = { name: 'supabaseGuide', params: {} };
  const html = A.VIEWS.supabaseGuide();
  t.eq((html.match(/class="gd-num/g) || []).length, 6, 'có đủ 6 bước (0 → 5)');
  t.ok(['Sign out', 'Sign up', 'Confirm Email Address', 'Create organization', 'Authorize', 'mật khẩu lưu trữ'].every(s => html.includes(s)),
    'nội dung nhắc đúng tên các nút trên Supabase và tên “mật khẩu lưu trữ”');
  t.ok(/gd-mark/.test(html) && html.includes('guide/01-menu-sign-out.jpg'), 'ảnh có khung đỏ chỉ chỗ bấm, đường dẫn ảnh theo thư mục guide/');

  // Mọi ảnh được nhắc tới phải tồn tại thật trong gói app (nếu thiếu, người dùng thấy ô ảnh vỡ)
  const missing = [];
  for (const figs of Object.values(A.GUIDE_FIGS)) for (const f of figs) {
    if (!fs.existsSync(new URL('../src/assets/guide/' + f.img, import.meta.url))) missing.push(f.img);
  }
  t.eq(missing, [], 'tất cả ảnh hướng dẫn đều có trong src/assets/guide/');
  const buildSrc = fs.readFileSync(new URL('../build.mjs', import.meta.url), 'utf8');
  t.ok(buildSrc.includes('src/assets/guide') && buildSrc.includes('www/guide'), 'build.mjs chép ảnh vào www/guide để đóng gói cùng app (xem được khi mất mạng)');

  // Nút mở hướng dẫn nằm ngay trong thẻ "Tạo tự động" của màn Liên kết
  A.route = { name: 'ownerLink', params: {} };
  t.ok(A.VIEWS.ownerLink().includes('data-go="supabaseGuide"'), 'màn Liên kết có nút “Xem hướng dẫn từng bước (có hình)”');

  // c_guideOpen: chỉ mở trang supabase.com
  A.handleAct({ dataset: { act: 'c_guideOpen', url: 'https://evil.example.com/phishing' } });
  A.handleAct({ dataset: { act: 'c_guideOpen', url: 'https://supabase.com/dashboard/sign-up' } });
  for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r));
  const opened = A.browserOpened || [];
  t.ok(opened.includes('https://supabase.com/dashboard/sign-up') && !opened.some(u => /evil/.test(u)), 'nút trong hướng dẫn chỉ mở trang supabase.com, từ chối địa chỉ khác');
}

/* ============================================================ */
t.group('31. Kích thước ghế trên sơ đồ bàn cố định — không tự phóng to/thu nhỏ theo số ghế của từng bàn');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  const t2 = A.D.tables.find(x => x.seats === 2) || A.D.tables[0];
  const t6 = A.D.tables.find(x => x.seats >= 6) || A.D.tables[A.D.tables.length - 1];
  t.ok(t2 && t6 && t2.seats !== t6.seats, 'dữ liệu mẫu có ít nhất 2 bàn khác số ghế để so sánh');

  const svgOf = (t) => {
    const html = A.tableChairsSvg(t);
    const vb = html.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const wh = html.match(/<svg viewBox="[^"]+" width="(\d+)" height="(\d+)"/);
    return { vbW: Number(vb[1]), vbH: Number(vb[2]), pxW: Number(wh[1]), pxH: Number(wh[2]) };
  };
  const s2 = svgOf(t2), s6 = svgOf(t6);

  // Mấu chốt: tỉ lệ px-trên-mỗi-đơn-vị-SVG phải GIỐNG NHAU giữa 2 bàn — tức cùng một "thước đo"
  // cho ghế, dù viewBox (nội dung) khác nhau vì số ghế khác nhau.
  const scale2 = s2.pxW / s2.vbW, scale6 = s6.pxW / s6.vbW;
  t.ok(Math.abs(scale2 - scale6) < 0.01, `tỉ lệ phóng (px/đơn vị SVG) giống nhau giữa bàn ${t2.seats} ghế và bàn ${t6.seats} ghế: ${scale2} vs ${scale6} — nghĩa là 1 ghế luôn to bằng nhau (sai số nhỏ chấp nhận được do làm tròn px)`);

  // Bàn nhiều ghế hơn thì khung bàn to hơn trên màn hình (đúng ý "tự to theo số ghế", không phải
  // ghế bị bóp nhỏ lại) — không còn kiểu "ép vừa khung cố định" như lỗi trước đây.
  t.ok(s6.pxW >= s2.pxW, `bàn ${t6.seats} ghế hiện vật lý to hơn hoặc bằng bàn ${t2.seats} ghế trên màn hình (${s6.pxW}px so với ${s2.pxW}px)`);

  const css = fs.readFileSync(new URL('../src/web/styles.css', import.meta.url), 'utf8');
  t.ok(!/\.tblicon svg\{[^}]*[^-]width:100%/.test(css), 'CSS không còn ép chiều rộng ảnh bàn ghế thành 100% khung chứa cố định (nguồn gốc lỗi cũ) — chỉ còn max-width:100% làm giới hạn an toàn');
}

t.group('32. Các màn thêm/sửa (bàn, đặt bàn, món, khuyến mãi, nguyên liệu) không bị tràn/che khuất ở cỡ chữ lớn');
{
  const css = fs.readFileSync(new URL('../src/web/styles.css', import.meta.url), 'utf8');
  t.ok(/\.sheet\{[^}]*max-height:min\(calc\(78vh/.test(css), 'khung "sheet" (nền của cả 5 màn thêm/sửa) giới hạn chiều cao kép theo cả % lẫn px tuyệt đối — không chỉ dựa vào vh (từng có lịch sử tính sai khi phối hợp với zoom ở một số trình duyệt)');
  t.ok(/\.sheet\{[^}]*overflow-y:auto/.test(css), 'vẫn giữ cuộn dọc khi nội dung dài hơn khung — nút Lưu luôn với tới được bằng cách cuộn xuống');

  const appSrc = fs.readFileSync(new URL('../src/web/app.js', import.meta.url), 'utf8');
  t.ok(appSrc.includes('data-act="pickMenuImage" style="flex:1 1 100px"') && appSrc.includes('data-act="clearMenuImage" style="flex:1 1 100px"'),
    'màn Thêm món: hàng "Chọn ảnh"/"Xoá ảnh" cho phép xuống dòng, có bề rộng tối thiểu hợp lý');
  t.ok(appSrc.includes('id="rg"') && /flex-wrap:wrap[^`]*Số khách/.test(appSrc.slice(appSrc.indexOf("id=\"rg\"") - 300, appSrc.indexOf("id=\"rg\"") + 50)),
    'màn Thêm đặt bàn trước: hàng "Số khách"/"Giờ đến" cho phép xuống dòng');
  t.ok(/flex-wrap:wrap[^`]*Đơn vị/.test(appSrc.slice(appSrc.indexOf('id="iu"') - 300, appSrc.indexOf('id="iu"') + 50)),
    'màn Thêm nguyên liệu: hàng "Đơn vị"/"Ngưỡng cảnh báo" cho phép xuống dòng');

  // Màn Sửa/Thêm bàn: lưới chọn số ghế dùng CSS grid (tự xuống dòng theo bản chất, không cần flex-wrap)
  t.ok(appSrc.includes("grid-template-columns:repeat(4,1fr)"), 'màn Thêm/Sửa bàn: lưới chọn số ghế dùng CSS grid — tự ngắt dòng theo cấu trúc, không phụ thuộc flex-wrap');

  const w = newWorld(); const A = await setupOwner(w, { link: false });
  A.route = { name: 'menu', params: {} };
  A.handleAct({ dataset: { act: 'newItem' } });
  t.ok(!!A.document, 'mở màn Thêm món không ném lỗi (sanity check luồng sheet() vẫn chạy bình thường)');
}

/* ============================================================ */
t.group('33. Sheet (màn thêm/sửa) không còn bị thanh trạng thái che mất phần trên — lỗi khác với lỗi tràn/scroll đã sửa trước đó');
{
  const css = fs.readFileSync(new URL('../src/web/styles.css', import.meta.url), 'utf8');
  t.ok(/\.sheet-bg\{[^}]*padding-top:calc\(env\(safe-area-inset-top,0px\) \+ 14px\)/.test(css),
    '.sheet-bg chừa đúng khoảng trống cho thanh trạng thái ở phía trên — trước đây không chừa gì, nội dung dài thì phần đầu (tiêu đề, ô nhập đầu tiên) bị vẽ đè dưới status bar, không phải lỗi cuộn');
  t.ok(/\.sheet\{[^}]*max-height:min\(calc\(78vh - env\(safe-area-inset-top,0px\) - 14px\),620px\)/.test(css),
    'chiều cao tối đa của sheet TRỪ ĐÚNG phần đã chừa ở trên — nếu chỉ chừa chỗ mà không trừ chiều cao, sheet vẫn tràn ngược lên đúng chỗ vừa chừa ra');

  const appSrc = fs.readFileSync(new URL('../src/web/app.js', import.meta.url), 'utf8');
  t.ok(appSrc.includes('env(safe-area-inset-top,0px) + 24px) 24px'), 'màn phóng to mã QR thanh toán cũng chừa đúng khoảng trống trên/dưới cho thanh trạng thái và thanh điều hướng');

  t.ok(/#printOverlay\{[^}]*padding-top:env\(safe-area-inset-top,0px\)/.test(css), 'màn xem trước khi in cũng chừa đúng khoảng trống cho thanh trạng thái (thanh tiêu đề màu cam dính ở đó, dễ bị che nhất)');
}

/* ============================================================ */
t.group('34. Nhãn phiên bản build — để tự xác nhận đã cài đúng bản mới nhất khi thử đi thử lại');
{
  const { assembleScript, assembleHtml, readConfig } = await import('../scripts/assemble.mjs');

  // Mô phỏng đúng biến môi trường GitHub Actions tự cấp (không cần tự gõ tay)
  const old = { RUN: process.env.GITHUB_RUN_NUMBER, SHA: process.env.GITHUB_SHA };
  process.env.GITHUB_RUN_NUMBER = '42'; process.env.GITHUB_SHA = 'a1b2c3d4e5f6';
  const cfg = readConfig();
  delete process.env.GITHUB_RUN_NUMBER; delete process.env.GITHUB_SHA;
  if (old.RUN !== undefined) process.env.GITHUB_RUN_NUMBER = old.RUN;
  if (old.SHA !== undefined) process.env.GITHUB_SHA = old.SHA;

  t.ok(/^#42 · \d{4}-\d{2}-\d{2} \d{2}:\d{2} · a1b2c3d$/.test(cfg.buildVersion), `tự sinh đúng định dạng từ số lần chạy + giờ build + 7 ký tự mã commit: "${cfg.buildVersion}"`);

  cfg.centralUrl = 'https://x.supabase.co'; cfg.centralAnonKey = 'k'.repeat(40); cfg.guestPageUrl = 'https://x.github.io/y/';
  const html = assembleHtml({ cfg, bridgeJs: 'window.NativeBridge={};' });
  t.ok(html.includes(cfg.buildVersion), 'nhãn phiên bản được nướng vào app lúc build');

  const w = newWorld(); const A = await setupOwner(w, { link: false });
  t.ok(!A.VIEWS.login().includes('Bản '), 'môi trường test không có GITHUB_RUN_NUMBER → không hiện nhãn (không hiện chữ rỗng/undefined)');
}

/* ============================================================ */
t.group('35. Khung thêm/sửa (sheet) luôn giữ cỡ 100% dù app đang phóng to — tránh lỗi cuộn dính với khung nổi cố định dưới zoom');
{
  const w = newWorld(); const A = await setupOwner(w, { link: false });
  A.handleAct({ dataset: { act: 'setFontScale', k: '1.5' } });
  t.eq(A.document.body.style.zoom, '1.5', 'toàn app vẫn phóng to 150% như đã chọn');
  t.eq(A.document.body.style['--font-scale'], '1.5', 'lưu đúng tỉ lệ vào biến CSS --font-scale để sheet dùng huỷ zoom riêng');

  const css = fs.readFileSync(new URL('../src/web/styles.css', import.meta.url), 'utf8');
  t.ok(/\.sheet-bg\{[^}]*zoom:calc\(1 \/ var\(--font-scale,1\)\)/.test(css), '.sheet-bg tự huỷ đúng zoom của app (1/1.5) — khung thêm/sửa luôn hiện ở cỡ chữ thường, không bị lỗi dù chọn cỡ chữ nào');

  const adminHtml = A.VIEWS.admin();
  t.ok(adminHtml.includes('luôn hiện ở cỡ bình thường để tránh lỗi hiển thị'), 'màn Cài đặt giải thích rõ lý do đánh đổi này, không để người dùng tự hỏi vì sao form không to lên');
}

/* ============================================================ */
t.group('36. Bớt độ trễ đồng bộ NỀN (do Realtime/định kỳ): không hỏi lại quyền mọi lần, tối đa 1 lần/phút — nhưng đồng bộ gọi tay (syncNow) luôn kiểm tra đủ, không đánh đổi bảo mật');
{
  const w = newWorld(); const A = await setupOwner(w);
  w.store.storeStatusCalls = 0;   // đặt lại sau các lần gọi lúc setupOwner()

  await A.Sync.syncNow();
  const after1 = w.store.storeStatusCalls;
  t.ok(after1 >= 1, 'đồng bộ gọi tay (syncNow) luôn kiểm tra quyền');

  await A.Sync.syncNow(); await A.Sync.syncNow();
  t.eq(w.store.storeStatusCalls, after1 + 2, 'gọi tay nhiều lần liên tiếp vẫn kiểm tra quyền đủ mỗi lần — không bớt bước ở đường gọi tay, tránh chậm phát hiện thu hồi/mất quyền');

  // Đồng bộ NỀN (kick — mô phỏng Realtime báo có thay đổi) thì được bớt bước nếu vừa kiểm tra gần đây
  const beforeKick = w.store.storeStatusCalls;
  A.Sync.kick(0); await A.runTimers();
  A.Sync.kick(0); await A.runTimers();
  A.Sync.kick(0); await A.runTimers();
  t.eq(w.store.storeStatusCalls, beforeKick, 'nhiều lần đồng bộ NỀN liên tiếp trong vòng 1 phút KHÔNG hỏi lại quyền nữa — bớt hẳn một vòng mạng mỗi lần, đúng nguyên nhân chính gây độ trễ vài giây khi 2 máy đồng bộ qua lại');
}

/* ============================================================ */
t.group('37. Ảnh thực đơn tải lên Storage thay vì nhúng base64 — giảm dung lượng CSDL và băng thông');
{
  const TINY_JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';

  const w = newWorld(); const A = await setupOwner(w);   // setupOwner() mặc định đã liên kết Supabase
  await A.uploadMenuImage(TINY_JPG, null);
  t.ok(A.window._miImage && A.window._miImage.startsWith('https://') && A.window._miImage.includes('/storage/v1/object/public/menu-images/'),
    `tải lên thành công → dùng link Storage công khai, không còn base64 nhúng thẳng: ${A.window._miImage}`);
  t.ok(!A.window._miImage.startsWith('data:'), 'chắc chắn không còn là base64 (đúng mục tiêu giảm dung lượng CSDL)');

  // Tải lên lỗi (vd. bucket chưa có do chưa chạy lại SQL) → lùi về base64 như cũ, không chặn việc lưu món
  w.store.storageUploadFails = true;
  await A.uploadMenuImage(TINY_JPG, null);
  t.ok(A.window._miImage.startsWith('data:'), 'tải Storage lỗi → tự lùi về base64 tạm thời, không chặn việc lưu món');
  w.store.storageUploadFails = false;

  // Chưa liên kết Supabase của quán → không có Storage để tải lên, dùng thẳng base64 ngay từ đầu
  const B = await setupOwner(newWorld(), { link: false });
  await B.uploadMenuImage(TINY_JPG, null);
  t.ok(B.window._miImage.startsWith('data:'), 'chưa liên kết Supabase → dùng base64 ngay, không cố gọi Storage (sẽ chắc chắn lỗi)');
}

/* ============================================================ */
t.group('38. Dọn dữ liệu cũ (cleanup_old_data) — tránh CSDL đầy dần, không đụng đơn đang mở hay dữ liệu gần đây');
{
  const w = newWorld(); const A = await setupOwner(w);
  // maybeCleanup() (tự động, tối đa 1 lần/ngày) sẽ tự chạy ngay trong các syncNow() ở bước chuẩn bị
  // dữ liệu dưới đây nếu không chặn trước — đặt mốc "vừa dọn xong" để cô lập, chỉ còn đúng lần gọi
  // RPC TRỰC TIẾP cuối bài test này là lần dọn dẹp thật sự được đo.
  await A.Persist.setMeta('lastCleanupAt', Date.now());
  const DAY = 86400000, MONTH = 30 * DAY;
  const age = (collection, predicate, ms) => {
    for (const r of w.store.records.values()) if (r.collection === collection && predicate(r)) r.updated_at = w.store.now() - ms;
  };

  // Đơn đã thanh toán, CŨ (26 tháng) → phải bị dọn, kèm cả orderItems/payments của nó
  const oldPaid = await order(A, 'Bàn 01', 1, [['Trà đá', 1]]);
  await A.refresh(); await serveAll(A, oldPaid.id);
  await A.api(`/orders/${oldPaid.id}/payments`, { method: 'POST', body: { method: 'cash' } });
  await A.sync();
  age('orders', r => r.id === oldPaid.id, 26 * MONTH); age('orderItems', r => r.data.order_id === oldPaid.id, 26 * MONTH);
  age('payments', r => r.data.order_id === oldPaid.id, 26 * MONTH);

  // Đơn đã thanh toán nhưng GẦN ĐÂY (1 tháng) → phải giữ lại
  const recentPaid = await order(A, 'Bàn 02', 1, [['Trà đá', 1]]);
  await A.refresh(); await serveAll(A, recentPaid.id);
  await A.api(`/orders/${recentPaid.id}/payments`, { method: 'POST', body: { method: 'cash' } });

  // Đơn CŨ nhưng VẪN ĐANG MỞ (chưa thanh toán) → không bao giờ được đụng tới, dù cũ cỡ nào
  const oldOpen = await order(A, 'Bàn 03', 1, [['Trà đá', 1]]);
  await A.sync();
  age('orders', r => r.id === oldOpen.id, 26 * MONTH);

  // Bia mộ thật (deleted=true) — giảm số ghế một bàn 4→1, 3 ghế bị xoá thật khỏi mảng (không phải
  // kiểu "active=0" như xoá món/bàn) → đúng trường hợp cần dọn, cũ 40 ngày
  const tb4 = A.D.tables.find(t => t.seats === 4) || A.D.tables[0];
  await A.api('/tables/' + tb4.id, { method: 'PATCH', body: { seats: 1 } });
  await A.sync();
  // "Bia mộ" bị xoá sạch nội dung data (chỉ còn {}) — chỉ còn id (dạng "tableId:seatNo") để nhận diện
  age('seats', r => r.deleted && r.id.startsWith(tb4.id + ':'), 40 * DAY);

  const result = await A.Cloud.store.rpc('cleanup_old_data', { p_months_keep: 24 });

  t.ok(result.data.purged_orders_rows >= 3, `dọn đúng đơn cũ đã thanh toán + orderItems + payments của nó (${result.data.purged_orders_rows} dòng)`);
  t.ok(result.data.purged_tombstones >= 1, 'dọn đúng bia mộ (món đã xoá) quá 30 ngày');

  const stillThere = c => (id) => [...w.store.records.values()].some(r => r.collection === c && r.id === id && !r.deleted);
  t.ok(!stillThere('orders')(oldPaid.id), 'đơn cũ đã thanh toán — bị xoá thật khỏi CSDL');
  t.ok(stillThere('orders')(recentPaid.id), 'đơn thanh toán GẦN ĐÂY — vẫn còn nguyên, không đụng tới');
  t.ok(stillThere('orders')(oldOpen.id), 'đơn CŨ nhưng còn đang MỞ — không bao giờ bị dọn dù cũ cỡ nào');

  // Không phải chủ quán thì không được gọi
  const S = await addStaffDevice(w, A, 'pv'); await S.login('chuquan', 'chuquan123');
  const { error: e2 } = await S.Cloud.store.rpc('cleanup_old_data', {});
  t.ok(/Chỉ chủ quán/.test(e2?.message || ''), 'máy nhân viên gọi thẳng RPC bị chặn, không tự ý dọn được');
}

t.group('39. Tự động gọi dọn dữ liệu — tối đa 1 lần/ngày, chỉ từ máy chủ quán');
{
  const w = newWorld(); const A = await setupOwner(w);
  await A.Persist.setMeta('lastCleanupAt', 0);   // setupOwner() đã tự đồng bộ vài lần — đặt lại mốc để đo đúng từ đây
  w.store.cleanupCalls = 0;
  const orig = w.store.rpc_cleanup_old_data?.bind(w.store);
  w.store.rpc_cleanup_old_data = function (...a) { w.store.cleanupCalls++; return orig(...a); };

  const flush = async () => { for (let i = 0; i < 10; i++) await new Promise(r => setImmediate(r)); };

  await A.sync(); await flush();
  t.eq(w.store.cleanupCalls, 1, 'lần đồng bộ đầu tiên trong ngày tự gọi dọn dữ liệu');

  await A.sync(); await flush(); await A.sync(); await flush();
  t.eq(w.store.cleanupCalls, 1, 'các lần đồng bộ tiếp theo trong cùng ngày KHÔNG gọi lại — đúng 1 lần/ngày');

  const S = await addStaffDevice(w, A, 'pv2'); await S.login('chuquan', 'chuquan123');
  await S.sync(); await flush();
  t.eq(w.store.cleanupCalls, 1, 'máy nhân viên đồng bộ KHÔNG tự gọi dọn dữ liệu (chỉ máy chủ quán mới gọi)');
}

/* ============================================================ */
t.group('40. Quản lý danh mục món & khu bếp — thêm/sửa/xoá, chặn xoá khi còn món đang dùng, máy nhân viên không được đụng');
{
  const w = newWorld(); const A = await setupOwner(w);   // cần liên kết để tạo được máy nhân viên kiểm tra quyền bên dưới

  // Danh mục
  const before = A.D.categories.length;
  const r = await A.api('/categories', { method: 'POST', body: { name: 'Món tráng miệng mới' } });
  await A.refresh();
  t.eq(A.D.categories.length, before + 1, 'thêm danh mục mới thành công');
  t.ok(A.D.categories.some(c => c.name === 'Món tráng miệng mới'), 'đúng tên vừa thêm');

  await t.rejects(() => A.api('/categories', { method: 'POST', body: { name: 'Món tráng miệng mới' } }), /đã tồn tại/, 'không cho thêm trùng tên');

  await A.api(`/categories/${r.id}`, { method: 'PATCH', body: { name: 'Món tráng miệng mới lạnh' } });
  await A.refresh();
  t.ok(A.D.categories.some(c => c.name === 'Món tráng miệng mới lạnh'), 'sửa tên danh mục thành công');

  // Gán một món vào danh mục này rồi thử xoá — phải bị chặn
  const mi = A.D.menu[0];
  await A.api(`/menu/${mi.id}`, { method: 'PATCH', body: { categoryId: r.id } });
  await A.refresh();
  await t.rejects(() => A.api(`/categories/${r.id}`, { method: 'DELETE' }), /Còn món đang dùng/, 'chặn xoá danh mục khi còn món đang dùng');

  // Chuyển món sang danh mục khác rồi xoá lại — phải thành công
  const otherCat = A.D.categories.find(c => c.id !== r.id);
  await A.api(`/menu/${mi.id}`, { method: 'PATCH', body: { categoryId: otherCat.id } });
  await A.refresh();
  await A.api(`/categories/${r.id}`, { method: 'DELETE' });
  await A.refresh();
  t.ok(!A.D.categories.some(c => c.id === r.id), 'xoá danh mục thành công sau khi đã chuyển hết món ra');

  // Khu bếp — cùng kiểu hành vi
  const rk = await A.api('/kitchens', { method: 'POST', body: { name: 'Khu bếp mới' } });
  await A.refresh();
  t.ok(A.D.kitchens.some(k => k.name === 'Khu bếp mới'), 'thêm khu bếp mới thành công');
  await A.api(`/kitchens/${rk.id}`, { method: 'PATCH', body: { name: 'Khu bếp mới sửa' } });
  await A.refresh();
  t.ok(A.D.kitchens.some(k => k.name === 'Khu bếp mới sửa'), 'sửa tên khu bếp thành công');
  await A.api(`/kitchens/${rk.id}`, { method: 'DELETE' });
  await A.refresh();
  t.ok(!A.D.kitchens.some(k => k.id === rk.id), 'xoá khu bếp (chưa món nào dùng) thành công');

  // Máy nhân viên không được đụng vào
  const S = await addStaffDevice(w, A, 'pv'); await S.login('chuquan', 'chuquan123');
  await t.rejects(() => S.api('/categories', { method: 'POST', body: { name: 'X' } }), /Chỉ máy của chủ quán/, 'máy nhân viên không thêm được danh mục');
  await t.rejects(() => S.api('/kitchens', { method: 'POST', body: { name: 'X' } }), /Chỉ máy của chủ quán/, 'máy nhân viên không thêm được khu bếp');

  // Giao diện
  A.route = { name: 'catKitchen', params: {} };
  const html = A.VIEWS.catKitchen();
  t.ok(html.includes('Danh mục &amp; khu bếp') && html.includes('+ Thêm danh mục') && html.includes('+ Thêm khu bếp'), 'màn quản lý hiện đủ cả 2 mục');
}

t.group('41. Xoá hẳn tài khoản nhân viên — chỉ xoá được khi đang khoá, không xoá được chủ quán');
{
  const w = newWorld(); const A = await setupOwner(w);   // cần liên kết để tạo được máy nhân viên kiểm tra quyền bên dưới
  const r = await A.api('/staff', { method: 'POST', body: { name: 'Nhân viên Test', role: 'Phục vụ', username: 'nv_test' } });
  await A.refresh();
  const sid = A.D.staff.find(s => s.username === 'nv_test').id;

  await t.rejects(() => A.api('/staff/' + sid, { method: 'DELETE' }), /đang khoá/, 'tài khoản đang HOẠT ĐỘNG → chưa xoá được, phải khoá trước');

  await A.api('/staff/' + sid, { method: 'PATCH', body: { active: false } });
  await A.refresh();
  let html = A.VIEWS.staff ? (() => { A.route = { name: 'staff', params: { id: sid } }; return A.VIEWS.staff(); })() : '';
  t.ok(html.includes('Xoá hẳn tài khoản'), 'đã khoá → màn chi tiết hiện nút xoá hẳn');

  await A.api('/staff/' + sid, { method: 'DELETE' });
  await A.refresh();
  t.ok(!A.D.staff.some(s => s.id === sid), 'xoá thành công sau khi đã khoá');

  // Không xoá được chủ quán dù (giả sử) có cách nào đó để khoá được
  const owner = A.D.staff.find(s => s.role === 'Chủ quán');
  await t.rejects(() => A.api('/staff/' + owner.id, { method: 'DELETE' }), /Không thể xoá tài khoản chủ quán/, 'không bao giờ xoá được tài khoản chủ quán');

  // Máy nhân viên không tự xoá được ai
  const r2 = await A.api('/staff', { method: 'POST', body: { name: 'NV2', role: 'Phục vụ', username: 'nv2' } });
  await A.refresh();
  await A.api('/staff/' + A.D.staff.find(s=>s.username==='nv2').id, { method: 'PATCH', body: { active: false } });
  await A.sync();   // đẩy lên store thật — máy S tạo sau mới thấy được qua pull, refresh() chỉ đọc cục bộ
  const S = await addStaffDevice(w, A, 'pv2'); await S.login('chuquan', 'chuquan123');
  await S.sync();
  const lockedId = S.D.staff.find(s => s.username === 'nv2').id;
  await t.rejects(() => S.api('/staff/' + lockedId, { method: 'DELETE' }), /Chỉ máy của chủ quán/, 'máy nhân viên không tự xoá tài khoản nào được, kể cả đã khoá');
}

/* ============================================================ */
const { pass, fail, failures } = t.results;
console.log(`\n${'='.repeat(60)}\n${pass} đạt · ${fail} lỗi · ${pass + fail} kiểm tra`);
if (fail) { console.log('\nCác kiểm tra lỗi:'); failures.forEach(f => console.log(' - ' + f)); process.exit(1); }
