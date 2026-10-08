/* Dựng HTML tĩnh của các màn hình app (bằng chính mã giao diện thật + dữ liệu mẫu) để chụp ảnh cho trang Google Play.
   Chạy từ thư mục gốc dự án:  node play-listing/tools/make-screens.mjs
   Ra: play-listing/tools/_shots/NN-ten.html (mở bằng trình duyệt, chụp ở khổ 450x900 → ảnh 900x1800, đúng tỉ lệ 2:1 Play cho phép). */
import fs from 'node:fs';
import path from 'node:path';
import { newWorld, newDevice } from '../../test/harness.mjs';
import { ROOT } from '../../scripts/assemble.mjs';

const OUT = path.join(ROOT, 'play-listing/tools/_shots');
fs.mkdirSync(OUT, { recursive: true });
const css = fs.readFileSync(path.join(ROOT, 'src/web/styles.css'), 'utf8');

const w = newWorld();
const A = await newDevice(w, 'owner');
await A.Cloud.ownerSignUp('chu@quan.vn', 'matkhau1', 'Quán Phở Sen Vàng');
await A.License.refresh(true);
await A.createStore({ shopName: 'Quán Phở Sen Vàng', ownerName: 'Nguyễn Văn An', username: 'chuquan', appPassword: 'chuquan123', sample: true });
await A.Cloud.saveCfg({ role: 'owner' });
await A.Persist.flush();
await A.login('chuquan', 'chuquan123');
await A.api('/settings', { method: 'PATCH', body: { vietqrBin: '970436', vietqrAccount: '0123456789', vietqrName: 'NGUYEN VAN AN' } });

const menuId = (n) => A.D.menu.find(m => m.name === n)?.id;
const table = (n) => A.D.tables.find(t => t.name === n);
async function order(tableName, seat, lines) {
  const tb = table(tableName);
  return A.api('/orders/items', { method: 'POST', body: { tableId: tb.id, seatNo: seat, lines: lines.map(([n, q]) => ({ menuItemId: menuId(n), qty: q })).filter(l => l.menuItemId) } });
}
const names = A.D.menu.map(m => m.name);
console.log('Thực đơn mẫu:', names.slice(0, 14).join(' | '));
console.log('Bàn mẫu:', A.D.tables.map(t => t.name).join(' | '));

// Vài đơn đang mở ở các bàn khác nhau, có món đã xong / đang nấu để màn Bếp và Thu ngân có nội dung
const pick = (i) => names[i % names.length];
const o1 = await order(A.D.tables[0].name, 1, [[pick(0), 2], [pick(1), 1], [pick(2), 1]]);
const o2 = await order(A.D.tables[1].name, 1, [[pick(3), 1], [pick(4), 2]]);
const o3 = await order(A.D.tables[2].name, 1, [[pick(1), 3], [pick(5), 1]]);
// Hai hoá đơn đã thu tiền (cho màn Thu ngân và Báo cáo có số liệu)
for (const [tn, lines] of [[A.D.tables[3].name, [[pick(2), 2], [pick(5), 2], [pick(6), 1]]], [A.D.tables[4].name, [[pick(3), 2], [pick(0), 1], [pick(7), 2]]]]) {
  const o = await order(tn, 1, lines); await A.refresh();
  for (const it of A.D.orderItems.filter(i => i.order_id === o.id)) { await A.api(`/kds/items/${it.id}/start`, { method: 'POST' }); await A.api(`/kds/items/${it.id}/done`, { method: 'POST' }); }
  await A.api(`/orders/${o.id}/payments`, { method: 'POST', body: { method: tn === A.D.tables[3].name ? 'cash' : 'vietqr' } });
}
await A.refresh();
// o1: xong hết (chờ thanh toán); o2: một món đang nấu; o3: vừa gọi
for (const it of A.D.orderItems.filter(i => i.order_id === o1.id)) { await A.api(`/kds/items/${it.id}/start`, { method: 'POST' }); await A.api(`/kds/items/${it.id}/done`, { method: 'POST' }); }
const first2 = A.D.orderItems.filter(i => i.order_id === o2.id)[0];
if (first2) await A.api(`/kds/items/${first2.id}/start`, { method: 'POST' });
await A.refresh();

const shots = [
  ['01-phuc-vu-so-do-ban', { name: 'tables', params: {} }],
  ['02-goi-mon', { name: 'order', params: { id: o3.id } }],
  ['03-bep', { name: 'kds', params: {} }],
  ['04-thu-ngan', { name: 'cashier', params: {} }],
  ['05-thanh-toan-vietqr', { name: 'pay', params: { id: o1.id, g: 'vietqr' } }],
  ['06-quan-ly', { name: 'admin', params: {} }],
  ['07-bao-cao', { name: 'reports', params: {} }],
];
for (const [file, route] of shots) {
  A.route = route;
  let html;
  try { html = A.VIEWS[route.name](); } catch (e) { console.log('✗', file, e.message); continue; }
  const page = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<style>${css}</style><style>html,body{margin:0}</style></head><body><div id="app">${html}</div></body></html>`;
  fs.writeFileSync(path.join(OUT, file + '.html'), page);
  console.log('✓', file, Math.round(page.length / 1024) + ' KB');
}
