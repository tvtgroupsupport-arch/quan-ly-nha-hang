/* ============================================================
   ENGINE NGHIỆP VỤ CỤC BỘ
   Toàn bộ nghiệp vụ (gọi món, bếp, kho, ghép/tách đơn, thanh toán, đặt bàn...)
   chạy ngay trên điện thoại, đọc/ghi biến D trong bộ nhớ. Việc lưu xuống
   SQLite và đồng bộ lên Supabase do lớp cloud/ (persist, records, sync) đảm nhận —
   engine không biết gì về mạng, nên luôn chạy được khi offline.
   ============================================================ */

let D = null;                       // kho dữ liệu đang dùng (nạp từ SQLite lúc khởi động)

const nowMs = () => Date.now();
/** Ai đang thao tác — chịu được cả khi chưa đăng nhập (gọi API trực tiếp) */
/** Khoá đăng nhập: sai 5 lần liên tiếp → khoá 15 phút (theo tên đăng nhập, lưu lại để khởi động lại app không xoá được) */
const LOGIN_MAX_FAILS = 5, LOGIN_LOCK_MS = 15 * 60000, LOGIN_FAIL_KEY = 'bepo_login_fail';
function _loginFailMap() { try { return JSON.parse(localStorage.getItem(LOGIN_FAIL_KEY) || '{}'); } catch (e) { return {}; } }
function _loginFailSave(m) { try { localStorage.setItem(LOGIN_FAIL_KEY, JSON.stringify(m)); } catch (e) {} }
function loginLockLeft(u) { const r = _loginFailMap()[String(u).toLowerCase()]; return r && r.until > Date.now() ? r.until - Date.now() : 0; }
function loginFail(u) {
  const m = _loginFailMap(), k = String(u).toLowerCase(), t = Date.now();
  let r = m[k] || { n: 0, until: 0 };
  if (r.until && r.until <= t) r = { n: 0, until: 0 };     // hết hạn khoá → đếm lại TỪ ĐẦU (trước đây until cũ vẫn nằm đó nên lần đếm sau luôn bị đặt về 1: khoá một lần rồi không bao giờ khoá lại)
  r.n++;
  if (r.n >= LOGIN_MAX_FAILS) { r.until = t + LOGIN_LOCK_MS; r.n = 0; }
  m[k] = r; _loginFailSave(m);
}
function loginOk(u) { const m = _loginFailMap(); delete m[String(u).toLowerCase()]; _loginFailSave(m); }
/** Xoá MỌI khoá đăng nhập — khi tạo lại quán / ngắt liên kết / khôi phục / liên kết máy nhân viên: khoá cũ (theo tên đăng nhập, lưu ở localStorage) không được dính sang quán mới */
function clearLoginLock() { try { localStorage.removeItem(LOGIN_FAIL_KEY); } catch (e) {} }
const who = () => (typeof ME !== 'undefined' && ME) ? ME.name + (ME.role ? ' (' + ME.role + ')' : '') : 'Hệ thống';
const whoId = () => (typeof ME !== 'undefined' && ME) ? ME.id : null;
/** Vai trò gán được khi tạo tài khoản: KHÔNG có 'Chủ quán' — tài khoản Chủ quán chỉ có lúc tạo quán, không ai (kể cả chủ quán) tạo thêm qua API */
const STAFF_ASSIGNABLE_ROLES = ['Phục vụ', 'Thu ngân', 'Bếp', 'Quản lý'];
const STAFF_PRESETS = {
  'Quản lý':  { pos:1, tables:1, kds:1, reservations:1, tablesAdmin:1, menu:1, stock:1, promo:1, report:1, logs:1 },
  'Thu ngân': { pos:1, tables:1, reservations:1, promo:1 },
  'Bếp':      { kds:1, stock:1 },
  'Phục vụ':  { tables:1, reservations:1 }
};
/** Người đang thao tác KHÔNG phải Chủ quán? (không có phiên đăng nhập = lệnh nội bộ của chính engine/test, giữ nguyên như trước: không giới hạn) */
const actorIsNotOwner = () => typeof ME !== 'undefined' && !!ME && ME.role !== 'Chủ quán';
/** Tài khoản `target` có "lớn hơn" người đang thao tác không: là Chủ quán, hoặc có quyền k mà người thao tác không có.
    Chủ quán thì không bị giới hạn. Người không phải Chủ quán không được cấp lại mật khẩu / khoá / đổi tên / đổi quyền / xoá tài khoản như vậy. */
function staffOutranks(target) {
  if (!actorIsNotOwner()) return false;
  if (target.role === 'Chủ quán') return true;
  const mine = ME.perms || {}, tp = target.perms || {};
  return Object.keys(tp).some(k => tp[k] && !mine[k]);
}
/** Người đang thao tác có BẬT được quyền k cho target không: Chủ quán luôn được; người khác chỉ được khi chính mình có k, hoặc target đã có sẵn k (không phải "cấp thêm"). Engine và màn Nhân viên dùng chung hàm này. */
function canGrantPerm(target, k) {
  if (!actorIsNotOwner()) return true;
  return !!((ME.perms || {})[k]) || !!((target.perms || {})[k]);
}
const OUTRANK_MSG = 'Tài khoản này có quyền mà bạn không có (hoặc là Chủ quán) — nhờ chủ quán thao tác';
/** Mảnh định danh mật khẩu hiện tại của tài khoản (chính là MUỐI ngẫu nhiên của bản băm — đổi/cấp lại mật khẩu là đổi muối; KHÔNG phải bản băm).
    Lưu cùng phiên đăng nhập để biết phiên đã cũ khi mật khẩu bị đổi/cấp lại. */
const pwVer = s => (s && s.pw && s.pw.s) || '';
/** Mã ngẫu nhiên 12 ký tự từ bộ sinh số an toàn — nhiều máy cùng tạo bản ghi offline không được trùng id */
const rid = () => {
  const a = new Uint32Array(3); crypto.getRandomValues(a);
  return Array.from(a, n => n.toString(36).padStart(7, '0')).join('').slice(0, 12);
};
/** Mã QR của ghế — đây là thứ DUY NHẤT xác thực khách khi gọi món, nên phải là một bí mật
    không đoán được, không được ghép từ id bàn/số ghế (lộ id bàn là suy ra được mọi ghế khác). */
const tok = () => { const a = new Uint8Array(20); crypto.getRandomValues(a); return Array.from(a, b => b.toString(16).padStart(2, '0')).join(''); };

function emptyD() {
  return {
    restaurant: { name: 'Nhà Hàng' },
    settings: { autoLock: true, sound: true, sepay: true, confirmFirstOrder: false,
                callSound: true, chime: 1, soundVolume: 100 },
    license: null,
    areas: [], tables: [], seats: [], categories: [], kitchens: [], menu: [], recipes: [],
    ingredients: [], promos: [], staff: [], reservations: [],
    orders: [], orderItems: [], payments: [], stockMoves: [], logs: [],
    counter: 1000                    // bộ đếm mã đơn — chỉ của riêng máy này, không đồng bộ
  };
}
/** Ghi nhận dữ liệu đã đổi: lớp lưu trữ sẽ ghi SQLite và (nếu đã liên kết) đẩy lên Supabase */
function saveD() { if (typeof Persist !== 'undefined') Persist.saveSoon(); }

const VALID_TABLE_LAYOUTS = ['auto', 'h', 'v', 'wall-top', 'wall-bottom', 'wall-left', 'wall-right'];

/** Mã đơn: máy phụ có hậu tố riêng (#1001-A3) để hai máy cùng offline không trùng mã */
function nextOrderCode() {
  const tag = (typeof Records !== 'undefined' && Records.codeTag) ? '-' + Records.codeTag : '';
  return '#' + (++D.counter) + tag;
}

/* ---------- khởi tạo dữ liệu lần đầu ---------- */
/** Nền tối thiểu để dùng được ngay: một khu, vài danh mục, hai bếp */
function seedBasic(db) {
  const t = nowMs();
  db.areas.push({ id: 'a' + rid(), name: 'Khu A', sort: 0 });
  ['Món chính', 'Đồ uống'].forEach((n, i) => db.categories.push({ id: 'c' + rid(), name: n, sort: i }));
  ['Bếp chính', 'Quầy pha chế'].forEach(n => db.kitchens.push({ id: 'k' + rid(), name: n }));
}

/** Dữ liệu mẫu (bàn, thực đơn, kho) để chủ quán thử ngay — không có đơn hàng, không có tài khoản mẫu */
function seedSample(db) {
  const t = nowMs();
  db.areas.length = 0; db.categories.length = 0; db.kitchens.length = 0;
  const A = ['Khu A', 'Khu B', 'Ngoài trời'].map((name, i) => ({ id: 'a' + rid(), name, sort: i }));
  const C = ['Khai vị', 'Món chính', 'Đồ uống', 'Tráng miệng'].map((name, i) => ({ id: 'c' + rid(), name, sort: i }));
  const K = ['Bếp chính', 'Bếp lạnh', 'Quầy pha chế'].map(name => ({ id: 'k' + rid(), name }));
  db.areas.push(...A); db.categories.push(...C); db.kitchens.push(...K);

  [['Bàn 01', 0, 2], ['Bàn 02', 0, 4], ['Bàn 03', 0, 6], ['Bàn 04', 1, 4], ['Bàn 05', 1, 2], ['Bàn 06', 2, 6]].forEach(([name, ai, seats]) => {
    const id = 't' + rid();
    db.tables.push({ id, name, area_id: A[ai].id, seats, layout: 'auto', active: 1, updated_at: t });
    for (let n = 1; n <= seats; n++) db.seats.push({ table_id: id, seat_no: n, qr_token: tok(), locked: 0, calling: 0, bound_order_id: null, updated_at: t });
  });

  const ING = {};
  [['Thịt bò', 'kg', 12.4, 5], ['Sườn heo', 'kg', 8.1, 5], ['Bánh phở', 'kg', 28, 10],
   ['Cam tươi', 'kg', 9.5, 4], ['Tôm sú', 'kg', 6.2, 3], ['Rau sống', 'kg', 5, 2]].forEach(([name, unit, qty, min_qty]) => {
    const id = 'i' + rid(); ING[name] = id;
    db.ingredients.push({ id, name, unit, qty, qty0: qty, min_qty, updated_at: t });   // qty0 = tồn đầu (dùng để đồng bộ kho)
  });
  const def = [
    ['Gỏi cuốn tôm thịt', 1, 45000, 2, '🥗', 'Tôm, thịt luộc, bún, rau sống', [['Tôm sú', 0.08], ['Rau sống', 0.05]]],
    ['Chả giò hải sản', 1, 55000, 1, '🥟', '6 cuốn, ăn kèm rau sống', [['Tôm sú', 0.1]]],
    ['Phở bò tái', 1, 75000, 1, '🍜', 'Bánh phở, thịt bò tái, hành ngò', [['Thịt bò', 0.15], ['Bánh phở', 0.2]]],
    ['Cơm tấm sườn bì', 1, 65000, 1, '🍚', 'Sườn nướng, bì, chả, trứng ốp', [['Sườn heo', 0.25]]],
    ['Cơm chiên hải sản', 1, 70000, 1, '🍤', 'Tôm mực, trứng, rau củ', [['Tôm sú', 0.12]]],
    ['Trà đá', 2, 10000, 2, '🧊', 'Ly lớn', []],
    ['Nước cam ép', 2, 30000, 2, '🍊', 'Cam tươi vắt', [['Cam tươi', 0.3]]],
    ['Bia Sài Gòn', 2, 25000, 2, '🍺', 'Lon 330ml', []],
    ['Chè thái', 3, 35000, 1, '🍮', 'Mít, nhãn, nước cốt dừa', []]
  ];
  def.forEach(([name, ci, price, ki, emoji, description, rec]) => {
    const id = 'm' + rid();
    db.menu.push({ id, name, description, emoji, price, category_id: C[ci].id, kitchen_id: K[ki].id, stock_state: 'ok', active: 1, updated_at: t });
    rec.forEach(([ing, q]) => db.recipes.push({ menu_item_id: id, ingredient_id: ING[ing], qty_per_serve: q }));
  });
}

/** Tạo dữ liệu cho quán mới: thông tin quán + tài khoản chủ quán (mật khẩu đã băm) */
async function createStore({ shopName, phone, ownerName, username, appPassword, sample }) {
  const db = emptyD();
  db.restaurant = { name: (shopName || '').trim() || 'Nhà Hàng', phone: (phone || '').trim() };
  sample ? seedSample(db) : seedBasic(db);
  db.staff.push({
    id: 's' + rid(), name: (ownerName || '').trim() || 'Chủ quán', role: 'Chủ quán', username: String(username).trim(),
    perms: { pos: 1, tables: 1, kds: 1, reservations: 1, tablesAdmin: 1, menu: 1, stock: 1, promo: 1, report: 1, staff: 1, billing: 1, logs: 1 },
    active: 1, pw: await AuthLocal.hash(appPassword), must_change: 0
  });
  D = db;
  clearLoginLock();
  addLog('Hệ thống', 'Khởi tạo quán', db.restaurant.name);
  saveD();
  return D;
}

/** Xoá cờ "đang gọi nhân viên" của ghế thuộc bàn ĐÃ XOÁ (active=0): bàn đã ẩn thì không ai xử lý được lời gọi, banner/chấm báo sẽ hiện mãi. Chỉ đụng ghế có bàn tồn tại và đã bị xoá
    (bàn chưa kịp đồng bộ về thì chưa coi là đã xoá). Gọi lúc nạp dữ liệu / làm mới. */
function clearOrphanCalls() {
  if (!D || !D.seats || !D.tables) return;
  const dead = new Set(D.tables.filter(t => !t.active).map(t => t.id));
  if (!dead.size) return;
  let n = 0;
  for (const s of D.seats) if (s.calling && dead.has(s.table_id)) { s.calling = 0; s.updated_at = nowMs(); n++; }
  if (n) saveD();
}
function atToday(h, m) { const d = new Date(); d.setHours(h, m, 0, 0); return d.getTime(); }

/* ---------- nghiệp vụ dùng chung ---------- */
function addLog(actor, action, detail, level) {
  D.logs.unshift({ id: 'l' + rid(), level: level || 'info', actor, action, detail: detail || null, created_at: nowMs() });
  if (D.logs.length > 3000) D.logs.pop();   // chỉ cắt nhật ký cục bộ; máy chủ vẫn giữ
}
/** Mô tả vị trí/đơn/món cho nhật ký: "Bàn 3 · Ghế 2", "đơn #12", "Phở ×2 (ít hành)" — để đọc nhật ký biết chính xác thao tác ở đâu. */
/** Ngày dương lịch theo GIỜ MÁY (không phải UTC): 'YYYY-MM-DD' */
function localYmd(t) { const d = t == null ? new Date() : new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function startOfTodayMs() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
const STATUS_VI = { pending: 'Chờ xác nhận', queued: 'Chờ bếp', cooking: 'Đang làm', ready: 'Đã làm xong', served: 'Đã phục vụ', cancelled: 'Đã huỷ' };
const placeOf = (tid, sn) => { if (!tid) return 'Giao hàng'; const t = D.tables.find(x => x.id === tid); return (t ? t.name : 'Bàn đã xoá') + (sn ? ' · Ghế ' + sn : ''); };
const orderPlace = o => placeOf(o.table_id, o.seat_no);
const itemTxt = i => i.name_snapshot + ' ×' + i.qty + (i.note ? ' (' + i.note + ')' : '');
const itemPlace = i => { const o = D.orders.find(x => x.id === i.order_id); return (i.origin_table ? placeOf(i.origin_table, i.origin_seat) : (o ? orderPlace(o) : '?')) + (o ? ' · đơn ' + o.code : ''); };
/** Nhật ký thay đổi: ghi rõ GIÁ TRỊ TRƯỚC → SAU của từng trường đã đổi (bỏ qua nếu không có gì đổi).
    fields = { khoá: ['Nhãn hiển thị', hàmĐổiGiáTrị?] } — hàm đổi giá trị dùng để hiện tên thay vì mã (khu vực, danh mục, khu bếp…). */
function showLogVal(v) {
  if (v === undefined || v === null || v === '') return '(trống)';
  if (typeof v === 'boolean') return v ? 'bật' : 'tắt';
  if (typeof v === 'object') { try { return JSON.stringify(v); } catch (e) { return String(v); } }
  const s = String(v);
  return s.length > 80 ? s.slice(0, 77) + '…' : s;
}
function diffLog(action, name, before, after, fields) {
  const parts = [];
  for (const k of Object.keys(fields)) {
    const [label, fmt] = fields[k];
    const a = before[k], b = after[k];
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue;
    if (k === 'image') { parts.push(label + ': ' + (b ? (a ? 'đổi ảnh' : 'thêm ảnh') : 'xoá ảnh')); continue; }
    parts.push(label + ': ' + showLogVal(fmt ? fmt(a) : a) + ' → ' + showLogVal(fmt ? fmt(b) : b));
  }
  if (parts.length) addLog(who(), action, (name ? name + ' — ' : '') + parts.join('; '));
  return parts.length;
}
const snapOf = (o, keys) => { const r = {}; keys.forEach(k => { r[k] = o[k]; }); return r; };
function moveStockD(ingId, type, qty, reason, orderId) {
  const ing = D.ingredients.find(i => i.id === ingId);
  if (!ing) return;
  ing.qty = Math.round((ing.qty + (type === 'in' ? qty : -qty)) * 1000) / 1000;
  D.stockMoves.unshift({ id: 'sm' + rid(), ingredient_id: ingId, type, qty, qty_after: ing.qty,
    reason: reason || '', ref_order_id: orderId || null, staff_id: whoId(), created_at: nowMs() });
  // Không cắt phiếu kho: tồn kho được tính lại từ tồn đầu + toàn bộ phiếu để đồng bộ nhiều máy không lệch
  if (ing.qty < 0) addLog('Hệ thống', 'Kho âm', `${ing.name} còn ${ing.qty} ${ing.unit}`, 'warn');
}
/** Trừ kho theo công thức; servings âm = hoàn kho */
function consume(mid, servings, orderId) {
  const m = D.menu.find(x => x.id === mid);
  D.recipes.filter(r => r.menu_item_id === mid).forEach(r => {
    const used = Math.round(r.qty_per_serve * Math.abs(servings) * 1000) / 1000;
    if (!used) return;
    moveStockD(r.ingredient_id, servings > 0 ? 'auto' : 'in', used,
      servings > 0 ? `Theo công thức ${m.name}` : `Hoàn kho ${m.name}`, orderId);
  });
}
function openOrderD(tableId, seatNo) {
  const s = D.seats.find(x => x.table_id === tableId && x.seat_no === Number(seatNo));
  if (s?.bound_order_id) {
    const b = D.orders.find(o => o.id === s.bound_order_id && o.status === 'open');
    if (b) return b;
    s.bound_order_id = null;
  }
  return D.orders.find(o => o.table_id === tableId && o.seat_no === Number(seatNo) && o.status === 'open');
}
function seatsOfOrderD(oid) {
  const rows = D.seats.filter(s => s.bound_order_id === oid)
    .map(s => ({ table_id: s.table_id, seat_no: s.seat_no }));
  const o = D.orders.find(x => x.id === oid);
  if (o?.table_id && !rows.some(r => r.table_id === o.table_id && r.seat_no === o.seat_no)) {
    rows.unshift({ table_id: o.table_id, seat_no: o.seat_no });
  }
  return rows;
}
function totalD(oid) {
  const items = D.orderItems.filter(i => i.order_id === oid && i.status !== 'cancelled');
  const subtotal = items.reduce((s, i) => s + i.qty * i.price_snapshot, 0);
  const o = D.orders.find(x => x.id === oid);
  const p = o?.promo_id ? D.promos.find(x => x.id === o.promo_id) : null;
  let discount = 0;
  if (p && p.active && subtotal >= p.min_total) {
    discount = Math.min(subtotal, p.type === 'pct' ? Math.round(subtotal * p.value / 100) : p.value);
  }
  return { subtotal, discount, total: subtotal - discount, promo: p };
}
function orderFull(oid) {
  const o = { ...D.orders.find(x => x.id === oid) };
  o.items = D.orderItems.filter(i => i.order_id === oid && i.status !== 'cancelled');
  o.seats = seatsOfOrderD(oid);
  return Object.assign(o, totalD(oid));
}

/* ---------- bộ định tuyến API giả ---------- */
function err(status, message, extra) { const e = new Error(message); e.status = status; e.data = { error: message, ...(extra || {}) }; return e; }

/** Máy nhân viên (liên kết bằng mã QR) chỉ được thao tác vận hành. Đây là lớp chặn phía giao diện để báo lỗi
    rõ ràng; lớp chặn THẬT nằm trong Postgres (hàm push_records) nên sửa mã app cũng không vượt qua được. */
const STAFF_DEVICE_FORBIDDEN = [
  ['POST', 'areas'], ['POST', 'tables'], ['PATCH', 'tables', '*'], ['DELETE', 'tables', '*'],
  ['POST', 'menu'], ['DELETE', 'menu', '*'], ['PUT', 'menu', '*', 'recipe'],
  ['POST', 'ingredients'], ['PATCH', 'ingredients', '*'],
  ['POST', 'promos'], ['PATCH', 'promos', '*'],
  ['POST', 'staff'], ['PATCH', 'staff', '*'], ['POST', 'staff', '*', 'reset-password'], ['DELETE', 'staff', '*'],
  ['POST', 'categories'], ['PATCH', 'categories', '*'], ['DELETE', 'categories', '*'],
  ['POST', 'kitchens'], ['PATCH', 'kitchens', '*'], ['DELETE', 'kitchens', '*'],
  ['PATCH', 'settings'], ['PATCH', 'restaurant']
];
/** Khoá gói cước (hết hạn): chặn mọi thao tác ghi trừ đăng nhập/đăng xuất/đổi mật khẩu */
const LICENSE_ALLOWED_WRITES = [['POST', 'auth', 'login'], ['POST', 'auth', 'logout'], ['POST', 'auth', 'password']];

function engineGuard(method, seg, body) {
  const match = pat => pat[0] === method && pat.length - 1 === seg.length && pat.slice(1).every((x, i) => x === '*' || x === seg[i]);
  if (method !== 'GET' && typeof License !== 'undefined' && License.locked() && !LICENSE_ALLOWED_WRITES.some(match)) {
    return err(402, 'Gói cước đã hết hạn — chủ quán cần gia hạn để tiếp tục thao tác');
  }
  if (typeof Cloud !== 'undefined' && Cloud.role === 'staff') {
    if (method === 'PATCH' && seg[0] === 'menu' && seg.length === 2) {
      // Máy nhân viên chỉ được đổi tình trạng còn/hết món
      const keys = Object.keys(body || {}).filter(k => k !== 'stockState');
      if (keys.length) return err(403, 'Máy nhân viên chỉ được đổi tình trạng còn/hết của món');
      return null;
    }
    if (STAFF_DEVICE_FORBIDDEN.some(match)) return err(403, 'Chỉ máy của chủ quán mới làm được thao tác này');
  }
  return null;
}

/** Số từ dữ liệu gửi lên: rỗng/không gửi → mặc định; không phải số hữu hạn → NaN (để checkPromo báo lỗi) */
const numOr = (v, d) => (v === undefined || v === null || v === '' ? d : Number(v));
/** Kiểm tra & chuẩn hoá các trường của khuyến mãi (dùng cho cả tạo mới lẫn sửa — truyền giá trị cuối cùng sau khi sửa).
    only (tập tên trường: 'type' | 'value' | 'min_total' | 'use_limit' | 'expires_on'): chỉ kiểm các trường ĐANG ĐƯỢC SỬA. Khuyến mãi cũ có dữ liệu "lệch" ở trường khác
    (% lớn hơn 100, thiếu giới hạn lượt, ngày sai dạng…) vẫn bật/tắt và đổi tên được — nếu kiểm cả bản ghi thì nút bật/tắt (chỉ gửi {active}) bị chặn oan. */
function checkPromo(p, only) {
  const chk = k => !only || only.has(k);
  const out = { value: p.value, min_total: p.min_total, use_limit: p.use_limit, expires_on: p.expires_on || null };
  if (chk('type') || chk('value')) {
    if (!['pct', 'amt'].includes(p.type)) throw err(400, 'Loại giảm giá không hợp lệ');
    const v = Number(p.value);
    if (!Number.isFinite(v) || !(v > 0)) throw err(400, 'Giá trị giảm phải lớn hơn 0');
    if (p.type === 'pct' && v > 100) throw err(400, 'Giảm theo phần trăm tối đa 100%');
    out.value = Math.round(v);
  }
  if (chk('min_total')) {
    const min = Number(p.min_total);
    if (!Number.isFinite(min) || min < 0) throw err(400, 'Đơn tối thiểu không được âm');
    out.min_total = min;
  }
  if (chk('use_limit')) {
    const lim = Number(p.use_limit);
    if (!Number.isInteger(lim) || lim < 0) throw err(400, 'Giới hạn lượt phải là số nguyên từ 0 trở lên');
    out.use_limit = lim;
  }
  if (chk('expires_on') && out.expires_on !== null) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(out.expires_on));
    const d = m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    if (!m || d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) throw err(400, 'Ngày hết hạn không hợp lệ');
  }
  return out;
}

async function apiLocal(path, { method = 'GET', body } = {}) {
  await new Promise(r => setTimeout(r, 40));   // trễ nhẹ cho giống mạng thật
  const [p, qs] = path.split('?');
  const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const seg = p.split('/').filter(Boolean);
  const M = (m, ...parts) => method === m && seg.length === parts.length &&
    parts.every((x, i) => x === '*' || x === seg[i]);

  const blocked = engineGuard(method, seg, body);
  if (blocked) throw blocked;

  /* --- đăng nhập (mật khẩu băm PBKDF2, kiểm tra cục bộ nên dùng được khi offline) --- */
  if (M('POST', 'auth', 'login')) {
    const uname = String(body?.username || '').trim();
    const lockLeft = loginLockLeft(uname);
    if (lockLeft > 0) throw err(429, 'Sai mật khẩu quá 5 lần — đăng nhập bị khoá ' + Math.ceil(lockLeft / 60000) + ' phút');
    const s = D.staff.find(x => x.username === uname && x.active);
    const ok = s && await AuthLocal.verify(String(body?.password || ''), s.pw);
    if (!ok) { loginFail(uname); throw err(401, 'Sai tên đăng nhập app hoặc mật khẩu đăng nhập app'); }
    loginOk(uname);
    addLog(s.name, 'Đăng nhập');
    saveD();
    // Máy nhân viên (liên kết QR) không ghi được bản ghi tài khoản lên kho → không buộc đổi mật khẩu ở máy này (chủ quán cấp mật khẩu ở máy chủ quán)
    const mustChange = !!s.must_change && !(typeof Cloud !== 'undefined' && Cloud.role === 'staff');
    const pv = pwVer(s);
    return { token: 'local.' + btoa(JSON.stringify({ sub: s.id, pv })) + '.x',
             staff: { id: s.id, name: s.name, role: s.role, perms: s.perms, mustChange, pv } };
  }
  if (M('POST', 'auth', 'logout')) { if (ME) addLog(who(), 'Đăng xuất'); saveD(); return { ok: true }; }
  if (M('POST', 'auth', 'password')) {
    if (typeof Cloud !== 'undefined' && Cloud.role === 'staff') throw err(403, 'Máy nhân viên không tự đổi được mật khẩu đăng nhập app — nhờ chủ quán cấp lại ở máy chủ quán');
    const s = D.staff.find(x => x.id === whoId());
    if (!s) throw err(401, 'Chưa đăng nhập');
    if (!(await AuthLocal.verify(String(body?.oldPassword || ''), s.pw))) throw err(400, 'Mật khẩu hiện tại không đúng');
    const np = String(body?.newPassword || '');
    if (np.length < 6) throw err(400, 'Mật khẩu mới tối thiểu 6 ký tự');
    s.pw = await AuthLocal.hash(np); s.must_change = 0;
    // Phiên hiện tại của chính người đổi nhận mật khẩu mới làm mốc: app sẽ tự đăng xuất ngay sau đó, không để refresh() kịp đá "oan" bằng thông báo thu hồi.
    // Phiên ở MÁY KHÁC của cùng tài khoản vẫn giữ mốc cũ → bị thu hồi ở lần làm mới kế tiếp.
    if (typeof ME !== 'undefined' && ME && ME.id === s.id) ME.pv = pwVer(s);
    addLog(s.name, 'Đổi mật khẩu'); saveD();
    return { ok: true };
  }

  /* --- snapshot --- */
  if (M('GET', 'snapshot')) {
    const snapOrders = D.orders.filter(o => o.status === 'open' || o.created_at > nowMs() - 86400000);
    const snapOrderIds = new Set(snapOrders.map(o => o.id));
    return {
      serverTime: nowMs(), restaurant: D.restaurant, settings: D.settings,
      areas: D.areas, tables: D.tables.filter(t => t.active), seats: D.seats,
      categories: D.categories, kitchens: D.kitchens,
      menu: D.menu.filter(m => m.active), recipes: D.recipes, ingredients: D.ingredients,
      promos: D.promos, staff: D.staff, reservations: D.reservations,
      orders: snapOrders,
      orderItems: D.orderItems.filter(i => snapOrderIds.has(i.order_id)),
      payments: D.payments.filter((p, i) => i < 200 || (p.paid_at || p.created_at) >= startOfTodayMs()), stockMoves: D.stockMoves.slice(0, 200), logs: D.logs.slice(0, 200)
    };
  }

  /* --- số liệu báo cáo theo khoảng ngày (tính từ TOÀN BỘ dữ liệu, không phụ thuộc bản chụp bị cắt) --- */
  if (M('GET', 'report-range')) {
    const from = Number(q.from), to = Number(q.to);
    // Dựng bảng tra (id → bản ghi) MỘT lần: tra bằng .find() cho từng hoá đơn là O(đơn × hoá đơn) — 30 ngày với hàng chục nghìn đơn mất cả phút
    const ordMap = new Map(D.orders.map(o => [o.id, o]));
    const tblMap = new Map(D.tables.map(t => [t.id, t]));
    const staffMap = new Map(D.staff.map(s => [s.id, s.name]));
    const payments = D.payments.filter(p => p.state === 'paid' && (p.paid_at || p.created_at) >= from && (p.paid_at || p.created_at) < to).map(p => {
      const o = ordMap.get(p.order_id);
      const t = o && tblMap.get(o.table_id);
      return { id: p.id, orderId: o ? o.code : p.order_id, total: p.total, method: p.method, ts: p.paid_at || p.created_at,
               by: staffMap.get(p.staff_id) || '—', label: t ? t.name + ' · Ghế ' + o.seat_no : 'Giao hàng' };
    });
    const top = {};
    const inRange = new Set(D.orders.filter(o => o.created_at >= from && o.created_at < to).map(o => o.id));
    D.orderItems.forEach(i => { if (inRange.has(i.order_id) && i.status !== 'cancelled') top[i.name_snapshot] = (top[i.name_snapshot] || 0) + i.qty; });
    return { payments, top };
  }

  /* --- bàn & khu vực --- */
  if (M('POST', 'areas')) {
    const name = String(body?.name || '').trim();
    if (!name) throw err(400, 'Nhập tên khu vực');
    if (D.areas.some(a => a.name.toLowerCase() === name.toLowerCase())) throw err(409, 'Khu vực đã tồn tại');
    D.areas.push({ id: 'a' + rid(), name, sort: D.areas.length });
    addLog(who(), 'Thêm khu vực', name); saveD(); return { ok: true };
  }
  if (M('POST', 'tables')) {
    const n = Number(body?.seats);
    if (!body?.name) throw err(400, 'Thiếu tên bàn');
    if (!Number.isInteger(n) || n < 1 || n > 8) throw err(400, 'Số ghế phải từ 1 đến 8');
    if (D.tables.some(t => t.active && t.name.toLowerCase() === body.name.toLowerCase())) throw err(409, 'Tên bàn đã tồn tại');
    const id = 't' + rid();
    const layout = VALID_TABLE_LAYOUTS.includes(body.layout) ? body.layout : 'auto';
    D.tables.push({ id, name: body.name, area_id: body.areaId, seats: n, layout, active: 1, updated_at: nowMs() });
    for (let i = 1; i <= n; i++) D.seats.push({ table_id: id, seat_no: i, qr_token: tok(), locked: 0, calling: 0, bound_order_id: null, updated_at: nowMs() });
    addLog(who(), 'Tạo bàn', `${body.name} · ${n} ghế`); saveD(); return { id };
  }
  if (M('PATCH', 'tables', '*')) {
    const t = D.tables.find(x => x.id === seg[1]);
    if (!t) throw err(404, 'Không tìm thấy bàn');
    const n = body?.seats === undefined ? t.seats : Number(body.seats);
    if (!Number.isInteger(n) || n < 1 || n > 8) throw err(400, 'Số ghế phải từ 1 đến 8');
    if (body?.name !== undefined) {
      const nm = String(body.name).trim();
      if (!nm) throw err(400, 'Thiếu tên bàn');
      if (D.tables.some(x => x.id !== t.id && x.active && x.name.toLowerCase() === nm.toLowerCase())) throw err(409, 'Tên bàn đã tồn tại');
      body.name = nm;
    }
    const busy = Math.max(0, ...D.orders.filter(o => o.table_id === t.id && o.status === 'open').map(o => o.seat_no || 0));
    if (busy && n < busy) throw err(409, `Ghế ${busy} đang có khách`);
    const layout = body.layout === undefined ? t.layout : (VALID_TABLE_LAYOUTS.includes(body.layout) ? body.layout : 'auto');
    const tBefore = snapOf(t, ['name', 'area_id', 'seats', 'layout']);
    Object.assign(t, { name: body.name ?? t.name, area_id: body.areaId ?? t.area_id, seats: n, layout, updated_at: nowMs() });
    for (let i = 1; i <= n; i++) if (!D.seats.some(s => s.table_id === t.id && s.seat_no === i))
      D.seats.push({ table_id: t.id, seat_no: i, qr_token: tok(), locked: 0, calling: 0, bound_order_id: null, updated_at: nowMs() });
    D.seats = D.seats.filter(s => s.table_id !== t.id || s.seat_no <= n);
    const areaName = id => (D.areas.find(a => a.id === id) || {}).name || id;
    diffLog('Sửa bàn', tBefore.name, tBefore, snapOf(t, ['name', 'area_id', 'seats', 'layout']), { name: ['Tên bàn'], area_id: ['Khu vực', areaName], seats: ['Số ghế'], layout: ['Bố trí ghế'] });
    saveD(); return { ok: true };
  }
  if (M('DELETE', 'tables', '*')) {
    if (D.orders.some(o => o.table_id === seg[1] && o.status === 'open')) throw err(409, 'Bàn đang có khách');
    const t = D.tables.find(x => x.id === seg[1]); if (t) t.active = 0;
    // khoá + đổi mã QR mọi ghế: tem cũ dán ở bàn đã xoá không còn gọi món được nữa
    D.seats.filter(s => s.table_id === seg[1]).forEach(s => { s.locked = 1; s.calling = 0; s.qr_token = tok(); s.bound_order_id = null; s.updated_at = nowMs(); });
    addLog(who(), 'Xoá bàn', t?.name); saveD(); return { ok: true };
  }

  /* --- ghế --- */
  if (M('POST', 'seats', 'bulk-lock')) {
    (body?.seats || []).forEach(x => {
      const s = D.seats.find(v => v.table_id === x.tableId && v.seat_no === Number(x.seatNo));
      if (s) { s.locked = body.locked ? 1 : 0; s.updated_at = nowMs(); }
    });
    addLog(who(), body?.locked ? 'Khoá QR' : 'Mở khoá QR', (body?.seats || []).map(x => placeOf(x.tableId, Number(x.seatNo))).join(', '));
    saveD(); return { ok: true };
  }
  if (M('POST', 'seats', 'bulk-clear')) {
    const busy = [];
    (body?.seats || []).forEach(x => {
      if (openOrderD(x.tableId, x.seatNo)) { busy.push(x); return; }
      const s = D.seats.find(v => v.table_id === x.tableId && v.seat_no === Number(x.seatNo));
      if (s) { s.locked = 0; s.calling = 0; s.bound_order_id = null; s.updated_at = nowMs(); }
    });
    addLog(who(), 'Dọn bàn, mở lại QR', (body?.seats || []).filter(x => !busy.includes(x)).map(x => placeOf(x.tableId, Number(x.seatNo))).join(', ') + (busy.length ? ` (chưa dọn được vì còn đơn: ${busy.map(x => placeOf(x.tableId, Number(x.seatNo))).join(', ')})` : ''));
    saveD(); return { ok: true, cleared: (body?.seats || []).length - busy.length, busy };
  }
  if (M('POST', 'seats', '*', '*', 'clear-call')) {
    const s = D.seats.find(v => v.table_id === seg[1] && v.seat_no === Number(seg[2]));
    if (s) { s.calling = 0; s.updated_at = nowMs(); }
    saveD(); return { ok: true };
  }
  if (M('POST', 'seats', '*', '*', 'lock')) {
    const s = D.seats.find(v => v.table_id === seg[1] && v.seat_no === Number(seg[2]));
    if (s) { s.locked = body?.locked ? 1 : 0; s.updated_at = nowMs(); }
    saveD(); return { ok: true };
  }
  if (M('POST', 'seats', '*', '*', 'rotate')) {
    const s = D.seats.find(v => v.table_id === seg[1] && v.seat_no === Number(seg[2]));
    if (s) { s.qr_token = tok(); s.updated_at = nowMs(); }
    addLog(who(), 'Đổi mã QR ghế', placeOf(seg[1], Number(seg[2])) + ' — mã cũ hết hiệu lực'); saveD(); return { qrToken: s?.qr_token };
  }

  /* --- đơn hàng --- */
  if (M('POST', 'orders', 'items')) {
    const { tableId, seatNo, lines } = body || {};
    if (!lines?.length) throw err(400, 'Chưa chọn món');
    // Ghế phải có thật trong bàn — nếu không, đơn sẽ mồ côi và không màn nào hiển thị
    if (tableId && !D.seats.some(s => s.table_id === tableId && s.seat_no === Number(seatNo))) {
      throw err(400, 'Ghế không tồn tại trong bàn này');
    }
    // Kiểm tra MỌI dòng trước khi đụng tới dữ liệu — lỗi ở dòng sau không để lại đơn rỗng / món đã trừ kho
    for (const ln of lines) {
      const m = D.menu.find(x => x.id === ln.menuItemId && x.active);
      if (!m) throw err(400, 'Món không tồn tại');
      if (m.stock_state === 'out') throw err(409, `${m.name} đã hết hàng`);
      const q0 = ln.qty == null ? 1 : Number(ln.qty);
      if (!Number.isInteger(q0) || q0 < 1 || q0 > 999) throw err(400, 'Số lượng phải là số nguyên từ 1 đến 999');
    }
    let o = tableId ? openOrderD(tableId, seatNo) : null;
    const isNew = !o;
    if (!o) {
      const id = 'o' + rid();
      o = { id, code: nextOrderCode(), table_id: tableId, seat_no: Number(seatNo), source: 'staff',
        status: 'open', merged_into: null, customer_name: '', customer_phone: '', promo_id: null,
        created_at: nowMs(), updated_at: nowMs() };
      D.orders.push(o);
      const s = D.seats.find(v => v.table_id === tableId && v.seat_no === Number(seatNo));
      if (s) s.bound_order_id = id;
    }
    const batch = Math.max(0, ...D.orderItems.filter(i => i.order_id === o.id).map(i => i.batch)) + 1;
    const added = [];
    for (const ln of lines) {
      const m = D.menu.find(x => x.id === ln.menuItemId && x.active);
      if (!m) throw err(400, 'Món không tồn tại');
      if (m.stock_state === 'out') throw err(409, `${m.name} đã hết hàng`);
      const qty = ln.qty == null ? 1 : Number(ln.qty);
      D.orderItems.push({ id: 'it' + rid(), order_id: o.id, menu_item_id: m.id, name_snapshot: m.name,
        price_snapshot: m.price, kitchen_id: m.kitchen_id, qty, note: ln.note || '',
        status: 'queued',
        batch, origin_table: tableId || null, origin_seat: tableId ? Number(seatNo) : null,
        created_at: nowMs(), updated_at: nowMs() });
      consume(m.id, qty, o.id);
      added.push(m.name + ' ×' + qty + (ln.note ? ' (' + ln.note + ')' : ''));
    }
    o.updated_at = nowMs();
    addLog(who(), 'Gửi món', `${orderPlace(o)} · đơn ${o.code}${isNew ? ' (mới)' : ''} · đợt ${batch}: ${added.join(', ')}`);
    saveD(); return orderFull(o.id);
  }
  if (M('PATCH', 'order-items', '*')) {
    const it = D.orderItems.find(i => i.id === seg[1]);
    if (!it) throw err(404, 'Không tìm thấy món');
    if (it.status === 'cancelled') throw err(409, 'Món này đã bị xoá khỏi đơn, không sửa được nữa');
    const ordP = D.orders.find(x => x.id === it.order_id);
    if (ordP && ordP.status !== 'open') throw err(409, 'Đơn đã đóng, không sửa món được nữa');
    if (body?.status && !['pending', 'queued', 'cooking', 'ready', 'served'].includes(body.status)) throw err(400, 'Trạng thái món không hợp lệ');
    const itBefore = snapOf(it, ['qty', 'note', 'status']);
    if (body?.qty !== undefined) {
      const n = Number(body.qty);
      if (!Number.isInteger(n) || n < 1 || n > 999) throw err(400, 'Số lượng phải là số nguyên từ 1 đến 999');
      if (n !== it.qty) {
        // Chỉ chặn giảm khi món ĐÃ VÀO BẾP; món chờ xác nhận (pending) hay chờ bếp (queued) vẫn giảm được
        if (['cooking', 'ready', 'served'].includes(it.status) && n < it.qty) throw err(409, 'Món đã vào bếp, không giảm được');
        consume(it.menu_item_id, n - it.qty, it.order_id);
        it.qty = n;
      }
    }
    if (body?.status) it.status = body.status;
    if (body?.note !== undefined) it.note = body.note;
    it.updated_at = nowMs();
    diffLog('Sửa món trong đơn', it.name_snapshot + ' — ' + itemPlace(it), itBefore, snapOf(it, ['qty', 'note', 'status']), { qty: ['Số lượng'], note: ['Ghi chú'], status: ['Trạng thái', s => STATUS_VI[s] || s] });
    saveD(); return orderFull(it.order_id);
  }
  if (M('DELETE', 'order-items', '*')) {
    const it = D.orderItems.find(i => i.id === seg[1]);
    if (!it) throw err(404, 'Không tìm thấy món');
    if (it.status === 'cancelled') throw err(409, 'Món này đã được xoá khỏi đơn rồi');
    const ordOf = D.orders.find(x => x.id === it.order_id);
    if (ordOf && ordOf.status !== 'open') throw err(409, 'Đơn đã đóng, không xoá món được nữa');
    consume(it.menu_item_id, -it.qty, it.order_id);
    const prevSt = it.status;
    it.status = 'cancelled'; it.updated_at = nowMs();
    addLog(who(), 'Xoá món khỏi đơn', `${itemTxt(it)} — ${itemPlace(it)} (trạng thái trước khi xoá: ${STATUS_VI[prevSt] || prevSt})`);
    const left = D.orderItems.filter(i => i.order_id === it.order_id && i.status !== 'cancelled').length;
    if (!left) { const o = D.orders.find(x => x.id === it.order_id); if (o) o.status = 'void';
      D.seats.filter(s => s.bound_order_id === it.order_id).forEach(s => s.bound_order_id = null); }
    saveD(); return orderFull(it.order_id);
  }
  if (M('POST', 'orders', 'merge')) {
    // Khử trùng: nhiều ghế cùng thuộc một hoá đơn gộp sẽ cho cùng một id — không được tự gộp đơn vào chính nó.
    const orders = [...new Set(body?.orderIds || [])].map(id => D.orders.find(o => o.id === id && o.status === 'open')).filter(Boolean);
    if (orders.length < 2) throw err(409, 'Cần ít nhất 2 đơn đang mở');
    orders.sort((a, b) => a.created_at - b.created_at);
    const main = orders[0];
    orders.slice(1).forEach(o => {
      D.orderItems.filter(i => i.order_id === o.id).forEach(i => { i.order_id = main.id; i.updated_at = nowMs(); });
      if (!main.promo_id && o.promo_id) main.promo_id = o.promo_id;
      o.status = 'merged'; o.merged_into = main.id; o.updated_at = nowMs();
      const s = D.seats.find(v => v.table_id === o.table_id && v.seat_no === o.seat_no);
      if (s) s.bound_order_id = main.id;
      D.seats.filter(v => v.bound_order_id === o.id).forEach(v => v.bound_order_id = main.id);
    });
    const ms = D.seats.find(v => v.table_id === main.table_id && v.seat_no === main.seat_no);
    if (ms) ms.bound_order_id = main.id;
    addLog(who(), 'Ghép đơn', `Gộp vào đơn ${main.code} (${orderPlace(main)}) từ: ${orders.slice(1).map(o => o.code + ' ' + orderPlace(o)).join(', ')} — ${seatsOfOrderD(main.id).length} ghế dùng chung`);
    saveD(); return orderFull(main.id);
  }
  if (M('POST', 'orders', '*', 'split')) {
    const main = D.orders.find(o => o.id === seg[1] && o.status === 'open');
    if (!main) throw err(404, 'Đơn không còn mở');
    const { tableId, seatNo } = body || {};
    if (main.table_id === tableId && main.seat_no === Number(seatNo)) throw err(409, 'Không tách được ghế gốc của đơn');
    const items = D.orderItems.filter(i => i.order_id === main.id && i.origin_table === tableId
      && i.origin_seat === Number(seatNo) && i.status !== 'cancelled');
    if (!items.length) throw err(409, 'Ghế này chưa gọi món nào trong đơn');
    const id = 'o' + rid();
    D.orders.push({ id, code: nextOrderCode(), table_id: tableId, seat_no: Number(seatNo),
      source: main.source, status: 'open', merged_into: null, customer_name: '', customer_phone: '',
      promo_id: null, created_at: nowMs(), updated_at: nowMs() });
    items.forEach(i => { i.order_id = id; i.updated_at = nowMs(); });
    const s = D.seats.find(v => v.table_id === tableId && v.seat_no === Number(seatNo));
    if (s) s.bound_order_id = id;
    addLog(who(), 'Tách ghế khỏi đơn ghép', `${placeOf(tableId, Number(seatNo))} tách khỏi đơn ${main.code} (${orderPlace(main)}) → đơn mới: ${items.map(itemTxt).join(', ')}`);
    saveD(); return orderFull(id);
  }
  if (M('POST', 'orders', '*', 'approve')) {
    const o = D.orders.find(x => x.id === seg[1] && x.status === 'open');
    if (!o) throw err(404, 'Đơn không còn mở');
    const list = D.orderItems.filter(i => i.order_id === o.id && i.status === 'pending');
    if (!list.length) throw err(409, 'Đơn không có món nào chờ xác nhận');
    list.forEach(i => { i.status = 'queued'; i.updated_at = nowMs(); });
    addLog(who(), 'Xác nhận đơn khách', `${orderPlace(o)} · đơn ${o.code}: ${list.map(itemTxt).join(', ')} → xuống bếp`);
    saveD(); return orderFull(o.id);
  }
  if (M('POST', 'orders', '*', 'reject')) {
    const o = D.orders.find(x => x.id === seg[1] && x.status === 'open');
    if (!o) throw err(404, 'Đơn không còn mở');
    const list = D.orderItems.filter(i => i.order_id === o.id && i.status === 'pending');
    if (!list.length) throw err(409, 'Đơn không có món nào chờ xác nhận');
    list.forEach(i => { consume(i.menu_item_id, -i.qty, o.id); i.status = 'cancelled'; i.updated_at = nowMs(); });
    const left = D.orderItems.filter(i => i.order_id === o.id && i.status !== 'cancelled').length;
    if (!left) { o.status = 'void'; D.seats.filter(s => s.bound_order_id === o.id).forEach(s => s.bound_order_id = null); }
    addLog(who(), 'Từ chối đơn khách', `${orderPlace(o)} · đơn ${o.code}: ${list.map(itemTxt).join(', ')}`);
    saveD(); return { ok: true };
  }
  if (M('POST', 'orders', '*', 'transfer')) {
    const o = D.orders.find(x => x.id === seg[1]);
    if (!o) throw err(404, 'Không tìm thấy đơn');
    if (openOrderD(body.tableId, body.seatNo)) throw err(409, 'Ghế đích đang có khách');
    const fromPlace = orderPlace(o);
    D.seats.filter(s => s.bound_order_id === o.id).forEach(s => s.bound_order_id = null);
    o.table_id = body.tableId; o.seat_no = Number(body.seatNo); o.updated_at = nowMs();
    const s = D.seats.find(v => v.table_id === o.table_id && v.seat_no === o.seat_no);
    if (s) s.bound_order_id = o.id;
    addLog(who(), 'Chuyển bàn', `Đơn ${o.code}: ${fromPlace} → ${orderPlace(o)}`); saveD(); return orderFull(o.id);
  }
  /* Chuyển NHIỀU ghế (hoặc cả bàn) cùng lúc: moves = [{ from:{tableId,seatNo}, to:{tableId,seatNo} }].
     Mỗi ghế nguồn phải đang có đơn; ghế đích phải trống (hoặc chính là ghế nguồn khác được chuyển đi trong lượt này). */
  if (M('POST', 'orders', 'move-seats')) {
    const moves = (body?.moves || []).map(m => ({ f: { t: m.from?.tableId, s: Number(m.from?.seatNo) }, to: { t: m.to?.tableId, s: Number(m.to?.seatNo) } }));
    if (!moves.length) throw err(409, 'Chưa chọn ghế nào để chuyển');
    const key = x => x.t + '#' + x.s;
    if (new Set(moves.map(m => key(m.f))).size !== moves.length) throw err(409, 'Có ghế nguồn bị chọn trùng');
    if (new Set(moves.map(m => key(m.to))).size !== moves.length) throw err(409, 'Có ghế đích bị chọn trùng');
    const leaving = new Set(moves.map(m => key(m.f)));
    moves.forEach(m => {
      m.order = openOrderD(m.f.t, m.f.s);
      if (!m.order) throw err(409, 'Ghế nguồn không còn đơn đang mở');
      const tb = D.tables.find(x => x.id === m.to.t && x.active);
      if (!tb || !(m.to.s >= 1 && m.to.s <= tb.seats)) throw err(409, 'Ghế đích không tồn tại');
      if (!leaving.has(key(m.to)) && openOrderD(m.to.t, m.to.s)) throw err(409, 'Ghế đích đang có khách');
      // chốt trước danh sách món cần đổi nơi gọi (tránh đổi hai lần khi chuyền dây chuyền A→B, B→C)
      m.items = D.orderItems.filter(i => i.order_id === m.order.id && i.origin_table === m.f.t && i.origin_seat === m.f.s);
      m.isMain = m.order.table_id === m.f.t && m.order.seat_no === m.f.s;
    });
    // Pha 1: gỡ liên kết ghế nguồn; pha 2: gắn ghế đích
    moves.forEach(m => { const s = D.seats.find(v => v.table_id === m.f.t && v.seat_no === m.f.s); if (s) s.bound_order_id = null; });
    moves.forEach(m => {
      m.items.forEach(i => { i.origin_table = m.to.t; i.origin_seat = m.to.s; i.updated_at = nowMs(); });
      if (m.isMain) { m.order.table_id = m.to.t; m.order.seat_no = m.to.s; }
      m.order.updated_at = nowMs();
      const s = D.seats.find(v => v.table_id === m.to.t && v.seat_no === m.to.s);
      if (s) s.bound_order_id = m.order.id;
    });
    addLog(who(), 'Chuyển chỗ', moves.map(m => `${placeOf(m.f.t, m.f.s)} → ${placeOf(m.to.t, m.to.s)} (đơn ${m.order.code})`).join('; '));
    saveD();
    return { ok: true, orderIds: [...new Set(moves.map(m => m.order.id))] };
  }
  if (M('POST', 'orders', '*', 'promo')) {
    const o = D.orders.find(x => x.id === seg[1] && x.status === 'open');
    if (!o) throw err(404, 'Đơn không còn mở');
    if (body?.promoId) {
      const p = D.promos.find(x => x.id === body.promoId);
      if (!p || !p.active) throw err(409, 'Chương trình không còn hiệu lực');
      if (p.expires_on && p.expires_on < localYmd()) throw err(409, 'Chương trình đã hết hạn');
      if (p.use_limit && (p.used_count || 0) >= p.use_limit && o.promo_id !== p.id) throw err(409, 'Chương trình đã hết lượt dùng');
      const sub = D.orderItems.filter(i => i.order_id === o.id && i.status !== 'cancelled')
        .reduce((s, i) => s + i.qty * i.price_snapshot, 0);
      if (sub < p.min_total) throw err(409, 'Đơn chưa đủ điều kiện tối thiểu');
    }
    const prName = id => id ? ((D.promos.find(x => x.id === id) || {}).name || id) : '';
    const prOld = o.promo_id;
    o.promo_id = body?.promoId || null; o.updated_at = nowMs();
    addLog(who(), body?.promoId ? 'Áp khuyến mãi' : 'Bỏ khuyến mãi', `Đơn ${o.code} · ${orderPlace(o)} — Khuyến mãi: ${showLogVal(prName(prOld))} → ${showLogVal(prName(o.promo_id))}`);
    saveD(); return { ok: true };
  }
  if (M('POST', 'orders', '*', 'payments')) {
    const o = D.orders.find(x => x.id === seg[1] && x.status === 'open');
    if (!o) throw err(404, 'Đơn không còn mở');
    if (D.orderItems.some(i => i.order_id === o.id && !['served', 'cancelled'].includes(i.status)))
      throw err(409, 'Còn món chưa phục vụ xong');
    const { subtotal, discount, total } = totalD(o.id);
    const id = 'pay' + rid();
    // LUÔN tạo ở trạng thái 'pending' rồi mới gọi settleD() để chốt — nếu set sẵn 'paid' ở đây,
    // guard đầu hàm settleD() ("đã paid thì return") sẽ tự chặn chính nó, không cập nhật đơn/ghế/khuyến mãi.
    D.payments.unshift({ id, order_id: o.id, method: body?.method || 'cash', subtotal, discount, total,
      state: 'pending', staff_id: whoId(), created_at: nowMs(), paid_at: null });
    if (body?.method === 'cash') settleD(id);
    saveD();
    const p = D.payments.find(x => x.id === id);
    return { paymentId: id, subtotal, discount, total, state: p.state };
  }
  if (M('POST', 'payments', '*', 'confirm')) { settleD(seg[1]); saveD(); return { ok: true }; }

  if (M('GET', 'orders', 'history')) {
    const limit = Math.min(100, Number(q.limit) || 30);
    const before = Number(q.before) || nowMs() + 1;
    let rows = D.orders.filter(o => o.created_at < before);
    if (q.status) rows = rows.filter(o => o.status === q.status);
    rows = rows.sort((a, b) => b.created_at - a.created_at).slice(0, limit).map(o => {
      const items = D.orderItems.filter(i => i.order_id === o.id && i.status !== 'cancelled');
      const pay = D.payments.find(p => p.order_id === o.id && p.state === 'paid');
      return { ...o, table_name: (D.tables.find(t => t.id === o.table_id) || {}).name,
        subtotal: items.reduce((s, i) => s + i.qty * i.price_snapshot, 0), item_count: items.length,
        paid_total: pay ? pay.total : null, paid_method: pay ? pay.method : null };
    });
    return { rows, nextBefore: rows.length ? rows[rows.length - 1].created_at : null };
  }
  if (M('GET', 'orders', '*', 'detail')) {
    const o = D.orders.find(x => x.id === seg[1]);
    if (!o) throw err(404, 'Không tìm thấy đơn');
    const tt = totalD(o.id);
    // Đơn ĐÃ THANH TOÁN: lấy tạm tính / giảm / thành tiền ĐÃ CHỐT trong bản thanh toán — không tính lại bằng khuyến mãi hiện hành
    // (tắt/sửa khuyến mãi sau đó sẽ làm đổi số tiền đã thu và hoá đơn in lại). Đơn đang mở vẫn tính động.
    const paid = o.status === 'paid' ? D.payments.find(p => p.order_id === o.id && p.state === 'paid') : null;
    const money = paid ? { subtotal: paid.subtotal, discount: paid.discount || 0, total: paid.total } : { subtotal: tt.subtotal, discount: tt.discount, total: tt.total };
    return { ...o, table_name: (D.tables.find(t => t.id === o.table_id) || {}).name,
      items: D.orderItems.filter(i => i.order_id === o.id).sort((a, b) => a.batch - b.batch),
      payments: D.payments.filter(p => p.order_id === o.id),
      seats: seatsOfOrderD(o.id),
      promo: o.promo_id ? D.promos.find(p => p.id === o.promo_id) : null, ...tt, ...money };
  }

  /* --- bếp --- */
  if (M('POST', 'kds', 'items', '*', '*')) {
    const map = { start: 'cooking', ready: 'ready', done: 'served', reset: 'queued' };
    const it = D.orderItems.find(i => i.id === seg[2]);
    if (!it) throw err(404, 'Không tìm thấy món');
    if (it.status === 'cancelled') throw err(409, 'Món này đã bị xoá khỏi đơn');
    if (it.status === 'pending') throw err(409, 'Món đang chờ nhân viên xác nhận, chưa chuyển cho bếp được');
    const ordK = D.orders.find(x => x.id === it.order_id);
    if (ordK && ordK.status !== 'open') throw err(409, 'Đơn đã đóng');
    const stOld = it.status;
    it.status = map[seg[3]] || it.status; it.updated_at = nowMs();
    if (stOld !== it.status) addLog(who(), 'Đổi trạng thái món', `${itemTxt(it)} — ${itemPlace(it)}: ${STATUS_VI[stOld] || stOld} → ${STATUS_VI[it.status] || it.status}`);
    saveD(); return { ok: true };
  }

  /* --- đặt bàn --- */
  if (M('POST', 'reservations')) {
    const { name, tableId, seatNos, startAt, guests, durationMin = 90 } = body || {};
    if (!name || !startAt) throw err(400, 'Thiếu tên khách hoặc giờ đến');
    const nGuests = Number(guests) || 1;
    const seats = Array.isArray(seatNos) ? [...new Set(seatNos.map(Number).filter(n => n > 0))] : [];
    if (tableId) {
      const t = D.tables.find(x => x.id === tableId);
      if (!t) throw err(404, 'Không tìm thấy bàn');
      if (seats.some(n => n > t.seats)) throw err(400, `${t.name} chỉ có ${t.seats} ghế`);
      const held = seats.length || t.seats;
      if (held < nGuests) throw err(409, `Đã chọn ${held} ghế nhưng có ${nGuests} khách — cần chọn thêm ${nGuests - held} ghế`);
      const end = Number(startAt) + durationMin * 60000;
      const clash = D.reservations.find(r => {
        if (r.table_id !== tableId || !['pending', 'confirmed'].includes(r.status)) return false;
        if (!(r.start_at < end && r.start_at + r.duration_min * 60000 > Number(startAt))) return false;
        const rs = r.seat_nos || [];
        // Không chọn ghế = giữ cả bàn, nên đụng mọi lịch khác
        return (!seats.length || !rs.length) || seats.some(n => rs.includes(n));
      });
      if (clash) throw err(409, `Trùng lịch của ${clash.name} lúc ${new Date(clash.start_at).toTimeString().slice(0, 5)}`);
    }
    D.reservations.push({ id: 'r' + rid(), name, phone: body.phone || '', guests: nGuests,
      table_id: tableId || null, seat_nos: seats.length ? seats : null,
      start_at: Number(startAt), duration_min: durationMin, status: 'pending',
      note: body.note || '', created_at: nowMs(), updated_at: nowMs() });
    addLog(who(), 'Tạo lịch đặt bàn', `${name} · ${nGuests} khách${seats.length ? ` · ghế ${seats.join(', ')}` : ''}`);
    saveD(); return { ok: true };
  }
  if (M('PATCH', 'reservations', '*')) {
    const r = D.reservations.find(x => x.id === seg[1]);
    if (!r) throw err(404, 'Không tìm thấy lịch');
    const rsOld = r.status; r.status = body?.status; r.updated_at = nowMs();
    addLog(who(), 'Cập nhật đặt bàn', `${r.name} — Trạng thái: ${showLogVal(rsOld)} → ${showLogVal(r.status)}`); saveD(); return { ok: true };
  }

  /* --- thực đơn, kho, khuyến mãi, nhân viên --- */
  if (M('POST', 'menu')) {
    if (!body?.name?.trim()) throw err(400, 'Nhập tên món');
    if (!(Number(body.price) > 0) || !Number.isFinite(Number(body.price))) throw err(400, 'Giá phải lớn hơn 0');
    if (!body.categoryId) throw err(400, 'Chọn danh mục cho món');
    if (!body.kitchenId) throw err(400, 'Chọn khu bếp cho món');
    if (!D.categories.some(c => c.id === body.categoryId)) throw err(400, 'Danh mục không tồn tại');
    if (!D.kitchens.some(k => k.id === body.kitchenId)) throw err(400, 'Khu bếp không tồn tại');
    D.menu.push({ id: 'm' + rid(), name: body.name.trim(), description: body.description || '',
      emoji: body.emoji || '🍽️', image: body.image || null, price: Math.round(body.price),
      category_id: body.categoryId, kitchen_id: body.kitchenId, stock_state: body.stockState || 'ok',
      active: 1, updated_at: nowMs() });
    addLog(who(), 'Thêm món', body.name); saveD(); return { ok: true };
  }
  if (M('PATCH', 'menu', '*')) {
    const m = D.menu.find(x => x.id === seg[1]);
    if (!m) throw err(404, 'Không tìm thấy món');
    if (body.name !== undefined && !String(body.name).trim()) throw err(400, 'Nhập tên món');
    if (body.price !== undefined && (!(Number(body.price) > 0) || !Number.isFinite(Number(body.price)))) throw err(400, 'Giá phải lớn hơn 0');
    if (body.categoryId !== undefined && !D.categories.some(c => c.id === body.categoryId)) throw err(400, 'Danh mục không tồn tại');
    if (body.kitchenId !== undefined && !D.kitchens.some(k => k.id === body.kitchenId)) throw err(400, 'Khu bếp không tồn tại');
    if (body.name !== undefined) body.name = String(body.name).trim();
    const mBefore = snapOf(m, ['name', 'description', 'emoji', 'image', 'price', 'category_id', 'kitchen_id', 'stock_state']);
    Object.assign(m, { name: body.name ?? m.name, description: body.description ?? m.description,
      emoji: body.emoji ?? m.emoji, image: body.image !== undefined ? body.image : m.image,
      price: body.price !== undefined ? Math.round(body.price) : m.price,
      category_id: body.categoryId ?? m.category_id, kitchen_id: body.kitchenId ?? m.kitchen_id,
      stock_state: body.stockState ?? m.stock_state, updated_at: nowMs() });
    const catName = id => (D.categories.find(c => c.id === id) || {}).name || id, kitName = id => (D.kitchens.find(k => k.id === id) || {}).name || id;
    diffLog('Sửa món', mBefore.name, mBefore, snapOf(m, ['name', 'description', 'emoji', 'image', 'price', 'category_id', 'kitchen_id', 'stock_state']),
      { name: ['Tên'], description: ['Mô tả'], emoji: ['Biểu tượng'], image: ['Ảnh'], price: ['Giá (đ)'], category_id: ['Danh mục', catName], kitchen_id: ['Khu bếp', kitName],
        stock_state: ['Tình trạng', v => ({ ok: 'còn hàng', low: 'sắp hết', out: 'hết hàng' }[v] || v)] });
    saveD(); return { ok: true };
  }
  if (M('DELETE', 'menu', '*')) {
    const m = D.menu.find(x => x.id === seg[1]); if (m) m.active = 0;
    addLog(who(), 'Xoá món', m?.name); saveD(); return { ok: true };
  }
  if (M('PUT', 'menu', '*', 'recipe')) {
    const ingNm = id => (D.ingredients.find(i => i.id === id) || {}).name || id;
    const recTxt = list => list.map(r => ingNm(r.ingredient_id) + ' ' + r.qty_per_serve).join(', ');
    const recBefore = recTxt(D.recipes.filter(r => r.menu_item_id === seg[1]));
    D.recipes = D.recipes.filter(r => r.menu_item_id !== seg[1]);
    (body?.lines || []).forEach(l => { if (Number(l.qtyPerServe) > 0)
      D.recipes.push({ menu_item_id: seg[1], ingredient_id: l.ingredientId, qty_per_serve: Number(l.qtyPerServe) }); });
    const recAfter = recTxt(D.recipes.filter(r => r.menu_item_id === seg[1]));
    addLog(who(), 'Cập nhật công thức', ((D.menu.find(x => x.id === seg[1]) || {}).name || seg[1]) + ' — Công thức: ' + showLogVal(recBefore) + ' → ' + showLogVal(recAfter));
    saveD(); return { ok: true };
  }
  if (M('POST', 'ingredients')) {
    if (!body?.name?.trim()) throw err(400, 'Nhập tên nguyên liệu');
    D.ingredients.push({ id: 'i' + rid(), name: body.name.trim(), unit: body.unit || 'kg',
      qty: Number(body.qty) || 0, qty0: Number(body.qty) || 0, min_qty: Number(body.minQty) || 0, updated_at: nowMs() });
    addLog(who(), 'Thêm nguyên liệu', body.name); saveD(); return { ok: true };
  }
  if (M('PATCH', 'ingredients', '*')) {
    const i = D.ingredients.find(x => x.id === seg[1]);
    if (!i) throw err(404, 'Không tìm thấy nguyên liệu');
    const iBefore = snapOf(i, ['name', 'unit', 'min_qty']);
    Object.assign(i, { name: body.name ?? i.name, unit: body.unit ?? i.unit,
      min_qty: body.minQty !== undefined ? Number(body.minQty) : i.min_qty, updated_at: nowMs() });
    diffLog('Sửa nguyên liệu', iBefore.name, iBefore, snapOf(i, ['name', 'unit', 'min_qty']), { name: ['Tên'], unit: ['Đơn vị'], min_qty: ['Mức tối thiểu'] });
    saveD(); return { ok: true };
  }
  if (M('POST', 'stock', 'moves')) {
    const ing = D.ingredients.find(i => i.id === body?.ingredientId);
    if (!ing) throw err(404, 'Không tìm thấy nguyên liệu');
    const n = Number(body.qty);
    if (!(n > 0)) throw err(400, 'Số lượng phải lớn hơn 0');
    if (body.type === 'out' && n > ing.qty && !body.force)
      throw err(409, 'Vượt tồn kho', { available: ing.qty, needConfirm: true });
    moveStockD(ing.id, body.type, n, body.reason);
    addLog(who(), body.type === 'in' ? 'Nhập kho' : 'Xuất kho', `${n} ${ing.unit} ${ing.name}`);
    saveD(); return { qtyAfter: ing.qty };
  }
  if (M('POST', 'promos')) {
    if (!body?.name?.trim()) throw err(400, 'Nhập tên chương trình');
    const pv = checkPromo({ type: body.type, value: body.value, min_total: numOr(body.minTotal, 0), use_limit: numOr(body.useLimit, 0), expires_on: body.expiresOn || null });
    D.promos.push({ id: 'p' + rid(), name: body.name.trim(), type: body.type, value: pv.value,
      min_total: pv.min_total, use_limit: pv.use_limit, used_count: 0,
      expires_on: pv.expires_on, active: 1, updated_at: nowMs() });
    addLog(who(), 'Tạo khuyến mãi', body.name); saveD(); return { ok: true };
  }
  if (M('PATCH', 'promos', '*')) {
    const p = D.promos.find(x => x.id === seg[1]);
    if (!p) throw err(404, 'Không tìm thấy chương trình');
    if (body.name !== undefined && !String(body.name).trim()) throw err(400, 'Nhập tên chương trình');
    // Kiểm tra trên giá trị SAU KHI sửa (đổi loại sang % mà giữ nguyên số tiền 50.000 cũng phải bị chặn)
    const only = new Set();
    if (body.type !== undefined || body.value !== undefined) { only.add('type'); only.add('value'); }
    if (body.minTotal !== undefined) only.add('min_total');
    if (body.useLimit !== undefined) only.add('use_limit');
    if (body.expiresOn !== undefined) only.add('expires_on');
    const pv = checkPromo({ type: body.type ?? p.type, value: body.value !== undefined ? body.value : p.value,
      min_total: body.minTotal !== undefined ? numOr(body.minTotal, 0) : p.min_total,
      use_limit: body.useLimit !== undefined ? numOr(body.useLimit, 0) : p.use_limit,
      expires_on: body.expiresOn !== undefined ? (body.expiresOn || null) : p.expires_on }, only);
    const pBefore = snapOf(p, ['name', 'type', 'value', 'min_total', 'use_limit', 'expires_on', 'active']);
    Object.assign(p, { name: body.name ?? p.name, type: body.type ?? p.type,
      value: pv.value, min_total: pv.min_total, use_limit: pv.use_limit, expires_on: pv.expires_on,
      active: body.active !== undefined ? (body.active ? 1 : 0) : p.active, updated_at: nowMs() });
    diffLog('Sửa khuyến mãi', pBefore.name, pBefore, snapOf(p, ['name', 'type', 'value', 'min_total', 'use_limit', 'expires_on', 'active']),
      { name: ['Tên'], type: ['Loại', v => ({ pct: 'giảm %', amt: 'giảm tiền' }[v] || v)], value: ['Giá trị giảm'], min_total: ['Đơn tối thiểu'], use_limit: ['Giới hạn lượt dùng'], expires_on: ['Hết hạn'], active: ['Đang áp dụng', v => !!v] });
    saveD(); return { ok: true };
  }
  if (M('POST', 'staff')) {
    if (!body?.name?.trim() || !body?.username?.trim()) throw err(400, 'Nhập tên và tên đăng nhập');
    const role = body.role || 'Phục vụ';
    if (role === 'Chủ quán') throw err(403, 'Không thể tạo thêm tài khoản Chủ quán');
    if (!STAFF_ASSIGNABLE_ROLES.includes(role)) throw err(400, 'Vai trò không hợp lệ');
    if (D.staff.some(s => s.username === body.username.trim())) throw err(409, 'Tên đăng nhập đã tồn tại');
    let preset = { ...STAFF_PRESETS[role] };
    let trimmedPerms = [];
    if (actorIsNotOwner()) {     // người không phải Chủ quán không tạo được tài khoản có quyền vượt quyền của chính mình: quyền mẫu chỉ giữ phần giao với quyền của người tạo
      const mine = ME.perms || {};
      trimmedPerms = Object.keys(preset).filter(k => !mine[k]);       // quyền mẫu bị bỏ — trả về để giao diện báo, không cắt âm thầm
      preset = Object.fromEntries(Object.keys(preset).filter(k => mine[k]).map(k => [k, 1]));
    }
    const temp = AuthLocal.tempPassword();
    D.staff.push({ id: 's' + rid(), name: body.name.trim(), role,
      username: body.username.trim(), perms: preset, active: 1, pw: await AuthLocal.hash(temp), must_change: 1 });
    addLog(who(), 'Tạo tài khoản', body.name); saveD();
    return { ok: true, tempPassword: temp, trimmedPerms };
  }
  if (M('PATCH', 'staff', '*')) {
    const s = D.staff.find(x => x.id === seg[1]);
    if (!s) throw err(404, 'Không tìm thấy nhân viên');
    if (s.role === 'Chủ quán' && whoId() && s.id !== whoId()) throw err(403, 'Không thể sửa tài khoản chủ quán');
    // Không cho khoá tài khoản Chủ quán qua API này dưới bất kỳ hình thức nào — kể cả tự khoá chính mình —
    // vì đây là tài khoản duy nhất không ai khác mở lại được.
    if (s.role === 'Chủ quán' && body.active === false) throw err(403, 'Không thể tự khoá tài khoản chủ quán');
    if (staffOutranks(s)) throw err(403, OUTRANK_MSG);
    const sBefore = { name: s.name, active: s.active, perms: Object.keys(s.perms || {}).filter(k => s.perms[k]).sort().join(', ') };
    if (body.perms && actorIsNotOwner()) {
      // Người không phải Chủ quán không được tự nâng quyền: không sửa quyền của chính mình, không cấp thêm quyền mà mình chưa có.
      // Chỉ xét quyền MỚI ĐƯỢC THÊM (bật trong body.perms mà tài khoản đang tắt): giao diện gửi cả bản đồ quyền {...quyền cũ, [k]: bật/tắt},
      // nếu xét cả bản đồ thì sửa quyền người khác bị chặn oan chỉ vì họ đã có sẵn quyền mà mình không có.
      if (s.id === whoId()) throw err(403, 'Không tự đổi quyền của chính mình — nhờ chủ quán');
      const over = Object.keys(body.perms).filter(k => body.perms[k] && !canGrantPerm(s, k));
      if (over.length) throw err(403, 'Không thể cấp quyền mà bạn chưa có');
    }
    if (body.perms) s.perms = body.perms;
    if (body.active !== undefined) s.active = body.active ? 1 : 0;
    if (body.name) s.name = body.name;
    diffLog('Sửa nhân viên', sBefore.name, sBefore, { name: s.name, active: s.active, perms: Object.keys(s.perms || {}).filter(k => s.perms[k]).sort().join(', ') },
      { name: ['Họ tên'], active: ['Tài khoản hoạt động', v => !!v], perms: ['Quyền'] });
    saveD(); return { ok: true };
  }
  if (M('POST', 'staff', '*', 'reset-password')) {
    const st = D.staff.find(x => x.id === seg[1]);
    if (!st) throw err(404, 'Không tìm thấy nhân viên');
    if (st.role === 'Chủ quán' && whoId() !== st.id) throw err(403, 'Không thể cấp lại mật khẩu của tài khoản chủ quán');
    if (staffOutranks(st)) throw err(403, OUTRANK_MSG);
    const temp = AuthLocal.tempPassword();
    st.pw = await AuthLocal.hash(temp); st.must_change = 1;
    // Mật khẩu mới = muối mới → phiên đang mở của tài khoản này (ở máy khác) bị thu hồi ở lần làm mới kế tiếp (core.js refresh). Người tự cấp lại cho chính mình giữ phiên hiện tại.
    if (typeof ME !== 'undefined' && ME && ME.id === st.id) ME.pv = pwVer(st);
    addLog(who(), 'Cấp lại mật khẩu', st.name); saveD(); return { tempPassword: temp };
  }
  if (M('DELETE', 'staff', '*')) {
    const s = D.staff.find(x => x.id === seg[1]);
    if (!s) throw err(404, 'Không tìm thấy nhân viên');
    if (s.role === 'Chủ quán') throw err(403, 'Không thể xoá tài khoản chủ quán');
    if (staffOutranks(s)) throw err(403, OUTRANK_MSG);
    if (s.active) throw err(409, 'Chỉ xoá được tài khoản đang khoá — khoá tài khoản này trước');
    D.staff = D.staff.filter(x => x.id !== s.id);
    addLog(who(), 'Xoá tài khoản nhân viên', s.name); saveD();
    return { ok: true };
  }

  /* --- danh mục món --- */
  if (M('POST', 'categories')) {
    const name = body?.name?.trim();
    if (!name) throw err(400, 'Nhập tên danh mục');
    if (D.categories.some(c => c.name === name)) throw err(409, 'Tên danh mục đã tồn tại');
    const sort = D.categories.length ? Math.max(...D.categories.map(c => c.sort || 0)) + 1 : 0;
    const c = { id: 'c' + rid(), name, sort };
    D.categories.push(c);
    addLog(who(), 'Thêm danh mục', name); saveD();
    return { ok: true, id: c.id };
  }
  if (M('PATCH', 'categories', '*')) {
    const c = D.categories.find(x => x.id === seg[1]);
    if (!c) throw err(404, 'Không tìm thấy danh mục');
    if (body?.name !== undefined) {
      const name = body.name.trim();
      if (!name) throw err(400, 'Tên không được để trống');
      if (D.categories.some(x => x.id !== c.id && x.name === name)) throw err(409, 'Tên danh mục đã tồn tại');
      const old = c.name; c.name = name;
      if (old !== name) addLog(who(), 'Sửa danh mục', 'Tên: ' + showLogVal(old) + ' → ' + showLogVal(name));
    }
    saveD();
    return { ok: true };
  }
  if (M('DELETE', 'categories', '*')) {
    const c = D.categories.find(x => x.id === seg[1]);
    if (!c) throw err(404, 'Không tìm thấy danh mục');
    if (D.menu.some(m => m.category_id === c.id && m.active)) {
      throw err(409, 'Còn món đang dùng danh mục này — chuyển món sang danh mục khác trước khi xoá');
    }
    D.categories = D.categories.filter(x => x.id !== c.id);
    addLog(who(), 'Xoá danh mục', c.name); saveD();
    return { ok: true };
  }

  /* --- khu bếp --- */
  if (M('POST', 'kitchens')) {
    const name = body?.name?.trim();
    if (!name) throw err(400, 'Nhập tên khu bếp');
    if (D.kitchens.some(k => k.name === name)) throw err(409, 'Tên khu bếp đã tồn tại');
    const k = { id: 'k' + rid(), name };
    D.kitchens.push(k);
    addLog(who(), 'Thêm khu bếp', name); saveD();
    return { ok: true, id: k.id };
  }
  if (M('PATCH', 'kitchens', '*')) {
    const k = D.kitchens.find(x => x.id === seg[1]);
    if (!k) throw err(404, 'Không tìm thấy khu bếp');
    if (body?.name !== undefined) {
      const name = body.name.trim();
      if (!name) throw err(400, 'Tên không được để trống');
      if (D.kitchens.some(x => x.id !== k.id && x.name === name)) throw err(409, 'Tên khu bếp đã tồn tại');
      const old = k.name; k.name = name;
      if (old !== name) addLog(who(), 'Sửa khu bếp', 'Tên: ' + showLogVal(old) + ' → ' + showLogVal(name));
    }
    saveD();
    return { ok: true };
  }
  if (M('DELETE', 'kitchens', '*')) {
    const k = D.kitchens.find(x => x.id === seg[1]);
    if (!k) throw err(404, 'Không tìm thấy khu bếp');
    if (D.menu.some(m => m.kitchen_id === k.id && m.active)) {
      throw err(409, 'Còn món đang dùng khu bếp này — chuyển món sang khu bếp khác trước khi xoá');
    }
    D.kitchens = D.kitchens.filter(x => x.id !== k.id);
    addLog(who(), 'Xoá khu bếp', k.name); saveD();
    return { ok: true };
  }

  if (M('PATCH', 'settings')) {
    const before = { ...D.settings };
    Object.assign(D.settings, body || {});
    const f = {}; Object.keys(body || {}).forEach(k => { f[k] = [k]; });
    diffLog('Đổi cài đặt', '', before, D.settings, f);
    saveD(); return D.settings;
  }
  if (M('PATCH', 'restaurant')) {
    if (body?.name !== undefined && !String(body.name).trim()) throw err(400, 'Nhập tên nhà hàng');
    const rBefore = snapOf(D.restaurant, ['name', 'phone', 'address']);
    Object.assign(D.restaurant, { name: body?.name?.trim() ?? D.restaurant.name, phone: body?.phone ?? D.restaurant.phone, address: body?.address ?? D.restaurant.address });
    diffLog('Đổi thông tin nhà hàng', '', rBefore, snapOf(D.restaurant, ['name', 'phone', 'address']), { name: ['Tên nhà hàng'], phone: ['Số điện thoại'], address: ['Địa chỉ'] });
    saveD(); return D.restaurant;
  }

  throw err(404, 'Bản dùng thử chưa có chức năng này');
}

function settleD(paymentId) {
  const p = D.payments.find(x => x.id === paymentId);
  if (!p || p.state === 'paid') return;
  p.state = 'paid'; p.paid_at = nowMs();
  const o = D.orders.find(x => x.id === p.order_id);
  const payPlaces = o ? [...new Set(seatsOfOrderD(o.id).map(st => placeOf(st.table_id, st.seat_no)).concat([orderPlace(o)]))].join(' + ') : '';
  if (o) {
    o.status = 'paid'; o.updated_at = nowMs();
    if (o.promo_id) { const pr = D.promos.find(x => x.id === o.promo_id); if (pr) pr.used_count++; }
    const autoLock = D.settings.autoLock !== false;
    seatsOfOrderD(o.id).forEach(st => {
      const s = D.seats.find(v => v.table_id === st.table_id && v.seat_no === st.seat_no);
      if (s) { s.bound_order_id = null; s.calling = 0; s.locked = autoLock ? 1 : 0; s.updated_at = nowMs(); }
    });
  }
  addLog(who(), 'Thu tiền', `${o ? 'Đơn ' + o.code + ' · ' + payPlaces + ' — ' : ''}${p.total}đ (tạm tính ${p.subtotal}đ, giảm ${p.discount || 0}đ) · ${({ cash: 'tiền mặt', transfer: 'chuyển khoản', vietqr: 'VietQR' }[p.method] || p.method)}`);
}
