/* ============================================================
   Các màn hình bổ sung: chọn ghế dùng chung, kho tách riêng,
   lịch sử đơn, chọn tem QR để in.
   ============================================================ */

/* ---------- BỘ CHỌN GHẾ DÙNG CHUNG ----------
   Mọi thao tác với bàn/ghế đều đi qua đây: chọn bàn trước, rồi chọn
   từng ghế hoặc cả bàn. `mode` quyết định làm gì sau khi chọn. */
const SEAT_PICK = {
  lock:     { title: 'Khoá mã QR',        verb: 'Khoá', tone: 'danger', need: 'any' },
  unlock:   { title: 'Mở lại mã QR',      verb: 'Mở khoá', tone: 'ok',  need: 'any' },
  clean:    { title: 'Dọn bàn',           verb: 'Dọn & mở QR', tone: 'ok', need: 'any' },
  merge:    { title: 'Ghép đơn',          verb: 'Gộp thành một hoá đơn', tone: 'pri', need: 'order2' },
  transfer: { title: 'Chuyển chỗ',        verb: 'Chọn chỗ đến', tone: 'pri', need: 'order1' },
  call:     { title: 'Xử lý gọi nhân viên', verb: 'Đánh dấu đã xử lý', tone: 'ok', need: 'calling' },
  order:    { title: 'Gọi món',           verb: 'Mở màn gọi món', tone: 'pri', need: 'one' },
  print:    { title: 'In mã QR',          verb: 'Tạo file PDF', tone: 'pri', need: 'any' },
  rotate:   { title: 'Đổi mã QR mới',     verb: 'Đổi mã & vô hiệu mã cũ', tone: 'danger', need: 'any' }
};

/** Tóm tắt các ghế đã chọn theo bàn: "Bàn 1: 2 ghế · Bàn 3: 1 ghế" — chọn được ghế ở NHIỀU bàn trước khi bấm thực hiện. */
function seatSelSummary(sel) {
  const per = new Map();
  for (const k of sel) { const tid = k.split('#')[0]; per.set(tid, (per.get(tid) || 0) + 1); }
  return [...per].map(([tid, n]) => `${esc((tableById(tid) || {}).name || 'Bàn')}: ${n} ghế`).join(' · ');
}

function vSeatPick() {
  const mode = route.params.mode || 'order';
  const cfg = SEAT_PICK[mode] || SEAT_PICK.order;
  const tid = route.params.t;
  const sel = window._seatSel || (window._seatSel = new Set());
  const from = route.params.from || '';
  const navKey = from === 'cashier' ? 'cashier' : 'tables';
  const multi = mode !== 'order';   // gọi món chỉ một ghế; các thao tác còn lại chọn được nhiều bàn
  const goBar = (t) => sel.size ? `<div class="footbar">
      <button class="btn ${cfg.tone}" data-act="seatGo" data-mode="${mode}" data-t="${t || ''}" data-from="${from}">${cfg.verb} · ${sel.size} ghế</button>
      <button class="btn ghost" data-act="seatClear">Bỏ chọn</button>
    </div>` : '';
  const picked = multi && sel.size ? `<div class="t-xs" style="color:var(--accent)">Đã chọn: ${seatSelSummary(sel)}</div>` : '';

  // Bước 1: chọn bàn
  if (!tid) {
    const area = route.params.area || DB.areas[0];
    const tables = DB.tables.filter(t => t.area === area);
    return `<div class="screen">
      ${hdr(cfg.title, 'Bước 1 — chọn bàn')}
      <div class="body" data-swipe="area" data-area="${esc(area)}">
        <div class="scrollx">${DB.areas.map(a => `<button class="chip ${a === area ? 'on' : ''}" data-go="seatPick" data-mode="${mode}" data-area="${esc(a)}" data-from="${from}">${esc(a)}</button>`).join('')}</div>
        <div class="t-xs">${multi ? 'Chọn được ghế ở nhiều bàn, nhiều khu: bấm từng bàn để tick ghế, xong bấm nút ở dưới' : 'Vuốt sang trái/phải để đổi khu vực'}</div>
        ${picked}
        <div class="grid2">
          ${tables.map(t => {
            const s = tableSummary(t);
            const cls = s.state === 'pay' ? 't-pay' : s.state === 'busy' ? 't-busy' : s.state === 'resv' ? 't-resv' : 't-free';
            const nSel = [...sel].filter(k => k.startsWith(t.id + '#')).length;
            return `<button class="tbl ${cls}" data-go="seatPick" data-mode="${mode}" data-t="${t.id}" data-area="${esc(area)}" data-from="${from}">
              <div class="nm">${esc(t.name)}${nSel ? ` · ☑ ${nSel}` : ''}</div>
              <div class="mt">${t.seats} ghế${s.busy ? ` · ${s.busy} đang dùng` : ' · Trống'}</div>
              ${s.calling ? '<div class="tag">🔔 đang gọi</div>' : ''}
            </button>`;
          }).join('') || '<div class="empty">Khu này chưa có bàn</div>'}
        </div>
      </div>
      ${multi ? goBar('') : ''}
      ${navBar(navKey)}
    </div>`;
  }

  // Bước 2: chọn ghế trong bàn
  const t = tableById(tid);
  if (!t) return vTables();
  const seats = Array.from({ length: t.seats }, (_, i) => i + 1);
  const eligible = seats.filter(n => seatEligible(mode, t.id, n));
  const allPicked = eligible.length > 0 && eligible.every(n => sel.has(seatKey(t.id, n)));

  return `<div class="screen">
    ${hdr(cfg.title, `${esc(t.name)} — bước 2, chọn ghế`)}
    <div class="body">
      ${multi ? `<div class="scrollx">${DB.tables.map(x => {
        const nSel = [...sel].filter(k => k.startsWith(x.id + '#')).length;
        return `<button class="chip ${x.id === t.id ? 'on' : ''}" data-go="seatPick" data-mode="${mode}" data-t="${x.id}" data-area="${esc(x.area)}" data-from="${from}">${esc(x.name)}${nSel ? ` ☑${nSel}` : ''}</button>`;
      }).join('')}</div>` : ''}
      <div class="card row" style="background:var(--chip);border:none">
        <div style="flex:1"><div class="t-sm">${cfg.verb}</div>
          <div class="t-xs">${sel.size ? (multi ? seatSelSummary(sel) : sel.size + ' ghế đã chọn') : 'Chưa chọn ghế nào'}</div></div>
        <button class="btn sm ${allPicked ? '' : 'pri'}" data-act="seatAll" data-t="${t.id}" data-mode="${mode}">
          ${allPicked ? 'Bỏ chọn tất cả' : 'Chọn cả bàn'}</button>
      </div>

      ${seats.map(n => {
        const st = seatStatus(t.id, n);
        const k = seatKey(t.id, n);
        const on = sel.has(k);
        const ok = seatEligible(mode, t.id, n);
        const o = st.order;
        const badge = st.state === 'pay' ? '<span class="badge b-green">Chờ thanh toán</span>'
          : st.state === 'busy' ? '<span class="badge b-amber">Đang phục vụ</span>'
          : st.state === 'resv' ? '<span class="badge b-blue">Đã đặt trước</span>'
          : '<span class="badge b-gray">Trống</span>';
        return `<button class="card between ${on ? 'sel' : ''}" data-act="seatToggle" data-k="${k}" data-mode="${mode}"
            style="width:100%;text-align:left;${ok ? '' : 'opacity:.4'}" ${ok ? '' : 'disabled'}>
          <div style="flex:1">
            <div class="t-md">${on ? '☑' : '☐'} Ghế ${n}${st.calling ? ' 🔔' : ''}${st.locked ? ' 🔒' : ''}</div>
            <div class="t-xs mono">${o ? `${o.items.reduce((a, b) => a + b.qty, 0)} món · ${fmt(orderTotal(o).total)}` : (ok ? '—' : reasonText(mode))}</div>
          </div>
          ${badge}
        </button>`;
      }).join('')}
    </div>
    ${goBar(t.id)}
    ${navBar(navKey)}
  </div>`;
}

/** In tem mã QR theo từng ghế — mỗi tem trỏ tới trang gọi món kèm mã riêng của đúng ghế đó.
    Cần đã lưu link trang gọi món ở màn "Mã QR gọi món" trước (xem guestUrl() trong core.js). */
function vQrPrint() {
  const sel = window._qrSel || (window._qrSel = new Set());
  const area = route.params.area || DB.areas[0];
  const tables = DB.tables.filter(t => t.area === area);
  const totalSeats = DB.tables.reduce((s, t) => s + t.seats, 0);
  const pageReady = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.guestPageUrl) && (typeof Cloud !== 'undefined' && Cloud.linked);
  if (!pageReady) {
    return `<div class="screen">
      ${hdr('In tem mã QR')}
      <div class="body">
        <div class="card row" style="background:var(--amber-soft);border-color:var(--amber)">
          <span style="color:var(--amber)">${icon('warn')}</span>
          <div class="t-sm" style="color:var(--amber);flex:1">Chưa đủ điều kiện in tem — vào <b>Mã QR gọi món</b> ở màn trước để xem cần làm gì.</div>
        </div>
        <button class="btn pri" data-go="guestPage">Mã QR gọi món</button>
      </div>
      ${navBar('admin')}
    </div>`;
  }
  return `<div class="screen">
    ${hdr('In tem mã QR', `${sel.size}/${totalSeats} tem đã chọn`)}
    <div class="body" data-swipe="area" data-area="${esc(area)}" data-route="qrPrint">
      <div class="card row" style="background:var(--blue-soft);border-color:var(--blue)">
        <span style="color:var(--blue)">${icon('printer')}</span>
        <div class="t-sm" style="color:var(--blue);flex:1">Chọn ghế cần in rồi bấm <b>Tạo file PDF</b> — app lưu tem thành file PDF khổ <b>A4</b> (mỗi tem 50×60mm), bạn mở file PDF và tự in.</div>
      </div>
      <div class="scrollx">${DB.areas.map(a => `<button class="chip ${a === area ? 'on' : ''}" data-go="qrPrint" data-area="${esc(a)}">${esc(a)}</button>`).join('')}</div>
      <div class="row" style="gap:8px">
        <button class="btn sm ghost" data-act="qrSelAll" style="flex:1">Chọn tất cả bàn</button>
        <button class="btn sm ghost" data-act="qrSelNone" style="flex:1">Bỏ chọn hết</button>
      </div>
      ${tables.map(t => {
        const seats = Array.from({ length: t.seats }, (_, i) => i + 1);
        const allOn = seats.every(n => sel.has(t.id + ':' + n));
        return `<div class="card">
          <div class="between" style="margin-bottom:10px">
            <div><div class="t-md">${esc(t.name)}</div><div class="t-xs">${t.seats} ghế</div></div>
            <button class="btn sm ${allOn ? '' : 'pri'}" data-act="qrTable" data-t="${t.id}">${allOn ? 'Bỏ bàn này' : 'Chọn cả bàn'}</button>
          </div>
          <div class="grid3">
            ${seats.map(n => {
              const k = t.id + ':' + n;
              const on = sel.has(k);
              const locked = DB.seatsState[t.id + '#' + n]?.locked;
              return `<button class="chip ${on ? 'on' : ''}" data-act="qrSeat" data-k="${k}" style="justify-content:center">${on ? '☑' : '☐'} Ghế ${n}${locked ? ' 🔒' : ''}</button>`;
            }).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>
    ${sel.size ? `<div class="footbar">
      <button class="btn pri" data-act="qrPrintGo">Tạo file PDF · ${sel.size} tem — A4</button>
    </div>` : ''}
    ${navBar('admin')}
  </div>`;
}

/** Ghế có hợp lệ với thao tác đang chọn không */
function seatEligible(mode, tid, n) {
  const st = seatStatus(tid, n);
  switch (mode) {
    case 'lock':     return !st.locked;
    case 'unlock':   return !!st.locked;
    case 'clean':    return !st.order;   // còn đơn thì phải thanh toán trước
    case 'call':     return !!st.calling;
    case 'merge':
    case 'transfer': return !!st.order;
    case 'order':    return !st.locked;
    case 'print':
    case 'rotate':   return true;
    default:         return true;
  }
}
function reasonText(mode) {
  return { lock: 'đã khoá sẵn', unlock: 'chưa bị khoá', clean: 'còn đơn chưa thanh toán',
           call: 'không có yêu cầu', merge: 'chưa có đơn', transfer: 'chưa có đơn',
           order: 'mã QR đang khoá' }[mode] || '';
}

/* ---------- KHO (tách khỏi thực đơn) ---------- */
function vStock() {
  const low = DB.inventory.filter(i => i.qty <= i.min);
  return `<div class="screen">
    ${hdr('Kho nguyên liệu', `${DB.inventory.length} mặt hàng${low.length ? ` · ${low.length} cần nhập` : ''}`,
      { right: `<button class="iconbtn" data-act="newIng" aria-label="Thêm nguyên liệu" style="background:var(--accent);color:#fff">${icon('plus')}</button>` })}
    <div class="body">
      <div class="row" style="gap:8px">
        <button class="btn sm ok" data-act="stockIn" style="flex:1">${icon('plus')} Nhập kho</button>
        <button class="btn sm danger" data-act="stockOut" style="flex:1">Xuất kho</button>
        <button class="btn sm ghost" data-go="stockLog">Lịch sử kho</button>
      </div>
      ${low.length ? `<div class="card row" style="background:var(--amber-soft);border-color:var(--amber)">
        <span style="color:var(--amber)">${icon('warn')}</span>
        <div class="t-sm" style="color:var(--amber);flex:1">${low.length} nguyên liệu dưới ngưỡng: ${low.map(i => esc(i.name)).join(', ')}</div>
      </div>` : ''}
      ${DB.inventory.map(i => {
        const neg = i.qty < 0, lowI = i.qty <= i.min;
        return `<button class="card between" data-act="editIng" data-id="${i.id}" style="width:100%;text-align:left">
          <div><div class="t-md">${esc(i.name)}</div><div class="t-xs">Ngưỡng ${i.min} ${esc(i.unit)}${usedIn(i.id)}</div></div>
          <span class="mono t-md" style="color:${neg ? 'var(--red)' : lowI ? 'var(--amber)' : 'var(--green)'}">${i.qty} ${esc(i.unit)}${neg ? ' · âm' : lowI ? ' · sắp hết' : ''}</span>
        </button>`;
      }).join('') || '<div class="empty">Chưa có nguyên liệu nào</div>'}
    </div>
    ${navBar('admin')}
  </div>`;
}
function usedIn(ingId) {
  const n = DB.menu.filter(m => m.recipe.some(r => r.ing === ingId)).length;
  return n ? ` · dùng trong ${n} món` : ' · chưa gắn công thức';
}

/* ---------- LỊCH SỬ ĐƠN ---------- */
function vHistory() {
  const rows = window._history || [];
  const loading = window._historyLoading;
  const f = route.params.hf || 'all';
  const stName = { open: ['Đang mở', 'b-amber'], paid: ['Đã thanh toán', 'b-green'],
                   void: ['Đã huỷ', 'b-red'], merged: ['Đã ghép', 'b-gray'] };
  return `<div class="screen">
    ${hdr('Lịch sử đơn hàng', rows.length ? `${rows.length} đơn gần nhất` : '',
      { right: `<button class="iconbtn" data-act="expSrv" data-k="orders" aria-label="Xuất CSV">${icon('printer')}</button>` })}
    <div class="body" data-swipe="tabs" data-tabkey="hf" data-tabs="all|paid|open|void" data-cur="${esc(f)}">
      <div class="scrollx">
        ${[['all', 'Tất cả'], ['paid', 'Đã thanh toán'], ['open', 'Đang mở'], ['void', 'Đã huỷ']]
          .map(([k, lb]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="histFilter" data-hf="${k}">${lb}</button>`).join('')}
      </div>
      ${loading ? '<div class="empty">Đang tải…</div>' : ''}
      ${rows.map(o => {
        const [lb, cls] = stName[o.status] || ['—', 'b-gray'];
        const total = o.paid_total != null ? o.paid_total : o.subtotal;
        return `<button class="card between" data-act="histOpen" data-id="${o.id}" style="width:100%;text-align:left">
          <div style="flex:1;min-width:0">
            <div class="t-md">${esc(o.code)} · ${esc(o.table_name || 'Giao hàng')}${o.seat_no ? ` · Ghế ${o.seat_no}` : ''}</div>
            <div class="t-xs mono">${dstr(o.created_at)} · ${o.item_count} món${o.paid_method ? ' · ' + esc(o.paid_method) : ''}</div>
          </div>
          <div class="col" style="align-items:flex-end;gap:6px">
            <span class="badge ${cls}">${lb}</span>
            <span class="mono t-md">${fmt(total)}</span>
          </div>
        </button>`;
      }).join('')}
      ${!loading && !rows.length ? '<div class="empty">Chưa có đơn nào</div>' : ''}
      ${rows.length >= 30 ? `<button class="btn ghost" data-act="histMore">Tải thêm</button>` : ''}
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ---------- CHI TIẾT MỘT ĐƠN TRONG LỊCH SỬ ---------- */
function vHistoryDetail() {
  const o = window._histDetail;
  if (!o) return `<div class="screen">${hdr('Chi tiết đơn')}<div class="body"><div class="empty">Đang tải…</div></div></div>`;
  const stName = { queued: ['Chờ bếp', 'b-blue'], cooking: ['Đang làm', 'b-amber'],
                   served: ['Đã phục vụ', 'b-green'], cancelled: ['Đã huỷ', 'b-red'] };
  const batches = [...new Set(o.items.map(i => i.batch))].sort((a, b) => a - b);
  return `<div class="screen">
    ${hdr(esc(o.code), `${esc(o.table_name || 'Giao hàng')}${o.seat_no ? ` · Ghế ${o.seat_no}` : ''} · ${dstr(o.created_at)}`)}
    <div class="body">
      ${o.customer_name || o.customer_phone ? `<div class="card">
        <div class="t-xs">Khách đặt</div>
        <div class="t-md">${esc(o.customer_name || '—')}${o.customer_phone ? ' · ' + esc(o.customer_phone) : ''}</div>
        <div class="t-xs">Nguồn: ${esc({ qr: 'Khách quét QR', staff: 'Nhân viên nhập', grab: 'Grab', shopee: 'ShopeeFood' }[o.source] || o.source)}</div>
      </div>` : ''}

      ${batches.map(b => `<div class="sec">Đợt ${b} · ${hhmm(o.items.find(i => i.batch === b).created_at)}</div>
        ${o.items.filter(i => i.batch === b).map(i => {
          const [lb, cls] = stName[i.status] || ['—', 'b-gray'];
          return `<div class="card between" style="${i.status === 'cancelled' ? 'opacity:.55' : ''}">
            <div style="flex:1">
              <div class="t-md" style="${i.status === 'cancelled' ? 'text-decoration:line-through' : ''}">${esc(i.name_snapshot)} <span class="muted">×${i.qty}</span></div>
              ${i.note ? `<div class="t-xs">Ghi chú: ${esc(i.note)}</div>` : ''}
              <div class="mono t-xs">${fmt(i.price_snapshot)} / phần</div>
            </div>
            <div class="col" style="align-items:flex-end;gap:6px">
              <span class="badge ${cls}">${lb}</span>
              <span class="mono t-md">${i.status === 'cancelled' ? '—' : fmt(i.price_snapshot * i.qty)}</span>
            </div>
          </div>`;
        }).join('')}`).join('')}

      <div class="card">
        <div class="between" style="margin-bottom:8px"><span class="t-sm muted">Tạm tính</span><span class="mono t-md">${fmt(o.subtotal)}</span></div>
        ${o.discount ? `<div class="between" style="margin-bottom:8px"><span class="t-sm" style="color:var(--green)">${esc(o.promo?.name || 'Giảm giá')}</span><span class="mono t-md" style="color:var(--green)">−${fmt(o.discount)}</span></div>` : ''}
        <div class="divider"></div>
        <div class="between" style="margin-top:8px"><span class="t-md">Tổng cộng</span><span class="mono" style="font-size:21px;font-weight:700">${fmt(o.total)}</span></div>
      </div>

      ${o.payments.length ? `<div class="sec">Thanh toán</div>
        ${o.payments.map(p => `<div class="card between">
          <div><div class="t-md">${esc(p.method)}</div>
          <div class="t-xs mono">${p.paid_at ? dstr(p.paid_at) : 'chưa hoàn tất'}${p.ref_code ? ' · ' + esc(p.ref_code) : ''}</div></div>
          <div class="col" style="align-items:flex-end;gap:4px">
            <span class="badge ${p.state === 'paid' ? 'b-green' : 'b-amber'}">${p.state === 'paid' ? 'Đã thu' : 'Chờ'}</span>
            <span class="mono t-md">${fmt(p.total)}</span></div>
        </div>`).join('')}` : '<div class="t-xs" style="text-align:center;padding:8px">Đơn chưa thanh toán</div>'}
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ---------- CHỌN TEM QR ĐỂ IN ---------- */
/** Mã QR gọi món — mỗi ghế một mã riêng, trỏ tới trang web khách tự đăng lên Supabase
    Storage của chính quán (chủ quán xuất trang 1 lần, không cần đổi lại trừ khi đổi nơi
    lưu trữ). App không cần biết trang đó, chỉ cần biết ĐỊA CHỈ của nó để in đúng mã QR. */
function vGuestPage() {
  const pageUrl = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.guestPageUrl) || '';
  const linked = typeof Cloud !== 'undefined' && Cloud.linked;
  const ready = !!(pageUrl && linked);
  return `<div class="screen">
    ${hdr('Mã QR gọi món')}
    <div class="body">
      <div class="card row" style="background:var(--blue-soft);border-color:var(--blue)">
        <span style="color:var(--blue)">${icon('qr')}</span>
        <div class="t-sm" style="color:var(--blue);flex:1;line-height:1.6">Khách quét mã ở bàn → mở trang gọi món → gửi thẳng xuống bếp, không cần nhân viên nhập hộ.
          Trang này chạy trên trình duyệt của khách, không cần cài gì — và không cần bạn tự đăng ở đâu cả.</div>
      </div>

      ${!pageUrl ? `<div class="card row" style="background:var(--amber-soft);border-color:var(--amber)">
          <span style="color:var(--amber)">${icon('warn')}</span>
          <div class="t-sm" style="color:var(--amber);flex:1">Bản app này chưa được cấu hình trang gọi món — báo nhà cung cấp phần mềm.</div>
        </div>` : ''}
      ${!linked ? `<div class="card row" style="background:var(--amber-soft);border-color:var(--amber)">
          <span style="color:var(--amber)">${icon('warn')}</span>
          <div class="t-sm" style="color:var(--amber);flex:1">Cần <b>liên kết Supabase của quán</b> trước (mục Đồng bộ &amp; thiết bị) — mã QR cần địa chỉ đó mới gọi món được.</div>
        </div>` : ''}

      ${ready ? `<button class="btn pri" data-go="qrPrint">In tem mã QR theo từng ghế</button>`
        : `<div class="t-xs" style="margin-top:10px;color:var(--muted)">In tem được ngay khi đủ hai điều kiện trên — không cần làm gì thêm.</div>`}
    </div>
    ${navBar('admin')}
  </div>`;
}
