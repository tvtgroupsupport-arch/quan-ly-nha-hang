/* ============================================================
   LƯU TRỮ CỤC BỘ
   Dữ liệu vận hành vẫn nằm trong bộ nhớ (biến D) để giao diện chạy
   đồng bộ, nhanh như trước. Mỗi khi D đổi, các bản ghi thay đổi được
   ghi xuống SQLite (Android) hoặc localStorage (khi chạy thử trên web).
   Mỗi dòng SQLite = một bản ghi + cờ `dirty` (chưa đẩy lên Supabase).
   ============================================================ */

/** Backend SQLite — `sql` là lớp bọc quanh plugin Capacitor (xem native/bridge.js) */
function makeSqlBackend(sql) {
  return {
    name: 'sqlite',
    async init() {
      await sql.open('quanlynhahang');
      await sql.exec(`
        CREATE TABLE IF NOT EXISTS records (
          collection TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL,
          u INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 0,
          o INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (collection, id));
        CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);`);
    },
    async loadAll() {
      const rows = await sql.query('SELECT collection,id,data,u,deleted,dirty,o FROM records', []);
      const meta = {};
      for (const m of await sql.query('SELECT k,v FROM meta', [])) {
        try { meta[m.k] = JSON.parse(m.v); } catch (e) { meta[m.k] = m.v; }
      }
      return { rows: rows.map(r => ({ collection: r.collection, id: r.id, data: r.data, u: Number(r.u), deleted: !!r.deleted, dirty: !!r.dirty, o: Number(r.o) || 0 })), meta };
    },
    async upsertRows(rows) {
      if (!rows.length) return;
      for (let i = 0; i < rows.length; i += 400) {
        await sql.batch(rows.slice(i, i + 400).map(r => ({
          statement: 'INSERT OR REPLACE INTO records (collection,id,data,u,deleted,dirty,o) VALUES (?,?,?,?,?,?,?)',
          values: [r.collection, r.id, r.data, r.u, r.deleted ? 1 : 0, r.dirty ? 1 : 0, r.o || 0]
        })));
      }
    },
    async deleteRows(keys) {
      if (!keys.length) return;
      for (let i = 0; i < keys.length; i += 400) {
        await sql.batch(keys.slice(i, i + 400).map(k => ({
          statement: 'DELETE FROM records WHERE collection = ? AND id = ?', values: [k.collection, k.id] })));
      }
    },
    async setMeta(k, v) {
      await sql.batch([{ statement: 'INSERT OR REPLACE INTO meta (k,v) VALUES (?,?)', values: [k, JSON.stringify(v)] }]);
    },
    async wipe() {
      await sql.exec('DELETE FROM records; DELETE FROM meta;');
    },
    async ping() { await sql.query('SELECT 1', []); }
  };
}

/** Backend dự phòng cho trình duyệt (chạy thử): gom tất cả vào một khoá localStorage */
function makeLocalStorageBackend(store) {
  const KEY = 'qlnh_local_v1';
  let state = { rows: {}, meta: {} };
  const save = () => { try { store.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  return {
    name: 'localStorage',
    async init() {
      try { const raw = store.getItem(KEY); if (raw) state = JSON.parse(raw); } catch (e) {}
    },
    async loadAll() {
      return { rows: Object.values(state.rows), meta: { ...state.meta } };
    },
    async upsertRows(rows) { rows.forEach(r => { state.rows[r.collection + '|' + r.id] = r; }); save(); },
    async deleteRows(keys) { keys.forEach(k => { delete state.rows[k.collection + '|' + k.id]; }); save(); },
    async setMeta(k, v) { state.meta[k] = v; save(); },
    async wipe() { state = { rows: {}, meta: {} }; save(); },
    async ping() {}
  };
}

const Persist = (() => {
  let backend = null;
  let meta = {};
  let timer = null;
  let chain = Promise.resolve();
  let ready = false;

  /** Đọc bộ nhớ cục bộ; trả về D đã dựng lại (hoặc null nếu máy chưa có dữ liệu) */
  async function init() {
    const sql = (typeof NativeBridge !== 'undefined' && NativeBridge.sqlite) || null;
    backend = sql ? makeSqlBackend(sql) : makeLocalStorageBackend(window.localStorage || { getItem() {}, setItem() {} });
    await backend.init();
    const { rows, meta: m } = await backend.loadAll();
    meta = m || {};
    ready = true;
    Records.hw = meta.hw;
    const D0 = Records.hydrate(rows);
    if (D0) { if (typeof meta.counter === 'number') D0.counter = meta.counter; Records.recomputeStock(D0); }
    return D0;
  }

  function getMeta(k, dflt) { return (k in meta) ? meta[k] : dflt; }

  /* ---- Ngắt mạch khi cầu nối native (SQLite) kẹt ----
     Một lệnh plugin quá hạn = luồng plugin chung của Capacitor đang kẹt. Nếu cứ xếp thêm lệnh (mỗi lệnh chờ 20 giây) thì hàng đợi tích tồn
     và đồng bộ (chờ hàng đợi này) treo theo dù mạng/máy chủ vẫn tốt. Nên: ngừng gọi native, giữ dữ liệu trong bộ nhớ (kể cả cờ chờ gửi),
     cứ 5 giây dò bằng một lệnh nhẹ duy nhất; khi sống lại thì ghi bù toàn bộ xuống đĩa. */
  let stalledSince = 0, probeTimer = null, probing = false, pendingRemoved = [];
  const PROBE_MS = 5000;
  const isStall = e => !!(e && e.pluginTimeout);
  function noteFail(e, what) {
    if (isStall(e)) enterStall(); else console.warn(what, e);
  }
  function enterStall() {
    if (stalledSince) return;
    stalledSince = Date.now();
    console.warn('SQLite stalled: disk writes paused, data kept in memory');
    clearInterval(probeTimer);
    probeTimer = setInterval(probe, PROBE_MS);
    if (typeof Persist !== 'undefined' && Persist.onStallChange) { try { Persist.onStallChange(true); } catch (e) {} }
  }
  async function probe() {
    if (probing || !stalledSince || !backend) return;
    probing = true;
    try {
      await backend.ping();
      // sống lại → ghi bù toàn bộ (bản ghi, bản ghi đã xoá, meta) trong hàng đợi để không chen với ghi mới
      chain = chain.then(async () => {
        await backend.upsertRows(Records.allRows());
        if (pendingRemoved.length) { const r = pendingRemoved; await backend.deleteRows(r); pendingRemoved = pendingRemoved.filter(x => !r.includes(x)); }
        for (const k of Object.keys(meta)) await backend.setMeta(k, meta[k]);
        stalledSince = 0; clearInterval(probeTimer); probeTimer = null;
        if (typeof Persist !== 'undefined' && Persist.onStallChange) { try { Persist.onStallChange(false); } catch (e) {} }
      }).catch(e => noteFail(e, 'Persist catch-up write failed'));
      await chain;
    } catch (e) { /* vẫn kẹt: lần dò sau */ }
    finally { probing = false; }
  }
  /** Xếp một thao tác ghi vào hàng đợi; đang kẹt thì bỏ qua ngay (dữ liệu sẽ được ghi bù khi SQLite sống lại) */
  function queue(fn, what, onSkip) {
    chain = chain.then(async () => {
      if (stalledSince) { if (onSkip) onSkip(); return; }
      await fn();
    }).catch(e => noteFail(e, what));
    return chain;
  }

  function setMeta(k, v) {
    meta[k] = v;
    return queue(() => backend.setMeta(k, v), 'setMeta lỗi');
  }

  /** Ghi các bản ghi vừa đổi xuống đĩa. Gọi sau mỗi lần saveD() (có điều tiết 250ms). */
  function saveSoon() {
    if (!ready) return;
    clearTimeout(timer);
    timer = setTimeout(flush, 250);
  }
  function flush() {
    clearTimeout(timer); timer = null;
    if (!ready || typeof D === 'undefined' || !D) return chain;
    const { rows, removed } = Records.capture(D);
    const counter = D.counter, hw = Records.hw;
    queue(async () => {
      await backend.upsertRows(rows);
      await backend.deleteRows(removed);
      if (counter !== meta.counter) { meta.counter = counter; await backend.setMeta('counter', counter); }
      if (hw !== meta.hw) { meta.hw = hw; await backend.setMeta('hw', hw); }
    }, 'Ghi bộ nhớ lỗi', () => { meta.counter = counter; meta.hw = hw; pendingRemoved.push(...removed); });
    if (rows.length && typeof Sync !== 'undefined') Sync.kick();
    return chain;
  }
  /** Ghi các hàng đã xử lý xong (ví dụ sau khi đẩy lên Supabase) */
  function writeRows(rows, removed) {
    return queue(async () => {
      await backend.upsertRows(rows || []);
      await backend.deleteRows(removed || []);
    }, 'Ghi bộ nhớ lỗi', () => { pendingRemoved.push(...(removed || [])); });
  }
  async function idle() { await chain; }
  async function wipe() {
    clearTimeout(timer); timer = null;
    await chain;
    await backend.wipe();
    meta = {};
    Records.reset();
    if (typeof clearLoginLock === 'function') clearLoginLock();   // khoá đăng nhập của quán cũ không được dính sang quán mới (xoá dữ liệu / khôi phục / liên kết máy nhân viên)
  }

  return { init, getMeta, setMeta, saveSoon, flush, writeRows, idle, wipe, probe, onStallChange: null,
           get stalledSince() { return stalledSince; },
           get backendName() { return backend && backend.name; } };
})();
