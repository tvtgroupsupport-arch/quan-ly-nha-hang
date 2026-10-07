/* ============================================================
   BẢN GHI ĐỒNG BỘ
   D (dữ liệu trong bộ nhớ) được xem như tập các bản ghi:
     (collection, id) → JSON.  Module này:
     • phát hiện bản ghi nào mới/đổi/mất giữa hai lần lưu → đánh dấu `dirty`
     • hợp nhất bản ghi kéo từ Supabase vào D (bản mới hơn thắng)
     • tính lại các giá trị phái sinh (tồn kho, bộ đếm mã đơn)

   Kho là ví dụ quan trọng: số tồn `qty` KHÔNG đồng bộ trực tiếp (hai máy
   cùng trừ kho sẽ đè nhau). Chỉ đồng bộ `qty0` (tồn đầu) và các phiếu
   nhập/xuất (stockMoves, chỉ thêm, không sửa) — tồn = qty0 + tổng phiếu,
   nên dù hợp nhất theo thứ tự nào kết quả vẫn đúng.
   ============================================================ */

const round3 = n => Math.round(n * 1000) / 1000;
const byCreatedAsc  = (a, b) => (a.created_at || 0) - (b.created_at || 0);
const byCreatedDesc = (a, b) => (b.created_at || 0) - (a.created_at || 0);

const SYNC_DEFS = [
  { name: 'areas',        key: r => r.id },
  { name: 'tables',       key: r => r.id },
  { name: 'seats',        key: r => r.table_id + ':' + r.seat_no },
  { name: 'categories',   key: r => r.id },
  { name: 'kitchens',     key: r => r.id },
  { name: 'menu',         key: r => r.id },
  { name: 'recipes',      key: r => r.menu_item_id + ':' + r.ingredient_id },
  { name: 'ingredients',  key: r => r.id, strip: r => { const c = { ...r }; delete c.qty; return c; } },
  { name: 'promos',       key: r => r.id },
  { name: 'staff',        key: r => r.id },
  { name: 'reservations', key: r => r.id, sort: byCreatedAsc },
  { name: 'orders',       key: r => r.id, sort: byCreatedAsc },
  { name: 'orderItems',   key: r => r.id, sort: byCreatedAsc },
  { name: 'payments',     key: r => r.id, sort: byCreatedDesc },
  { name: 'stockMoves',   key: r => r.id, sort: byCreatedDesc },
  // Nhật ký bị cắt bớt ở máy → việc "mất" bản ghi nhật ký là cục bộ, không phải xoá thật
  { name: 'logs',         key: r => r.id, sort: byCreatedDesc, noDelete: true },
  { name: 'restaurant',   single: true },
  { name: 'settings',     single: true },
  { name: 'license',      single: true }
];
const SYNC_DEF = Object.fromEntries(SYNC_DEFS.map(d => [d.name, d]));

const Records = (() => {
  const byCol = Object.fromEntries(SYNC_DEFS.map(d => [d.name, new Map()]));  // name → Map(key → ent)
  let hw = 0;          // mốc logic cao nhất đã thấy (mỗi máy tự đặt đồng hồ riêng nên cần mốc nhân quả)
  let orderSeq = 0;    // thứ tự tạo — giữ nguyên thứ tự hiển thị sau khi khởi động lại
  let codeTag = '';    // hậu tố mã đơn của máy phụ, để hai máy không trùng mã

  const stamp = () => (hw = Math.max(Date.now(), hw + 1));
  const observe = u => { if (typeof u === 'number' && u > hw) hw = u; };
  const rowOf = (name, k, e) => ({ collection: name, id: k, data: e.full, u: e.u, deleted: e.deleted, dirty: e.dirty, o: e.o });
  const syncJson = (def, rec) => JSON.stringify(def.strip ? def.strip(rec) : rec);

  function reset() { SYNC_DEFS.forEach(d => byCol[d.name].clear()); hw = 0; orderSeq = 0; }

  /** Dựng lại D từ các dòng đã lưu. Trả về null nếu máy chưa có dữ liệu nào. */
  function hydrate(rows) {
    reset();
    const D0 = emptyD();
    const sorted = rows.slice().sort((a, b) => (a.o || 0) - (b.o || 0));
    for (const r of sorted) {
      const def = SYNC_DEF[r.collection];
      if (!def) continue;
      let rec; try { rec = JSON.parse(r.data); } catch (e) { continue; }
      const ent = { full: r.data, sync: syncJson(def, rec), u: r.u, dirty: !!r.dirty, deleted: !!r.deleted, o: r.o || 0 };
      orderSeq = Math.max(orderSeq, ent.o);
      byCol[def.name].set(r.id, ent);
      observe(r.u);
      if (ent.deleted) continue;
      if (def.single) D0[def.name] = rec; else D0[def.name].push(rec);
    }
    SYNC_DEFS.forEach(d => { if (d.sort) D0[d.name].sort(d.sort); });
    return rows.length ? D0 : null;
  }

  /** So D hiện tại với lần ghi trước → danh sách dòng cần ghi xuống đĩa */
  function capture(Dn) {
    const rows = [], removed = [];
    let now = 0;
    const when = () => now || (now = stamp());
    for (const def of SYNC_DEFS) {
      const col = byCol[def.name];
      if (def.single) {
        const rec = Dn[def.name];
        if (!rec || typeof rec !== 'object') continue;
        const full = JSON.stringify(rec), c = col.get('main');
        if (c && c.full === full) continue;
        const sync = syncJson(def, rec), changed = !c || c.sync !== sync;
        const ent = { full, sync, u: changed ? when() : c.u, dirty: changed ? true : c.dirty, deleted: false, o: c ? c.o : ++orderSeq };
        col.set('main', ent); rows.push(rowOf(def.name, 'main', ent));
        continue;
      }
      const seen = new Set();
      for (const rec of (Dn[def.name] || [])) {
        const k = def.key(rec);
        seen.add(k);
        const full = JSON.stringify(rec), c = col.get(k);
        if (c && !c.deleted && c.full === full) continue;
        const sync = syncJson(def, rec);
        const changed = !c || c.deleted || c.sync !== sync;
        const ent = { full, sync, u: changed ? when() : c.u, dirty: changed ? true : c.dirty, deleted: false, o: c ? c.o : ++orderSeq };
        col.set(k, ent); rows.push(rowOf(def.name, k, ent));
      }
      for (const [k, c] of col) {
        if (seen.has(k) || c.deleted) continue;
        if (def.noDelete) { col.delete(k); removed.push({ collection: def.name, id: k }); continue; }
        const ent = { ...c, deleted: true, dirty: true, u: when() };   // bia mộ — để máy khác biết đã xoá
        col.set(k, ent); rows.push(rowOf(def.name, k, ent));
      }
    }
    return { rows, removed };
  }

  function dirtyCount() {
    let n = 0;
    for (const d of SYNC_DEFS) for (const c of byCol[d.name].values()) if (c.dirty) n++;
    return n;
  }

  /** Lấy các bản ghi chưa đẩy (tối đa `limit` bản ghi / `maxBytes` ký tự), đúng dạng push_records() nhận */
  function dirtyBatch(limit, maxBytes) {
    const out = [];
    let bytes = 0;
    for (const def of SYNC_DEFS) {
      for (const [k, c] of byCol[def.name]) {
        if (!c.dirty) continue;
        const size = c.deleted ? 2 : c.sync.length;
        if (out.length && (out.length >= limit || bytes + size > (maxBytes || 800000))) return out;
        out.push({ collection: def.name, id: k, updated_at: c.u, deleted: c.deleted,
                   data: c.deleted ? {} : JSON.parse(c.sync) });
        bytes += size;
      }
    }
    return out;
  }

  /** Máy chủ đã nhận: bỏ cờ dirty nếu bản ghi chưa đổi tiếp trong lúc đẩy */
  function markClean(collection, id, u) {
    const col = byCol[collection], c = col && col.get(id);
    if (!c || c.u !== u) return null;
    if (c.deleted) { col.delete(id); return { removed: { collection, id } }; }
    c.dirty = false;
    return { row: rowOf(collection, id, c) };
  }

  /** Đánh dấu toàn bộ bản ghi là chưa đẩy — dùng khi chủ quán liên kết Supabase lần đầu */
  function markAllDirty() {
    const u = stamp(), rows = [];
    for (const def of SYNC_DEFS) for (const [k, c] of byCol[def.name]) {
      if (c.deleted) continue;
      c.dirty = true; c.u = u; rows.push(rowOf(def.name, k, c));
    }
    return rows;
  }

  /** Bản ghi bị máy chủ từ chối và máy chủ cũng không có → bỏ khỏi D */
  function forget(Dn, collection, id) {
    const def = SYNC_DEF[collection]; if (!def) return null;
    if (!def.single) Dn[collection] = (Dn[collection] || []).filter(r => def.key(r) !== id);
    byCol[collection].delete(id);
    return { collection, id };
  }

  /** Hợp nhất các bản ghi kéo từ Supabase vào D */
  function applyBatch(Dn, rows, opts) {
    const force = !!(opts && opts.force);
    const touched = new Set(), outRows = [], removed = [], idx = {};
    const dead = new Set();
    const idxOf = def => idx[def.name] || (idx[def.name] = new Map((Dn[def.name] || []).map((r, i) => [def.key(r), i])));
    for (const row of rows) {
      observe(row.updated_at);
      const def = SYNC_DEF[row.collection];
      if (!def) continue;
      const col = byCol[def.name], c = col.get(row.id);
      // Máy này có thay đổi chưa đẩy và không cũ hơn → giữ, sẽ đẩy lên sau
      // (force: máy chủ đã từ chối bản của máy này nên bản máy chủ là chuẩn)
      if (!force && c && c.dirty && c.u >= row.updated_at) continue;
      // Bản kéo về trùng hệt bản đang có (do cửa sổ kéo lùi) → bỏ qua cho đỡ ghi đĩa
      if (!force && c && !c.dirty && !c.deleted && !row.deleted && c.u === row.updated_at
          && c.sync === syncJson(def, row.data)) continue;
      touched.add(def.name);

      if (row.deleted) {
        if (!def.single) {
          const i = idxOf(def).get(row.id);
          if (i !== undefined) { Dn[def.name][i] = null; idx[def.name].delete(row.id); dead.add(def.name); }
        }
        if (c) { col.delete(row.id); removed.push({ collection: def.name, id: row.id }); }
        continue;
      }

      const rec = row.data;
      if (def.name === 'ingredients') {
        const prev = (Dn.ingredients || []).find(i => i.id === row.id);
        rec.qty = prev && typeof prev.qty === 'number' ? prev.qty : (typeof rec.qty0 === 'number' ? rec.qty0 : 0);
      }
      if (def.single) {
        Dn[def.name] = rec;
      } else {
        const map = idxOf(def), i = map.get(row.id);
        if (i === undefined) { Dn[def.name].push(rec); map.set(row.id, Dn[def.name].length - 1); }
        else Dn[def.name][i] = rec;
      }
      const ent = { full: JSON.stringify(rec), sync: syncJson(def, rec), u: row.updated_at, dirty: false, deleted: false,
                    o: c ? c.o : ++orderSeq };
      col.set(row.id, ent);
      outRows.push(rowOf(def.name, row.id, ent));
    }
    dead.forEach(n => { Dn[n] = Dn[n].filter(Boolean); });
    return { rows: outRows, removed, touched };
  }

  /* ---------- giá trị phái sinh ---------- */
  const moveDelta = m => (m.type === 'in' ? m.qty : -m.qty);

  function stockDeltas(Dn) {
    const delta = new Map();
    for (const m of Dn.stockMoves || []) delta.set(m.ingredient_id, (delta.get(m.ingredient_id) || 0) + moveDelta(m));
    return delta;
  }
  /** Nguyên liệu cũ chưa có tồn đầu: suy ra từ tồn hiện tại trừ đi các phiếu đã có */
  function ensureQty0(Dn) {
    const delta = stockDeltas(Dn);
    for (const ing of Dn.ingredients || []) {
      if (typeof ing.qty0 !== 'number') ing.qty0 = round3((Number(ing.qty) || 0) - (delta.get(ing.id) || 0));
    }
  }
  function recomputeStock(Dn) {
    const delta = stockDeltas(Dn);
    for (const ing of Dn.ingredients || []) {
      if (typeof ing.qty0 === 'number') ing.qty = round3(ing.qty0 + (delta.get(ing.id) || 0));
    }
  }
  /** Bộ đếm mã đơn không trùng mã đã có của chính máy này */
  function fixCounter(Dn) {
    const re = codeTag ? new RegExp('^#(\\d+)-' + codeTag + '$') : /^#(\d+)$/;
    let max = Dn.counter || 1000;
    for (const o of Dn.orders || []) { const m = re.exec(o.code || ''); if (m) max = Math.max(max, Number(m[1])); }
    Dn.counter = max;
  }
  function finalize(Dn, touched) {
    (touched || []).forEach(n => { const d = SYNC_DEF[n]; if (d && d.sort && Dn[n]) Dn[n].sort(d.sort); });
    recomputeStock(Dn);
    fixCounter(Dn);
  }

  return {
    hydrate, capture, applyBatch, dirtyBatch, dirtyCount, markClean, markAllDirty, forget, reset, finalize,
    ensureQty0, recomputeStock, fixCounter, stamp, observe,
    get hw() { return hw; }, set hw(v) { hw = Math.max(hw, v || 0); },
    get codeTag() { return codeTag; }, set codeTag(v) { codeTag = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); }
  };
})();
