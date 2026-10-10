/* ============ ROUTER & RENDER ============ */
let route = { name: 'login', params: {} };
const histStack = [];
function go(name, params) {
  if (route.name !== name) histStack.push({ ...route });
  route = { name, params: params || {} };
  render(); window.scrollTo(0, 0); centerActiveTabs();
}
function back() {
  route = histStack.pop() || { name: 'tables', params: {} };
  render(); window.scrollTo(0, 0);
}

const VIEWS = {
  login: vLogin, tables: vTables, table: vTable, newOrder: vNewOrder, order: vOrder, pay: vPay, paid: vPaid,
  kds: vKds, admin: vAdmin, reservations: vReservations, menu: vMenu, catKitchen: vCategoriesKitchens, promos: vPromos, reports: vReports,
  staff: vStaff, billing: vBilling, logs: vLogs,
  tablesAdmin: vTablesAdmin, stockLog: vStockLog, exportHub: vExport,
  seatPick: vSeatPick, stock: vStock, history: vHistory, historyDetail: vHistoryDetail,
  guestPage: vGuestPage, qrPrint: vQrPrint, transferTo: vTransferTo, cashier: vCashier, cashierTable: vCashierTable,
  // đám mây: thiết lập máy, liên kết Supabase, thiết bị, gói cước
  setup: vSetup, ownerAuth: vOwnerAuth, ownerInit: vOwnerInit, ownerLink: vOwnerLink, ownerRestore: vOwnerRestore,
  restoring: vRestoring, staffJoin: vStaffJoin, cloud: vCloud, pairQr: vPairQr, subscription: vSubscription, locked: vLocked,
  supabaseGuide: vSupabaseGuide, quickStart: vQuickStart, lang: vLang
};
/** Chỉ tài khoản Chủ quán trên máy chủ quán mới vào được */
const OWNER_ONLY_ROUTES = ['subscription', 'pairQr', 'ownerLink'];
const meIsOwner = () => ME && ME.role === 'Chủ quán' && Cloud.role !== 'staff';

/** Chọn chỗ đến sau khi đã chọn ghế nguồn ở bộ chọn ghế */
function vTransferTo() {
  const src = window._moveSrc || [];
  if (!src.length) return vTables();
  const dst = window._moveDst || (window._moveDst = []);
  const navKey = route.params.from === 'cashier' ? 'cashier' : 'tables';
  const nm = (tid, n) => `${esc((tableById(tid) || {}).name || 'Bàn')} · Ghế ${n}`;
  const area = route.params.area || DB.areas[0];
  const tables = DB.tables.filter(t => t.area === area);
  const total = src.reduce((s, x) => { const o = openOrderFor(x.tableId, x.seatNo); return s + (o ? orderTotal(o).total : 0); }, 0);
  const ready = dst.length === src.length;
  return `<div class="screen">
    ${hdr('Chuyển tới', `${src.length} ghế · ${fmt(total)}`)}
    <div class="body" data-swipe="area" data-area="${esc(area)}">
      <div class="card">
        <div class="t-xs" style="margin-bottom:6px">Ghế nguồn → chỗ mới (chọn ${src.length} ghế trống theo thứ tự)</div>
        ${src.map((x, i) => {
          const [dt, ds] = dst[i] ? dst[i].split('#') : [null, null];
          return `<div class="between t-sm" style="padding:3px 0"><span>${nm(x.tableId, x.seatNo)}</span><span style="color:${dt ? 'var(--green)' : 'var(--faint)'}">→ ${dt ? nm(dt, ds) : 'chưa chọn'}</span></div>`;
        }).join('')}
      </div>
      <div class="scrollx">${DB.areas.map(a => `<button class="chip ${a === area ? 'on' : ''}" data-go="transferTo" data-area="${esc(a)}" data-from="${route.params.from || ''}">${esc(a)}</button>`).join('')}</div>
      <div class="t-xs">Chỉ hiện các ghế đang trống. Chọn được ghế ở nhiều bàn, nhiều khu.</div>
      ${tables.map(t => {
        const free = Array.from({ length: t.seats }, (_, i) => i + 1).filter(n => !openOrderFor(t.id, n));
        if (!free.length) return '';
        return `<div class="card">
          <div class="between" style="margin-bottom:10px">
            <div class="t-md">${esc(t.name)}</div>
            <button class="btn sm ghost" data-act="moveDstFill" data-t="${t.id}">Điền ${src.length} ghế trống</button>
          </div>
          <div class="grid3">${free.map(n => { const on = dst.includes(t.id + '#' + n);
            return `<button class="chip ${on ? 'on' : ''}" data-act="moveDstToggle" data-k="${t.id}#${n}" style="justify-content:center">${on ? '☑' : '☐'} Ghế ${n}</button>`; }).join('')}</div>
        </div>`;
      }).join('') || '<div class="empty">Khu này không còn ghế trống</div>'}
    </div>
    ${dst.length ? `<div class="footbar">
      <button class="btn pri" data-act="moveGo" ${ready ? '' : 'disabled'}>${ready ? `Chuyển ${src.length} ghế` : `Còn thiếu ${src.length - dst.length} ghế đích`}</button>
      <button class="btn ghost" data-act="moveDstClear">Bỏ chọn</button>
    </div>` : ''}
    ${navBar(navKey)}
  </div>`;
}

/** Màn mở đầu tuỳ quyền: vào được cái nào thì mở cái đó */
function homeScreen() {
  for (const k of ['tables', 'pos', 'kds', 'reservations']) {
    if (can(k)) return { tables: 'tables', pos: 'cashier', kds: 'kds', reservations: 'reservations' }[k];
  }
  return 'admin';
}
/** Màn hình này cần quyền gì (dựa trên bảng SCREENS) */
function screenPerm(name) {
  // Màn con dùng chung quyền với màn cha
  const parent = { cashierTable: 'cashier', table: 'tables', order: 'tables',
                   seatPick: 'tables', transferTo: 'tables', newOrder: 'tables',
                   history: 'reports', exportHub: 'reports', stockLog: 'stock',
                   guestPage: 'tablesAdmin', qrPrint: 'tablesAdmin', historyDetail: 'reports',
                   catKitchen: 'menu' }[name] || name;
  const sc = SCREENS.find(x => x.route === parent);
  return sc ? sc.key : null;
}

function render() {
  // Màn chọn ngôn ngữ (lần đầu mở app): đứng riêng, không qua các bước kiểm tra đăng nhập/thiết lập bên dưới
  if (route.name === 'lang') { document.getElementById('app').innerHTML = vLang(); return; }
  // 1. Máy chưa thiết lập / đang chờ tải dữ liệu lần đầu
  if (!Cloud.role && !FREE_ROUTES.includes(route.name)) route = { name: 'setup', params: {} };
  const SETUP_FLOW = ['restoring', 'quickStart', 'setup', 'ownerAuth', 'ownerInit', 'ownerLink', 'ownerRestore', 'staffJoin', 'supabaseGuide'];
  if (Cloud.role && !(D && D.staff && D.staff.length) && !SETUP_FLOW.includes(route.name)) route = { name: 'restoring', params: {} };
  // 2. Chưa đăng nhập vào app
  if (!ME && !FREE_ROUTES.includes(route.name)) route = { name: 'login', params: {} };
  if (ME) {
    // 3. Quyền theo màn hình. Màn đơn hàng mở được từ cả Phục vụ lẫn Thu ngân nên chấp nhận một trong hai quyền.
    const shared = { order: ['tables', 'pos'], pay: ['pos'], paid: ['pos'], seatPick: ['tables', 'pos'], transferTo: ['tables', 'pos'] }[route.name];
    const ok = shared ? shared.some(k => can(k))
      : (() => { const need = screenPerm(route.name); return !need || can(need); })();
    if (!ok || (OWNER_ONLY_ROUTES.includes(route.name) && !meIsOwner())) route = { name: homeScreen(), params: {} };
    // 4. Gói cước hết hạn: khoá mềm — vẫn xem được báo cáo và gia hạn
    if (License.locked()) {
      const allowed = Cloud.role === 'staff' ? LOCK_OK_STAFF : LOCK_OK_OWNER;
      if (!allowed.includes(route.name)) route = { name: 'locked', params: {} };
    }
  }
  if (route.name === 'history' && !window._history && !window._historyLoading) {
    window._history = []; loadHistory(true);
  }
  const v = VIEWS[route.name] || vTables;
  document.getElementById('app').innerHTML = syncBanner() + v();
  hideOwnerOnly(document.getElementById('app'));
  applyFontScale();
  if (route.name === 'pay') queueMicrotask(renderCashBox);
}
/** Cỡ chữ 100/200/300% — RIÊNG TỪNG MÁY (mỗi nhân viên thích cỡ khác nhau), không đồng bộ qua
    Supabase như các cài đặt chung của quán, nên lưu cục bộ qua Persist thay vì D.settings.
    Co giãn CẢ GIAO DIỆN theo tỷ lệ (không chỉ riêng chữ), để nút bấm/khung chứa to lên CÙNG với
    chữ bên trong — đây là cách duy nhất không bị tràn/đè chữ ở mức 300%, vì nếu chỉ phóng to mỗi
    chữ mà giữ nguyên khung chứa thì chữ to chắc chắn tràn ra ngoài khung đó. `zoom` (không phải
    CSS chuẩn, nhưng Capacitor Android chạy Chromium nên dùng được) làm trình duyệt coi như kích
    thước màn hình đổi thật — mọi thứ tự xuống dòng/co giãn lại đúng cách. */
function fontScale() { return (typeof Persist !== 'undefined' && Persist.getMeta('fontScale', 1)) || 1; }
function applyFontScale() {
  const s = fontScale();
  document.body.style.zoom = String(s);
  document.body.style.setProperty('--font-scale', String(s));
}

/* thanh toán thành công dùng bộ nhớ tạm trên client */
let lastPaid = null;
function vPaid() {
  const p = lastPaid;
  if (!p) return vTables();
  return `<div class="screen"><div class="body" style="justify-content:center;align-items:center;text-align:center;padding:32px 24px">
    <div style="width:88px;height:88px;border-radius:999px;background:var(--green-soft);display:flex;align-items:center;justify-content:center;color:var(--green)">
      <svg width="42" height="42" viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6" stroke="currentColor" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <div class="t-lg" style="margin-top:18px">Thanh toán thành công</div>
    <div class="mono" style="font-size:30px;font-weight:700;color:var(--green);margin-top:8px">${fmt(p.total)}</div>
    <div class="card" style="width:100%;margin-top:24px">
      <div class="between" style="margin-bottom:8px"><span class="t-sm muted">Bàn</span><span class="t-md">${esc(p.label)}</span></div>
      <div class="between" style="margin-bottom:8px"><span class="t-sm muted">Phương thức</span><span class="t-md">${esc(p.method)}</span></div>
      <div class="between" style="${window._lastChange?'margin-bottom:8px':''}"><span class="t-sm muted">Thời gian</span><span class="mono t-sm">${hhmm(p.ts)}</span></div>
      ${window._lastChange?`<div class="divider" style="margin:8px 0"></div>
      <div class="between"><span class="t-md" style="color:var(--green)">Tiền thừa trả khách</span>
      <span class="mono" style="font-size:20px;font-weight:700;color:var(--green)">${fmt(window._lastChange)}</span></div>`:''}
    </div>
    <div class="col" style="width:100%;gap:10px;margin-top:24px">
      <button class="btn ghost" data-act="print">${icon('printer')} In hoá đơn</button>
      <button class="btn ghost sm" data-act="billPdf">Lưu PDF / gửi khách</button>
      <button class="btn pri" data-go="cashier">Về trang Thu ngân</button>
    </div>
  </div></div>`;
}

/* ============ UI PHỤ TRỢ ============ */
let toastTimer = null;
function toast(msg) {
  document.querySelector('.toast')?.remove();
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  document.body.appendChild(el);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.remove(), 2200);
}
let sheetEl = null;
function sheet(title, html) {
  closeSheet();
  const bg = document.createElement('div'); bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet"><h3>${esc(title)}</h3>${html}</div>`;
  bg.addEventListener('click', e => { if (e.target === bg) closeSheet(); });
  document.body.appendChild(bg); sheetEl = bg;
  hideOwnerOnly(bg);
}
function closeSheet() { sheetEl?.remove(); sheetEl = null; }
const val = id => (document.getElementById(id) || {}).value || '';

/** Bọc mọi hành động gọi API: hiện lỗi rõ ràng thay vì im lặng */
async function run(fn, okMsg) {
  try {
    const r = await fn();
    await refresh(); render();
    if (okMsg) toast(okMsg);
    return r;
  } catch (e) {
    toast(e.message || 'Có lỗi xảy ra');
    throw e;
  }
}

/* ============ SỰ KIỆN ============ */
document.addEventListener('click', e => {
  const actEl = e.target.closest('[data-act]');
  if (actEl) { if (handleAct(actEl, e) !== false) return; }
  const goEl = e.target.closest('[data-go]');
  if (goEl) {
    const n = goEl.dataset.go, p = {};
    ['id', 't', 's', 'cat', 'tab', 'area', 'k', 'g', 'q', 'f', 'mode', 'hf', 'n', 'from', 'm', 'to', 'name', 'period', 'pf', 'pt'].forEach(x => { if (goEl.dataset[x] !== undefined) p[x] = goEl.dataset[x]; });
    if (goEl.dataset.keep && route.name === n) Object.assign(p, { ...route.params, ...p });
    if (n === 'newOrder' && !goEl.dataset.keep && !p.t) window._cart = {};
    go(n, p);
  }
});
// Ô chọn bàn và ô số khách không phát sự kiện click, phải nghe change/input riêng
document.addEventListener('change', e => {
  if (e.target.id === 'rb') { window._resvSeats = new Set(); renderResvSeats(); }
  if (e.target.id === 'tlayout') { window._layout = e.target.value; renderTablePreview(); }
  if (e.target.id === 'miFile') {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Vui lòng chọn một tệp ảnh'); return; }
    const box = document.getElementById('miPreview');
    if (box) box.innerHTML = '<span class="t-xs">Đang xử lý…</span>';
    resizeImageFile(file, 200, 0.72).then(dataUrl => uploadMenuImage(dataUrl, box)).catch(err => {
      toast(err.message || 'Không xử lý được ảnh này');
      if (box) box.innerHTML = esc((document.getElementById('me')||{}).value || '🍽️');
    });
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'cashIn') {
    const digits = e.target.value.replace(/\D/g, '');
    window._cashRaw = digits;
    window._cashGiven = 0;          // đang gõ dở thì chưa chốt số tiền
    renderCashBox();
    const el = document.getElementById('cashIn');
    if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
    return;
  }
  if (e.target.id === 'rg') { renderResvSeats(); return; }
  if (e.target.dataset.act === 'setVolume') {
    const v = Number(e.target.value);
    const lbl = e.target.parentElement?.querySelector('.t-xs'); if (lbl) lbl.textContent = `Âm lượng: ${v}%`;
    clearTimeout(window._volDebounce);
    window._volDebounce = setTimeout(() => run(() => api('/settings', { method: 'PATCH', body: { soundVolume: v } })), 350);
    return;
  }
  if (e.target.id === 'q') {
    route.params.q = e.target.value;
    const pos = e.target.selectionStart; render();
    const el = document.getElementById('q'); if (el) { el.focus(); el.setSelectionRange(pos, pos); }
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && route.name === 'login' && (e.target.id === 'lu' || e.target.id === 'lp')) {
    handleAct({ dataset: { act: 'login' } });
  }
});

function handleAct(el, ev) {
  const a = el.dataset.act, d = el.dataset;
  if (cloudAct(el)) return;
  switch (a) {

  case 'back': back(); return;
  case 'closeSheet': closeSheet(); return;

  /* ---------- đăng nhập ---------- */
  case 'login': {
    const username = val('lu').trim(), password = val('lp');
    if (!username || !password) { toast('Nhập tên đăng nhập app và mật khẩu đăng nhập app'); return; }
    (async () => {
      try {
        const r = await api('/auth/login', { method: 'POST', body: { username, password, device: navigator.userAgent.slice(0, 80) } });
        TOKEN = r.token; try { localStorage.setItem(TOKEN_KEY, TOKEN); } catch (e) {}
        ME = r.staff; await refresh(); connectWs();
        if (r.staff.mustChange) { render(); handleAct({ dataset: { act: 'changePw', force: '1' } }); return; }
        go(homeScreen());
      } catch (e) { toast(e.message); }
    })();
    return;
  }
  case 'logout': {
    (async () => {
      try { await api('/auth/logout', { method: 'POST' }); } catch (e) {}
      TOKEN = null; ME = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
      try { WS?.close(); } catch (e) {}
      DB = emptyDb(); ensureKeepAlive(); go('login');
    })();
    return;
  }
  case 'changePw': {
    sheet('Đổi mật khẩu', `
      ${d.force ? '<div class="t-xs" style="margin-bottom:12px;color:var(--amber)">Bạn cần đổi mật khẩu trước khi dùng app.</div>' : ''}
      <div class="field"><label class="f">Mật khẩu hiện tại</label><input class="input" id="pw0" type="password"></div>
      <div class="field"><label class="f">Mật khẩu mới (tối thiểu 6 ký tự)</label><input class="input" id="pw1" type="password"></div>
      <button class="btn pri" data-act="savePw">Đổi mật khẩu</button>`);
    return;
  }
  case 'savePw': {
    (async () => {
      try {
        await api('/auth/password', { method: 'POST', body: { oldPassword: val('pw0'), newPassword: val('pw1') } });
        closeSheet(); toast('Đã đổi mật khẩu, vui lòng đăng nhập lại');
        TOKEN = null; ME = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
        go('login');
      } catch (e) { toast(e.message); }
    })();
    return;
  }

  /* ---------- bàn & ghế ---------- */

  case 'seat': {
    const t = d.t, s = Number(d.s);
    const o = openOrderFor(t, s);
    if (o) go('order', { id: o.id });
    else { window._cart = {}; go('newOrder', { t, s }); }
    return;
  }
  case 'newTable': case 'editTable': {
    const t = a === 'editTable' ? tableById(d.id) : null;
    window._seats = t ? t.seats : 4;
    window._layout = t ? (t.layout || 'auto') : 'auto';
    sheet(t ? 'Sửa bàn' : 'Thêm bàn mới', `
      <div class="field"><label class="f">Tên bàn</label><input class="input" id="tn" value="${t ? esc(t.name) : ''}" placeholder="vd. Bàn 22"></div>
      <div class="field"><label class="f">Khu vực</label><select class="input" id="ta">${DB.areas.map(x => `<option ${t && t.area === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
      <div class="field"><label class="f">Số ghế (tối đa 8)</label>
        <div id="tseats" style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">
          ${[1,2,3,4,5,6,7,8].map(n => `<button class="chip ${(t ? t.seats : 4) === n ? 'on' : ''}" data-act="pickSeats" data-n="${n}" style="justify-content:center">${n}</button>`).join('')}
        </div></div>
      <div class="field"><label class="f">Hướng bố trí ghế</label>
        <select class="input" id="tlayout">
          ${TABLE_LAYOUTS.map(x => `<option value="${x.id}" ${window._layout === x.id ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}
        </select>
        <div class="t-xs" style="margin-top:6px">Chỉ đổi cách vẽ vị trí ghế trên sơ đồ cho khớp với cách kê bàn thật — không đổi số ghế hay mã QR.</div>
      </div>
      <div id="tblPreview" style="display:flex;justify-content:center;padding:4px 0 8px"></div>
      <button class="btn pri" data-act="saveTable" data-id="${t ? t.id : ''}">Lưu</button>
      ${t ? `<button class="btn danger" data-act="delTable" data-id="${t.id}" style="margin-top:8px">Xoá bàn này</button>` : ''}`);
    renderTablePreview();
    return;
  }
  case 'pickSeats': {
    window._seats = Number(d.n);
    document.querySelectorAll('#tseats .chip').forEach(b => b.classList.toggle('on', Number(b.dataset.n) === window._seats));
    renderTablePreview();
    return;
  }
  case 'saveTable': {
    const body = { name: val('tn').trim(), areaId: DB.areaIds[val('ta')], seats: window._seats || 4, layout: window._layout || 'auto' };
    run(async () => {
      if (d.id) await api('/tables/' + d.id, { method: 'PATCH', body });
      else await api('/tables', { method: 'POST', body });
      closeSheet();
    }, 'Đã lưu bàn');
    return;
  }
  case 'delTable': { run(() => api('/tables/' + d.id, { method: 'DELETE' }).then(closeSheet), 'Đã xoá bàn'); return; }
  case 'newArea': {
    sheet('Thêm khu vực', `<div class="field"><label class="f">Tên khu vực</label><input class="input" id="an" placeholder="vd. Tầng 2"></div>
      <button class="btn pri" data-act="saveArea">Lưu</button>`);
    return;
  }
  case 'saveArea': { run(() => api('/areas', { method: 'POST', body: { name: val('an').trim() } }).then(closeSheet), 'Đã thêm khu vực'); return; }

  /* ---------- danh mục món ---------- */
  case 'newCategory': {
    sheet('Thêm danh mục', `<div class="field"><label class="f">Tên danh mục</label><input class="input" id="cn" placeholder="vd. Tráng miệng"></div>
      <button class="btn pri" data-act="saveCategory">Lưu</button>`);
    return;
  }
  case 'editCategory': {
    sheet('Sửa danh mục', `<div class="field"><label class="f">Tên danh mục</label><input class="input" id="cn" value="${esc(d.name)}"></div>
      <button class="btn pri" data-act="saveCategory" data-old="${esc(d.name)}">Lưu</button>`);
    return;
  }
  case 'saveCategory': {
    const name = val('cn').trim();
    if (!name) { toast('Nhập tên danh mục'); return; }
    const old = d.old;   // có giá trị khi sửa, rỗng khi thêm mới
    run(() => (old
      ? api(`/categories/${DB.categoryIds[old]}`, { method: 'PATCH', body: { name } })
      : api('/categories', { method: 'POST', body: { name } })
    ).then(closeSheet), old ? 'Đã sửa danh mục' : 'Đã thêm danh mục');
    return;
  }
  case 'delCategory': {
    const n = DB.menu.filter(m => m.cat === d.name).length;
    sheet('Xoá danh mục?', `<div class="t-sm muted" style="margin-bottom:16px;line-height:1.6">Xoá danh mục <b>${esc(d.name)}</b>.
        ${n ? `<br><b style="color:var(--red)">Còn ${n} món đang dùng danh mục này — cần chuyển món sang danh mục khác trước.</b>` : 'Không thể hoàn tác.'}</div>
      <button class="btn danger" data-act="delCategoryGo" data-name="${esc(d.name)}" ${n ? 'disabled' : ''}>Xoá</button>
      <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
    return;
  }
  case 'delCategoryGo': {
    run(() => api(`/categories/${DB.categoryIds[d.name]}`, { method: 'DELETE' }).then(closeSheet), 'Đã xoá danh mục');
    return;
  }

  /* ---------- khu bếp ---------- */
  case 'newKitchen': {
    sheet('Thêm khu bếp', `<div class="field"><label class="f">Tên khu bếp</label><input class="input" id="kn" placeholder="vd. Bếp lạnh"></div>
      <button class="btn pri" data-act="saveKitchen">Lưu</button>`);
    return;
  }
  case 'editKitchen': {
    sheet('Sửa khu bếp', `<div class="field"><label class="f">Tên khu bếp</label><input class="input" id="kn" value="${esc(d.name)}"></div>
      <button class="btn pri" data-act="saveKitchen" data-old="${esc(d.name)}">Lưu</button>`);
    return;
  }
  case 'saveKitchen': {
    const name = val('kn').trim();
    if (!name) { toast('Nhập tên khu bếp'); return; }
    const old = d.old;
    run(() => (old
      ? api(`/kitchens/${DB.kitchenIds[old]}`, { method: 'PATCH', body: { name } })
      : api('/kitchens', { method: 'POST', body: { name } })
    ).then(closeSheet), old ? 'Đã sửa khu bếp' : 'Đã thêm khu bếp');
    return;
  }
  case 'delKitchen': {
    const n = DB.menu.filter(m => m.kitchen === d.name).length;
    sheet('Xoá khu bếp?', `<div class="t-sm muted" style="margin-bottom:16px;line-height:1.6">Xoá khu bếp <b>${esc(d.name)}</b>.
        ${n ? `<br><b style="color:var(--red)">Còn ${n} món đang dùng khu bếp này — cần chuyển món sang khu bếp khác trước.</b>` : 'Không thể hoàn tác.'}</div>
      <button class="btn danger" data-act="delKitchenGo" data-name="${esc(d.name)}" ${n ? 'disabled' : ''}>Xoá</button>
      <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
    return;
  }
  case 'delKitchenGo': {
    run(() => api(`/kitchens/${DB.kitchenIds[d.name]}`, { method: 'DELETE' }).then(closeSheet), 'Đã xoá khu bếp');
    return;
  }

  /* ---------- gọi món ---------- */
  case 'cart+': { window._cart = window._cart || {}; window._cart[d.id] = (window._cart[d.id] || 0) + 1; render(); return; }
  case 'cart-': {
    window._cart = window._cart || {};
    window._cart[d.id] = Math.max(0, (window._cart[d.id] || 0) - 1);
    if (!window._cart[d.id]) delete window._cart[d.id];
    render(); return;
  }
  case 'pickTable': {
    // Chọn bàn trước, rồi mới chọn ghế — cùng luồng với mọi thao tác bàn/ghế khác
    window._seatSel = new Set();
    go('seatPick', { mode: 'order' });
    return;
  }
  case 'setTarget': { closeSheet(); go('newOrder', { t: d.t, s: d.s }); return; }
  case 'sendOrder': {
    const cart = window._cart || {};
    if (!Object.keys(cart).length) { toast('Chưa chọn món nào'); return; }
    if (!route.params.t) { handleAct({ dataset: { act: 'pickTable' } }); toast('Chọn bàn trước khi gửi'); return; }
    const lines = Object.entries(cart).map(([menuItemId, qty]) => ({ menuItemId, qty }));
    const idem = uid('ord');
    run(async () => {
      const o = await api('/orders/items', { method: 'POST', idem,
        body: { tableId: route.params.t, seatNo: Number(route.params.s), lines } });
      window._cart = {};
      route = { name: 'order', params: { id: o.id } };
    }, 'Đã gửi xuống bếp');
    return;
  }

  /* ---------- sửa đơn ---------- */
  case 'it+': {
    const o = orderById(d.o), i = o.items.find(x => x.lid === d.l);
    if (i.status === 'cooking') {
      // Món đã vào bếp — thêm 1 phần coi như một đợt gọi mới, tách riêng khỏi phần đang nấu
      // (giữ đúng ghế đã gọi món này, quan trọng với đơn đã ghép nhiều ghế).
      run(() => api('/orders/items', { method: 'POST', body: {
        tableId: i.originTable || o.tableId, seatNo: i.originSeat || o.seatNo,
        lines: [{ menuItemId: i.mid, qty: 1, note: i.note || '' }] } }),
        'Đã thêm 1 phần mới — tách riêng vì phần cũ đang được làm');
      return;
    }
    run(() => api('/order-items/' + d.l, { method: 'PATCH', body: { qty: i.qty + 1 } }));
    return;
  }
  case 'it-': {
    const o = orderById(d.o), i = o.items.find(x => x.lid === d.l);
    const qty = i.qty - 1;
    if (qty < 1) { toast('Dùng nút xoá nếu muốn bỏ món'); return; }
    run(() => api('/order-items/' + d.l, { method: 'PATCH', body: { qty } }));
    return;
  }
  case 'delItem': {
    const o = orderById(d.o), i = o.items.find(x => x.lid === d.l);
    sheet('Xoá món?', `<div class="t-sm muted" style="margin-bottom:16px">Xoá <b>${esc(i.name)} ×${i.qty}</b>. Kho sẽ được hoàn lại và thao tác ghi vào nhật ký.</div>
      <button class="btn danger" data-act="delItemOk" data-l="${d.l}">Xoá món</button>
      <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
    return;
  }
  case 'delItemOk': {
    run(async () => {
      const o = await api('/order-items/' + d.l, { method: 'DELETE' });
      closeSheet();
      if (o.status !== 'open') route = { name: 'tables', params: {} };
    }, 'Đã xoá món');
    return;
  }
  case 'pickPromo': {
    const o = orderById(d.o), { sub } = orderTotal(o);
    const today = new Date().toISOString().slice(0, 10);
    const avail = DB.promos.filter(p => p.active && p.expire >= today && !(p.limit > 0 && p.used >= p.limit));
    sheet('Chọn khuyến mãi', `${avail.map(p => {
      const ok = sub >= p.min;
      return `<button class="card between" data-act="setPromo" data-o="${d.o}" data-p="${p.id}" style="width:100%;text-align:left;margin-bottom:8px;${ok ? '' : 'opacity:.5'}">
        <div><div class="t-md">${esc(p.name)}</div><div class="t-xs">Đơn tối thiểu ${fmt(p.min)}${ok ? '' : ' · chưa đủ điều kiện'}</div></div>
        <span class="mono t-sm" style="color:var(--green)">−${fmt(p.type === 'pct' ? sub * p.value / 100 : p.value)}</span></button>`;
    }).join('') || '<div class="empty">Không có khuyến mãi khả dụng</div>'}
    <button class="btn ghost" data-act="setPromo" data-o="${d.o}" data-p="">Bỏ khuyến mãi</button>`);
    return;
  }
  case 'setPromo': {
    run(() => api(`/orders/${d.o}/promo`, { method: 'POST', body: { promoId: d.p || null } }).then(closeSheet));
    return;
  }

  case 'approveOrder': {
    run(() => api(`/orders/${d.o}/approve`, { method: 'POST' }), 'Đã gửi xuống bếp');
    return;
  }
  case 'rejectOrder': {
    sheet('Từ chối đơn của khách?', `<div class="t-sm muted" style="margin-bottom:16px;line-height:1.6">
      Các món khách vừa gọi sẽ bị huỷ và hoàn lại kho. Nên trao đổi với khách trước khi từ chối.</div>
      <button class="btn danger" data-act="rejectOk" data-o="${d.o}">Từ chối đơn</button>
      <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
    return;
  }
  case 'rejectOk': {
    run(async () => { await api(`/orders/${d.o}/reject`, { method: 'POST' }); closeSheet();
      route = { name: 'tables', params: {} }; }, 'Đã từ chối đơn');
    return;
  }

  case 'cashPick': {
    window._cashGiven = Number(d.v);
    window._cashRaw = '';
    renderCashBox();
    return;
  }

  /* ---------- thanh toán ---------- */
  case 'pay': { window._cashGiven = 0; window._cashRaw = ''; go('pay', { id: d.o }); return; }
  case 'confirmPay': {
    const o = orderById(d.o);
    if (d.g === 'cash') {
      const { total } = orderTotal(o);
      const given = Number(window._cashGiven || Number((window._cashRaw || '0')) || 0);
      if (given && given < total) { toast(`Khách đưa thiếu ${fmt(total - given)}`); return; }
      if (given > total) window._lastChange = given - total;
      else window._lastChange = 0;
    } else window._lastChange = 0;
    run(async () => {
      const p = await api(`/orders/${d.o}/payments`, { method: 'POST', idem: uid('pay'), body: { method: d.g } });
      if (p.state !== 'paid') await api(`/payments/${p.paymentId}/confirm`, { method: 'POST' });
      const t = o.tableId ? tableById(o.tableId) : null;
      lastPaid = { total: p.total, method: (DB.gateways.find(g => g.id === d.g) || {}).name || d.g,
                   ts: now(), label: t ? `${t.name} · Ghế ${o.seatNo}` : 'Giao hàng' };
      // Nội dung hoá đơn dựng NGAY lúc thanh toán (đơn đã đóng thì không còn trong danh sách đơn đang mở)
      try { lastPaid.model = modelFromOrder(o, { kind: 'paid', method: lastPaid.method, total: p.total, given: d.g === 'cash' ? Number(window._cashGiven || Number(window._cashRaw || '0') || 0) : 0, change: window._lastChange || 0 }); } catch (e) {}
      route = { name: 'paid', params: {} };
      if (devicePref('billAuto', false) && lastPaid.model) printBill(lastPaid.model);
    });
    return;
  }
  case 'printerScan': {
    if (typeof NativeBridge === 'undefined' || !NativeBridge.printer) { toast('Chỉ quét được máy in trên app cài trên điện thoại'); return; }
    window._pfound = []; window._pscanning = true; render();
    NativeBridge.printer.scan(list => { window._pfound = list; if (route.name === 'billing' && safeToRender()) render(); })
      .catch(() => toast('Không quét được máy in — kiểm tra đã bật Bluetooth và cấp quyền cho app'))
      .finally(() => { window._pscanning = false; if (route.name === 'billing' && safeToRender()) render(); });
    return;
  }
  case 'printerPick': { setPrinterCfg({ address: d.addr, name: d.nm || d.addr }); window._pfound = null; toast('Đã chọn máy in — bấm "In thử" để kiểm tra'); render(); return; }
  case 'printerManual': {
    const a = val('prAddr').trim().toUpperCase();
    if (!/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(a)) { toast('Địa chỉ máy in có dạng AA:BB:CC:DD:EE:FF'); return; }
    setPrinterCfg({ address: a, name: a }); toast('Đã chọn máy in'); render(); return;
  }
  case 'printerWidth': { setPrinterCfg({ width: Number(d.w) === 80 ? 80 : 58 }); render(); return; }
  case 'printerForget': {
    setPrinterCfg({ address: '', name: '' });
    try { if (typeof NativeBridge !== 'undefined' && NativeBridge.printer) NativeBridge.printer.disconnect(); } catch (e) {}
    toast('Đã bỏ máy in'); render(); return;
  }
  case 'printerTest': {
    printBill(receiptModel({ kind: 'paid', code: '#TEST', where: 'Bàn 01 · Ghế 1', ts: now(), cashier: ME ? ME.name : '',
      items: [{ name: 'Phở bò tái', qty: 2, price: 65000 }, { name: 'Trà đá', qty: 2, price: 10000, note: 'ít đá' }],
      subtotal: 150000, discount: 0, total: 150000, method: 'Tiền mặt', given: 200000, change: 50000 }));
    return;
  }
  case 'saveBillFooter': { run(() => api('/settings', { method: 'PATCH', body: { billFooter: val('billFooter').trim() } }), 'Đã lưu'); return; }
  case 'print': { if (!lastPaid || !lastPaid.model) { toast('Không có hoá đơn để in'); return; } printBill(lastPaid.model); return; }
  case 'billPdf': { if (!lastPaid || !lastPaid.model) { toast('Không có hoá đơn để in'); return; } printBill(lastPaid.model, true); return; }
  case 'printBill': { const o = orderById(d.o); if (!o) { toast('Không tìm thấy đơn'); return; } printBill(modelFromOrder(o)); return; }
  case 'histPrint': { if (!window._histDetail) return; printBill(modelFromDetail(window._histDetail), d.pdf === '1'); return; }

  /* ---------- bếp ---------- */
  case 'kdsToggle': {
    const o = orderById(d.o), i = o.items.find(x => x.lid === d.l);
    const next = i.status === 'queued' ? 'start' : i.status === 'cooking' ? 'done' : 'reset';
    run(() => api(`/kds/items/${d.l}/${next}`, { method: 'POST' }));
    return;
  }
  case 'kdsBulk': {
    // Gom mọi phần cùng món đang ở trạng thái trước đó rồi chuyển một lượt
    const from = d.to === 'served' ? 'cooking' : 'queued';
    const action = d.to === 'served' ? 'done' : 'start';
    const list = [];
    DB.orders.filter(o => o.status === 'open').forEach(o => o.items.forEach(i => {
      if (i.name === d.name && i.status === from && (d.k === 'all' || i.kitchen === d.k)) list.push(i.lid);
    }));
    if (!list.length) { toast('Không còn phần nào ở trạng thái này'); return; }
    run(async () => { for (const lid of list) await api(`/kds/items/${lid}/${action}`, { method: 'POST' }); },
      d.to === 'served' ? `Đã xong ${list.length} phần` : `Đã bắt đầu làm ${list.length} phần`);
    return;
  }
  case 'kdsDone': {
    const o = orderById(d.o);
    const list = o.items.filter(i => (d.k === 'all' || i.kitchen === d.k) && i.status !== 'served');
    run(async () => { for (const i of list) await api(`/kds/items/${i.lid}/done`, { method: 'POST' }); }, 'Đã hoàn tất vé bếp');
    return;
  }

  /* ---------- đặt bàn ---------- */
  case 'resv': {
    run(async () => {
      await api('/reservations/' + d.id, { method: 'PATCH', body: { status: d.v } });
      const r = DB.reservations.find(x => x.id === d.id);
      if (d.v === 'arrived' && r?.tableId) {
        // Không gán cứng ghế 1 nữa — để nhân viên chọn ghế trống thật sự
        window._seatSel = new Set();
        route = { name: 'seatPick', params: { mode: 'order', t: r.tableId } };
      }
    }, 'Đã cập nhật');
    return;
  }
  case 'newResv': {
    const today = new Date().toISOString().slice(0, 10);
    window._resvSeats = new Set();
    sheet('Đặt bàn mới', `
      <div class="field"><label class="f">Tên khách</label><input class="input" id="rn" placeholder="vd. Chị Hương"></div>
      <div class="field"><label class="f">Số điện thoại</label><input class="input" id="rp" type="tel" placeholder="09xx xxx xxx"></div>
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <div class="field" style="flex:1 1 120px"><label class="f">Số khách</label>
          <input class="input" id="rg" type="number" min="1" value="4" data-act="resvGuests"></div>
        <div class="field" style="flex:1 1 120px"><label class="f">Giờ đến</label><input class="input" id="rt" type="time" value="19:00"></div>
      </div>
      <div class="field"><label class="f">Ngày</label><input class="input" id="rd" type="date" value="${today}"></div>
      <div class="field"><label class="f">Bàn</label>
        <select class="input" id="rb" data-act="resvTable">
          <option value="">Không giữ bàn cụ thể</option>
          ${DB.tables.map(t => `<option value="${t.id}">${esc(t.name)} · ${esc(t.area)} · ${t.seats} ghế</option>`).join('')}
        </select></div>
      <div id="resvSeatBox"></div>
      <div class="field"><label class="f">Ghi chú</label><input class="input" id="rnote" placeholder="vd. bàn gần cửa sổ"></div>
      <button class="btn pri" data-act="saveResv">Lưu đặt bàn</button>`);
    return;
  }
  /** Vẽ lại phần chọn ghế mỗi khi đổi bàn hoặc đổi số khách */
  case 'resvTable': case 'resvGuests': {
    if (a === 'resvTable') window._resvSeats = new Set();
    renderResvSeats();
    return;
  }
  case 'resvSeat': {
    const sel = window._resvSeats || (window._resvSeats = new Set());
    const n = Number(d.n);
    sel.has(n) ? sel.delete(n) : sel.add(n);
    renderResvSeats();
    return;
  }
  case 'resvSeatAll': {
    const t = tableById(val('rb'));
    if (!t) return;
    const sel = window._resvSeats || (window._resvSeats = new Set());
    const all = Array.from({ length: t.seats }, (_, i) => i + 1);
    const on = all.every(n => sel.has(n));
    window._resvSeats = new Set(on ? [] : all);
    renderResvSeats();
    return;
  }
  case 'saveResv': {
    const startAt = new Date(`${val('rd')}T${val('rt') || '19:00'}`).getTime();
    const guests = Number(val('rg')) || 1;
    const tableId = val('rb') || null;
    const seatNos = [...(window._resvSeats || [])].sort((x, y) => x - y);
    if (!val('rn').trim()) { toast('Nhập tên khách'); return; }
    if (tableId) {
      const t = tableById(tableId);
      const held = seatNos.length || t.seats;
      if (held < guests) { toast(`Đã chọn ${held} ghế nhưng có ${guests} khách — chọn thêm ${guests - held} ghế`); return; }
    }
    run(() => api('/reservations', { method: 'POST', body: {
      name: val('rn').trim(), phone: val('rp'), guests,
      tableId, seatNos, startAt, note: val('rnote') } }).then(closeSheet), 'Đã tạo lịch đặt bàn');
    return;
  }

  /* ---------- thực đơn ---------- */
  case 'editItem': case 'newItem': {
    const m = a === 'editItem' ? menuById(d.id) : null;
    window._miImage = (m && m.image) || null;
    sheet(m ? 'Sửa món' : 'Thêm món mới', `
      <div class="field"><label class="f">Hình ảnh món (không bắt buộc)</label>
        <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
          <div id="miPreview" style="width:56px;height:56px;border-radius:10px;overflow:hidden;background:var(--chip);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">${(m&&m.image)?`<img src="${m.image}" style="width:100%;height:100%;object-fit:cover">`:(m?esc(m.emoji):'🍽️')}</div>
          <input type="file" id="miFile" accept="image/*" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;pointer-events:none">
          <button class="btn sm ghost" data-act="pickMenuImage" style="flex:1 1 100px" type="button">Chọn ảnh</button>
          <button class="btn sm danger" data-act="clearMenuImage" style="flex:1 1 100px" type="button">Xoá ảnh</button>
        </div>
        <div class="t-xs" style="margin-top:6px">Ảnh sẽ tự thu nhỏ để không chiếm nhiều bộ nhớ máy. Không chọn ảnh thì vẫn dùng biểu tượng ${m?esc(m.emoji):'🍽️'}.</div>
        <div class="t-xs" style="margin-top:10px;margin-bottom:4px">Nút "Chọn ảnh" không mở được hộp thoại trên máy này? Dán liên kết ảnh vào đây thay thế:</div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <input class="input" id="miUrl" placeholder="https://..." style="flex:1 1 160px">
          <button class="btn sm ghost" data-act="useImageUrl" style="width:auto">Dùng ảnh này</button>
        </div>
      </div>
      <input type="hidden" id="me" value="${m ? esc(m.emoji) : '🍽️'}">
      <div class="field"><label class="f">Tên món</label><input class="input" id="mn" value="${m ? esc(m.name) : ''}" placeholder="vd. Bún bò Huế"></div>
      <div class="field"><label class="f">Giá bán (đ)</label><input class="input" id="mp" type="number" value="${m ? m.price : ''}" placeholder="65000"></div>
      <div class="field"><label class="f">Mô tả</label><input class="input" id="md" value="${m ? esc(m.desc) : ''}"></div>
      <div class="field"><label class="f">Danh mục</label><select class="input" id="mc">${DB.categories.map(c => `<option ${m && m.cat === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label class="f">Khu bếp</label><select class="input" id="mk">${DB.kitchens.map(c => `<option ${m && m.kitchen === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label class="f">Tình trạng</label><select class="input" id="ms">
        <option value="ok" ${m && m.stock === 'ok' ? 'selected' : ''}>Còn hàng</option>
        <option value="low" ${m && m.stock === 'low' ? 'selected' : ''}>Sắp hết</option>
        <option value="out" ${m && m.stock === 'out' ? 'selected' : ''}>Hết hàng</option></select></div>
      <button class="btn pri" data-act="saveItem" data-id="${m ? m.id : ''}">Lưu</button>
      ${m ? `<button class="btn ghost" data-act="editRecipe" data-id="${m.id}" style="margin-top:8px">${icon('box')} Công thức (${m.recipe.length} nguyên liệu)</button>
      <button class="btn danger" data-act="delMenuItem" data-id="${m.id}" style="margin-top:8px">Xoá món khỏi thực đơn</button>` : ''}`);
    return;
  }
  case 'pickMenuImage': { document.getElementById('miFile')?.click(); return; }
  case 'useImageUrl': {
    const url = val('miUrl').trim();
    if (!/^https?:\/\/.+\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(url)) {
      toast('Cần link ảnh hợp lệ, kết thúc bằng .jpg .png .webp hoặc .gif');
      return;
    }
    window._miImage = url;
    const box = document.getElementById('miPreview');
    if (box) box.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='⚠'">`;
    toast('Đã dùng ảnh từ liên kết');
    return;
  }
  case 'clearMenuImage': {
    window._miImage = null;
    const box = document.getElementById('miPreview');
    if (box) box.innerHTML = esc(val('me') || '🍽️');
    return;
  }
  case 'saveItem': {
    const body = { name: val('mn').trim(), price: Number(val('mp')), description: val('md'),
      emoji: val('me') || '🍽️', categoryId: DB.categoryIds[val('mc')], kitchenId: DB.kitchenIds[val('mk')],
      stockState: val('ms'), image: window._miImage || null };
    run(async () => {
      if (d.id) await api('/menu/' + d.id, { method: 'PATCH', body });
      else await api('/menu', { method: 'POST', body });
      closeSheet();
    }, 'Đã lưu');
    return;
  }
  case 'delMenuItem': { run(() => api('/menu/' + d.id, { method: 'DELETE' }).then(closeSheet), 'Đã xoá món'); return; }

  /* ---------- công thức ---------- */
  case 'editRecipe': {
    const m = menuById(d.id);
    sheet('Công thức · ' + m.name, `
      <div class="t-xs" style="margin-bottom:12px;line-height:1.6">Định lượng cho 1 phần. Mỗi lần khách gọi món, máy chủ tự trừ kho đúng theo công thức này và ghi vào lịch sử.</div>
      ${m.recipe.length ? m.recipe.map((r, idx) => { const ing = DB.inventory.find(i => i.id === r.ing);
        return `<div class="card between" style="margin-bottom:8px">
          <div><div class="t-md">${esc(ing ? ing.name : '(đã xoá)')}</div><div class="t-xs mono">${r.qty} ${esc(ing ? ing.unit : '')}/phần</div></div>
          <button data-act="delRecipe" data-id="${m.id}" data-i="${idx}" style="color:var(--red)" aria-label="Xoá">${icon('trash')}</button>
        </div>`; }).join('') : '<div class="empty" style="padding:20px">Chưa có nguyên liệu nào</div>'}
      <div class="sec">Thêm nguyên liệu</div>
      <div class="field"><select class="input" id="rg2">${DB.inventory.map(i => `<option value="${i.id}">${esc(i.name)} (${esc(i.unit)})</option>`).join('')}</select></div>
      <div class="field"><label class="f">Định lượng cho 1 phần</label><input class="input" id="rq" type="number" step="0.01" placeholder="vd. 0.15"></div>
      <button class="btn pri" data-act="addRecipe" data-id="${m.id}">Thêm vào công thức</button>
      <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Xong</button>`);
    return;
  }
  case 'addRecipe': {
    const m = menuById(d.id), qty = Number(val('rq'));
    if (!(qty > 0)) { toast('Nhập định lượng hợp lệ'); return; }
    const ing = val('rg2');
    const lines = m.recipe.filter(r => r.ing !== ing).map(r => ({ ingredientId: r.ing, qtyPerServe: r.qty }));
    lines.push({ ingredientId: ing, qtyPerServe: qty });
    run(async () => { await api(`/menu/${m.id}/recipe`, { method: 'PUT', body: { lines } });
      handleAct({ dataset: { act: 'editRecipe', id: m.id } }); }, 'Đã lưu công thức');
    return;
  }
  case 'delRecipe': {
    const m = menuById(d.id);
    const lines = m.recipe.filter((_, i) => i !== Number(d.i)).map(r => ({ ingredientId: r.ing, qtyPerServe: r.qty }));
    run(async () => { await api(`/menu/${m.id}/recipe`, { method: 'PUT', body: { lines } });
      handleAct({ dataset: { act: 'editRecipe', id: m.id } }); });
    return;
  }

  /* ---------- kho ---------- */
  case 'newIng': case 'editIng': {
    const i = a === 'editIng' ? DB.inventory.find(x => x.id === d.id) : null;
    sheet(i ? 'Sửa nguyên liệu' : 'Thêm nguyên liệu', `
      <div class="field"><label class="f">Tên nguyên liệu</label><input class="input" id="in" value="${i ? esc(i.name) : ''}"></div>
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <div class="field" style="flex:1 1 120px"><label class="f">Đơn vị</label><input class="input" id="iu" value="${i ? esc(i.unit) : 'kg'}"></div>
        <div class="field" style="flex:1 1 120px"><label class="f">Ngưỡng cảnh báo</label><input class="input" id="im" type="number" step="0.1" value="${i ? i.min : 3}"></div>
      </div>
      ${i ? `<div class="card between" style="margin-bottom:14px"><span class="t-sm">Tồn hiện tại</span><span class="mono t-md">${i.qty} ${esc(i.unit)}</span></div>
      <div class="t-xs" style="margin-bottom:14px">Muốn đổi số tồn phải lập phiếu nhập hoặc xuất, để luôn có vết đối chiếu.</div>`
      : `<div class="field"><label class="f">Tồn ban đầu</label><input class="input" id="iq" type="number" step="0.1" value="0"></div>`}
      <button class="btn pri" data-act="saveIng" data-id="${i ? i.id : ''}">Lưu</button>`);
    return;
  }
  case 'saveIng': {
    const body = { name: val('in').trim(), unit: val('iu'), minQty: Number(val('im')) };
    run(async () => {
      if (d.id) await api('/ingredients/' + d.id, { method: 'PATCH', body });
      else await api('/ingredients', { method: 'POST', body: { ...body, qty: Number(val('iq')) || 0 } });
      closeSheet();
    }, 'Đã lưu');
    return;
  }
  case 'stockIn': case 'stockOut': {
    const isIn = a === 'stockIn';
    sheet(isIn ? 'Nhập kho' : 'Xuất kho', `
      <div class="field"><label class="f">Nguyên liệu</label><select class="input" id="sg">
        ${DB.inventory.map(i => `<option value="${i.id}">${esc(i.name)} — còn ${i.qty} ${esc(i.unit)}</option>`).join('')}</select></div>
      <div class="field"><label class="f">Số lượng</label><input class="input" id="sq" type="number" step="0.1" placeholder="vd. 5"></div>
      <div class="field"><label class="f">Lý do</label><input class="input" id="sr" placeholder="${isIn ? 'vd. Nhập hàng từ nhà cung cấp' : 'vd. Hỏng, trả hàng, kiểm kê'}"></div>
      <button class="btn ${isIn ? 'ok' : 'danger'}" data-act="saveStock" data-t="${isIn ? 'in' : 'out'}">${isIn ? 'Xác nhận nhập' : 'Xác nhận xuất'}</button>`);
    return;
  }
  case 'saveStock': {
    const body = { ingredientId: val('sg'), type: d.t, qty: Number(val('sq')), reason: val('sr'), force: d.force === '1' };
    if (!(body.qty > 0)) { toast('Nhập số lượng hợp lệ'); return; }
    (async () => {
      try {
        await api('/stock/moves', { method: 'POST', body });
        await refresh(); closeSheet(); render(); toast(d.t === 'in' ? 'Đã nhập kho' : 'Đã xuất kho');
      } catch (e) {
        if (e.data?.needConfirm) {
          const ing = DB.inventory.find(i => i.id === body.ingredientId);
          sheet('Xuất quá tồn kho?', `<div class="t-sm muted" style="margin-bottom:16px;line-height:1.6">Kho <b>${esc(ing.name)}</b> chỉ còn ${e.data.available} ${esc(ing.unit)}. Xuất ${body.qty} sẽ làm kho âm.</div>
            <button class="btn danger" data-act="forceStock" data-i="${body.ingredientId}" data-q="${body.qty}" data-r="${esc(body.reason)}">Vẫn xuất</button>
            <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
        } else toast(e.message);
      }
    })();
    return;
  }
  case 'forceStock': {
    run(() => api('/stock/moves', { method: 'POST', body: { ingredientId: d.i, type: 'out', qty: Number(d.q), reason: d.r || 'Xuất vượt tồn kho', force: true } }).then(closeSheet), 'Đã xuất, kho đang âm');
    return;
  }

  /* ---------- khuyến mãi ---------- */
  case 'newPromo': case 'editPromo': {
    const p = a === 'editPromo' ? DB.promos.find(x => x.id === d.id) : null;
    sheet(p ? 'Sửa khuyến mãi' : 'Tạo khuyến mãi', `
      <div class="field"><label class="f">Tên chương trình</label><input class="input" id="pn" value="${p ? esc(p.name) : ''}"></div>
      <div class="field"><label class="f">Loại giảm giá</label><select class="input" id="pt">
        <option value="pct" ${p && p.type === 'pct' ? 'selected' : ''}>Theo phần trăm</option>
        <option value="amt" ${p && p.type === 'amt' ? 'selected' : ''}>Số tiền cố định</option></select></div>
      <div class="field"><label class="f">Giá trị giảm</label><input class="input" id="pv" type="number" value="${p ? p.value : ''}"></div>
      <div class="field"><label class="f">Đơn tối thiểu (đ)</label><input class="input" id="pm" type="number" value="${p ? p.min : 0}"></div>
      <div class="field"><label class="f">Giới hạn lượt (0 = không giới hạn)</label><input class="input" id="pl" type="number" value="${p ? p.limit : 0}"></div>
      <div class="field"><label class="f">Ngày hết hạn</label><input class="input" id="pe" type="date" value="${p ? p.expire : ''}"></div>
      <button class="btn pri" data-act="savePromo" data-id="${p ? p.id : ''}">Lưu</button>`);
    return;
  }
  case 'savePromo': {
    const body = { name: val('pn').trim(), type: val('pt'), value: Number(val('pv')),
      minTotal: Number(val('pm')), useLimit: Number(val('pl')), expiresOn: val('pe') || null };
    run(async () => {
      if (d.id) await api('/promos/' + d.id, { method: 'PATCH', body });
      else await api('/promos', { method: 'POST', body });
      closeSheet();
    }, 'Đã lưu');
    return;
  }
  case 'togglePromo': {
    const p = DB.promos.find(x => x.id === d.id);
    run(() => api('/promos/' + d.id, { method: 'PATCH', body: { active: !p.active } }));
    return;
  }

  /* ---------- nhân viên ---------- */
  case 'perm': {
    const s = DB.staff.find(x => x.id === d.id);
    const perms = { ...s.perms, [d.k]: el.checked };
    run(() => api('/staff/' + d.id, { method: 'PATCH', body: { perms } }));
    return;
  }
  case 'toggleStaff': {
    const s = DB.staff.find(x => x.id === d.id);
    run(() => api('/staff/' + d.id, { method: 'PATCH', body: { active: !s.active } }));
    return;
  }
  case 'delStaffAsk': {
    const s = DB.staff.find(x => x.id === d.id);
    sheet('Xoá hẳn tài khoản?', `<div class="t-sm muted" style="margin-bottom:16px;line-height:1.6">Xoá hẳn tài khoản <b>${esc(s.name)}</b> (${esc(s.user)}) khỏi danh sách nhân viên. Không thể hoàn tác — nếu cần dùng lại, phải tạo tài khoản mới.</div>
      <button class="btn danger" data-act="delStaffGo" data-id="${esc(s.id)}">Xoá</button>
      <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
    return;
  }
  case 'delStaffGo': {
    run(() => api('/staff/' + d.id, { method: 'DELETE' }).then(() => { closeSheet(); go('staff', {}); }), 'Đã xoá tài khoản');
    return;
  }
  case 'resetPw': {
    (async () => {
      try {
        const r = await api(`/staff/${d.id}/reset-password`, { method: 'POST' });
        const s = DB.staff.find(x => x.id === d.id);
        sheet('Mật khẩu tạm thời', `<div class="card col" style="align-items:center;gap:8px;padding:24px">
          <div class="t-xs">Gửi cho ${esc(s.name)}</div><div class="mono" style="font-size:26px;font-weight:700;letter-spacing:2px">${esc(r.tempPassword)}</div>
          <div class="t-xs" style="text-align:center">Nhân viên phải đổi mật khẩu ở lần đăng nhập đầu. Mọi phiên cũ đã bị thu hồi.</div></div>
          <button class="btn pri" data-act="closeSheet" style="margin-top:12px">Xong</button>`);
      } catch (e) { toast(e.message); }
    })();
    return;
  }
  case 'newStaff': {
    sheet('Thêm nhân viên', `
      <div class="field"><label class="f">Họ và tên</label><input class="input" id="sn" placeholder="vd. Trần Thu Hà"></div>
      <div class="field"><label class="f">Vai trò</label><select class="input" id="sr2">
        <option>Phục vụ</option><option>Thu ngân</option><option>Bếp</option><option>Quản lý</option></select></div>
      <div class="field"><label class="f">Tên đăng nhập</label><input class="input" id="su" placeholder="vd. ha.phucvu"></div>
      <button class="btn pri" data-act="saveStaff">Tạo tài khoản</button>`);
    return;
  }
  case 'saveStaff': {
    (async () => {
      try {
        const r = await api('/staff', { method: 'POST', body: { name: val('sn').trim(), role: val('sr2'), username: val('su').trim() } });
        await refresh();
        sheet('Đã tạo tài khoản', `<div class="card col" style="align-items:center;gap:8px;padding:24px">
          <div class="t-xs">Mật khẩu tạm thời</div><div class="mono" style="font-size:26px;font-weight:700;letter-spacing:2px">${esc(r.tempPassword)}</div>
          <div class="t-xs" style="text-align:center">Nhân viên đổi mật khẩu ở lần đăng nhập đầu.</div></div>
          <button class="btn pri" data-act="closeSheet" style="margin-top:12px">Xong</button>`);
      } catch (e) { toast(e.message); }
    })();
    return;
  }

  case 'retryVietQrBanks': { loadVietQrBanksLive({ retry: true }); render(); return; }
  case 'saveVietQr': {
    const bin = val('vqrBank'), acc = val('vqrAcc').trim(), name = val('vqrName').trim().toUpperCase();
    if (!bin) { toast('Chọn ngân hàng'); return; }
    if (!/^\d{6,19}$/.test(acc)) { toast('Số tài khoản không hợp lệ — chỉ gồm chữ số'); return; }
    run(() => api('/settings', { method: 'PATCH', body: { vietqrBin: bin, vietqrAccount: acc, vietqrName: name } }), 'Đã lưu tài khoản VietQR');
    return;
  }
  case 'editRestaurant': {
    sheet('Thông tin nhà hàng', `
      <div class="field"><label class="f">Tên nhà hàng</label>
        <input class="input" id="rname" value="${esc(DB.restaurant.name || '')}" placeholder="vd. Nhà Hàng Sen Vàng"></div>
      <div class="field"><label class="f">Số điện thoại</label>
        <input class="input" id="rphone" type="tel" value="${esc(DB.restaurant.phone || '')}" placeholder="vd. 028 1234 5678"></div>
      <div class="field"><label class="f">Địa chỉ (in trên hoá đơn)</label>
        <input class="input" id="raddr" value="${esc(DB.restaurant.address || '')}" placeholder="vd. 12 Nguyễn Huệ, Quận 1"></div>
      <div class="t-xs" style="margin-bottom:14px">Hiện ở màn đăng nhập, đầu app, và trang khách quét QR gọi món.</div>
      <button class="btn pri" data-act="saveRestaurant">Lưu</button>`);
    return;
  }
  case 'saveRestaurant': {
    const name = val('rname').trim();
    if (!name) { toast('Nhập tên nhà hàng'); return; }
    run(() => api('/restaurant', { method: 'PATCH', body: { name, phone: val('rphone').trim(), address: val('raddr').trim() } }).then(closeSheet), 'Đã lưu thông tin nhà hàng');
    return;
  }

  case 'applyPeriod': {
    const pf = val('pf'), pt = val('pt');
    if (pf && pt && pf > pt) { toast('Ngày bắt đầu phải trước ngày kết thúc'); return; }
    go(d.route, { ...route.params, period: 'custom', pf, pt });
    return;
  }

  /* ---------- cài đặt & báo cáo ---------- */
  case 'zoomQr': { openQrZoom(d.payload); return; }
  case 'setFontScale': {
    Persist.setMeta('fontScale', Number(d.k));
    applyFontScale(); render();
    return;
  }
  case 'setSetting': { run(() => api('/settings', { method: 'PATCH', body: { [d.k]: el.checked } })); return; }
  case 'pickChime': {
    playChime(Number(d.k), DB.settings.soundVolume);   // nghe ngay khi chọn, cho biết đang chọn đúng chuông nào
    run(() => api('/settings', { method: 'PATCH', body: { chime: Number(d.k) } }));
    return;
  }
  case 'pickLang': {
    setLang(d.k);
    if (window._routeAfterLang) { route = window._routeAfterLang; window._routeAfterLang = null; histStack.length = 0; }
    else toast(LANGS[d.k].name);
    render(); _applyAll(); return;
  }
  case 'tryChime': {
    playChime(DB.settings.chime || 1, DB.settings.soundVolume, true);
    if (devicePref('vibrate', true)) vibratePhone();
    return;
  }
  case 'tryNotify': {
    // Gửi thử một thông báo hệ thống (đúng như khi app chạy nền) — để kiểm tra quyền thông báo, chuông và rung của máy này
    if (typeof NativeBridge === 'undefined' || !NativeBridge.alerts) { toast('Chỉ thử được trên app cài trên điện thoại'); return; }
    NativeBridge.alerts.notify({ title: trText('Thử thông báo'), body: trText('Nếu nghe chuông và thấy rung là máy đã sẵn sàng'), chime: DB.settings.chime || 1, vibrate: devicePref('vibrate', true), test: true })
      .then(ok => toast(ok ? 'Đã gửi thông báo thử — kéo thanh trạng thái xuống để xem' : 'Chưa cấp quyền thông báo — vào Cài đặt điện thoại > Ứng dụng > Quyền > Thông báo để bật'));
    return;
  }
  case 'devPref': {
    // Tuỳ chọn riêng từng máy (không đồng bộ): rung / nhận thông báo khi chạy nền
    setDevicePref(d.k, !!el.checked);
    if (d.k === 'background') ensureKeepAlive();
    if (d.k === 'vibrate' && el.checked) vibratePhone();
    render(); return;
  }
  case 'gw': { toast('Cuộn lên mục VietQR/payOS phía trên để cấu hình'); el.checked = !el.checked; return; }
  case 'expSrv': { exportExcelLocal(d.k, d.from ? Number(d.from) : null, d.to ? Number(d.to) : null); return; }
  case 'noPerm': { toast('Bạn không có quyền vào mục này'); return; }

  /* ---------- BỘ CHỌN GHẾ DÙNG CHUNG ---------- */
  case 'seatPickAt': { window._seatSel = new Set(); go('seatPick', { mode: d.mode, t: d.t }); return; }
  case 'seatPickStart': { window._seatSel = new Set(); go('seatPick', { mode: d.mode, from: d.from || '' }); return; }
  case 'seatToggle': {
    const sel = window._seatSel || (window._seatSel = new Set());
    sel.has(d.k) ? sel.delete(d.k) : sel.add(d.k);
    render(); return;
  }
  case 'seatAll': {
    const t = tableById(d.t), sel = window._seatSel || (window._seatSel = new Set());
    const ok = Array.from({ length: t.seats }, (_, i) => i + 1).filter(n => seatEligible(d.mode, t.id, n));
    const allOn = ok.length && ok.every(n => sel.has(seatKey(t.id, n)));
    ok.forEach(n => allOn ? sel.delete(seatKey(t.id, n)) : sel.add(seatKey(t.id, n)));
    render(); return;
  }
  case 'seatClear': { window._seatSel = new Set(); render(); return; }
  case 'rotateGo': {
    const seats = window._rotateList || [];
    run(async () => {
      for (const s of seats) await api(`/seats/${s.tableId}/${s.seatNo}/rotate`, { method: 'POST' });
      window._rotateList = null; window._seatSel = new Set();
      closeSheet(); back();
    }, 'Đã đổi mã — nhớ in lại tem');
    return;
  }
  /* ---------- IN MÃ QR ---------- */
  case 'qrSeat': {
    const sel = window._qrSel || (window._qrSel = new Set());
    sel.has(d.k) ? sel.delete(d.k) : sel.add(d.k);
    render(); return;
  }
  case 'qrTable': {
    const t = tableById(d.t), sel = window._qrSel || (window._qrSel = new Set());
    const keys = Array.from({ length: t.seats }, (_, i) => t.id + ':' + (i + 1));
    const allOn = keys.every(k => sel.has(k));
    keys.forEach(k => allOn ? sel.delete(k) : sel.add(k));
    render(); return;
  }
  case 'qrSelAll': {
    const sel = window._qrSel || (window._qrSel = new Set());
    DB.tables.forEach(t => { for (let n = 1; n <= t.seats; n++) sel.add(t.id + ':' + n); });
    render(); return;
  }
  case 'qrSelNone': { window._qrSel = new Set(); render(); return; }
  case 'qrPrintGo': {
    const sel = [...(window._qrSel || [])];
    if (!sel.length) { toast('Chưa chọn tem nào'); return; }
    openQrSheet(sel);
    return;
  }
  case 'seatGo': {
    const sel = [...(window._seatSel || [])];
    if (!sel.length) return;
    const seats = sel.map(k => { const [tableId, seatNo] = k.split('#'); return { tableId, seatNo: Number(seatNo) }; });
    const mode = d.mode;

    if (mode === 'lock' || mode === 'unlock') {
      run(async () => { await api('/seats/bulk-lock', { method: 'POST', body: { seats, locked: mode === 'lock' } });
        window._seatSel = new Set(); back(); }, mode === 'lock' ? 'Đã khoá mã QR — khách không gọi món được nữa' : 'Đã mở lại mã QR');
      return;
    }
    if (mode === 'clean') {
      run(async () => {
        const r = await api('/seats/bulk-clear', { method: 'POST', body: { seats } });
        window._seatSel = new Set(); back();
        if (r.busy?.length) toast(`${r.busy.length} ghế còn đơn chưa thanh toán, chưa dọn được`);
      }, 'Đã dọn bàn, mã QR mở lại');
      return;
    }
    if (mode === 'call') {
      run(async () => { for (const s of seats) await api(`/seats/${s.tableId}/${s.seatNo}/clear-call`, { method: 'POST' });
        window._seatSel = new Set(); back(); }, 'Đã đánh dấu xử lý');
      return;
    }
    if (mode === 'rotate') {
      sheet('Đổi mã QR?', `<div class="t-sm muted" style="margin-bottom:16px;line-height:1.6">
        ${seats.length} ghế sẽ nhận mã QR mới. <b>Mã đã in trước đó lập tức hết hiệu lực</b> — nhớ in lại tem cho các ghế này.</div>
        <button class="btn danger" data-act="rotateGo">Đổi mã mới</button>
        <button class="btn ghost" data-act="closeSheet" style="margin-top:8px">Huỷ</button>`);
      window._rotateList = seats;
      return;
    }
    if (mode === 'print') {
      window._qrSel = new Set(seats.map(s => s.tableId + ':' + s.seatNo));
      window._seatSel = new Set();
      go('qrPrint', {});
      return;
    }
    if (mode === 'merge') {
      // Nhiều ghế có thể cùng thuộc một hoá đơn gộp → khử trùng theo mã đơn; ghế/bàn có thể ở nhiều bàn, nhiều khu khác nhau.
      const ids = [...new Set(seats.map(s => openOrderFor(s.tableId, s.seatNo)).filter(Boolean).map(o => o.id))];
      if (ids.length < 2) { toast('Cần chọn ít nhất 2 ghế thuộc 2 hoá đơn khác nhau'); return; }
      const fromCashier = d.from === 'cashier';
      run(async () => {
        const o = await api('/orders/merge', { method: 'POST', body: { orderIds: ids } });
        window._seatSel = new Set();
        histStack.length = 0;
        route = { name: 'order', params: { id: o.id, ...(fromCashier ? { from: 'cashier' } : {}) } };
      }, `Đã gộp ${ids.length} hoá đơn — các ghế này giờ dùng chung một hoá đơn`);
      return;
    }
    if (mode === 'transfer') {
      // Chuyển nhiều ghế / cả bàn cùng lúc: giữ thứ tự theo bàn rồi theo số ghế để khớp với thứ tự chọn chỗ mới
      const order = new Map(DB.tables.map((t, i) => [t.id, i]));
      window._moveSrc = seats.sort((a, b) => (order.get(a.tableId) - order.get(b.tableId)) || (a.seatNo - b.seatNo));
      window._moveDst = [];
      window._seatSel = new Set();
      go('transferTo', { from: d.from || '' });
      return;
    }
    if (mode === 'order') {
      if (seats.length !== 1) { toast('Gọi món chỉ chọn một ghế'); return; }
      window._cart = {}; window._seatSel = new Set();
      go('newOrder', { t: seats[0].tableId, s: seats[0].seatNo });
      return;
    }
    return;
  }

  case 'splitPick': {
    const o = orderById(d.o);
    const others = (o.seats || []).filter(x => !(x.tableId === o.tableId && x.seatNo === o.seatNo));
    if (!others.length) { toast('Không còn ghế nào để tách'); return; }
    sheet('Tách ghế khỏi hoá đơn gộp', `
      <div class="t-xs" style="margin-bottom:12px;line-height:1.6">Món do ghế được chọn gọi sẽ chuyển sang một hoá đơn riêng. Ghế gốc của đơn không tách được.</div>
      ${others.map(x => {
        const tb = tableById(x.tableId);
        const n = o.items.filter(i => i.originTable === x.tableId && i.originSeat === x.seatNo).length;
        return `<button class="card between" data-act="splitGo" data-o="${o.id}" data-t="${x.tableId}" data-s="${x.seatNo}"
            style="width:100%;text-align:left;margin-bottom:8px;${n ? '' : 'opacity:.45'}" ${n ? '' : 'disabled'}>
          <div><div class="t-md">${esc(tb ? tb.name : 'Bàn')} · Ghế ${x.seatNo}</div>
          <div class="t-xs">${n ? n + ' món đã gọi' : 'chưa gọi món nào'}</div></div>
          ${icon('back')}
        </button>`;
      }).join('')}`);
    return;
  }
  case 'splitGo': {
    run(async () => {
      const o = await api(`/orders/${d.o}/split`, { method: 'POST', body: { tableId: d.t, seatNo: Number(d.s) } });
      closeSheet();
      route = { name: 'order', params: { id: o.id } };
    }, 'Đã tách ra hoá đơn riêng');
    return;
  }

  /* ---------- MÃ QR THỰC ĐƠN (xem, không đặt món) ---------- */
  case 'exportMenuPage': { exportMenuPage(); return; }
  case 'saveMenuQrLink': {
    const url = val('menuUrl').trim();
    if (!/^https?:\/\//i.test(url)) { toast('Cần nhập link hợp lệ, bắt đầu bằng http:// hoặc https://'); return; }
    run(() => api('/settings', { method: 'PATCH', body: { menuPageUrl: url } }), 'Đã lưu link — mã QR bên dưới đã cập nhật');
    return;
  }
  case 'printMenuQr': {
    const url = DB.settings.menuPageUrl;
    if (!url) { toast('Chưa có link trang thực đơn — nhập link ở trên trước'); return; }
    saveQrPdf([{ shop: DB.restaurant.name || '', where: trText('Quét mã xem thực đơn'), hint: trText('Giá và món có thể thay đổi') + ', ' + trText('vui lòng hỏi nhân viên để biết chi tiết'),
                 area: '', matrix: QR.matrix(url) }], `tem-qr-thuc-don-${new Date().toISOString().slice(0, 10)}.pdf`);
    return;
  }

  /* ---------- LỊCH SỬ ĐƠN ---------- */
  case 'histFilter': { route.params.hf = d.hf; window._history = []; loadHistory(true); return; }
  case 'histMore': { loadHistory(false); return; }
  case 'histOpen': {
    window._histDetail = null;
    go('historyDetail', { id: d.id });
    (async () => {
      try { window._histDetail = await api(`/orders/${d.id}/detail`); render(); }
      catch (e) { toast(e.message); }
    })();
    return;
  }

  case 'moveDstToggle': {
    const dst = window._moveDst || (window._moveDst = []);
    const i = dst.indexOf(d.k);
    if (i >= 0) dst.splice(i, 1);
    else if (dst.length >= (window._moveSrc || []).length) { toast('Đã chọn đủ ghế đích — bỏ bớt một ghế nếu muốn đổi'); return; }
    else dst.push(d.k);
    render(); return;
  }
  case 'moveDstFill': {
    // Điền tự động: lấy các ghế trống đầu tiên của bàn này cho những ghế nguồn còn thiếu
    const t = tableById(d.t), dst = window._moveDst || (window._moveDst = []);
    const need = (window._moveSrc || []).length - dst.length;
    const free = Array.from({ length: t.seats }, (_, i) => i + 1).filter(n => !openOrderFor(t.id, n) && !dst.includes(t.id + '#' + n));
    if (need <= 0) { toast('Đã chọn đủ ghế đích'); return; }
    free.slice(0, need).forEach(n => dst.push(t.id + '#' + n));
    if (free.length < need) toast(`Bàn này chỉ còn ${free.length} ghế trống — chọn thêm ở bàn khác`);
    render(); return;
  }
  case 'moveDstClear': { window._moveDst = []; render(); return; }
  case 'moveGo': {
    const src = window._moveSrc || [], dst = window._moveDst || [];
    if (!src.length || dst.length !== src.length) { toast('Chọn đủ ghế đích trước'); return; }
    const moves = src.map((x, i) => { const [tableId, seatNo] = dst[i].split('#'); return { from: { tableId: x.tableId, seatNo: x.seatNo }, to: { tableId, seatNo: Number(seatNo) } }; });
    const fromCashier = route.params.from === 'cashier';
    run(async () => {
      const r = await api('/orders/move-seats', { method: 'POST', body: { moves } });
      window._moveSrc = null; window._moveDst = null;
      histStack.length = 0;
      route = (r.orderIds && r.orderIds.length === 1 && !fromCashier)
        ? { name: 'order', params: { id: r.orderIds[0] } }
        : { name: fromCashier ? 'cashier' : 'tables', params: {} };
    }, `Đã chuyển ${moves.length} ghế sang chỗ mới`);
    return;
  }

  /* ---------- ghép bàn / chuyển ghế ---------- */

  }
  return false;
}

/** Thu nhỏ ảnh món ăn về đúng kích thước cần hiển thị trên điện thoại/tablet
    trước khi lưu, để không đẩy dung lượng lưu trữ lên cao. Vẽ lại qua canvas
    ở cạnh dài tối đa maxDim (px) rồi nén JPEG — vài chục KB một ảnh, đủ nét
    cho ô hình 46–56px trong danh sách món. */
function resizeImageFile(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Không đọc được tệp ảnh'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Tệp không phải ảnh hợp lệ'));
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight;
        if (!w || !h) { reject(new Error('Không đọc được kích thước ảnh')); return; }
        if (w > h) { if (w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; } }
        else { if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; } }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        try { resolve(canvas.toDataURL('image/jpeg', quality)); }
        catch (e) { reject(new Error('Không nén được ảnh')); }
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

/** Tải ảnh (đã nén thành dataUrl) lên kho Storage của quán thay vì nhúng base64 thẳng vào dữ liệu
    món — base64 nhúng trong cột dữ liệu làm phình dung lượng CSDL (giới hạn 500MB gói miễn phí) và
    tốn băng thông (mọi lần đồng bộ/khách xem thực đơn đều tải lại nguyên ảnh). Tên tệp ngẫu nhiên,
    không trùng nhau giữa các món. Nếu chưa liên kết Supabase của quán, hoặc tải lên lỗi (có thể do
    chưa chạy script SQL mới có kho ảnh) — dùng tạm base64 như cũ, không chặn việc lưu món. */
async function uploadMenuImage(dataUrl, box) {
  if (typeof Cloud === 'undefined' || !Cloud.store) {
    window._miImage = dataUrl;
    if (box) box.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
    toast('Chưa liên kết Supabase của quán — dùng tạm ảnh trong máy (nặng hơn, nên liên kết sớm)');
    return;
  }
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${crypto.randomUUID()}.jpg`;
    const { error } = await Cloud.store.storage.from('menu-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) throw error;
    const { data: pub } = Cloud.store.storage.from('menu-images').getPublicUrl(path);
    window._miImage = pub.publicUrl;
    if (box) box.innerHTML = `<img src="${pub.publicUrl}" style="width:100%;height:100%;object-fit:cover">`;
    toast('Đã tải ảnh lên — không chiếm dung lượng CSDL');
  } catch (e) {
    window._miImage = dataUrl;
    if (box) box.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
    toast('Không tải lên được kho ảnh (có thể chưa chạy lại script SQL mới) — dùng tạm ảnh trong máy');
  }
}

/* ---------- phóng to mã QR thanh toán ----------
   Chạm vào mã QR VietQR lúc thu tiền → toàn màn hình chỉ còn mã QR to, nền trắng sáng
   (tương phản tối đa, dễ quét ngay cả khi không tăng được độ sáng thật) + tăng độ sáng
   màn hình thật nếu máy hỗ trợ. Chạm lại bất kỳ đâu để thu nhỏ về như cũ. */
let qrZoomEl = null;   // theo dõi bằng biến JS, không dò qua DOM — tránh phụ thuộc getElementById tìm đúng id
/** payload = chuỗi VietQR (dựng bằng VietQR.payload) — vẽ bằng SVG ngay tại chỗ, không tải ảnh nên chạy được khi mất mạng. */
function openQrZoom(payload) {
  const src = payload;
  if (!src || qrZoomEl) return;
  NativeBridge.brightness.boost();
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:#fff;z-index:50;display:flex;align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top,0px) + 24px) 24px calc(env(safe-area-inset-bottom,0px) + 24px)';
  ov.innerHTML = `<div role="img" aria-label="Mã QR thanh toán" style="width:100%;max-width:min(92vw,92vh);aspect-ratio:1">${QR.svg(src, { label: 'Mã QR thanh toán VietQR' })}</div>
    <div style="position:absolute;bottom:env(safe-area-inset-bottom,24px);left:0;right:0;text-align:center;color:#999;font-size:13px">Chạm để thu nhỏ</div>`;
  ov.addEventListener('click', closeQrZoom);
  document.body.appendChild(ov);
  qrZoomEl = ov;
}
function closeQrZoom() {
  if (!qrZoomEl) return;
  qrZoomEl.remove(); qrZoomEl = null;
  NativeBridge.brightness.restore();
}

/* ---------- in tem QR ngay trong trang (không mở cửa sổ mới) ----------
   window.open() hay bị trình duyệt/khung xem trên di động chặn, đặc biệt khi
   không phải do đúng một cú bấm trực tiếp gọi ra. Cách này chỉ chèn một lớp
   phủ toàn màn hình vào chính trang đang mở rồi gọi window.print() — không
   cần cửa sổ nào khác, không cần quyền gì thêm. */
/** In tem QR — khổ cố định 50×60mm mỗi tem, giống tem in nhiệt/tem dán bàn thật.
    Không cho chọn số cột nữa: lưới tự xếp bao nhiêu tem vừa một hàng theo bề rộng
    giấy (CSS grid auto-fill), khổ mỗi tem luôn đúng 50×60mm khi in ra. */
/** Tạo FILE PDF khổ A4 chứa các tem (3 cột × 4 hàng, mỗi tem 50×60mm) rồi mở hộp thoại Lưu/Chia sẻ — người dùng tự in từ file PDF.
    Tên quán dài tự xuống dòng (xem src/web/pdf-qr.js). */
async function openQrSheet(keys){
  const tags = keys.map(k => {
    const [tid, sn] = k.split(':');
    const t = tableById(tid);
    const url = t && guestUrl(tid, Number(sn));
    if (!t || !url) return null;   // chưa lưu link trang gọi món, hoặc ghế này chưa có mã riêng
    return { shop: DB.restaurant.name || '', where: trText(`${t.name} · Ghế ${sn}`), hint: trText('Quét mã để xem thực đơn và gọi món tại bàn'),
             area: t.area || '', matrix: QR.matrix(url) };
  }).filter(Boolean);
  if (!tags.length) { toast('Không dựng được tem nào'); return; }
  await saveQrPdf(tags, `tem-qr-${new Date().toISOString().slice(0, 10)}.pdf`);
}
async function saveQrPdf(tags, filename) {
  toast('Đang tạo file PDF…');
  try {
    const blob = await QRPDF.build(tags);
    const ok = await saveFile(filename, blob, 'application/pdf');
    if (!ok) { toast('Thiết bị không hỗ trợ tải tệp'); return; }
    const pages = Math.ceil(tags.length / QRPDF.PER_PAGE);
    toast(`Đã tạo file PDF: ${tags.length} tem, ${pages} trang A4 — mở file để in`);
  } catch (e) { console.warn('QR PDF error:', e); toast('Không tạo được file PDF'); }
}

function renderTablePreview() {
  const box = document.getElementById('tblPreview');
  if (!box) return;
  box.innerHTML = tableChairsSvg({ id: '__preview__', seats: window._seats || 4, layout: window._layout || 'auto' });
  const el = box.querySelector('svg'); if (el) el.style.maxWidth = '220px';
}

/** Phần chọn ghế trong form đặt bàn: hiện ghế của bàn đang chọn kèm cảnh báo thiếu chỗ */
function renderResvSeats() {
  const box = document.getElementById('resvSeatBox');
  if (!box) return;
  const t = tableById(val('rb'));
  if (!t) { box.innerHTML = ''; return; }
  const sel = window._resvSeats || (window._resvSeats = new Set());
  const guests = Number(val('rg')) || 1;
  const held = sel.size || t.seats;
  const thieu = guests - held;
  const seats = Array.from({ length: t.seats }, (_, i) => i + 1);
  const allOn = seats.every(n => sel.has(n));
  box.innerHTML = `
    <div class="field">
      <div class="between" style="margin-bottom:8px">
        <label class="f" style="margin:0">Vị trí ghế trong ${esc(t.name)}</label>
        <button class="btn sm ${allOn ? '' : 'ghost'}" data-act="resvSeatAll" style="width:auto;padding:6px 12px">
          ${allOn ? 'Bỏ chọn' : 'Chọn cả bàn'}</button>
      </div>
      <div class="grid3">
        ${seats.map(n => {
          const busy = !!openOrderFor(t.id, n);
          return `<button class="chip ${sel.has(n) ? 'on' : ''}" data-act="resvSeat" data-n="${n}"
            style="justify-content:center;${busy ? 'opacity:.6' : ''}">${sel.has(n) ? '☑' : '☐'} Ghế ${n}</button>`;
        }).join('')}
      </div>
      <div class="t-xs" style="margin-top:8px;${thieu > 0 ? 'color:var(--red);font-weight:600' : 'color:var(--muted)'}">
        ${thieu > 0
          ? `⚠ ${guests} khách nhưng mới giữ ${held} ghế — cần chọn thêm ${thieu} ghế`
          : sel.size
            ? `Giữ ${sel.size} ghế cho ${guests} khách`
            : `Chưa chọn ghế cụ thể — giữ cả bàn ${t.seats} ghế cho ${guests} khách`}
      </div>
    </div>`;
}

/** Thu nhỏ ảnh món ăn về đúng kích thước cần hiển thị trên điện thoại/tablet
    trước khi lưu, để không đẩy dung lượng lưu trữ lên cao. Vẽ lại qua canvas
    ở cạnh dài tối đa maxDim (px) rồi nén JPEG — vài chục KB một ảnh, đủ nét
    cho ô hình 46–56px trong danh sách món. */

/* ---------- tải lịch sử đơn theo trang ---------- */
async function loadHistory(reset) {
  window._historyLoading = true; render();
  const f = route.params.hf || 'all';
  const rows = reset ? [] : (window._history || []);
  const before = rows.length ? rows[rows.length - 1].created_at : Date.now() + 1;
  try {
    const q = `/orders/history?limit=30&before=${before}${f !== 'all' ? '&status=' + f : ''}`;
    const r = await api(q);
    window._history = [...rows, ...r.rows];
  } catch (e) { toast(e.message); }
  window._historyLoading = false; render();
}

/** Đưa (các) tab/chip đang được chọn ra giữa thanh cuộn ngang của nó — gọi sau khi đổi tab
    (vuốt hoặc bấm trực tiếp) để người dùng luôn thấy rõ đang ở tab nào, không phải tự cuộn tìm. */
function centerActiveTabs() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.chip.on, .cats button.on').forEach(el => {
      const box = el.parentElement;
      if (!box) return;
      const cs = getComputedStyle(box);
      if (cs.overflowX !== 'auto' && cs.overflowX !== 'scroll') return;
      const br = box.getBoundingClientRect(), er = el.getBoundingClientRect();
      const target = box.scrollLeft + (er.left - br.left) - (br.width - er.width) / 2;
      box.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    });
  });
}

/* ---------- vuốt ngang để đổi khu vực / danh mục ---------- */
(function enableSwipe() {
  let x0 = null, y0 = null, target = null, el0 = null;
  document.addEventListener('touchstart', e => {
    const el = e.target.closest('[data-swipe]');
    if (!el) { target = null; el0 = null; return; }
    target = el.dataset.swipe; el0 = el;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', e => {
    if (x0 === null || !target) return;
    const dx = e.changedTouches[0].clientX - x0;
    const dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    // chỉ tính là vuốt ngang khi đi đủ xa và không phải cuộn dọc
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.6) return;
    shift(target, dx < 0 ? 1 : -1, el0);
  }, { passive: true });

  /** Đi tới phần tử kế tiếp trong một danh sách, quay vòng */
  function nextIn(list, cur, dir) {
    const i = list.indexOf(cur);
    return list[((i < 0 ? 0 : i) + dir + list.length) % list.length];
  }

  function shift(kind, dir, el) {
    if (kind === 'kitchen') {
      const list = ['all', ...DB.kitchens];
      if (list.length < 2) return;
      const cur = route.params.k || 'all';
      route.params.k = nextIn(list, cur, dir);
      render(); centerActiveTabs(); toast(route.params.k === 'all' ? 'Tất cả khu bếp' : route.params.k);
      return;
    }
    if (kind === 'tabs' && el) {
      // Màn có tab: vuốt để nhảy tab, danh sách khai báo ngay trên thẻ
      const list = (el.dataset.tabs || '').split('|').filter(Boolean);
      if (list.length < 2) return;
      const key = el.dataset.tabkey || 'tab';
      route.params[key] = nextIn(list, el.dataset.cur || list[0], dir);
      if (key === 'hf' && typeof loadHistory === 'function') { window._history = []; loadHistory(true); }
      else render();
      centerActiveTabs();
      return;
    }
    if (kind === 'routes' && el) {
      // Ba màn báo cáo nằm cạnh nhau: vuốt để đi qua lại
      const list = (el.dataset.routes || '').split('|').filter(Boolean);
      if (list.length < 2) return;
      const next = nextIn(list, el.dataset.cur || list[0], dir);
      if (next !== route.name) go(next, {});
      return;
    }
    if (kind === 'area') {
      // Một số màn chỉ hiện vài khu (Thu ngân chỉ hiện khu có khách) — vuốt theo đúng danh sách đó
      const list = (el && el.dataset.areas) ? el.dataset.areas.split('|').filter(Boolean) : DB.areas;
      if (list.length < 2) return;
      const cur = route.params.area || list[0];
      const i = (list.indexOf(cur) + dir + list.length) % list.length;
      route.params.area = list[i]; render(); centerActiveTabs(); toast(list[i]);
    } else if (kind === 'cat') {
      const list = DB.categories;
      if (list.length < 2) return;
      const cur = route.params.cat || list[0];
      const i = (list.indexOf(cur) + dir + list.length) % list.length;
      route.params.cat = list[i]; render(); centerActiveTabs(); toast(list[i]);
    }
  }
})();

/* ============ KHỞI ĐỘNG ============ */
/** Nút xoá chỉ có ở máy chủ quán: máy nhân viên bị chặn xoá ở cả giao diện lẫn Postgres */
const STAFF_DEVICE_HIDE = ['delTable', 'delMenuItem', 'delRecipe'];
function hideOwnerOnly(root) {
  if (!root || Cloud.role !== 'staff') return;
  root.querySelectorAll(STAFF_DEVICE_HIDE.map(a => `[data-act="${a}"]`).join(',')).forEach(el => el.remove());
}
/** Không vẽ lại khi người dùng đang gõ hoặc đang mở hộp thoại, kẻo mất chữ đang nhập */
function safeToRender() {
  if (sheetEl) return false;
  const ae = document.activeElement;
  return !(ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName));
}

/** Giữ app sống khi chạy nền (dịch vụ nền Android có thông báo cố định) để vẫn nhận đồng bộ và báo chuông/rung khi nhân viên
    đang mở app khác hoặc tắt màn hình. Chỉ chạy khi đã đăng nhập và người dùng chưa tắt ở Cài đặt (tuỳ chọn riêng từng máy). */
function ensureKeepAlive() {
  try {
    if (typeof NativeBridge === 'undefined' || !NativeBridge.alerts) return;
    NativeBridge.alerts.keepAlive(!!ME && devicePref('background', true));
  } catch (e) {}
}

/** Hỏi lại gói cước rồi CẬP NHẬT MÀN HÌNH nếu trạng thái khoá đổi. Trước đây chỉ vẽ lại khi vẫn còn khoá nên đã gia hạn xong
    (Google Play tự trừ tiền, RTDN cập nhật máy chủ) mà app vẫn kẹt ở màn "Gói cước đã hết hạn" tới khi bấm "Kiểm tra lại". */
let _licBusy = false, _licLast = 0;
async function recheckLicense(force) {
  if (_licBusy) return;
  _licBusy = true; _licLast = Date.now();
  const before = License.locked();
  try {
    if (Cloud.role === 'owner') await refreshLicenseWithPlay(!!force);
    else if (Cloud.role === 'staff') Sync.kick(0);      // máy nhân viên nhận gói cước qua đồng bộ từ máy chủ quán
  } catch (e) { /* mất mạng: giữ kết quả cũ, lần sau thử lại */ }
  _licBusy = false;
  const after = License.locked();
  if (ME && before !== after) {
    if (!after && route.name === 'locked') route = { name: homeScreen(), params: {} };
    if (safeToRender()) render();
  } else if (ME && after && route.name === 'locked' && safeToRender()) render();
}
/** Chạy mỗi 30 giây: gói sắp hết (còn dưới 2 phút) hoặc đã hết hạn thì hỏi lại — dày 30 giây trong 10 phút đầu (đợi Google gia hạn và
    thông báo RTDN về máy chủ), sau đó thưa dần 5 phút/lần. Gói còn dài hạn thì không làm gì. */
function licenseWatch() {
  try {
    if (!ME) return;
    const s = License.status();
    if (s.state === 'unknown') return;
    const left = s.expiresAt - License.now();
    if (left > 120000) return;
    const gap = left < -600000 ? 300000 : 30000;
    if (Date.now() - _licLast >= gap) recheckLicense(true);
  } catch (e) {}
}
function wireCloud() {
  let t = null;
  setInterval(ensureKeepAlive, 60000);
  Sync.onChange = () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      const prevSeats = ME ? DB.seatsState : null, prevOrders = ME ? DB.orders : null;
      try { await refresh(); } catch (e) { return; }
      // Chưa đăng nhập: vẫn cập nhật DB (tên quán...) để màn Đăng nhập hiện đúng, chỉ không gán lại ME
      if (!ME) { if (['restoring', 'login'].includes(route.name) && safeToRender()) render(); return; }
      if (prevSeats && DB.settings.callSound !== false && hasNewStaffCall(prevSeats, DB.seatsState)) {
        alertStaff('Khách gọi nhân viên', newStaffCallLabel(prevSeats, DB.seatsState));
      } else if (prevOrders && DB.settings.sound !== false && hasNewKitchenTicket(prevOrders, DB.orders)) {
        alertStaff('Có món mới cho bếp', 'Mở app để xem vé bếp');
      }
      ensureKeepAlive();
      if (safeToRender()) render();
    }, 300);
  };
  Sync.onStatus = () => {
    updateSyncBanner();
    if (['cloud', 'restoring'].includes(route.name) && safeToRender()) render();
  };
  if (typeof NativeBridge === 'undefined') return;
  NativeBridge.network.onChange(on => Sync.setOnline(on));
  NativeBridge.network.get().then(on => Sync.setOnline(on));
  NativeBridge.app.onResume(() => {
    Sync.kick(0);
    ensureKeepAlive();
    recheckLicense(License.status().state !== 'ok');   // sắp/đã quá hạn → hỏi lại ngay, không đợi chu kỳ 6 giờ
  });
  // Nút Back của Android: đóng hộp thoại → quay lại màn trước → thu nhỏ app
  NativeBridge.app.onBack(() => {
    if (qrZoomEl) { closeQrZoom(); return true; }
    if (sheetEl) { closeSheet(); return true; }
    if (histStack.length && !['login', 'setup'].includes(route.name)) { back(); return true; }
    return false;
  });
  setInterval(() => recheckLicense(false), 6 * 3600000);
  setInterval(licenseWatch, 30000);
}

(async function boot() {
  try { if (typeof NativeBridge !== 'undefined' && NativeBridge.ready) await NativeBridge.ready(); } catch (e) { console.warn(e); }
  let d0 = null;
  try { d0 = await Persist.init(); } catch (e) { console.warn('Không đọc được bộ nhớ cục bộ', e); }
  D = d0 || emptyD();
  Cloud.init(); License.load();
  wireCloud();
  if (!Cloud.role) {
    route = { name: 'setup', params: {} };
  } else {
    // Tải DB (tên quán, cài đặt...) ngay cả khi CHƯA đăng nhập, để màn Đăng nhập hiện đúng
    // thông tin quán thay vì nhãn mặc định "Nhà Hàng" — /snapshot không yêu cầu đăng nhập.
    if (D.staff.length) {
      try { await refresh(); } catch (e) { /* chưa có mạng lần đầu: giữ nhãn mặc định, không chặn khởi động */ }
    }
    if (TOKEN && D.staff.length) {
      try {
        // xác định người đang đăng nhập từ token đã lưu
        const payload = JSON.parse(atob(TOKEN.split('.')[1]));
        ME = DB.staff.find(s => s.id === payload.sub) || null;
        if (ME) { DB.session.user = ME.id; connectWs(); route = { name: homeScreen(), params: {} }; }
      } catch (e) { TOKEN = null; try { localStorage.removeItem(TOKEN_KEY); } catch (e2) {} }
    }
    Sync.start();
    recheckLicense(true);
  }
  initI18n();
  // Lần đầu mở app: hỏi ngôn ngữ trước, xong mới vào luồng thiết lập/đăng nhập bình thường
  if (!hasLangChoice()) { window._routeAfterLang = route; route = { name: 'lang', params: {} }; }
  render();
})();

// Làm mới định kỳ để đồng hồ đếm giờ ở bếp luôn đúng
setInterval(() => { if (route.name === 'kds') render(); }, 30000);
