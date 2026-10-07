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
    }
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
    async wipe() { state = { rows: {}, meta: {} }; save(); }
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
  function setMeta(k, v) {
    meta[k] = v;
    chain = chain.then(() => backend.setMeta(k, v)).catch(e => console.warn('setMeta lỗi', e));
    return chain;
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
    chain = chain.then(async () => {
      await backend.upsertRows(rows);
      await backend.deleteRows(removed);
      if (counter !== meta.counter) { meta.counter = counter; await backend.setMeta('counter', counter); }
      if (hw !== meta.hw) { meta.hw = hw; await backend.setMeta('hw', hw); }
    }).catch(e => console.warn('Ghi bộ nhớ lỗi', e));
    if (rows.length && typeof Sync !== 'undefined') Sync.kick();
    return chain;
  }
  /** Ghi các hàng đã xử lý xong (ví dụ sau khi đẩy lên Supabase) */
  function writeRows(rows, removed) {
    chain = chain.then(async () => {
      await backend.upsertRows(rows || []);
      await backend.deleteRows(removed || []);
    }).catch(e => console.warn('Ghi bộ nhớ lỗi', e));
    return chain;
  }
  async function idle() { await chain; }
  async function wipe() {
    clearTimeout(timer); timer = null;
    await chain;
    await backend.wipe();
    meta = {};
    Records.reset();
  }

  return { init, getMeta, setMeta, saveSoon, flush, writeRows, idle, wipe,
           get backendName() { return backend && backend.name; } };
})();
