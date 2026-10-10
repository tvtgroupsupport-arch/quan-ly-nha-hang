/* ============================================================
   Lõi client — gọi local-engine.js (chạy ngay trên máy, không qua mạng) rồi
   "adapt" dữ liệu thô sang hình dạng màn hình cần. Đồng bộ nhiều máy (nếu đã
   liên kết Supabase của quán) do lớp cloud/ lo riêng, core.js không biết gì
   về mạng.
   ============================================================ */

const TOKEN_KEY = 'senvang_token';
let TOKEN = null;
try { TOKEN = localStorage.getItem(TOKEN_KEY); } catch (e) {}

let DB = emptyDb();
let ME = null;
let WS = null;
let online = false;

function emptyDb() {
  return {
    restaurant: { name: 'Nhà Hàng' }, settings: {},
    areas: [], tables: [], categories: [], kitchens: [], menu: [], inventory: [],
    promos: [], staff: [], reservations: [], orders: [], payments: [], stockMoves: [],
    logs: [], seatsState: {}, gateways: [], session: { user: null }
  };
}

/* ---------- gọi API ----------
   Không gọi lên mạng: nghiệp vụ chạy ngay trên máy (local-engine.js), việc đồng bộ
   với Supabase chạy ngầm ở lớp cloud/ nên giao diện không bao giờ phải chờ mạng. */
async function api(path, opts = {}) {
  online = true;
  try {
    return await apiLocal(path, opts);
  } catch (e) {
    if (e.status === 401) { TOKEN = null; ME = null; route = { name: 'login', params: {} }; render(); }
    throw e;
  }
}

/* ---------- chuyển dữ liệu server sang dạng màn hình đang dùng ---------- */
function adapt(s) {
  const areaName = id => (s.areas.find(a => a.id === id) || {}).name || '';
  const catName  = id => (s.categories.find(c => c.id === id) || {}).name || '';
  const kitName  = id => (s.kitchens.find(k => k.id === id) || {}).name || '';
  const itemsOf  = oid => s.orderItems.filter(i => i.order_id === oid && i.status !== 'cancelled');

  const db = {
    serverTime: s.serverTime,
    restaurant: s.restaurant || { name: 'Nhà Hàng' },
    settings: s.settings || {},
    session: { user: ME ? ME.id : null },
    areas: s.areas.map(a => a.name),
    areaIds: Object.fromEntries(s.areas.map(a => [a.name, a.id])),
    categories: s.categories.map(c => c.name),
    categoryIds: Object.fromEntries(s.categories.map(c => [c.name, c.id])),
    kitchens: s.kitchens.map(k => k.name),
    kitchenIds: Object.fromEntries(s.kitchens.map(k => [k.name, k.id])),
    tables: s.tables.map(t => ({ id: t.id, name: t.name, area: areaName(t.area_id), areaId: t.area_id, seats: t.seats, layout: t.layout || 'auto' })),
    menu: s.menu.map(m => ({
      id: m.id, name: m.name, desc: m.description || '', emoji: m.emoji || '🍽️',
      image: m.image !== undefined ? m.image : (m.image_path || null),
      price: m.price, cat: catName(m.category_id), catId: m.category_id,
      kitchen: kitName(m.kitchen_id), kitchenId: m.kitchen_id, stock: m.stock_state,
      recipe: s.recipes.filter(r => r.menu_item_id === m.id).map(r => ({ ing: r.ingredient_id, qty: r.qty_per_serve }))
    })),
    inventory: s.ingredients.map(i => ({ id: i.id, name: i.name, unit: i.unit, qty: i.qty, min: i.min_qty })),
    promos: s.promos.map(p => ({
      id: p.id, name: p.name, type: p.type, value: p.value, min: p.min_total,
      limit: p.use_limit, used: p.used_count, expire: p.expires_on || '2099-12-31', active: !!p.active
    })),
    staff: s.staff.map(x => ({
      id: x.id, name: x.name, role: x.role, user: x.username, active: !!x.active,
      perms: typeof x.perms === 'string' ? JSON.parse(x.perms || '{}') : (x.perms || {})
    })),
    reservations: s.reservations.map(r => ({
      id: r.id, name: r.name, phone: r.phone, guests: r.guests, tableId: r.table_id,
      time: new Date(r.start_at).toTimeString().slice(0, 5), startAt: r.start_at,
      durationMin: r.duration_min || 90,
      seatNos: r.seat_nos ? (typeof r.seat_nos === 'string' ? JSON.parse(r.seat_nos) : r.seat_nos) : [],
      status: r.status, note: r.note || ''
    })),
    orders: s.orders.map(o => ({
      id: o.id, code: o.code, tableId: o.table_id, seatNo: o.seat_no,
      seatKey: o.table_id ? o.table_id + '#' + o.seat_no : 'delivery#' + o.code,
      status: o.status, source: o.source, promoId: o.promo_id, createdAt: o.created_at,
      customer: { name: o.customer_name || '', phone: o.customer_phone || '' },
      seats: s.seats.filter(st => st.bound_order_id === o.id)
                    .map(st => ({ tableId: st.table_id, seatNo: st.seat_no })),
      items: itemsOf(o.id).map(i => ({
        lid: i.id, mid: i.menu_item_id, name: i.name_snapshot, price: i.price_snapshot,
        qty: i.qty, note: i.note || '', status: i.status, kitchen: kitName(i.kitchen_id),
        emoji: (s.menu.find(m => m.id === i.menu_item_id) || {}).emoji || '🍽️', batch: i.batch,
        originTable: i.origin_table, originSeat: i.origin_seat
      }))
    })),
    payments: s.payments.filter(p => p.state === 'paid').map(p => {
      const o = s.orders.find(x => x.id === p.order_id);
      const t = o && s.tables.find(x => x.id === o.table_id);
      return { id: p.id, orderId: o ? o.code : p.order_id, total: p.total, method: p.method,
               ts: p.paid_at || p.created_at, by: (s.staff.find(x => x.id === p.staff_id) || {}).name || '—',
               label: t ? `${t.name} · Ghế ${o.seat_no}` : 'Giao hàng' };
    }),
    stockMoves: s.stockMoves.map(m => {
      const ing = s.ingredients.find(i => i.id === m.ingredient_id) || {};
      return { id: m.id, ts: m.created_at, name: ing.name || '—', unit: ing.unit || '',
               type: m.type === 'adjust' ? 'out' : m.type, qty: m.qty, after: m.qty_after,
               reason: m.reason || '', by: (s.staff.find(x => x.id === m.staff_id) || {}).name || 'Hệ thống' };
    }),
    logs: s.logs.map(l => ({ id: l.id, ts: l.created_at, who: l.actor, level: l.level,
                             what: l.action + (l.detail ? ' — ' + l.detail : '') })),
    seatsState: {},
    // 'state' phản ánh ĐÃ CẤU HÌNH THẬT hay chưa — không hiện "Thật" giả tạo cho cổng chưa nối.
    gateways: [
      { id: 'vietqr', name: 'VietQR', state: (s.settings?.vietqrBin && s.settings?.vietqrAccount) ? 'live' : 'mock', on: true },
      { id: 'cash', name: 'Tiền mặt', state: 'live', on: true },
      { id: 'payos', name: 'payOS', state: s.settings?.payosConfigured ? 'live' : 'mock', on: false },
      { id: 'momo', name: 'MoMo', state: 'mock', on: false },
      { id: 'zalopay', name: 'ZaloPay', state: 'mock', on: false },
      { id: 'vnpay', name: 'VNPay', state: 'mock', on: false }
    ]
  };
  for (const st of s.seats) {
    db.seatsState[st.table_id + '#' + st.seat_no] =
      { locked: !!st.locked, calling: !!st.calling, qrToken: st.qr_token, boundOrderId: st.bound_order_id };
  }
  return db;
}

async function refresh() {
  const snap = await api('/snapshot');
  DB = adapt(snap);
  DB.session.user = ME ? ME.id : null;
}

/* ---------- Bản thật đẩy thay đổi qua WebSocket.
     Ở bản dùng thử chỉ có một máy nên không cần: mọi thao tác đã gọi refresh() ngay sau đó. */
function connectWs() { online = true; renderConn(); }
let _actx = null;
function audioCtx() {
  if (!_actx) { try { _actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
  if (_actx.state === 'suspended') _actx.resume().catch(() => {});
  return _actx;
}
let _toneCalls = 0;   // chỉ để kiểm thử: đếm số NỐT thực sự được lên lịch (phân biệt kêu 1 lần hay lặp lại)
let _chimeCalls = 0;   // chỉ để kiểm thử: đếm số lần đã GỌI phát chuông, không phụ thuộc có âm thanh thật hay không
const _chimeBuf = {};  // bộ nhớ đệm: mỗi kiểu chuông chỉ vẽ một lần
function _chimeBuffer(ctx, kind) {
  const k = CHIMES[kind] ? kind : 1;
  const key = k + '@' + ctx.sampleRate;
  if (!_chimeBuf[key]) {
    const data = synthChime(k, ctx.sampleRate || 44100);
    const buf = ctx.createBuffer(1, data.length, ctx.sampleRate || 44100);
    buf.getChannelData(0).set(data);
    _chimeBuf[key] = buf;
  }
  return _chimeBuf[key];
}
/** Phát một trong các kiểu âm báo, theo đúng âm lượng cài đặt (0–100, 100 = to nhất app có thể phát).
    repeat=true: lặp lại khoảng 3 giây (dùng khi báo thật — khách gọi nhân viên / vé bếp mới — để
    chắc chắn nhân viên nghe thấy dù đang ồn). repeat=false: chỉ phát một lượt (nghe thử nhanh lúc
    đang chọn kiểu chuông trong Cài đặt, không cần kêu dài). Âm lượng cuối cùng còn phụ thuộc âm lượng
    "đa phương tiện" của điện thoại. */
function playChime(kind, volume, repeat) {
  _chimeCalls++;
  try {
    const ctx = audioCtx(); if (!ctx) return;
    const vol = Math.max(0, Math.min(100, volume == null ? 100 : volume)) / 100;
    const k = CHIMES[kind] ? kind : 1;
    const period = chimePhraseSeconds(k);
    const rounds = repeat ? Math.max(2, Math.ceil(3 / period)) : 1;
    const buf = _chimeBuffer(ctx, k);
    const gain = ctx.createGain(); gain.gain.value = vol; gain.connect(ctx.destination);
    for (let r = 0; r < rounds; r++) {
      _toneCalls += CHIMES[k].length;
      const src = ctx.createBufferSource(); src.buffer = buf; src.connect(gain);
      src.start(ctx.currentTime + r * period);
    }
  } catch (e) {}
}
/** Rung điện thoại (nếu máy có motor rung). Mẫu rung dài, lặp — đủ để cảm nhận được khi để trong túi. */
let _vibrateCalls = 0;
function vibratePhone() {
  _vibrateCalls++;
  try {
    if (typeof NativeBridge !== 'undefined' && NativeBridge.alerts) NativeBridge.alerts.vibrate();
    else if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate([600, 200, 600, 200, 600]);
  } catch (e) {}
}
/** Mỗi máy tự chọn có rung / có nhận thông báo chạy nền hay không (không đồng bộ giữa các máy) */
function devicePref(key, dflt) {
  try { const v = localStorage.getItem('pref_' + key); return v == null ? dflt : v === '1'; } catch (e) { return dflt; }
}
function setDevicePref(key, on) { try { localStorage.setItem('pref_' + key, on ? '1' : '0'); } catch (e) {} }

/** Báo cho nhân viên biết có việc mới: đang mở app → kêu chuông trong app + rung; app đang chạy nền / mở app khác
    → hiện THÔNG BÁO HỆ THỐNG (có chuông và rung riêng của hệ điều hành, hiện đè lên app khác). */
function alertStaff(title, body) {
  const kind = (DB.settings && DB.settings.chime) || 1;
  const vol = DB.settings && DB.settings.soundVolume != null ? DB.settings.soundVolume : 100;
  const hidden = typeof document !== 'undefined' && document.hidden;
  if (hidden && typeof NativeBridge !== 'undefined' && NativeBridge.alerts) {
    NativeBridge.alerts.notify({ title: trText(title), body: trText(body), chime: kind, vibrate: devicePref('vibrate', true) });
    return;
  }
  playChime(kind, vol, true);
  if (devicePref('vibrate', true)) vibratePhone();
}
/** Tên bàn + ghế của ghế VỪA gọi nhân viên (cho nội dung thông báo) */
function newStaffCallLabel(prevSeatsState, nextSeatsState) {
  for (const k in nextSeatsState) {
    if (nextSeatsState[k].calling && !(prevSeatsState[k] && prevSeatsState[k].calling)) {
      const [tid, n] = k.split('#'); const t = tableById(tid);
      return `${t ? t.name : 'Bàn'} · Ghế ${n}`;
    }
  }
  return '';
}
/** Tương thích ngược — vài chỗ cũ còn gọi beep() trực tiếp */
function beep() { playChime(1, 100); }

/** Có ghế nào VỪA chuyển sang trạng thái gọi nhân viên (trước đó chưa gọi) hay không?
    Tách riêng thành hàm thuần (không đụng DOM/Audio) để kiểm thử được dễ dàng. */
function hasNewStaffCall(prevSeatsState, nextSeatsState) {
  for (const k in nextSeatsState) {
    if (nextSeatsState[k].calling && !(prevSeatsState[k] && prevSeatsState[k].calling)) return true;
  }
  return false;
}
/** Có món nào VỪA vào bếp (queued/pending) mà trước đó chưa từng thấy hay không? */
function hasNewKitchenTicket(prevOrders, nextOrders) {
  const prevIds = new Set();
  prevOrders.forEach(o => o.items.forEach(i => prevIds.add(i.lid)));
  for (const o of nextOrders) {
    for (const i of o.items) {
      if ((i.status === 'queued' || i.status === 'pending') && !prevIds.has(i.lid)) return true;
    }
  }
  return false;
}
function renderConn() {
  const el = document.getElementById('conn');
  if (el) el.style.display = 'none';
}

/* ---------- tiện ích dùng chung với bản cũ ---------- */
const fmt = n => (Math.round(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
const uid = p => (p || '') + Math.random().toString(36).slice(2, 8);
const seatKey = (t, s) => t + '#' + s;
/** Đường dẫn khách quét QR gọi món — MỘT trang tĩnh dùng chung cho mọi quán (địa chỉ cố định,
    nướng sẵn lúc build app, xem APP_CONFIG.guestPageUrl). Vì trang không "sống" trong Supabase
    của quán nên mỗi mã QR phải tự mang theo đủ 3 thứ: địa chỉ Supabase của quán, khoá anon
    (khoá công khai — an toàn khi lộ, được chặn bởi RLS chứ không phải nhờ giấu khoá), và mã
    riêng của đúng ghế đó. */
function guestUrl(tableId, seatNo) {
  const base = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.guestPageUrl) || '';
  const tok = DB.seatsState[seatKey(tableId, seatNo)]?.qrToken;
  const storeUrl = (typeof Cloud !== 'undefined' && Cloud.cfg && Cloud.cfg.storeUrl) || '';
  const storeAnon = (typeof Cloud !== 'undefined' && Cloud.cfg && Cloud.cfg.storeAnon) || '';
  if (!base || !tok || !storeUrl || !storeAnon) return null;
  const qs = new URLSearchParams({ store: storeUrl, key: storeAnon, t: tok });
  return base + (base.includes('?') ? '&' : '?') + qs.toString();
}
const now = () => Date.now();
const hhmm = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const elapsed = ts => { const m = Math.floor((now() - ts) / 60000); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const mins = ts => Math.floor((now() - ts) / 60000);
const dstr = ts => new Date(ts).toLocaleDateString('vi-VN') + ' ' + hhmm(ts);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const menuById = id => DB.menu.find(m => m.id === id);
const tableById = id => DB.tables.find(t => t.id === id);
const orderById = id => DB.orders.find(o => o.id === id);
const me = () => ME;
/** Máy nhân viên (liên kết bằng mã QR) không vào được các màn chỉ chủ quán được sửa — khớp với quyền thật trong Postgres */
const STAFF_DEVICE_BLOCKED_SCREENS = ['tablesAdmin', 'promo', 'staff', 'billing'];
const can = p => {
  if (!ME) return false;
  if (typeof Cloud !== 'undefined' && Cloud.role === 'staff' && STAFF_DEVICE_BLOCKED_SCREENS.includes(p)) return false;
  return ME.role === 'Chủ quán' || !!ME.perms[p];
};

/** Đơn đang mở của một ghế — ưu tiên đơn ghép mà ghế đang được gắn vào */
function openOrderFor(tableId, seatNo) {
  const st = DB.seatsState[seatKey(tableId, Number(seatNo))] || {};
  if (st.boundOrderId) {
    const bound = DB.orders.find(o => o.id === st.boundOrderId && o.status === 'open');
    if (bound) return bound;
  }
  return DB.orders.find(o => o.tableId === tableId && o.seatNo === Number(seatNo) && o.status === 'open');
}
/** Đơn này có phải hoá đơn gộp của nhiều ghế không */
function isMerged(o) { return o && o.seats && o.seats.length > 1; }
function orderTotal(o) {
  const sub = o.items.reduce((s, i) => s + i.price * i.qty, 0);
  const p = o.promoId ? DB.promos.find(x => x.id === o.promoId) : null;
  let disc = 0;
  if (p && sub >= p.min) disc = Math.min(sub, p.type === 'pct' ? Math.round(sub * p.value / 100) : p.value);
  return { sub, disc, total: sub - disc, promo: p };
}
function seatStatus(tableId, seatNo) {
  const st = DB.seatsState[seatKey(tableId, seatNo)] || {};
  const o = openOrderFor(tableId, seatNo);
  const hold = activeHold(tableId, seatNo);   // tính trước — cần dùng ở cả hai nhánh dưới đây
  if (o) {
    const allServed = o.items.length > 0 && o.items.every(i => i.status === 'served');
    // Ghế đang có khách NHƯNG cũng đang trong cửa sổ giữ chỗ của một lịch đặt khác —
    // đây là xung đột cần nhân viên biết để thu xếp trước giờ khách đặt tới.
    return { state: allServed ? 'pay' : 'busy', order: o, calling: st.calling, locked: st.locked, conflict: hold || null };
  }
  if (hold) return { state: 'resv', resv: hold, calling: st.calling };
  return { state: 'free', calling: st.calling, locked: st.locked };
}
/** Cửa sổ giữ chỗ: bắt đầu 30 phút trước giờ hẹn, kết thúc khi hết thời lượng đặt.
    Ngoài khoảng đó, ghế vẫn nhận khách bình thường — tránh khoá bàn cả ngày vì một lịch tối. */
const HOLD_BEFORE_MIN = 30;
function activeHold(tableId, seatNo) {
  const t = now();
  return DB.reservations.find(r => {
    if (r.tableId !== tableId) return false;
    if (!['pending', 'confirmed'].includes(r.status)) return false;
    const from = r.startAt - HOLD_BEFORE_MIN * 60000;
    const to = r.startAt + (r.durationMin || 90) * 60000;
    if (t < from || t > to) return false;
    // Lịch có chọn ghế thì chỉ giữ đúng những ghế đó
    if (seatNo != null && r.seatNos && r.seatNos.length) return r.seatNos.includes(Number(seatNo));
    return true;
  });
}
/** Lịch sắp tới của bàn, kể cả khi chưa tới giờ giữ chỗ — dùng để hiển thị thông tin */
function upcomingHold(tableId) {
  const t = now();
  return DB.reservations
    .filter(r => r.tableId === tableId && ['pending', 'confirmed'].includes(r.status) && r.startAt > t - 3600000)
    .sort((a, b) => a.startAt - b.startAt)[0];
}

function tableSummary(t) {
  let busy = 0, pay = 0, calling = false, resv = null, conflicts = [];
  for (let s = 1; s <= t.seats; s++) {
    const st = seatStatus(t.id, s);
    if (st.state === 'busy') busy++;
    if (st.state === 'pay') { busy++; pay++; }
    if (st.calling) calling = true;
    if (st.state === 'resv') resv = st.resv;
    if (st.conflict) conflicts.push({ seat: s, resv: st.conflict });
  }
  const soon = !resv ? upcomingHold(t.id) : null;
  let state = 'free';
  if (pay > 0 && pay === busy) state = 'pay';
  else if (busy > 0) state = 'busy';
  else if (resv) state = 'resv';
  return { state, busy, pay, calling, resv, soon, conflicts };
}
function seatLabel(k) {
  const [tid, sn] = k.split('#'); const t = tableById(tid);
  return (t ? t.name : 'Bàn') + ' · Ghế ' + sn;
}
