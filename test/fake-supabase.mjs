/* Supabase giả cho kiểm thử — mô phỏng ĐÚNG các luật trong supabase/store-setup.sql và central-setup.sql:
   chỉ ghi qua push_records, phân quyền chủ quán/máy nhân viên, mã mời dùng một lần hết hạn 5 phút,
   chỉ mục chặn thanh toán trùng, so mốc updated_at, bia mộ, seq tăng dần, jsonb sắp lại khoá.
   Lưu ý: đây là bản mô phỏng bằng JS để kiểm thử PHÍA APP; nó KHÔNG chứng minh script SQL chạy đúng trên Postgres. */

const STAFF_RW = ['orders', 'orderItems', 'payments', 'stockMoves', 'reservations', 'seats', 'logs'];
const KNOWN = ['areas', 'tables', 'seats', 'categories', 'kitchens', 'menu', 'recipes', 'ingredients', 'promos', 'staff',
  'reservations', 'orders', 'orderItems', 'payments', 'stockMoves', 'logs', 'restaurant', 'settings', 'license'];

/** jsonb lưu khoá theo (độ dài, thứ tự chữ cái) — mô phỏng để bắt lỗi phụ thuộc thứ tự khoá */
function jsonb(v) {
  if (Array.isArray(v)) return v.map(jsonb);
  if (v && typeof v === 'object') {
    const out = {};
    Object.keys(v).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)).forEach(k => { out[k] = jsonb(v[k]); });
    return out;
  }
  return v;
}
const stable = v => JSON.stringify(jsonb(v));
const omit = (o, keys) => { const c = { ...o }; keys.forEach(k => delete c[k]); return c; };
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
const err = (message, code) => ({ message, code: code || '' });

export class FakeProject {
  constructor(url, kind) {
    this.url = url; this.kind = kind;                 // 'store' | 'central'
    this.users = new Map(); this.byId = new Map();
    this.now = () => Date.now();
    this.sqlReady = true; this.confirmEmail = false; this.anonEnabled = true;
    // store
    this.records = new Map(); this.seq = 0; this.owner = null; this.devices = new Map(); this.tickets = new Map();
    this.pushCalls = 0;
    // central
    this.subs = new Map(); this.links = new Map(); this.requests = []; this.admins = new Set(); this.trialDays = 14;
  }
  addUser(email, password, anonymous) {
    const u = { id: uuid(), email: email || null, password: password || null, anonymous: !!anonymous };
    this.byId.set(u.id, u); if (email) this.users.set(email, u);
    if (this.kind === 'central' && !anonymous) {
      this.subs.set(u.id, { plan_months: 0, status: 'trial', started_at: this.now(), expires_at: this.now() + this.trialDays * 86400000 });
    }
    return u;
  }
  iso(ms) { return new Date(ms).toISOString(); }

  isOwner(s) { return !!(s && !s.anonymous && this.owner === s.uid); }
  isDevice(s) { const d = s && this.devices.get(s.uid); return !!(d && !d.revoked_at); }

  /* ---------- RPC ---------- */
  // Khách quét QR không đăng nhập gì cả (không cả ẩn danh) — chỉ 3 hàm này được phép gọi với s=null,
  // đúng với "grant execute ... to anon" (không có "to authenticated") trong store-setup.sql.
  static ANON_FNS = new Set(['guest_menu', 'guest_call', 'guest_order']);
  rpc(name, args, s) {
    args = args || {};
    if (this.kind === 'store' && !this.sqlReady) return { data: null, error: err('Could not find the function public.' + name, 'PGRST202') };
    const fn = this['rpc_' + name];
    if (!fn) return { data: null, error: err('Could not find the function public.' + name, 'PGRST202') };
    if (!s && !FakeProject.ANON_FNS.has(name)) return { data: null, error: err('Chưa đăng nhập', '28000') };
    try { return { data: fn.call(this, args, s), error: null }; }
    catch (e) { return { data: null, error: err(e.message, e.code || '42501') }; }
  }
  /* --- tiện ích dùng chung cho các hàm khách --- */
  colRows(collection) { return [...this.records.values()].filter(r => r.collection === collection && !r.deleted); }
  colOne(collection, id) { const r = this.records.get(collection + '|' + id); return r && !r.deleted ? r : null; }
  findSeatByToken(token) { return this.colRows('seats').find(r => r.data.qr_token === token) || null; }
  putRecord(collection, id, data) {
    const now = ++this.seq;
    this.records.set(collection + '|' + id, { collection, id, data, updated_at: this.now(), deleted: false, device_id: null, seq: now });
  }
  /* --- store --- */
  rpc_cleanup_old_data(args, s) {
    if (!this.isOwner(s)) throw Object.assign(new Error('Chỉ chủ quán được dọn dữ liệu'), { code: '42501' });
    const monthsKeep = Math.max((args && args.p_months_keep) || 24, 6);
    const now = this.now(), day = 86400000, month = 30 * day;
    const deletedCutoff = now - 30 * day, ordersCutoff = now - monthsKeep * month, logsCutoff = now - 6 * month, stockCutoff = now - 12 * month;
    let purgedTombstones = 0, purgedOrders = 0, purgedLogs = 0, purgedStock = 0;

    for (const [k, r] of [...this.records]) {
      if (r.deleted && r.updated_at < deletedCutoff) { this.records.delete(k); purgedTombstones++; }
    }
    const oldOrderIds = new Set([...this.records.values()]
      .filter(r => r.collection === 'orders' && !r.deleted && r.data.status === 'paid' && r.updated_at < ordersCutoff)
      .map(r => r.id));
    if (oldOrderIds.size) {
      for (const [k, r] of [...this.records]) {
        const belongs = (r.collection === 'orderItems' || r.collection === 'payments') && oldOrderIds.has(r.data.order_id);
        const isOrder = r.collection === 'orders' && oldOrderIds.has(r.id);
        if (belongs || isOrder) { this.records.delete(k); purgedOrders++; }
      }
    }
    for (const [k, r] of [...this.records]) {
      if (r.collection === 'logs' && r.updated_at < logsCutoff) { this.records.delete(k); purgedLogs++; }
    }
    for (const [k, r] of [...this.records]) {
      if (r.collection === 'stockMoves' && r.updated_at < stockCutoff) { this.records.delete(k); purgedStock++; }
    }
    return { purged_tombstones: purgedTombstones, purged_orders_rows: purgedOrders, purged_logs: purgedLogs, purged_stock_moves: purgedStock, months_kept: monthsKeep };
  }
  rpc_store_status(_, s) {
    this.storeStatusCalls = (this.storeStatusCalls || 0) + 1;
    const d = this.devices.get(s.uid);
    return { ready: true, version: 1, has_owner: !!this.owner, is_owner: this.isOwner(s), is_device: this.isDevice(s), device_revoked: !!(d && d.revoked_at) };
  }
  rpc_claim_owner(_, s) {
    if (s.anonymous) throw Object.assign(new Error('Tài khoản ẩn danh không thể làm chủ quán'), { code: '42501' });
    if (this.owner === s.uid) return true;
    if (this.owner) throw Object.assign(new Error('Dự án Supabase này đã có chủ quán khác'), { code: '42501' });
    this.owner = s.uid; return true;
  }
  rpc_create_pairing_ticket(_, s) {
    if (!this.isOwner(s)) throw Object.assign(new Error('Chỉ chủ quán được tạo mã mời'), { code: '42501' });
    const token = uuid().replace(/-/g, '');
    const expires = this.now() + 5 * 60000;
    this.tickets.set(token, { expires, used: false });
    return { token, expires_at: this.iso(expires) };
  }
  rpc_redeem_pairing_ticket({ p_token, p_device_name }, s) {
    if (this.isOwner(s)) throw Object.assign(new Error('Máy của chủ quán không cần liên kết như máy nhân viên'), { code: '42501' });
    const t = this.tickets.get(p_token);
    if (!t || t.used || t.expires <= this.now()) throw Object.assign(new Error('Mã không hợp lệ hoặc đã hết hạn'), { code: '22023' });
    t.used = true;
    this.devices.set(s.uid, { id: s.uid, device_name: (p_device_name || '').trim().slice(0, 60) || 'Máy nhân viên',
      created_at: this.iso(this.now()), last_seen_at: this.iso(this.now()), revoked_at: null });
    return { device_id: s.uid };
  }
  rpc_revoke_device({ p_id }, s) {
    if (!this.isOwner(s)) throw Object.assign(new Error('Chỉ chủ quán được thu hồi thiết bị'), { code: '42501' });
    const d = this.devices.get(p_id);
    if (d && !d.revoked_at) { d.revoked_at = this.iso(this.now()); return true; }
    return false;
  }
  rpc_touch_device(_, s) { const d = this.devices.get(s.uid); if (d && !d.revoked_at) d.last_seen_at = this.iso(this.now()); return null; }
  rpc_delete_device({ p_id }, s) {
    if (!this.isOwner(s)) throw Object.assign(new Error('Chỉ chủ quán được xoá thiết bị'), { code: '42501' });
    const d = this.devices.get(p_id);
    if (d && d.revoked_at) { this.devices.delete(p_id); return true; }
    return false;
  }

  /* --- khách quét QR (không đăng nhập gì cả — s luôn null ở đây) --- */
  _guestSeat(token, requireUnlocked = true) {
    if (!token || token.length < 4 || token.length > 120) throw Object.assign(new Error('Mã QR không hợp lệ'), { code: '22023' });
    const r = this.findSeatByToken(token);
    if (!r) throw Object.assign(new Error('Mã QR không hợp lệ hoặc đã bị đổi'), { code: '22023' });
    if (requireUnlocked && Number(r.data.locked) === 1) throw Object.assign(new Error('Bàn này đã khoá mã QR — vui lòng gọi nhân viên'), { code: '42501' });
    return r;
  }
  rpc_guest_menu({ p_seat_token }) {
    const seat = this._guestSeat(p_seat_token, false);
    const table = this.colOne('tables', seat.data.table_id);
    const rest = this.colOne('restaurant', 'main');
    return {
      locked: Number(seat.data.locked) === 1,
      restaurant: rest ? rest.data : {},
      table_name: table ? table.data.name : null,
      seat_no: Number(seat.data.seat_no),
      categories: this.colRows('categories').map(r => r.data).sort((a, b) => (a.sort || 0) - (b.sort || 0)),
      menu: this.colRows('menu').filter(r => Number(r.data.active) === 1).map(r => r.data),
      order: (() => {
        const o = seat.data.bound_order_id && this.colOne('orders', seat.data.bound_order_id);
        if (!o || o.data.status !== 'open') return null;
        const items = this.colRows('orderItems').filter(r => r.data.order_id === o.id && r.data.status !== 'cancelled')
          .sort((a, b) => a.data.created_at - b.data.created_at)
          .map(r => ({ name: r.data.name_snapshot, qty: r.data.qty, note: r.data.note, status: r.data.status, price: r.data.price_snapshot }));
        return { id: o.id, code: o.data.code, status: o.data.status, items };
      })()
    };
  }
  rpc_guest_call({ p_seat_token }) {
    const seat = this._guestSeat(p_seat_token, true);
    this.putRecord('seats', seat.id, { ...seat.data, calling: 1, updated_at: this.now() });
    return true;
  }
  rpc_guest_order({ p_seat_token, p_lines }) {
    if (!Array.isArray(p_lines) || !p_lines.length || p_lines.length > 40) throw Object.assign(new Error('Chưa chọn món'), { code: '22023' });
    const seat = this._guestSeat(p_seat_token, true);
    const now = this.now();
    let orderId = seat.data.bound_order_id, order = orderId ? this.colOne('orders', orderId) : null;
    if (order && order.data.status !== 'open') order = null;
    let isNew = false;
    if (!order) {
      isNew = true;
      orderId = 'o' + uuid().replace(/-/g, '');
      const orderData = { id: orderId, code: '#G' + (++this._guestSeq || (this._guestSeq = 1)), table_id: seat.data.table_id,
        seat_no: Number(seat.data.seat_no), source: 'qr', status: 'open', merged_into: null,
        customer_name: '', customer_phone: '', promo_id: null, created_at: now, updated_at: now };
      this.putRecord('orders', orderId, orderData);
      this.putRecord('seats', seat.id, { ...seat.data, bound_order_id: orderId, updated_at: now });
      order = { data: orderData };
    } else {
      this.putRecord('orders', orderId, { ...order.data, updated_at: now });
    }
    const batch = Math.max(0, ...this.colRows('orderItems').filter(r => r.data.order_id === orderId).map(r => r.data.batch || 0)) + 1;
    const settings = this.colOne('settings', 'main');
    const confirm = !!(settings && settings.data.confirmFirstOrder);
    const status = confirm && isNew ? 'pending' : 'queued';
    let count = 0;
    for (const ln of p_lines) {
      if (++count > 40) break;
      const m = this.colOne('menu', ln.menuItemId);
      if (!m || Number(m.data.active) !== 1) throw Object.assign(new Error('Món không tồn tại'), { code: '22023' });
      if (m.data.stock_state === 'out') throw Object.assign(new Error(m.data.name + ' đã hết hàng'), { code: '22023' });
      const qty = Math.max(1, Math.min(50, Number(ln.qty) || 1));
      const itemId = 'it' + uuid().replace(/-/g, '');
      this.putRecord('orderItems', itemId, { id: itemId, order_id: orderId, menu_item_id: ln.menuItemId,
        name_snapshot: m.data.name, price_snapshot: m.data.price, kitchen_id: m.data.kitchen_id, qty,
        note: String(ln.note || '').slice(0, 200), status, batch, origin_table: seat.data.table_id,
        origin_seat: Number(seat.data.seat_no), created_at: now, updated_at: now });
      for (const r of this.colRows('recipes').filter(r => r.data.menu_item_id === ln.menuItemId)) {
        const used = Math.round((r.data.qty_per_serve || 0) * qty * 1000) / 1000;
        if (!used) continue;
        const ing = this.colOne('ingredients', r.data.ingredient_id);
        const qtyAfter = (ing ? (ing.data.qty || 0) : 0) - used;
        const mvId = 'sm' + uuid().replace(/-/g, '');
        this.putRecord('stockMoves', mvId, { id: mvId, ingredient_id: r.data.ingredient_id, type: 'auto', qty: used,
          qty_after: qtyAfter, reason: `Theo công thức ${m.data.name} (khách gọi qua QR)`, ref_order_id: orderId,
          staff_id: null, created_at: now });
      }
    }
    return { order_id: orderId, order_code: order.data.code, items: count, status };
  }

  rpc_push_records({ p_recs }, s) {
    this.pushCalls++;
    const owner = this.isOwner(s), dev = this.isDevice(s);
    if (!(owner || dev)) throw Object.assign(new Error('Thiết bị chưa được liên kết hoặc đã bị thu hồi'), { code: '42501' });
    if (!Array.isArray(p_recs) || p_recs.length > 500) throw Object.assign(new Error('Dữ liệu đồng bộ không hợp lệ'), { code: '22023' });
    const results = [];
    for (const r of p_recs) {
      let status, reason = null;
      try {
        if (!r.collection || r.id == null || r.updated_at == null || !r.data || typeof r.data !== 'object' || Array.isArray(r.data)) throw new Error('Bản ghi thiếu trường bắt buộc');
        if (!KNOWN.includes(r.collection)) throw new Error('Loại dữ liệu không được hỗ trợ: ' + r.collection);
        if (JSON.stringify(r.data).length > 700000) throw new Error('Bản ghi quá lớn');
        const key = r.collection + '|' + r.id, cur = this.records.get(key);
        if (!owner) {
          if (r.deleted) throw new Error('Máy nhân viên không được xoá dữ liệu');
          if (STAFF_RW.includes(r.collection)) { /* được phép */ }
          else if (r.collection === 'menu') {
            if (!(cur && !cur.deleted && stable(omit(cur.data, ['stock_state', 'updated_at'])) === stable(omit(r.data, ['stock_state', 'updated_at']))))
              throw new Error('Máy nhân viên chỉ được đổi tình trạng còn/hết món');
          } else if (r.collection === 'promos') {
            if (!(cur && !cur.deleted && stable(omit(cur.data, ['used_count', 'updated_at'])) === stable(omit(r.data, ['used_count', 'updated_at']))))
              throw new Error('Máy nhân viên chỉ được ghi lượt dùng khuyến mãi');
          } else throw new Error('Chỉ máy chủ quán được thay đổi mục này');
        }
        const willApply = !cur || (cur.updated_at <= r.updated_at && (owner || !cur.deleted));
        if (willApply) {
          // chỉ mục duy nhất: một đơn chỉ một thanh toán 'paid'
          if (r.collection === 'payments' && !r.deleted && r.data.state === 'paid') {
            for (const [k, o] of this.records) {
              if (o.collection === 'payments' && !o.deleted && o.id !== r.id && o.data.state === 'paid' && o.data.order_id === r.data.order_id) {
                const e = new Error('duplicate key value violates unique constraint "one_paid_payment_per_order"'); e.unique = true; throw e;
              }
            }
          }
          this.records.set(key, { collection: r.collection, id: String(r.id), data: jsonb(r.data), updated_at: r.updated_at,
            deleted: !!r.deleted, device_id: s.uid, seq: ++this.seq });
          status = 'applied';
        } else status = 'stale';
      } catch (e) {
        if (e.unique) { status = 'duplicate'; reason = 'Đơn này đã được thanh toán ở máy khác'; }
        else { status = 'rejected'; reason = e.message; }
      }
      results.push({ collection: r.collection, id: r.id, status, reason });
    }
    return results;
  }

  /* --- central --- */
  rpc_get_my_subscription(_, s) {
    const sub = this.subs.get(s.uid); if (!sub) return null;
    const live = sub.expires_at > this.now();
    return { plan_months: sub.plan_months, status: live ? sub.status : 'expired', started_at: this.iso(sub.started_at),
             expires_at: this.iso(sub.expires_at), server_now: this.iso(this.now()) };
  }
  rpc_save_store_link({ p_url, p_anon }, s) {
    if (!/^https:\/\/[A-Za-z0-9._-]+(:[0-9]+)?$/.test(p_url)) throw new Error('Địa chỉ Supabase không hợp lệ');
    this.links.set(s.uid, { url: p_url, anon_key: p_anon }); return null;
  }
  rpc_get_store_link(_, s) { return this.links.get(s.uid) || null; }
  rpc_request_renewal({ p_months, p_note }, s) {
    if (![1, 6, 12].includes(p_months)) throw new Error('Gói không hợp lệ');
    const ex = this.requests.find(r => r.owner_id === s.uid && r.status === 'pending');
    if (ex) { ex.plan_months = p_months; return ex.id; }
    const r = { id: this.requests.length + 1, owner_id: s.uid, plan_months: p_months, note: p_note, status: 'pending', created_at: this.iso(this.now()) };
    this.requests.push(r); return r.id;
  }
  /** mô phỏng admin duyệt: cộng dồn từ max(now, hạn cũ) */
  adminExtend(uid, months) {
    const sub = this.subs.get(uid);
    const base = Math.max(this.now(), sub.expires_at);
    const d = new Date(base); d.setMonth(d.getMonth() + months);
    sub.expires_at = d.getTime(); sub.plan_months = months; sub.status = 'active';
  }

  /* ---------- truy vấn bảng (có RLS) ---------- */
  select(table, f, s) {
    let rows = [];
    if (table === 'records') {
      if (!(this.isOwner(s) || this.isDevice(s))) return [];                 // RLS: lặng lẽ trả về rỗng
      rows = [...this.records.values()].map(r => ({ ...r, data: jsonb(JSON.parse(JSON.stringify(r.data))) }));
    } else if (table === 'staff_devices') {
      rows = [...this.devices.values()].filter(d => this.isOwner(s) || d.id === s.uid).map(d => ({ ...d }));
    } else if (table === 'renewal_requests') {
      rows = this.requests.filter(r => r.owner_id === s.uid).map(r => ({ ...r }));
    }
    for (const [op, col, val] of f.filters) {
      if (op === 'gt') rows = rows.filter(r => r[col] > val);
      if (op === 'eq') rows = rows.filter(r => r[col] === val);
      if (op === 'in') rows = rows.filter(r => val.includes(r[col]));
    }
    if (f.order) rows.sort((a, b) => (a[f.order.col] > b[f.order.col] ? 1 : -1) * (f.order.asc ? 1 : -1));
    if (f.limit) rows = rows.slice(0, f.limit);
    return rows;
  }
}

class Query {
  constructor(proj, table, sess) { this.p = proj; this.t = table; this.s = sess; this.f = { filters: [], order: null, limit: 0 }; }
  select() { return this; }
  gt(c, v) { this.f.filters.push(['gt', c, v]); return this; }
  eq(c, v) { this.f.filters.push(['eq', c, v]); return this; }
  in(c, v) { this.f.filters.push(['in', c, v]); return this; }
  order(c, o) { this.f.order = { col: c, asc: !o || o.ascending !== false }; return this; }
  limit(n) { this.f.limit = n; return this; }
  then(res, rej) {
    return Promise.resolve().then(() => {
      if (this.p.kind === 'store' && !this.p.sqlReady) return { data: null, error: err('relation does not exist', '42P01') };
      return { data: this.p.select(this.t, this.f, this.s()), error: null };
    }).then(res, rej);
  }
}

/** Tạo createClient() cho MỘT thiết bị: phiên đăng nhập lưu theo (thiết bị, storageKey) giống localStorage thật */
export function makeSupabase(registry, deviceSessions) {
  return {
    createClient(url, key, opts) {
      const proj = registry[url];
      if (!proj) throw new Error('Không có dự án giả cho ' + url);
      const skey = (opts && opts.auth && opts.auth.storageKey) || 'sb';
      const sess = () => deviceSessions[skey] || null;
      const setSess = v => { if (v) deviceSessions[skey] = v; else delete deviceSessions[skey]; };
      const wrap = u => ({ session: { user: { id: u.id, email: u.email } }, user: { id: u.id, email: u.email } });
      return {
        auth: {
          async signInWithPassword({ email, password }) {
            const u = proj.users.get(email);
            if (!u || u.password !== password) return { data: {}, error: { message: 'Invalid login credentials' } };
            setSess({ uid: u.id, anonymous: false, email });
            return { data: wrap(u), error: null };
          },
          async signUp({ email, password }) {
            if (proj.users.has(email)) return { data: {}, error: { message: 'User already registered' } };
            const u = proj.addUser(email, password, false);
            if (proj.confirmEmail) return { data: { session: null, user: { id: u.id } }, error: null };
            setSess({ uid: u.id, anonymous: false, email });
            return { data: wrap(u), error: null };
          },
          async signInAnonymously() {
            if (!proj.anonEnabled) return { data: {}, error: { message: 'Anonymous sign-ins are disabled' } };
            const u = proj.addUser(null, null, true);
            setSess({ uid: u.id, anonymous: true });
            return { data: wrap(u), error: null };
          },
          async getSession() { const s = sess(); return { data: { session: s ? { user: { id: s.uid }, access_token: 'fake-jwt-' + s.uid } : null }, error: null }; },
          async getUser() { const s = sess(); return { data: { user: s ? { id: s.uid, email: s.email || null } : null }, error: null }; },
          async signOut() { setSess(null); return { error: null }; }
        },
        async rpc(name, args) { return proj.rpc(name, args, sess()); },
        from(table) { return new Query(proj, table, sess); },
        channel() { const c = { on() { return c; }, subscribe() { return c; } }; return c; },
        removeChannel() {},
        storage: {
          from(bucket) {
            return {
              async upload(path, blob, opts) {
                if (proj.storageUploadFails) return { data: null, error: { message: 'Bucket không tồn tại (chưa chạy script SQL mới)' } };
                proj.storageObjects = proj.storageObjects || new Map();
                proj.storageObjects.set(bucket + '/' + path, { size: blob.size || 0, contentType: (opts || {}).contentType });
                return { data: { path }, error: null };
              },
              getPublicUrl(path) {
                return { data: { publicUrl: `${url}/storage/v1/object/public/${bucket}/${path}` } };
              },
              async remove(paths) {
                proj.storageObjects = proj.storageObjects || new Map();
                for (const p of paths) proj.storageObjects.delete(bucket + '/' + p);
                return { data: {}, error: null };
              },
            };
          },
        },
      };
    }
  };
}
