function icon(name){
  const p = {
    back:'<path d="M15 4L7 12l8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    plus:'<path d="M12 4v16M4 12h16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>',
    tables:'<rect x="3" y="3" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.7" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.7" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.7" fill="none"/><rect x="14" y="14" width="7" height="7" rx="1.6" stroke="currentColor" stroke-width="1.7" fill="none"/>',
    kds:'<path d="M4 4h16v11H4z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M9 18l-1 3M15 18l1 3M7 21h10" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
    order:'<path d="M5 3h9l4 4v14H5z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M8 12h8M8 16h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    admin:'<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    calendar:'<rect x="3" y="4" width="18" height="17" rx="2" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>',
    bell:'<path d="M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M10.3 21a2 2 0 0 0 3.4 0" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
    card:'<rect x="2" y="6" width="20" height="13" rx="2" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M2 10.5h20" stroke="currentColor" stroke-width="1.7"/>',
    chart:'<path d="M4 20V11M12 20V4M20 20v-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    people:'<circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M4 21c1.5-4.5 5-6.5 8-6.5s6.5 2 8 6.5" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
    box:'<path d="M3 8l9-5 9 5v8l-9 5-9-5z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M3 8l9 5 9-5M12 13v8" stroke="currentColor" stroke-width="1.6"/>',
    tag:'<path d="M11 2 3 10v6l8 6 10-10V2z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><circle cx="8" cy="7" r="1.5" fill="currentColor"/>',
    clock:'<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M12 6v6l4 2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/>',
    qr:'<rect x="3" y="3" width="7" height="7" stroke="currentColor" stroke-width="1.7" fill="none"/><rect x="14" y="3" width="7" height="7" stroke="currentColor" stroke-width="1.7" fill="none"/><rect x="3" y="14" width="7" height="7" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M14 14h3v3h-3zM19 19h2v2h-2z" stroke="currentColor" stroke-width="1.7" fill="none"/>',
    out:'<path d="M9 3H4v18h5M15 7l5 5-5 5M20 12H9" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    trash:'<path d="M4 7h16M9 7V5h6v2M6 7l1 14h10l1-14" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    edit:'<path d="M15 3l6 6-12 12H3v-6z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/>',
    merge:'<rect x="2" y="6" width="8" height="12" rx="1.6" stroke="currentColor" stroke-width="1.6" fill="none"/><rect x="14" y="6" width="8" height="12" rx="1.6" stroke="currentColor" stroke-width="1.6" fill="none"/><path d="M10 12h4" stroke="currentColor" stroke-width="1.6"/>',
    move:'<path d="M5 12a7 7 0 1 1 2.5 5.4" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round"/><path d="M4 18v-4h4" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    lock:'<rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.7" fill="none"/>',
    check:'<path d="M4 12.5l5 5L20 6" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
    search:'<circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.8" fill="none"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    settings:'<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.7" fill="none"/><path d="M19.4 13a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H4a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H10a1.65 1.65 0 0 0 1-1.51V4a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10a1.65 1.65 0 0 0 1.51 1H20a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linejoin="round"/>',
    printer:'<path d="M6 9V3h12v6M6 18H4v-6h16v6h-2" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><rect x="7" y="14" width="10" height="7" stroke="currentColor" stroke-width="1.7" fill="none"/>',
    warn:'<path d="M12 3l9 17H3z" stroke="currentColor" stroke-width="1.7" fill="none" stroke-linejoin="round"/><path d="M12 9v5M12 17h.01" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>'
  }[name]||'';
  return `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
}
function hdr(title, sub, opts){
  opts = opts||{};
  const left = opts.noBack ? '' : `<button class="iconbtn" data-act="back" aria-label="Quay lại">${icon('back')}</button>`;
  return `<div class="hdr">${left}<div class="hdr-title"><h1>${esc(title)}</h1>${sub?`<div class="sub">${sub}</div>`:''}</div><div class="spacer"></div>${opts.right||''}</div>`;
}




/* ============ PHÂN QUYỀN THEO MÀN HÌNH ============
   Một bảng duy nhất dùng cho cả lưới Quản lý lẫn màn cấp quyền nhân viên,
   nên thêm màn mới chỉ phải khai báo một chỗ. */
const SCREENS = [
  { key: 'pos',         route: 'cashier',     icon: 'card',    label: 'Thu ngân',            desc: 'Tính tiền, sửa món, áp khuyến mãi' },
  { key: 'tables',      route: 'tables',      icon: 'tables',  label: 'Phục vụ',             desc: 'Sơ đồ bàn, gọi món, ghép/chuyển ghế' },
  { key: 'kds',         route: 'kds',         icon: 'kds',     label: 'Bảng đơn Bếp',        desc: 'Nhận và hoàn tất vé bếp' },
  { key: 'reservations',route: 'reservations',icon: 'calendar',label: 'Đặt bàn trước',       desc: 'Nhận và xác nhận lịch đặt bàn' },
  { key: 'tablesAdmin', route: 'tablesAdmin', icon: 'qr',      label: 'Quản lý bàn & mã QR', desc: 'Thêm/sửa bàn ghế, in và đổi mã QR' },
  { key: 'menu',        route: 'menu',        icon: 'box',     label: 'Thực đơn',            desc: 'Thêm/sửa món, giá, công thức' },
  { key: 'stock',       route: 'stock',       icon: 'box',     label: 'Kho nguyên liệu',     desc: 'Nhập/xuất kho, xem lịch sử kho' },
  { key: 'promo',       route: 'promos',      icon: 'tag',     label: 'Khuyến mãi',          desc: 'Tạo và bật/tắt chương trình' },
  { key: 'report',      route: 'reports',     icon: 'chart',   label: 'Báo cáo',             desc: 'Doanh thu, lịch sử đơn, xuất tệp' },
  { key: 'staff',       route: 'staff',       icon: 'people',  label: 'Nhân viên',           desc: 'Thêm nhân viên và cấp quyền' },
  { key: 'billing',     route: 'billing',     icon: 'card',    label: 'Thanh toán & hoá đơn',desc: 'Cổng thanh toán, cài đặt chung' },
  { key: 'logs',        route: 'logs',        icon: 'clock',   label: 'Nhật ký hoạt động',   desc: 'Xem mọi thao tác và lỗi' }
];

/** 25 ngân hàng phổ biến nhất theo mạng lưới VietQR/Napas247, kèm mã BIN chuẩn. */
/** Danh sách ngân hàng hỗ trợ VietQR — tải trực tiếp từ API chính thức (luôn đủ và mới nhất,
    khoảng 55 ngân hàng tính đến đầu 2026) khi có mạng; VIETQR_BANKS bên dưới chỉ là phương án
    dự phòng khi màn Thanh toán & hoá đơn mở lúc không có mạng (vài chục ngân hàng phổ biến nhất). */
let _vietqrBanksLive = null, _vietqrBanksLoading = false, _vietqrBanksTried = false;
/** Tự thử MỘT LẦN mỗi khi vào màn hình. Thất bại thì rơi về danh sách rút gọn và DỪNG — không tự lặp lại
    vô hạn (mất mạng mà cứ gọi lại mỗi lần render() sẽ treo màn hình). Nút "Thử lại" đặt cờ về false để
    cho phép thử lại có chủ đích. */
async function loadVietQrBanksLive(opts) {
  if (_vietqrBanksLive || _vietqrBanksLoading || (_vietqrBanksTried && !(opts && opts.retry))) return;
  _vietqrBanksLoading = true; _vietqrBanksTried = true;
  let ok = false;
  try {
    const r = await fetch('https://api.vietqr.io/v2/banks');
    const j = await r.json();
    const list = (j.data || []).filter(b => b.transferSupported).map(b => ({ bin: b.bin, name: b.shortName || b.name }));
    if (list.length) { _vietqrBanksLive = list; ok = true; }
  } catch (e) { /* không có mạng hoặc API đang lỗi — rơi về danh sách dự phòng bên dưới, không tự thử lại */ }
  _vietqrBanksLoading = false;
  if (route.name === 'billing' && safeToRender()) render();   // vẽ lại đúng MỘT lần để thoát "Đang tải…"
  return ok;
}
const vietQrBankOptions = () => _vietqrBanksLive || VIETQR_BANKS;

const VIETQR_BANKS = [
  { bin:"970436", name:"Vietcombank" },
  { bin:"970415", name:"VietinBank" },
  { bin:"970418", name:"BIDV" },
  { bin:"970405", name:"Agribank" },
  { bin:"970407", name:"Techcombank" },
  { bin:"970432", name:"VPBank" },
  { bin:"970422", name:"MB Bank" },
  { bin:"970416", name:"ACB" },
  { bin:"970403", name:"Sacombank" },
  { bin:"970423", name:"TPBank" },
  { bin:"970441", name:"VIB" },
  { bin:"970426", name:"MSB" },
  { bin:"970440", name:"SeABank" },
  { bin:"970443", name:"SHB" },
  { bin:"970437", name:"HDBank" },
  { bin:"970431", name:"Eximbank" },
  { bin:"970448", name:"OCB" },
  { bin:"970429", name:"SCB" },
  { bin:"970449", name:"LPBank" },
  { bin:"970428", name:"NamABank" },
  { bin:"970419", name:"NCB" },
  { bin:"970452", name:"KienLongBank" },
  { bin:"970454", name:"VietCapitalBank" },
  { bin:"970409", name:"BacABank" },
  { bin:"970446", name:"Co-opBank" }
];

/* ============ NAV ============ */
function navBar(active){
  const kdsPending = DB.orders.filter(o=>o.status==='open' && o.items.some(i=>i.status!=='served')).length;
  const calls = Object.values(DB.seatsState).filter(s=>s.calling).length;
  const item=(n,ic,lb,dot)=>`<a data-go="${n}" class="${active===n?'on':''}">${icon(ic)}<span>${lb}</span>${dot?'<i class="dot"></i>':''}</a>`;
  const pay = DB.orders.filter(o => o.status === 'open' && o.items.length
    && o.items.every(i => i.status === 'served')).length;
  return `<nav class="nav">
    ${item('tables','tables','Phục vụ',calls>0)}
    ${item('cashier','card','Thu ngân',pay>0)}
    ${item('kds','kds','Bếp',kdsPending>0)}
    ${item('admin','admin','Quản lý',false)}
  </nav>`;
}

/* ============ ĐĂNG NHẬP ============ */
function vLogin(){
  return `<div class="screen"><div class="body" style="justify-content:center;padding:32px 24px">
    <div style="text-align:center;margin-bottom:28px">
      <div style="width:60px;height:60px;border-radius:17px;background:var(--accent);display:flex;align-items:center;justify-content:center;margin:0 auto;font-size:28px">🍜</div>
      <div class="t-lg" style="margin-top:12px">${esc(DB.restaurant.name||'Quản lý nhà hàng')}</div>
      ${DB.restaurant.phone ? `<div class="t-xs" style="margin-top:2px">${esc(DB.restaurant.phone)}</div>` : ''}
    </div>
    <div class="field"><label class="f" for="lu">Tên đăng nhập app</label>
      <input class="input" id="lu" placeholder="vd. chuquan" autocomplete="username" autocapitalize="none"></div>
    <div class="field"><label class="f" for="lp">Mật khẩu đăng nhập app</label>
      <input class="input" id="lp" type="password" placeholder="••••••••" autocomplete="current-password"></div>
    <button class="btn pri" data-act="login">Đăng nhập</button>
    <div class="t-xs" style="text-align:center;margin-top:24px;line-height:1.6">
      Tài khoản bị khoá 15 phút sau 5 lần sai liên tiếp.<br>Quên mật khẩu đăng nhập app: nhờ chủ quán cấp lại trong mục Nhân viên.</div>
    ${(typeof APP_CONFIG !== 'undefined' && APP_CONFIG.buildVersion) ? `<div class="t-xs" style="text-align:center;margin-top:14px;opacity:.5">Bản ${esc(APP_CONFIG.buildVersion)}</div>` : ''}
  </div></div>`;
}

/* ============ SƠ ĐỒ BÀN ============ */
function vTables(){
  const area = route.params.area || DB.areas[0];
  const tables = DB.tables.filter(t=>t.area===area);
  return `<div class="screen">
    ${hdr('Sơ đồ bàn', esc(me()?me().name+' · '+me().role:'') , {noBack:true, right:`<button class="iconbtn" data-go="reservations" aria-label="Đặt bàn trước">${icon('calendar')}</button>`})}
    <div class="body" data-swipe="area" data-area="${esc(area)}">
      ${(()=>{
        // Ghế đang phục vụ nhưng có khách đặt trước trong vòng 30 phút tới — cần thu xếp gấp
        const rows=[];
        tables.forEach(t=>{ tableSummary(t).conflicts.forEach(c=>rows.push({t, ...c})); });
        if(!rows.length) return '';
        return `<div class="card" style="background:var(--red-soft);border-color:var(--red)">
          <div class="row" style="align-items:flex-start"><span style="color:var(--red)">${icon('warn')}</span>
          <div style="flex:1"><div class="t-md" style="color:var(--red)">${rows.length} ghế đang phục vụ nhưng có khách đặt trước gần tới giờ</div>
          <div class="t-xs" style="color:var(--red);margin-top:4px;line-height:1.6">${rows.map(r=>esc(`${r.t.name} · Ghế ${r.seat} — ${r.resv.name} đặt lúc ${new Date(r.resv.startAt).toTimeString().slice(0,5)}`)).join('<br>')}</div>
          </div></div></div>`;
      })()}
      ${(()=>{const w=DB.orders.filter(o=>o.status==='open'&&o.items.some(i=>i.status==='pending'));
        return w.length?`<div class="card" style="background:var(--amber-soft);border-color:var(--amber)">
          <div class="row"><span style="color:var(--amber)">${icon('bell')}</span>
          <div style="flex:1"><div class="t-md" style="color:var(--amber)">${w.length} đơn khách chờ bạn xác nhận</div>
          <div class="t-xs" style="color:var(--amber)">${w.map(o=>{const t=tableById(o.tableId);return esc((t?t.name:'Bàn')+' · Ghế '+o.seatNo)}).join(', ')}</div></div>
          <button class="btn sm" data-go="order" data-id="${w[0].id}">Xem</button></div></div>`:''})()}
      ${(()=>{const calls=Object.entries(DB.seatsState).filter(([k,s])=>s.calling);
        return calls.length?`<div class="card" style="background:var(--amber-soft);border-color:var(--amber)">
        <div class="row"><span style="color:var(--amber)">${icon('bell')}</span>
        <div style="flex:1"><div class="t-md" style="color:var(--amber)">${calls.length} ghế đang gọi nhân viên</div>
        <div class="t-xs">${calls.map(([k])=>esc(seatLabel(k))).join(', ')}</div></div>
        <button class="btn sm" data-act="seatPickStart" data-mode="call">Xử lý</button></div></div>`:''})()}
      <div class="scrollx">${DB.areas.map(a=>`<button class="chip ${a===area?'on':''}" data-go="tables" data-area="${esc(a)}">${esc(a)}</button>`).join('')}</div>
      <div class="t-xs">Vuốt sang trái/phải để đổi khu vực</div>
      <div class="legend">
        <span>Số dưới ghế = món đã phục vụ / tổng món</span>
      </div>
      <div class="legend">
        <span><i style="background:var(--line)"></i>Trống</span>
        <span><i style="background:var(--accent)"></i>Đang phục vụ</span>
        <span><i style="background:var(--green)"></i>Chờ thanh toán</span>
        <span><i style="background:var(--blue)"></i>Đã đặt trước</span>
      </div>
      <div class="grid2">
        ${tables.map(t=>{
          const s = tableSummary(t);
          const cls = s.state==='pay'?'t-pay':s.state==='busy'?'t-busy':s.state==='resv'?'t-resv':'t-free';
          const mt = s.state==='resv' ? `Giữ chỗ ${esc(s.resv.time)} · ${esc(s.resv.name)}`
            : s.state==='free' ? (s.soon ? `Trống · có lịch ${esc(s.soon.time)}` : 'Trống')
            : `${s.busy}/${t.seats} ghế đang dùng${s.pay?` · ${s.pay} chờ thu`:''}`
              + (s.soon ? ` · lịch ${esc(s.soon.time)}` : '');
          return `<div class="tblwrap" role="button" tabindex="0" data-go="table" data-id="${t.id}"
              aria-label="${esc(t.name)} — ${esc(mt)}">
            <div class="tblhead">
              <span class="nm">${esc(t.name)}${s.calling?' 🔔':''}</span>
              <span class="mt">${mt}</span>
            </div>
            ${tableChairsSvg(t)}
          </div>`;
        }).join('')}
      </div>
      <div class="sec">Thao tác với bàn / ghế</div>
      <div class="grid2">
        <button class="btn sm ghost" data-act="seatPickStart" data-mode="order">${icon('order')} Gọi món</button>
        <button class="btn sm ghost" data-act="seatPickStart" data-mode="merge">${icon('merge')} Ghép đơn</button>
        <button class="btn sm ghost" data-act="seatPickStart" data-mode="transfer">${icon('move')} Chuyển chỗ</button>
        <button class="btn sm ghost" data-act="seatPickStart" data-mode="clean">${icon('check')} Dọn bàn</button>
        <button class="btn sm ghost" data-act="seatPickStart" data-mode="lock">${icon('lock')} Khoá QR</button>
        <button class="btn sm ghost" data-act="seatPickStart" data-mode="unlock">${icon('qr')} Mở khoá QR</button>
      </div>
    </div>
    ${navBar('tables')}
  </div>`;
}
/** Dải ghế hiển thị ngay trong ô bàn: trạng thái, chuông gọi, số món đã phục vụ.
    `onSeat` quyết định bấm vào ghế thì làm gì (để Phục vụ và Thu ngân dùng chung). */
/* ============================================================
   Biểu tượng bàn + ghế — thay cho dãy ô vuông trước đây.
   Vẽ đúng số ghế đã đặt khi tạo bàn (1/2/4/6/8...), xếp quanh một mặt
   bàn hình chữ nhật theo cách bố trí bàn ăn thật: bàn vuông 4 ghế thì
   mỗi cạnh 1 ghế; bàn dài hơn thì dồn ghế về hai cạnh dài, hai đầu 1 ghế.
   ============================================================ */

/** Số ghế mỗi cạnh (trên, dưới, trái, phải) ứng với tổng số ghế của bàn — dùng khi
    hướng bố trí để 'Tự động' (mặc định lúc tạo bàn). */
const SEAT_SIDE_LAYOUT = {
  1: [1, 0, 0, 0], 2: [1, 1, 0, 0], 3: [2, 1, 0, 0], 4: [1, 1, 1, 1],
  5: [2, 1, 1, 1], 6: [2, 2, 1, 1], 7: [3, 2, 1, 1], 8: [3, 3, 1, 1]
};
const TABLE_LAYOUTS = [
  { id: 'auto',        label: 'Tự động — cân đối quanh 4 cạnh' },
  { id: 'h',           label: 'Ngang — ghế dồn về cạnh trên/dưới' },
  { id: 'v',           label: 'Dọc — ghế dồn về cạnh trái/phải' },
  { id: 'wall-top',    label: 'Áp tường — bỏ trống cạnh trên' },
  { id: 'wall-bottom', label: 'Áp tường — bỏ trống cạnh dưới' },
  { id: 'wall-left',   label: 'Áp tường — bỏ trống cạnh trái' },
  { id: 'wall-right',  label: 'Áp tường — bỏ trống cạnh phải' }
];
/** Cạnh đối diện — dùng để ưu tiên khi bàn áp tường, tránh dồn hết ghế về một cạnh */
const OPPOSITE_SIDE = { 0: 1, 1: 0, 2: 3, 3: 2 };  // 0=trên 1=dưới 2=trái 3=phải

/** Trả về [trên, dưới, trái, phải] — số ghế ở mỗi cạnh — theo hướng bố trí đã chọn.
    'auto' dùng bảng cân đối sẵn; 'h'/'v' dồn hết về 1 trục; 'wall-*' bỏ trống đúng
    cạnh áp tường và chia đều 3 cạnh còn lại, ưu tiên cạnh đối diện trước. */
function seatSideLayout(n, layout) {
  layout = layout || 'auto';
  if (layout === 'h') return [Math.ceil(n / 2), Math.floor(n / 2), 0, 0];
  if (layout === 'v') return [0, 0, Math.ceil(n / 2), Math.floor(n / 2)];
  if (layout.startsWith('wall-')) {
    const sideIdx = { top: 0, bottom: 1, left: 2, right: 3 }[layout.slice(5)];
    const counts = [0, 0, 0, 0];
    if (sideIdx !== undefined) {
      const opp = OPPOSITE_SIDE[sideIdx];
      const seq = [opp, ...[0, 1, 2, 3].filter(i => i !== sideIdx && i !== opp)];
      for (let i = 0; i < n; i++) counts[seq[i % seq.length]]++;
      return counts;
    }
  }
  if (SEAT_SIDE_LAYOUT[n]) return SEAT_SIDE_LAYOUT[n];
  const top = Math.ceil(n / 2), bottom = Math.floor(n / 2);
  return [top, bottom, 0, 0];
}
const SEAT_FILL = { free: 'var(--line)', busy: 'var(--accent)', pay: 'var(--green)', resv: 'var(--blue)', locked: 'var(--faint)' };

/** Vẽ 1 bàn kèm đúng số ghế, mỗi ghế tô màu theo trạng thái, có số ghế và
    chấm vàng nhỏ khi đang gọi nhân viên. Chỉ để xem — bấm vào đâu trong
    khối cha (.tblwrap) đều mở danh sách ghế, không bấm được từng ghế riêng. */
function tableChairsSvg(t) {
  const [top, bottom, left, right] = seatSideLayout(t.seats, t.layout);
  const cs = 18, gap = 7;   // kích thước 1 ghế và khoảng cách tối thiểu giữa 2 ghế cạnh nhau
  const pad = 14;           // khoảng trống quanh toàn hình

  // Độ dài cần thiết để xếp n ghế liền nhau không chạm nhau
  const need = n => n > 0 ? n * cs + (n - 1) * gap : 0;
  // Mặt bàn phải đủ rộng/cao cho cạnh đông ghế nhất của trục đó, tối thiểu 1.6×cs cho đẹp
  const tw = Math.max(need(top), need(bottom), cs * 1.6);
  const th = Math.max(need(left), need(right), cs * 1.6);

  // Lề dành cho ghế nhô ra ngoài mặt bàn — chỉ chừa to nếu cạnh đó thực sự có ghế
  const mTop = (top > 0 ? cs + 6 : pad * 0.6) ;
  const mBottom = (bottom > 0 ? cs + 6 : pad * 0.6);
  const mLeft = (left > 0 ? cs + 6 : pad * 0.6);
  const mRight = (right > 0 ? cs + 6 : pad * 0.6);

  const tx = mLeft, ty = mTop;
  const W = mLeft + tw + mRight, H = mTop + th + mBottom;

  // Xếp đều n điểm trong đoạn [from, to] — do tw/th đã đo theo cạnh đông nhất nên
  // cạnh ít ghế hơn chỉ giãn cách rộng hơn một chút, không bao giờ đè lên nhau.
  const along = (count, from, to) => count <= 0 ? [] : Array.from({ length: count }, (_, i) =>
    count === 1 ? (from + to) / 2 : from + (to - from) * (i / (count - 1)));

  let seatNo = 0;
  const chairs = [];
  const place = (cx, cy, rot) => {
    seatNo++;
    const st = seatStatus(t.id, seatNo);
    const fill = SEAT_FILL[st.state] || SEAT_FILL.free;
    const dark = st.state === 'free';
    chairs.push(`<g transform="translate(${cx.toFixed(1)},${cy.toFixed(1)}) rotate(${rot})">
      <rect x="${-cs/2}" y="${-cs/2}" width="${cs}" height="${cs}" rx="4.5" fill="${fill}"
        ${st.conflict ? 'stroke="var(--red)" stroke-width="2"' : (st.state==='free'?'stroke="var(--line)" stroke-width="1"':'')}/>
      <text x="0" y="1" text-anchor="middle" dominant-baseline="middle" transform="rotate(${-rot})"
        font-size="9.5" font-weight="700" fill="${dark ? 'var(--faint)' : '#fff'}">${seatNo}</text>
      ${st.calling ? `<circle cx="${cs/2-2}" cy="${-cs/2+2}" r="3.6" fill="var(--amber)" transform="rotate(${-rot})"/>` : ''}
      ${st.locked ? `<circle cx="${-cs/2+2}" cy="${-cs/2+2}" r="3.6" fill="var(--faint)" transform="rotate(${-rot})"/>` : ''}
      <title>Ghế ${seatNo}${st.calling?' · đang gọi nhân viên':''}${st.locked?' · đã khoá QR':''}${st.conflict?` · ⚠ có khách đặt trước lúc ${new Date(st.conflict.startAt).toTimeString().slice(0,5)} nhưng ghế đang phục vụ`:''}</title>
    </g>`);
  };
  // Cạnh trên/dưới: chấm cách nhau theo trục X, nằm sát mép trên/dưới mặt bàn
  const edgeIn = cs / 2 + 1;
  along(top, tx + edgeIn, tx + tw - edgeIn).forEach(x => place(x, ty - cs/2 - 3, 0));
  along(bottom, tx + edgeIn, tx + tw - edgeIn).forEach(x => place(x, ty + th + cs/2 + 3, 0));
  along(left, ty + edgeIn, ty + th - edgeIn).forEach(y => place(tx - cs/2 - 3, y, 90));
  along(right, ty + edgeIn, ty + th - edgeIn).forEach(y => place(tx + tw + cs/2 + 3, y, 90));

  // Kích thước ghế LUÔN cố định (SCALE px cho mỗi đơn vị SVG) — bàn nhiều ghế thì khung bàn tự to ra,
  // ÍT khi nào ghế bị phóng to/thu nhỏ theo số ghế của từng bàn (lỗi trước đây: ép chiều rộng SVG cố
  // định 100% khung chứa, khiến bàn càng nhiều ghế thì từng ghế càng bị co nhỏ lại).
  const SCALE = 2;
  return `<div class="tblicon"><svg viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" width="${(W * SCALE).toFixed(0)}" height="${(H * SCALE).toFixed(0)}">
    <rect x="${tx}" y="${ty}" width="${tw}" height="${th}" rx="8" fill="var(--surface)" stroke="var(--line)" stroke-width="1.5"/>
    ${chairs.join('')}
  </svg></div>`;
}

/** Hình món: dùng ảnh đã chọn nếu có, không thì rơi về icon emoji như cũ */
function menuThumb(m, size){
  size = size || 46;
  if (m.image) return `<div class="thumb" style="width:${size}px;height:${size}px;min-width:${size}px;padding:0;overflow:hidden">
    <img src="${m.image}" alt="${esc(m.name)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`;
  return `<div class="thumb" style="width:${size}px;height:${size}px;min-width:${size}px;font-size:${Math.round(size*0.45)}px">${m.emoji||'🍽️'}</div>`;
}

function seatLabel(k){
  const [tid,sn]=k.split('#'); const t=tableById(tid);
  return (t?t.name:'Bàn') + ' · Ghế ' + sn;
}

/* ============ CHI TIẾT BÀN ============ */
function vTable(){
  const t = tableById(route.params.id);
  if(!t) return vTables();
  const s = tableSummary(t);
  return `<div class="screen">
    ${hdr(t.name, `${esc(t.area)} · ${t.seats} ghế`)}
    <div class="body">
      <div class="sec">Ghế</div>
      ${Array.from({length:t.seats},(_,i)=>i+1).map(n=>{
        const st = seatStatus(t.id,n);
        const o = st.order;
        const tot = o?orderTotal(o):null;
        const badge = st.state==='pay'?'<span class="badge b-green">Chờ thanh toán</span>'
          : st.state==='busy'?'<span class="badge b-amber">Đang phục vụ</span>'
          : st.state==='resv'?'<span class="badge b-blue">Đã đặt trước</span>'
          : '<span class="badge b-gray">Trống</span>';
        return `<button class="card between" data-act="seat" data-t="${t.id}" data-s="${n}" style="width:100%;text-align:left${st.conflict?';border-color:var(--red)':(st.locked?';border-color:var(--muted)':'')}">
          <div><div class="t-md">Ghế ${n}${st.locked?' <span style="color:var(--muted)" title="Đã khoá mã QR">🔒</span>':''}${st.calling?' <span title="Đang gọi nhân viên">🔔</span>':''}</div>
          <div class="t-xs mono">${o?`${o.items.reduce((a,b)=>a+b.qty,0)} món · ${fmt(tot.total)}`:'Chưa có đơn'}</div>
          ${st.locked?`<div class="t-xs" style="color:var(--muted);margin-top:2px">Mã QR đang khoá — khách không tự gọi món được</div>`:''}
          ${st.conflict?`<div class="t-xs" style="color:var(--red);margin-top:2px">⚠ ${esc(st.conflict.name)} đặt trước lúc ${new Date(st.conflict.startAt).toTimeString().slice(0,5)}</div>`:''}</div>
          ${badge}
        </button>`;
      }).join('')}
      <div class="sec">Thao tác — chọn ghế riêng hoặc cả bàn</div>
      <button class="card row" data-act="seatPickAt" data-t="${t.id}" data-mode="merge" style="width:100%;text-align:left">${icon('merge')}<span class="t-md" style="flex:1">Ghép đơn — gộp các ghế vào một hoá đơn</span>${icon('back')}</button>
      <button class="card row" data-act="seatPickAt" data-t="${t.id}" data-mode="transfer" style="width:100%;text-align:left">${icon('move')}<span class="t-md" style="flex:1">Chuyển nhiều ghế / cả bàn sang chỗ khác</span>${icon('back')}</button>
      <button class="card row" data-act="seatPickAt" data-t="${t.id}" data-mode="clean" style="width:100%;text-align:left">${icon('check')}<span class="t-md" style="flex:1">Dọn bàn</span>${icon('back')}</button>
    </div>
    ${navBar('tables')}
  </div>`;
}

/* ============ GỌI MÓN ============ */
function vNewOrder(){
  const p = route.params;
  const tableId = p.t || null, seatNo = p.s ? +p.s : null;
  const cat = p.cat || DB.categories[0];
  const q = (p.q||'').toLowerCase();
  const cart = window._cart || (window._cart = {});
  const existing = tableId ? openOrderFor(tableId, seatNo) : null;
  let list = DB.menu.filter(m=>m.cat===cat);
  if(q) list = DB.menu.filter(m=>m.name.toLowerCase().includes(q));
  const cartN = Object.values(cart).reduce((a,b)=>a+b,0);
  const cartSum = Object.entries(cart).reduce((s,[id,n])=>s+(menuById(id)?.price||0)*n,0);
  const target = tableId ? `${tableById(tableId).name} · Ghế ${seatNo}` : 'Chưa chọn bàn';
  return `<div class="screen">
    ${hdr(existing?'Gọi thêm món':'Gọi món', esc(target), {noBack:!!p.noBack, right:`<button class="iconbtn" data-act="pickTable" aria-label="Chọn bàn">${icon('tables')}</button>`})}
    <div class="body" data-swipe="cat" data-cat="${esc(cat)}">
      <div class="card row" style="padding:10px 14px">${icon('search')}
        <input class="input" style="border:none;padding:0;background:transparent" id="q" placeholder="Tìm món…" value="${esc(p.q||'')}">
      </div>
      ${q?'':`<div class="scrollx">${DB.categories.map(c=>`<button class="chip ${c===cat?'on':''}" data-go="newOrder" data-cat="${esc(c)}" data-keep="1">${esc(c)}</button>`).join('')}</div>
      <div class="t-xs">Vuốt sang trái/phải để đổi danh mục</div>`}
      ${list.length?list.map(m=>{
        const n = cart[m.id]||0;
        const out = m.stock==='out';
        return `<div class="card row" style="${out?'opacity:.5':''}">
          ${menuThumb(m)}
          <div style="flex:1;min-width:0">
            <div class="t-md">${esc(m.name)}</div>
            <div class="t-xs" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.desc)}</div>
            <div class="mono t-sm" style="color:var(--accent);font-weight:600;margin-top:4px">${fmt(m.price)}${m.stock==='low'?' · <span style="color:var(--amber)">sắp hết</span>':''}</div>
          </div>
          ${out?'<span class="badge b-red">Hết hàng</span>'
            : n>0?`<div class="step"><button class="minus" data-act="cart-" data-id="${m.id}" aria-label="Giảm">−</button><span class="n">${n}</span><button class="plus" data-act="cart+" data-id="${m.id}" aria-label="Tăng">+</button></div>`
            : `<button class="addbtn" data-act="cart+" data-id="${m.id}" aria-label="Thêm: ${esc(m.name)}">+</button>`}
        </div>`;
      }).join('') : '<div class="empty">Không tìm thấy món nào</div>'}
    </div>
    ${cartN>0?`<div class="bar"><div><div style="font-size:11.5px;opacity:.75">${cartN} món</div><div class="amt">${fmt(cartSum)}</div></div>
      <button class="cta" data-act="sendOrder">Gửi xuống bếp</button></div>`:''}
    ${navBar('newOrder')}
  </div>`;
}

/* ============ ĐƠN CỦA BÀN / THANH TOÁN ============ */
function vOrder(){
  const o = orderById(route.params.id);
  if(!o) return vTables();
  const {sub,disc,total,promo} = orderTotal(o);
  const allServed = o.items.length>0 && o.items.every(i=>i.status==='served');
  const stName = {pending:'Chờ xác nhận',queued:'Đã gửi bếp',cooking:'Đang làm',served:'Đã phục vụ'};
  const stCls = {pending:'b-amber',queued:'b-blue',cooking:'b-amber',served:'b-green'};
  const waiting = o.items.filter(i=>i.status==='pending');
  const t = o.tableId==='delivery'?null:tableById(o.tableId);
  const merged = isMerged(o);
  const seatList = (o.seats||[]).map(x=>{const tb=tableById(x.tableId); return {...x, label:`${tb?tb.name:'Bàn'} · Ghế ${x.seatNo}`};});
  return `<div class="screen">
    ${hdr(merged?`Hoá đơn gộp · ${seatList.length} ghế`:(t?`${t.name} · Ghế ${o.seatNo}`:'Đơn giao hàng'),
      `${esc(o.code||o.id)} · ${o.customer.name?esc(o.customer.name)+' · ':''}${hhmm(o.createdAt)}`)}
    <div class="body">
      ${waiting.length?`<div class="card" style="background:var(--amber-soft);border-color:var(--amber)">
        <div class="row" style="align-items:flex-start"><span style="color:var(--amber)">${icon('bell')}</span>
          <div style="flex:1">
            <div class="t-md" style="color:var(--amber)">Khách vừa gọi ${waiting.reduce((a,b)=>a+b.qty,0)} món</div>
            <div class="t-xs" style="color:var(--amber);margin-top:4px">${waiting.map(i=>`${esc(i.name)} ×${i.qty}`).join(', ')}</div>
            <div class="t-xs" style="color:var(--amber);margin-top:4px">Chưa xuống bếp — cần bạn xác nhận.</div>
          </div></div>
        <div class="row" style="gap:8px;margin-top:12px">
          <button class="btn sm ok" data-act="approveOrder" data-o="${o.id}" style="flex:1">Xác nhận gửi bếp</button>
          <button class="btn sm danger" data-act="rejectOrder" data-o="${o.id}" style="flex:1">Từ chối</button>
        </div>
      </div>`:''}
      ${merged?`<div class="card" style="background:var(--blue-soft);border-color:var(--blue)">
        <div class="row" style="align-items:flex-start"><span style="color:var(--blue)">${icon('merge')}</span>
          <div style="flex:1">
            <div class="t-md" style="color:var(--blue)">Các ghế dùng chung hoá đơn này</div>
            <div class="t-xs" style="color:var(--blue);margin-top:4px;line-height:1.6">${seatList.map(x=>esc(x.label)).join(' · ')}</div>
            <div class="t-xs" style="color:var(--blue);margin-top:6px">Khách quét mã QR của các ghế trên sẽ gọi món tiếp vào đúng hoá đơn này.</div>
          </div></div>
        <button class="btn sm ghost" data-act="splitPick" data-o="${o.id}" style="margin-top:12px">Tách một ghế ra hoá đơn riêng</button>
      </div>`:''}
      ${(()=>{
        // Món đang chờ/đang làm: mỗi đợt gọi hiện riêng một dòng, có trạng thái và nút sửa/xoá
        // riêng — để bếp và nhân viên luôn biết đợt nào vừa gọi thêm, đợt nào đã lên bếp trước.
        // Món đã phục vụ xong: gộp lại theo món (cộng dồn số lượng) thành một dòng gọn cho hoá đơn,
        // vì lúc này không còn cần phân biệt đợt gọi nữa.
        const pending = o.items.filter(i=>i.status!=='served');
        const served = o.items.filter(i=>i.status==='served');
        const servedGroups = new Map();
        served.forEach(i=>{
          const g = servedGroups.get(i.mid) || { name:i.name, emoji:i.emoji, qty:0, total:0, seats:new Set() };
          g.qty += i.qty; g.total += i.price*i.qty;
          if(merged && i.originSeat) g.seats.add(`Ghế ${i.originSeat}${(()=>{const tb=tableById(i.originTable);return tb&&tb.id!==o.tableId?' · '+esc(tb.name):'';})()}`);
          servedGroups.set(i.mid, g);
        });

        const pendingHtml = pending.map(i=>`<div class="card between">
          <div style="flex:1">
            <div class="t-md">${i.emoji} ${esc(i.name)}</div>
            ${merged&&i.originSeat?`<div class="t-xs">Ghế ${i.originSeat}${(()=>{const tb=tableById(i.originTable);return tb&&tb.id!==o.tableId?' · '+esc(tb.name):'';})()} gọi</div>`:''}
            ${i.note?`<div class="t-xs">Ghi chú: ${esc(i.note)}</div>`:''}
            <div class="row" style="margin-top:6px;gap:8px">
              <div class="step"><button class="minus" data-act="it-" data-o="${o.id}" data-l="${i.lid}" aria-label="Giảm">−</button><span class="n">${i.qty}</span><button class="plus" data-act="it+" data-o="${o.id}" data-l="${i.lid}" aria-label="Tăng">+</button></div>
              <span class="mono t-xs">${fmt(i.price)}</span>
            </div>
          </div>
          <div class="col" style="align-items:flex-end;gap:8px">
            <span class="badge ${stCls[i.status]}">${stName[i.status]}</span>
            <span class="mono t-md">${fmt(i.price*i.qty)}</span>
            <button data-act="delItem" data-o="${o.id}" data-l="${i.lid}" aria-label="Xoá: ${esc(i.name)}" style="color:var(--red)">${icon('trash')}</button>
          </div>
        </div>`).join('');

        const servedHtml = [...servedGroups.values()].map(g=>`<div class="card between" style="opacity:.9">
          <div style="flex:1">
            <div class="t-md">${g.emoji} ${esc(g.name)} <span class="muted">×${g.qty}</span></div>
            ${g.seats.size?`<div class="t-xs">${[...g.seats].map(esc).join(', ')}</div>`:''}
          </div>
          <div class="col" style="align-items:flex-end;gap:8px">
            <span class="badge ${stCls.served}">${stName.served}</span>
            <span class="mono t-md">${fmt(g.total)}</span>
          </div>
        </div>`).join('');

        return pendingHtml + servedHtml || '<div class="empty">Đơn chưa có món</div>';
      })()}

      <button class="btn ghost" data-go="newOrder" data-t="${o.tableId}" data-s="${o.seatNo}">${icon('plus')} Gọi thêm món</button>

      <div class="sec">Khuyến mãi</div>
      <button class="card between" data-act="pickPromo" data-o="${o.id}" style="width:100%;text-align:left">
        <span class="t-md">${promo?esc(promo.name):'Chọn khuyến mãi'}</span>
        <span class="mono t-sm" style="color:var(--green)">${disc?'−'+fmt(disc):''}</span>
      </button>

      <div class="card">
        <div class="between" style="margin-bottom:8px"><span class="t-sm muted">Tạm tính</span><span class="mono t-md">${fmt(sub)}</span></div>
        ${disc?`<div class="between" style="margin-bottom:8px"><span class="t-sm" style="color:var(--green)">Giảm giá</span><span class="mono t-md" style="color:var(--green)">−${fmt(disc)}</span></div>`:''}
        <div class="divider"></div>
        <div class="between" style="margin-top:8px"><span class="t-md">Tổng cộng</span><span class="mono" style="font-size:22px;font-weight:700">${fmt(total)}</span></div>
      </div>
      ${!allServed?`<div class="card row" style="background:var(--amber-soft);border-color:var(--amber)">
        <span style="color:var(--amber)">${icon('warn')}</span>
        <div class="t-sm" style="color:var(--amber);flex:1">Chỉ thanh toán khi mọi món đã phục vụ xong</div></div>`:''}
    </div>
    ${route.params.from==='cashier' ? `<div class="footbar">
      <button class="btn ghost" data-act="printBill" data-o="${o.id}">${icon('printer')} In tạm tính</button>
      <button class="btn pri" data-act="pay" data-o="${o.id}" ${allServed?'':'disabled style="opacity:.45"'}>Thanh toán ${fmt(total)}</button>
    </div>` : `<div class="footbar">
      <button class="btn ghost sm" data-act="printBill" data-o="${o.id}">${icon('printer')} In tạm tính</button>
      <div class="between"><span class="t-sm muted">Tổng cộng</span><span class="mono" style="font-size:20px;font-weight:700">${fmt(total)}</span></div>
      <div class="t-xs" style="text-align:center">${allServed?'Bàn đã phục vụ xong — thu tiền ở màn Thu ngân.':'Còn món chưa phục vụ xong.'}</div>
    </div>`}
  </div>`;
}

/* ============ MÀN THANH TOÁN ============ */
function vPay(){
  const o = orderById(route.params.id);
  if(!o) return vTables();
  const {total} = orderTotal(o);
  const gw = DB.gateways.filter(g=>g.on);
  const sel = route.params.g && gw.some(x=>x.id===route.params.g) ? route.params.g : gw[0].id;
  const g = DB.gateways.find(x=>x.id===sel);
  /* Mã VietQR dựng ngay trong app (không tải ảnh từ mạng) — dùng được cả khi mất Internet. */
  let vqrPayload = '', vqrError = '';
  if (sel==='vietqr' && DB.settings.vietqrBin && DB.settings.vietqrAccount) {
    try { vqrPayload = VietQR.payload({ bin: DB.settings.vietqrBin, account: DB.settings.vietqrAccount, amount: total, info: o.code||o.id }); }
    catch (e) { vqrError = e.message; }
  }

  return `<div class="screen">
    ${hdr('Thanh toán', `${esc(o.code||o.id)} · ${fmt(total)}`)}
    <div class="body" data-swipe="tabs" data-tabkey="g" data-tabs="${esc(gw.map(x=>x.id).join('|'))}" data-cur="${esc(sel)}">
      <div class="sec">Phương thức — vuốt trái/phải để đổi</div>
      <div class="grid3">
        ${gw.map(x=>`<button class="chip ${x.id===sel?'on':''}" data-go="pay" data-id="${o.id}" data-g="${x.id}"
          style="justify-content:center;text-align:center;padding:14px 6px">${esc(x.name)}</button>`).join('')}
      </div>

      ${sel==='cash' ? `<div id="cashBox"></div>`
        : sel==='vietqr' ? (vqrPayload ? `
        <div class="card col" style="gap:12px;align-items:center;padding:20px">
          <div class="t-md">${esc(g.name)}</div>
          <button class="qrbox" data-act="zoomQr" aria-label="Chạm để phóng to mã QR" style="border:none;cursor:pointer" data-payload="${esc(vqrPayload)}">
            ${QR.svg(vqrPayload, { label: 'Mã QR thanh toán VietQR' })}
          </button>
          <div class="t-xs muted">Chạm vào mã để phóng to</div>
          <div class="mono" style="font-size:20px;font-weight:700">${fmt(total)}</div>
          <div class="t-xs" style="text-align:center;line-height:1.6">Khách quét mã để chuyển khoản, hoặc đọc số tài khoản bên dưới nếu không quét được<br>
            <span class="mono">${esc(DB.settings.vietqrAccount)}</span>${DB.settings.vietqrName?' · '+esc(DB.settings.vietqrName):''}
            ${(()=>{ const b = vietQrBankOptions().find(x=>x.bin===DB.settings.vietqrBin); return b ? '<br>'+esc(b.name) : ''; })()}</div>
          <div class="t-xs muted" style="text-align:center">Mã được tạo ngay trong app — dùng được cả khi không có mạng</div>
        </div>` : `
        <div class="card row" style="background:var(--amber-soft);border-color:var(--amber)">
          <span style="color:var(--amber)">${icon('warn')}</span>
          <div class="t-sm" style="color:var(--amber);flex:1">${vqrError ? 'Không dựng được mã VietQR: '+esc(vqrError)+'. Vào Quản lý → Thanh toán & hoá đơn để kiểm tra lại tài khoản nhận tiền.' : 'Chưa cấu hình tài khoản VietQR — vào Quản lý → Thanh toán & hoá đơn để thêm số tài khoản trước.'}</div>
        </div>`)
        : `<div class="card row" style="background:var(--amber-soft);border-color:var(--amber)">
          <span style="color:var(--amber)">${icon('warn')}</span>
          <div class="t-sm" style="color:var(--amber);flex:1">${esc(g.name)} chưa khả dụng ở bản này — dùng Tiền mặt hoặc VietQR thay thế.</div>
        </div>`}

      ${g.state==='mock'?`<div class="card row" style="background:var(--blue-soft);border-color:var(--blue)"><span style="color:var(--blue)">${icon('warn')}</span><div class="t-sm" style="color:var(--blue);flex:1">Cổng này đang ở chế độ giả lập — chưa nối API thật</div></div>`:''}
    </div>
    <div class="footbar">
      <button class="btn pri" data-act="confirmPay" data-o="${o.id}" data-g="${sel}">Xác nhận đã nhận tiền</button>
      <button class="btn ghost" data-act="back">Huỷ</button>
    </div>
  </div>`;
}

/** Phần nhập tiền mặt: gợi ý nhân 1.000 / 10.000 / 100.000 theo số đang gõ, kèm tiền thừa.
    Vẽ riêng để gõ tới đâu cập nhật tới đó mà không dựng lại cả màn. */
function renderCashBox(){
  const box = document.getElementById('cashBox');
  if(!box) return;
  const o = orderById(route.params.id);
  if(!o) return;
  const {total} = orderTotal(o);
  const raw = (window._cashRaw || '').replace(/\D/g,'');
  const given = Number(window._cashGiven || 0);
  const change = given - total;

  // Gợi ý từ con số đang gõ: gõ "5" ra 5.000 / 50.000 / 500.000
  const typed = Number(raw || 0);
  const mults = typed > 0 ? [1000, 10000, 100000].map(m => typed * m).filter(v => v >= total) : [];
  // Mệnh giá tròn thường dùng, luôn lớn hơn hoá đơn
  const notes = [10000,20000,50000,100000,200000,500000].filter(v => v >= total).slice(0,3);
  const quick = [...new Set([total, ...mults, ...notes])].sort((a,b)=>a-b).slice(0,6);

  box.innerHTML = `
    <div class="card col" style="gap:12px;padding:18px">
      <div style="font-size:34px;text-align:center">💵</div>
      <div class="between"><span class="t-sm muted">Phải thu</span>
        <span class="mono" style="font-size:20px;font-weight:700">${fmt(total)}</span></div>
      <div>
        <label class="f" for="cashIn">Khách đưa</label>
        <input class="input mono" id="cashIn" inputmode="numeric" placeholder="Nhập số tiền"
          style="font-size:20px;font-weight:700;text-align:right" value="${given?fmt(given).replace('đ',''):raw}">
      </div>
      ${quick.length?`<div>
        <div class="t-xs" style="margin-bottom:6px">${typed>0?'Gợi ý theo số vừa gõ':'Chọn nhanh'}</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${quick.map(v=>`<button class="chip ${v===given?'on':''}" data-act="cashPick" data-v="${v}">
            ${v===total?'Đúng tiền · ':''}${fmt(v)}</button>`).join('')}
        </div></div>`:''}
      ${given>0?`<div class="divider"></div>
        <div class="between">
          <span class="t-md" style="color:${change<0?'var(--red)':'var(--green)'}">${change<0?'Còn thiếu':'Tiền thừa trả khách'}</span>
          <span class="mono" style="font-size:24px;font-weight:700;color:${change<0?'var(--red)':'var(--green)'}">${fmt(Math.abs(change))}</span>
        </div>`:''}
      ${given>0&&given<total?`<div class="t-xs" style="color:var(--red);text-align:center">Khách đưa chưa đủ — kiểm tra lại trước khi xác nhận</div>`:''}
    </div>`;
}

/* ============ BẾP (KDS) ============ */
function vKds(){
  const k = route.params.k || 'all';
  const mode = route.params.m === 'item' ? 'item' : 'ticket';
  const orders = DB.orders.filter(o=>o.status==='open' && o.items.length);

  const tickets = [];
  orders.forEach(o=>{
    // Món đang chờ nhân viên xác nhận thì chưa thuộc về bếp
    const mine = o.items.filter(i=>i.status!=='pending' && (k==='all' || i.kitchen===k));
    if(mine.length) tickets.push({o, items: mine});
  });
  tickets.sort((a,b)=>a.o.createdAt-b.o.createdAt);
  const pending = tickets.filter(t=>t.items.some(i=>i.status!=='served')).length;
  const avg = tickets.length?Math.round(tickets.reduce((s,t)=>s+mins(t.o.createdAt),0)/tickets.length):0;

  return `<div class="screen kds">
    <div class="hdr">
      <div class="hdr-title"><h1 style="color:#F1E9DE">Bếp · ${k==='all'?'Tất cả':esc(k)}</h1>
        <div class="sub" style="color:#8C8071">Cùng app quản lý · tablet bếp mở thẳng màn này</div></div>
      <div class="spacer"></div>
      <span class="badge" style="background:var(--accent);color:#221208">${pending} đơn chờ</span>
      <span class="badge" style="background:#3A3228;color:#BDAF9F">TB ${avg} phút</span>
    </div>
    <div class="body" data-swipe="kitchen" data-k="${esc(k)}">
      <div class="scrollx">
        <button class="chip ${k==='all'?'on':''}" data-go="kds" data-k="all" data-m="${mode}" style="${k==='all'?'':'background:#3A3228;color:#BDAF9F'}">Tất cả</button>
        ${DB.kitchens.map(x=>`<button class="chip ${k===x?'on':''}" data-go="kds" data-k="${esc(x)}" data-m="${mode}" style="${k===x?'':'background:#3A3228;color:#BDAF9F'}">${esc(x)}</button>`).join('')}
      </div>
      <div class="t-xs" style="color:#8C8071">Vuốt sang trái/phải để đổi khu bếp</div>

      <div class="row" style="gap:6px">
        <button class="btn sm ${mode==='ticket'?'pri':''}" data-go="kds" data-k="${esc(k)}" data-m="ticket"
          style="flex:1;${mode==='ticket'?'':'background:#3A3228;color:#BDAF9F'}">Theo đơn</button>
        <button class="btn sm ${mode==='item'?'pri':''}" data-go="kds" data-k="${esc(k)}" data-m="item"
          style="flex:1;${mode==='item'?'':'background:#3A3228;color:#BDAF9F'}">Tổng hợp theo món</button>
      </div>

      ${mode==='item' ? kdsByItem(tickets, k) : kdsByTicket(tickets, k)}
    </div>
    ${navBar('kds')}
  </div>`;
}

/** Chế độ theo đơn: mỗi vé bếp một thẻ, đúng thứ tự bàn gọi */
function kdsByTicket(tickets, k){
  if(!tickets.length) return '<div class="empty" style="color:#8C8071">Không có vé bếp nào đang chờ</div>';
  return tickets.map(({o,items})=>{
    const late = mins(o.createdAt)>15 && items.some(i=>i.status!=='served');
    const done = items.every(i=>i.status==='served');
    const t = o.tableId==='delivery'?null:tableById(o.tableId);
    const label = t?`${t.name} · Ghế ${o.seatNo}`:`Giao hàng · ${esc(o.customer.name||'App')}`;
    return `<div class="ticket ${late?'late':''} ${done?'done':''}">
      <div class="th"><span style="font-size:14px;font-weight:700">${label}</span>
      <span class="mono" style="font-size:13px;font-weight:700;color:${done?'#6FBB92':late?'#E08276':'#D8B24C'}">${done?'✓ Xong':elapsed(o.createdAt)}</span></div>
      <div class="tb">
        ${items.map(i=>`<button class="li ${i.status==='served'?'x':''}" data-act="kdsToggle" data-o="${o.id}" data-l="${i.lid}" style="text-align:left;width:100%">
          <span style="font-size:15px">${i.status==='served'?'☑':i.status==='cooking'?'🔥':'☐'}</span>
          <span style="flex:1">${esc(i.name)} ×${i.qty}${i.note?` <span style="color:#8C8071">(${esc(i.note)})</span>`:''}</span>
          <span style="font-size:11px;color:#8C8071">${esc(i.kitchen)}</span>
        </button>`).join('')}
      </div>
      ${done?'':`<button class="btn ok" data-act="kdsDone" data-o="${o.id}" data-k="${esc(k)}" style="margin:0 12px 12px;width:calc(100% - 24px);padding:10px">Hoàn tất vé này</button>`}
    </div>`;
  }).join('');
}

/** Chế độ tổng hợp: gom theo món để bếp làm một loạt, kèm số lượng từng trạng thái */
function kdsByItem(tickets, k){
  const agg = new Map();
  tickets.forEach(({o,items})=>items.forEach(i=>{
    if(!agg.has(i.name)) agg.set(i.name, { name:i.name, emoji:i.emoji, kitchen:i.kitchen,
      queued:0, cooking:0, served:0, total:0, refs:[], oldest:o.createdAt });
    const a = agg.get(i.name);
    a[i.status] += i.qty;
    a.total += i.qty;
    a.oldest = Math.min(a.oldest, o.createdAt);
    a.refs.push({ orderId:o.id, lid:i.lid, status:i.status, qty:i.qty, tableId:o.tableId, seatNo:o.seatNo });
  }));
  const rows = [...agg.values()].sort((a,b)=> (b.queued+b.cooking)-(a.queued+a.cooking) || a.oldest-b.oldest);
  if(!rows.length) return '<div class="empty" style="color:#8C8071">Không có món nào đang chờ</div>';

  const chip = (n, lb, color) => n ? `<span class="badge" style="background:${color};color:#221208">${lb} ${n}</span>` : '';
  return rows.map(r=>{
    const waiting = r.queued + r.cooking;
    const late = mins(r.oldest) > 15 && waiting > 0;
    const where = r.refs.filter(x=>x.status!=='served').map(x=>{
      const t = x.tableId==='delivery'?null:tableById(x.tableId);
      return `${t?t.name.replace('Bàn ','B'):'GH'}/${x.seatNo||'-'}×${x.qty}`;
    });
    return `<div class="ticket ${late?'late':''} ${waiting?'':'done'}">
      <div class="th">
        <span style="font-size:14px;font-weight:700">${r.emoji||''} ${esc(r.name)}</span>
        <span class="mono" style="font-size:13px;font-weight:700;color:${waiting?(late?'#E08276':'#D8B24C'):'#6FBB92'}">${waiting?elapsed(r.oldest):'✓ xong'}</span>
      </div>
      <div class="tb">
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${chip(r.queued,'Chưa làm','#BDAF9F')}
          ${chip(r.cooking,'Đang làm','#D8B24C')}
          ${chip(r.served,'Đã xong','#6FBB92')}
          <span class="badge" style="background:#3A3228;color:#BDAF9F">Tổng ${r.total}</span>
        </div>
        ${where.length?`<div style="font-size:11px;color:#8C8071;line-height:1.5">${esc(where.join(' · '))}</div>`:''}
      </div>
      ${r.queued?`<button class="btn ok" data-act="kdsBulk" data-name="${esc(r.name)}" data-k="${esc(k)}" data-to="cooking"
        style="margin:0 12px 8px;width:calc(100% - 24px);padding:9px;background:#D8B24C;color:#221208">Bắt đầu làm ${r.queued} phần</button>`:''}
      ${r.cooking?`<button class="btn ok" data-act="kdsBulk" data-name="${esc(r.name)}" data-k="${esc(k)}" data-to="served"
        style="margin:0 12px 12px;width:calc(100% - 24px);padding:9px">Xong ${r.cooking} phần</button>`:''}
    </div>`;
  }).join('');
}

/* ============ TRANG QUẢN LÝ ============ */
function vAdmin(){
  const u = me();
  return `<div class="screen">
    ${hdr('Quản lý', u?`${esc(u.name)} · ${esc(u.role)}`:'', {noBack:true})}
    <div class="body">
      <div class="grid2">
        ${SCREENS.map(sc => {
          const ok = can(sc.key);
          return `<button class="card col" ${ok?`data-go="${sc.route}"`:'data-act="noPerm"'}
              style="gap:10px;align-items:flex-start;${ok?'':'opacity:.4'}">
            <span style="color:var(--accent)">${icon(sc.icon)}</span>
            <span class="t-md">${esc(sc.label)}</span>
            <span class="t-xs" style="line-height:1.4">${esc(sc.desc)}</span>
          </button>`;
        }).join('')}
      </div>
      <button class="card row" data-go="userGuide" style="width:100%;text-align:left;margin-top:12px;border-color:var(--accent)"><span style="color:var(--accent)">${icon('search')}</span><span style="flex:1"><span class="t-md">Hướng dẫn sử dụng</span><br><span class="t-xs">Cách dùng từng chức năng, có ảnh minh hoạ</span></span></button>
      ${subscriptionCardHtml()}
      ${cloudCardHtml()}
      <div class="sec">Hiển thị trên máy này</div>
      <div class="card">
        <div class="t-md" style="margin-bottom:10px">Ngôn ngữ hiển thị</div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          ${Object.keys(LANGS).map(k=>`<button class="chip ${getLang()===k?'on':''}" data-act="pickLang" data-k="${k}" data-notr style="flex:1 1 100px;justify-content:center">${LANGS[k].flag} ${LANGS[k].name}</button>`).join('')}
        </div>
        <div class="t-xs" style="margin:8px 0 14px">Chỉ áp dụng cho máy này. Dữ liệu bạn nhập (tên món, tên khách…) giữ nguyên.</div>
      </div>
      <div class="card">
        <div class="t-md" style="margin-bottom:10px">Cỡ chữ</div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          ${[[1,'Nhỏ · 100%'],[1.2,'Vừa · 120%'],[1.5,'Lớn · 150%']].map(([k,lb])=>
            `<button class="chip ${Math.abs(fontScale()-k)<0.01?'on':''}" data-act="setFontScale" data-k="${k}" style="flex:1 1 100px;justify-content:center">${lb}</button>`).join('')}
        </div>
        <div class="t-xs" style="margin-top:8px">Chỉ áp dụng cho máy này — mỗi máy tự chọn riêng, không ảnh hưởng máy khác. Riêng các khung thêm/sửa dạng nổi (thêm bàn, thêm món, đặt bàn trước...) luôn hiện ở cỡ bình thường để tránh lỗi hiển thị.</div>
      </div>
      <button class="btn ghost" data-act="changePw">Đổi mật khẩu của tôi</button>
      <button class="btn ghost" data-act="logout">${icon('out')} Đăng xuất</button>
      ${(typeof APP_CONFIG !== 'undefined' && APP_CONFIG.buildVersion) ? `<div class="t-xs" style="text-align:center;margin-top:18px;opacity:.5">Bản ${esc(APP_CONFIG.buildVersion)}</div>` : ''}
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ============ THU NGÂN ============ */
function vCashier(){
  // Chỉ quan tâm bàn có khách — bàn trống và bàn mới giữ chỗ không liên quan tới thu ngân
  const active = t => { const s = tableSummary(t); return s.busy > 0 || s.pay > 0; };
  const areasWithGuests = DB.areas.filter(a => DB.tables.some(t => t.area === a && active(t)));
  const area = route.params.area && areasWithGuests.includes(route.params.area)
    ? route.params.area : (areasWithGuests[0] || DB.areas[0]);
  const tables = DB.tables.filter(t => t.area === area && active(t));
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayPays = DB.payments.filter(p => p.ts >= todayStart.getTime());
  const rev = todayPays.reduce((s,p)=>s+p.total,0);
  const readyAll = DB.orders.filter(o => o.status==='open' && o.items.length
    && o.items.every(i => i.status==='served'));

  return `<div class="screen">
    ${hdr('Thu ngân', `${readyAll.length} hoá đơn chờ thu`, {noBack:true})}
    <div class="body" data-swipe="area" data-area="${esc(area)}" data-areas="${esc(areasWithGuests.join('|'))}">
      <div class="card" style="background:var(--dark);border-color:var(--dark);color:#fff">
        <div class="between">
          <div><div style="font-size:12.5px;opacity:.7">Đã thu hôm nay</div>
            <div class="mono" style="font-size:24px;font-weight:700;margin-top:2px">${fmt(rev)}</div></div>
          <div style="text-align:right;font-size:12px;opacity:.75">${todayPays.length} hoá đơn</div>
        </div>
      </div>

      <button class="btn sm ghost" data-act="seatPickStart" data-mode="merge" data-from="cashier">${icon('merge')} Ghép đơn</button>

      ${areasWithGuests.length>1?`<div class="scrollx">${areasWithGuests.map(a=>{
        const n = DB.tables.filter(t=>t.area===a).reduce((s,t)=>s+tableSummary(t).pay,0);
        return `<button class="chip ${a===area?'on':''}" data-go="cashier" data-area="${esc(a)}">${esc(a)}${n?` · ${n} chờ thu`:''}</button>`;
      }).join('')}</div>
      <div class="t-xs">Vuốt sang trái/phải để đổi khu vực · chọn bàn rồi chọn ghế cần thu</div>`:''}

      <div class="grid2">
        ${tables.map(t=>{
          const s = tableSummary(t);
          const cls = s.state==='pay'?'t-pay':s.state==='busy'?'t-busy':s.state==='resv'?'t-resv':'t-free';
          const mt = s.pay ? `${s.pay} ghế chờ thu`
            : s.busy ? `${s.busy} ghế đang phục vụ` : 'Trống';
          return `<div class="tblwrap" role="button" tabindex="0" data-go="cashierTable" data-id="${t.id}"
              aria-label="${esc(t.name)} — ${esc(mt)}">
            <div class="tblhead">
              <span class="nm">${esc(t.name)}</span><span class="mt">${mt}</span>
            </div>
            ${tableChairsSvg(t)}
          </div>`;
        }).join('') || '<div class="empty">Khu này không có bàn nào đang phục vụ</div>'}
      </div>
      ${!areasWithGuests.length?'<div class="empty">Chưa có bàn nào đang phục vụ</div>':''}

      <div class="sec">Hoá đơn vừa thu</div>
      ${todayPays.slice(0,5).map(p=>`<div class="card between">
        <div><div class="t-md">${esc(p.label)}</div>
        <div class="t-xs mono">${hhmm(p.ts)} · ${esc(p.method)} · ${esc(p.by)}</div></div>
        <span class="mono t-md" style="color:var(--green)">${fmt(p.total)}</span>
      </div>`).join('') || '<div class="t-xs" style="text-align:center;padding:8px">Hôm nay chưa thu hoá đơn nào</div>'}
    </div>
    ${navBar('cashier')}
  </div>`;
}

/** Thu ngân — chọn ghế trong một bàn để thu tiền */
function vCashierTable(){
  const t = tableById(route.params.id);
  if (!t) return vCashier();
  const seats = Array.from({length:t.seats},(_,i)=>i+1);
  const merged = new Set();
  return `<div class="screen">
    ${hdr(t.name, `${esc(t.area)} — chọn ghế cần thu tiền`)}
    <div class="body">
      ${seats.map(n=>{
        const st = seatStatus(t.id, n);
        const o = st.order;
        if (!o) return `<div class="card between" style="opacity:.5">
          <div><div class="t-md">Ghế ${n}</div><div class="t-xs">Chưa có đơn</div></div>
          <span class="badge b-gray">Trống</span></div>`;
        const tt = orderTotal(o);
        const served = o.items.filter(i=>i.status==='served').reduce((a,b)=>a+b.qty,0);
        const all = o.items.reduce((a,b)=>a+b.qty,0);
        const ready = served === all;
        const isMergedOrder = o.seats && o.seats.length > 1;
        if (isMergedOrder) {
          if (merged.has(o.id)) return `<div class="card between" style="opacity:.55">
            <div><div class="t-md">Ghế ${n}</div>
            <div class="t-xs">Đã gộp vào hoá đơn ${esc(o.code||'')} ở trên</div></div>
            <span class="badge b-blue">Gộp</span></div>`;
          merged.add(o.id);
        }
        return `<button class="card between" data-go="order" data-id="${o.id}" data-from="cashier" style="width:100%;text-align:left">
          <div style="flex:1;min-width:0">
            <div class="t-md">${isMergedOrder?`Hoá đơn gộp · ${o.seats.length} ghế`:`Ghế ${n}`}${st.calling?' 🔔':''}</div>
            <div class="t-xs mono">${esc(o.code||'')} · ${served}/${all} món đã phục vụ · vào lúc ${hhmm(o.createdAt)}</div>
            ${isMergedOrder?`<div class="t-xs">Gồm ${o.seats.map(x=>`ghế ${x.seatNo}`).join(', ')}</div>`:''}
          </div>
          <div class="col" style="align-items:flex-end;gap:6px">
            <span class="badge ${ready?'b-green':'b-amber'}">${ready?'Sẵn sàng thu':'Đang phục vụ'}</span>
            <span class="mono t-md">${fmt(tt.total)}</span>
          </div>
        </button>`;
      }).join('')}
    </div>
    ${navBar('cashier')}
  </div>`;
}

/* ============ ĐẶT BÀN ============ */
function vReservations(){
  const st = {pending:['Chờ xác nhận','b-amber'],confirmed:['Đã xác nhận','b-blue'],arrived:['Đã đến','b-green'],noshow:['Không đến','b-red'],cancelled:['Đã huỷ','b-gray']};
  const list = [...DB.reservations].sort((a,b)=>a.time.localeCompare(b.time));
  return `<div class="screen">
    ${hdr('Đặt bàn trước', `${list.filter(r=>r.status==='pending').length} lịch chờ xác nhận`, {right:`<button class="iconbtn" data-act="newResv" aria-label="Thêm đặt bàn" style="background:var(--accent);color:#fff">${icon('plus')}</button>`})}
    <div class="body">
      ${list.length?list.map(r=>{
        const t = r.tableId?tableById(r.tableId):null;
        const [lb,cls]=st[r.status];
        const dim = ['arrived','noshow','cancelled'].includes(r.status);
        return `<div class="card ${r.status==='pending'?'sel':''}" style="${dim?'opacity:.65':''}">
          <div class="between"><span class="mono t-md">${esc(r.time)}</span><span class="badge ${cls}">${lb}</span></div>
          <div class="t-md" style="margin-top:8px">${esc(r.name)} · ${esc(r.phone)}</div>
          <div class="t-xs">${r.guests} khách${t?` · ${esc(t.name)}`:''}${r.seatNos&&r.seatNos.length?` · ghế ${r.seatNos.join(', ')}`:(t?' · cả bàn':'')}${r.note?` · ${esc(r.note)}`:''}</div>
        ${['pending','confirmed'].includes(r.status)?(()=>{
          const from = r.startAt - 30*60000;
          if (now() < from) return `<div class="t-xs" style="color:var(--faint)">Bắt đầu giữ chỗ lúc ${hhmm(from)}</div>`;
          if (now() <= r.startAt + (r.durationMin||90)*60000) return `<div class="t-xs" style="color:var(--green)">Đang giữ chỗ</div>`;
          return `<div class="t-xs" style="color:var(--red)">Đã quá giờ giữ chỗ</div>`;
        })():''}
          ${r.status==='pending'?`<div class="row" style="gap:8px;margin-top:12px">
            <button class="btn sm ok" data-act="resv" data-id="${r.id}" data-v="confirmed" style="flex:1">Xác nhận</button>
            <button class="btn sm" data-act="resv" data-id="${r.id}" data-v="cancelled" style="flex:1">Huỷ</button></div>`
          : r.status==='confirmed'?`<div class="row" style="gap:8px;margin-top:12px">
            <button class="btn sm ok" data-act="resv" data-id="${r.id}" data-v="arrived" style="flex:1">Khách đã đến</button>
            <button class="btn sm danger" data-act="resv" data-id="${r.id}" data-v="noshow" style="flex:1">Không đến</button></div>`:''}
        </div>`;
      }).join('') : '<div class="empty">Chưa có lịch đặt bàn nào</div>'}
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ============ THỰC ĐƠN & KHO ============ */
function vMenu(){
  const cat = route.params.cat || DB.categories[0];
  const stB = {ok:['Còn hàng','b-green'],low:['Sắp hết','b-amber'],out:['Hết hàng','b-red']};
  return `<div class="screen">
    ${hdr('Thực đơn', `${DB.menu.length} món`, {right:`
      <button class="iconbtn" data-go="catKitchen" aria-label="Quản lý danh mục &amp; khu bếp">${icon('settings')}</button>
      <button class="iconbtn" data-act="newItem" aria-label="Thêm món" style="background:var(--accent);color:#fff">${icon('plus')}</button>`})}
    <div class="body" data-swipe="cat" data-cat="${esc(cat)}">
      <div class="scrollx">${DB.categories.map(c=>`<button class="chip ${c===cat?'on':''}" data-go="menu" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="t-xs">Vuốt sang trái/phải để đổi danh mục</div>
      ${DB.menu.filter(m=>m.cat===cat).map(m=>{
        const [lb,cls]=stB[m.stock];
        return `<button class="card row" data-act="editItem" data-id="${m.id}" style="width:100%;text-align:left;${m.stock==='out'?'opacity:.6':''}">
          ${menuThumb(m,46)}
          <div style="flex:1;min-width:0"><div class="t-md">${esc(m.name)}</div>
            <div class="mono t-xs">${fmt(m.price)} · ${esc(m.cat)} · ${esc(m.kitchen)}</div></div>
          <span class="badge ${cls}">${lb}</span>
        </button>`;
      }).join('') || '<div class="empty">Danh mục này chưa có món nào</div>'}
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ============ KHUYẾN MÃI ============ */
function vPromos(){
  return `<div class="screen">
    ${hdr('Khuyến mãi','', {right:`<button class="iconbtn" data-act="newPromo" aria-label="Tạo khuyến mãi" style="background:var(--accent);color:#fff">${icon('plus')}</button>`})}
    <div class="body">
      ${DB.promos.map(p=>{
        const exhausted = p.limit>0 && p.used>=p.limit;
        const expired = new Date(p.expire) < new Date();
        const dead = exhausted||expired||!p.active;
        const lb = !p.active?['Tạm tắt','b-gray']:expired?['Hết hạn','b-gray']:exhausted?['Hết lượt','b-gray']:['Đang chạy','b-green'];
        return `<div class="card" style="${dead?'opacity:.6':''}">
          <div class="between"><span class="t-md">${esc(p.name)}</span><span class="badge ${lb[1]}">${lb[0]}</span></div>
          <div class="t-xs" style="margin-top:6px">Giảm ${p.type==='pct'?p.value+'%':fmt(p.value)} · đơn tối thiểu ${fmt(p.min)}</div>
          <div class="between" style="margin-top:10px">
            <span class="mono t-xs">Hạn ${esc(p.expire)}</span>
            <span class="mono t-xs">Đã dùng ${p.used}${p.limit>0?'/'+p.limit:''}</span>
          </div>
          <div class="row" style="gap:8px;margin-top:12px">
            <button class="btn sm" data-act="togglePromo" data-id="${p.id}" style="flex:1">${p.active?'Tạm tắt':'Bật lại'}</button>
            <button class="btn sm ghost" data-act="editPromo" data-id="${p.id}" style="flex:1">Sửa</button>
          </div>
        </div>`;
      }).join('') || '<div class="empty">Chưa có chương trình nào</div>'}
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ============ BÁO CÁO ============ */
/** Khoảng thời gian cho báo cáo — dùng chung giữa màn Doanh thu và Xuất báo cáo.
    period: today | week | month | custom. custom dùng thêm pf/pt (YYYY-MM-DD). */
function periodRange(params) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const todayStart = now.getTime(), tomorrow = todayStart + 86400000;
  const period = params.period || 'today';
  if (period === 'week') return { from: todayStart - 6 * 86400000, to: tomorrow, label: '7 ngày qua' };
  if (period === 'month') return { from: todayStart - 29 * 86400000, to: tomorrow, label: '30 ngày qua' };
  if (period === 'custom') {
    const pf = params.pf ? new Date(params.pf + 'T00:00:00').getTime() : todayStart - 6 * 86400000;
    const pt = params.pt ? new Date(params.pt + 'T00:00:00').getTime() + 86400000 : tomorrow;
    return { from: Math.min(pf, pt - 86400000), to: Math.max(pt, pf + 86400000),
             label: `${params.pf || '—'} → ${params.pt || '—'}` };
  }
  return { from: todayStart, to: tomorrow, label: 'Hôm nay' };
}
/** Chia khoảng thời gian thành các cột cho biểu đồ: theo ngày nếu ≤31 ngày, theo tuần nếu dài hơn */
function reportBuckets(from, to) {
  const totalDays = Math.max(1, Math.round((to - from) / 86400000));
  const dn = ['CN','T2','T3','T4','T5','T6','T7'];
  const dmy = t => { const d = new Date(t); return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0'); };
  const buckets = [];
  if (totalDays <= 31) {
    for (let s = from; s < to; s += 86400000) {
      buckets.push({ label: totalDays <= 7 ? dn[new Date(s).getDay()] : dmy(s), start: s, end: s + 86400000 });
    }
  } else {
    for (let s = from; s < to; s += 7 * 86400000) {
      buckets.push({ label: dmy(s), start: s, end: Math.min(s + 7 * 86400000, to) });
    }
  }
  return buckets;
}
/** Thanh chọn khoảng thời gian — dùng ở cả màn Doanh thu và Xuất báo cáo, giữ nguyên
    khi chuyển qua lại giữa 3 tab để không phải chọn lại. */
function periodBar(routeName, params) {
  const period = params.period || 'today';
  const chip = (id, label) => `<button class="chip ${period === id ? 'on' : ''}" data-go="${routeName}" data-period="${id}"
    ${params.pf ? `data-pf="${params.pf}"` : ''} ${params.pt ? `data-pt="${params.pt}"` : ''}>${label}</button>`;
  return `<div class="scrollx">
      ${chip('today', 'Hôm nay')}${chip('week', '7 ngày')}${chip('month', '30 ngày')}${chip('custom', 'Tuỳ chọn')}
    </div>
    ${period === 'custom' ? `<div class="row" style="gap:8px;margin-top:8px">
      <input class="input" id="pf" type="date" value="${params.pf || ''}" style="flex:1">
      <input class="input" id="pt" type="date" value="${params.pt || ''}" style="flex:1">
      <button class="btn sm pri" data-act="applyPeriod" data-route="${routeName}" style="width:auto">Áp dụng</button>
    </div>` : ''}`;
}


function vReports(){
  const range = periodRange(route.params);
  const pays = DB.payments.filter(p=>p.ts>=range.from && p.ts<range.to);
  const rev = pays.reduce((s,p)=>s+p.total,0);
  const buckets = reportBuckets(range.from, range.to);
  const daily = buckets.map(b=>pays.filter(p=>p.ts>=b.start&&p.ts<b.end).reduce((s,p)=>s+p.total,0));
  const maxD = Math.max(1,...daily);
  // món bán chạy trong khoảng đã chọn
  const cnt={};
  DB.orders.filter(o=>o.createdAt>=range.from && o.createdAt<range.to)
    .forEach(o=>o.items.forEach(i=>{cnt[i.name]=(cnt[i.name]||0)+i.qty}));
  const top = Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5);
  // theo thu ngân trong khoảng đã chọn
  const byUser={};
  pays.forEach(p=>{byUser[p.by]=(byUser[p.by]||0)+p.total});
  const staffRows = Object.entries(byUser).sort((a,b)=>b[1]-a[1]);
  const rp = { period: route.params.period||'today', pf: route.params.pf, pt: route.params.pt };
  const carry = `data-period="${rp.period}"${rp.pf?` data-pf="${rp.pf}"`:''}${rp.pt?` data-pt="${rp.pt}"`:''}`;
  return `<div class="screen">
    ${hdr('Báo cáo', `${range.label} · ${pays.length} hoá đơn`, {noBack:true})}
    <div class="body" data-swipe="routes" data-routes="reports|history|exportHub" data-cur="reports">
      <div class="row" style="gap:6px">
        <button class="btn sm pri" style="flex:1">Doanh thu</button>
        <button class="btn sm" data-go="history" ${carry} style="flex:1">Lịch sử đơn</button>
        <button class="btn sm" data-go="exportHub" ${carry} style="flex:1">Xuất báo cáo</button>
      </div>
      ${periodBar('reports', route.params)}
      <div class="card" style="background:var(--dark);border-color:var(--dark);color:#fff">
        <div style="font-size:12.5px;opacity:.7">Doanh thu · ${esc(range.label)}</div>
        <div class="mono" style="font-size:28px;font-weight:700;margin-top:4px">${fmt(rev)}</div>
        <div style="font-size:12px;opacity:.7;margin-top:6px">${pays.length} hoá đơn · TB ${fmt(pays.length?rev/pays.length:0)}/hoá đơn</div>
      </div>
      <div class="sec">Doanh thu theo ${buckets.length>0 && (range.to-range.from)/86400000<=31 ? 'ngày':'tuần'}</div>
      <div class="card">
        <div class="bars">
          ${daily.map((v,i)=>`<div class="b ${i===daily.length-1?'on':''}" style="height:${Math.max(4,Math.round(v/maxD*118))}px" title="${fmt(v)}"><span class="lb">${buckets[i].label}</span></div>`).join('')}
        </div>
        <div style="height:16px"></div>
      </div>
      <div class="sec">Món bán chạy</div>
      <div class="card"><table class="mini">${top.length?top.map(([n,q],i)=>`<tr><td>${i+1}. ${esc(n)}</td><td>${q} phần</td></tr>`).join(''):'<tr><td class="muted">Chưa có dữ liệu</td><td></td></tr>'}</table></div>
      <div class="sec">Doanh thu theo thu ngân</div>
      <div class="card"><table class="mini">${staffRows.length?staffRows.map(([n,v])=>`<tr><td>${esc(n)}</td><td>${fmt(v)}</td></tr>`).join(''):'<tr><td class="muted">Chưa có hoá đơn nào</td><td></td></tr>'}</table></div>
      <div class="sec">Hoá đơn trong khoảng đã chọn</div>
      <div class="card"><table class="mini">${pays.slice(0,8).map(p=>`<tr><td>${esc(p.label)} · <span class="mono t-xs">${hhmm(p.ts)}</span><br><span class="t-xs">${esc(p.method)}</span></td><td>${fmt(p.total)}</td></tr>`).join('') || '<tr><td class="muted">Chưa có hoá đơn</td><td></td></tr>'}</table></div>
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ============ NHÂN VIÊN ============ */
function vStaff(){
  const sel = route.params.id || DB.staff[0].id;
  const s = DB.staff.find(x=>x.id===sel) || DB.staff[0];
  const P = SCREENS.map(sc => [sc.key, sc.label, sc.desc]);
  return `<div class="screen">
    ${hdr('Nhân viên', `${DB.staff.filter(x=>x.active).length} đang hoạt động`, {right:`<button class="iconbtn" data-act="newStaff" aria-label="Thêm nhân viên" style="background:var(--accent);color:#fff">${icon('plus')}</button>`})}
    <div class="body">
      ${DB.staff.map(x=>`<button class="card row ${x.id===s.id?'sel':''}" data-go="staff" data-id="${x.id}" style="width:100%;text-align:left;${x.active?'':'opacity:.6'}">
        <div class="avatar" style="background:${x.role==='Chủ quán'?'var(--accent)':x.role==='Bếp'?'var(--green)':'var(--blue)'}">${esc(x.name.split(' ').map(c=>c[0]).slice(-2).join(''))}</div>
        <div style="flex:1"><div class="t-md">${esc(x.name)}</div><div class="t-xs">${esc(x.role)} · ${esc(x.user)}${x.active?'':' · đã khoá'}</div></div>
        <span style="width:10px;height:10px;border-radius:999px;background:${x.active?'var(--green)':'var(--red)'}"></span>
      </button>`).join('')}
      <div class="sec">Được vào màn hình nào · ${esc(s.name)}</div>
      ${s.role==='Chủ quán'?`<div class="card row" style="background:var(--chip);border:none">
        <span class="t-sm" style="flex:1">Chủ quán luôn vào được mọi màn hình, không cần cấp quyền.</span></div>`:''}
      ${P.map(([k,lb,desc])=>`<label class="card between" style="${s.role==='Chủ quán'?'opacity:.5':''}">
        <div style="flex:1"><div class="t-sm">${esc(lb)}</div><div class="t-xs">${esc(desc)}</div></div>
        <input type="checkbox" class="switch" data-act="perm" data-id="${s.id}" data-k="${k}"
          ${s.role==='Chủ quán'||s.perms[k]?'checked':''} ${s.role==='Chủ quán'?'disabled':''} aria-label="${esc(lb)}">
      </label>`).join('')}
      <div class="row" style="gap:8px;margin-top:6px">
        <button class="btn sm ${s.active?'danger':'ok'}" data-act="toggleStaff" data-id="${s.id}" style="flex:1">${s.active?'Khoá tài khoản':'Mở khoá'}</button>
        <button class="btn sm ghost" data-act="resetPw" data-id="${s.id}" style="flex:1">Cấp lại mật khẩu</button>
      </div>
      ${(!s.active && s.role !== 'Chủ quán') ? `<button class="btn sm danger" data-act="delStaffAsk" data-id="${s.id}" style="width:100%;margin-top:8px">Xoá hẳn tài khoản</button>
        <div class="t-xs" style="margin-top:4px;color:var(--muted)">Chỉ xoá được tài khoản đang khoá. Không thể hoàn tác.</div>` : ''}
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ============ THANH TOÁN & HOÁ ĐƠN ============ */
/** Cài đặt máy in hoá đơn (riêng từng máy) + lời cảm ơn cuối hoá đơn (chung cả quán) */
function printerCardHtml() {
  const cfg = printerCfg(), found = window._pfound || [], scanning = !!window._pscanning;
  return `<div class="sec">Máy in hoá đơn — riêng máy này</div>
    <div class="card">
      <div class="t-md">${cfg.address ? esc(cfg.name || cfg.address) : 'Chưa chọn máy in'}</div>
      <div class="t-xs" style="margin-top:2px;line-height:1.6">${cfg.address ? esc(cfg.address) : 'Chưa có máy in: hoá đơn được lưu thành PDF để in hoặc gửi cho khách.'}</div>
      <div class="t-sm" style="margin:12px 0 6px">Khổ giấy</div>
      <div class="row" style="gap:8px">${[58, 80].map(w => `<button class="chip ${cfg.width === w ? 'on' : ''}" data-act="printerWidth" data-w="${w}" style="flex:1;justify-content:center">${w}mm</button>`).join('')}</div>
      <button class="btn sm pri" data-act="printerScan" style="margin-top:12px" ${scanning ? 'disabled' : ''}>${scanning ? 'Đang tìm máy in…' : 'Tìm máy in Bluetooth'}</button>
      ${found.map(d => `<button class="card between" data-act="printerPick" data-addr="${esc(d.address)}" data-nm="${esc(d.name || '')}" style="width:100%;text-align:left;margin-top:8px">
        <div><div class="t-md">${esc(d.name || 'Máy in')}</div><div class="t-xs mono">${esc(d.address)}</div></div><span class="badge b-blue">Chọn</span></button>`).join('')}
      <div class="t-sm" style="margin:12px 0 6px">Hoặc nhập địa chỉ máy in</div>
      <div class="row" style="gap:8px"><input class="input" id="prAddr" placeholder="AA:BB:CC:DD:EE:FF" autocapitalize="characters" style="flex:1"><button class="btn sm ghost" data-act="printerManual" style="width:auto">Dùng</button></div>
      <div class="row" style="gap:8px;margin-top:12px">
        <button class="btn sm ghost" data-act="printerTest" style="flex:1">${icon('printer')} In thử</button>
        ${cfg.address ? `<button class="btn sm danger" data-act="printerForget" style="flex:1">Bỏ máy in</button>` : ''}
      </div>
      <div class="t-xs" style="margin-top:12px;line-height:1.6">Bật máy in, vào <b>Cài đặt Bluetooth</b> của điện thoại để ghép đôi máy in trước (mã thường là 0000 hoặc 1234), rồi bấm "Tìm máy in Bluetooth". Hoá đơn được in dạng ảnh nên đúng dấu tiếng Việt với mọi máy in nhiệt 58/80mm.</div>
    </div>
    <label class="card between">
      <div style="flex:1"><div class="t-md">Tự in hoá đơn sau khi thanh toán</div><div class="t-xs">In ngay khi thu tiền xong (hoặc lưu PDF nếu chưa có máy in)</div></div>
      <input type="checkbox" class="switch" data-act="devPref" data-k="billAuto" ${devicePref('billAuto', false) ? 'checked' : ''} aria-label="Tự in hoá đơn">
    </label>
    <div class="card">
      <div class="t-md" style="margin-bottom:8px">Lời cảm ơn cuối hoá đơn</div>
      <div class="row" style="gap:8px"><input class="input" id="billFooter" value="${esc(DB.settings.billFooter != null ? DB.settings.billFooter : BILL_FOOTER_DEFAULT)}" style="flex:1"><button class="btn sm pri" data-act="saveBillFooter" style="width:auto">Lưu</button></div>
      <div class="t-xs" style="margin-top:6px">Địa chỉ quán in ở đầu hoá đơn: nhập trong "Thông tin nhà hàng".</div>
    </div>`;
}

function vBilling(){
  const stB={live:['Thật','b-green'],mock:['Giả lập','b-blue']};
  return `<div class="screen">
    ${hdr('Thanh toán & hoá đơn')}
    <div class="body">
      <div class="sec">Thông tin nhà hàng</div>
      <button class="card between" data-act="editRestaurant" style="width:100%;text-align:left">
        <div style="flex:1">
          <div class="t-md">${esc(DB.restaurant.name || 'Chưa đặt tên')}</div>
          <div class="t-xs">${DB.restaurant.phone ? 'SĐT: '+esc(DB.restaurant.phone) : 'Chưa có số điện thoại'}</div>
          <div class="t-xs" style="margin-top:2px">Hiện ở đầu app và trang khách gọi món</div>
        </div>
        ${icon('edit')}
      </button>
      ${printerCardHtml()}
      <div class="sec">Tài khoản nhận tiền — VietQR</div>
      ${(()=>{ loadVietQrBanksLive(); return ''; })()}
      <div class="card">
        <div class="field"><label class="f">Ngân hàng</label>
          <select class="input" id="vqrBank">
            <option value="">— Chọn ngân hàng —</option>
            ${vietQrBankOptions().map(b=>`<option value="${b.bin}" ${DB.settings.vietqrBin===b.bin?'selected':''}>${esc(b.name)}</option>`).join('')}
          </select>
          <div class="t-xs row" style="margin-top:4px;gap:8px">
            <span style="flex:1">${_vietqrBanksLive ? `✓ Danh sách đầy đủ (${_vietqrBanksLive.length} ngân hàng, tải trực tiếp từ VietQR)` : _vietqrBanksLoading ? 'Đang tải danh sách đầy đủ…' : `Danh sách rút gọn (${VIETQR_BANKS.length} ngân hàng phổ biến)`}</span>
            ${(!_vietqrBanksLive && !_vietqrBanksLoading) ? `<button class="btn sm ghost" data-act="retryVietQrBanks" style="width:auto;padding:4px 10px">Thử lại</button>` : ''}
          </div></div>
        <div class="field"><label class="f">Số tài khoản</label>
          <input class="input" id="vqrAcc" inputmode="numeric" value="${esc(DB.settings.vietqrAccount||'')}" placeholder="vd. 0123456789"></div>
        <div class="field"><label class="f">Tên chủ tài khoản (không dấu, IN HOA)</label>
          <input class="input" id="vqrName" value="${esc(DB.settings.vietqrName||'')}" placeholder="vd. NGUYEN VAN A"></div>
        <button class="btn sm pri" data-act="saveVietQr">Lưu</button>
        ${DB.settings.vietqrBin&&DB.settings.vietqrAccount
          ? `<div class="t-xs" style="margin-top:8px;color:var(--green)">✓ Đã cấu hình — mã QR thanh toán tự điền đúng số tiền và nội dung</div>`
          : `<div class="t-xs" style="margin-top:8px;color:var(--amber)">Chưa cấu hình — màn thanh toán sẽ không hiện được mã QR chuyển khoản</div>`}
      </div>

      <div class="sec">Cổng thanh toán</div>
      ${DB.gateways.filter(g=>g.id==='cash'||g.id==='vietqr').map(g=>{
        const [lb,cls]=stB[g.state];
        return `<label class="card between">
          <div style="flex:1"><div class="t-md">${esc(g.name)}</div>
          <div class="t-xs">${g.state==='live'?'Đã sẵn sàng':'Chưa cấu hình xong'}</div></div>
          <span class="badge ${cls}" style="margin-right:10px">${lb}</span>
          <input type="checkbox" class="switch" data-act="gw" data-id="${g.id}" ${g.on?'checked':''} aria-label="Bật: ${esc(g.name)}">
        </label>`;
      }).join('')}
      <div class="sec">Tự động hoá</div>
      <label class="card between">
        <div style="flex:1"><div class="t-md">Nhân viên xác nhận đơn đầu tiên</div>
        <div class="t-xs">Khách quét QR gọi lần đầu sẽ chờ nhân viên duyệt rồi mới xuống bếp. Các đợt gọi sau đi thẳng.</div></div>
        <input type="checkbox" class="switch" data-act="setSetting" data-k="confirmFirstOrder" ${DB.settings.confirmFirstOrder===true?'checked':''} aria-label="Xác nhận đơn đầu tiên">
      </label>
      <label class="card between">
        <div style="flex:1"><div class="t-md">Tự khoá QR sau thanh toán</div><div class="t-xs">Khách rời bàn không gọi thêm được</div></div>
        <input type="checkbox" class="switch" data-act="setSetting" data-k="autoLock" ${DB.settings.autoLock!==false?'checked':''} aria-label="Tự khoá QR">
      </label>
      <label class="card between">
        <div style="flex:1"><div class="t-md">Âm báo đơn mới ở bếp</div><div class="t-xs">Kêu chuông khi có vé bếp mới</div></div>
        <input type="checkbox" class="switch" data-act="setSetting" data-k="sound" ${DB.settings.sound!==false?'checked':''} aria-label="Âm báo bếp">
      </label>
      <label class="card between">
        <div style="flex:1"><div class="t-md">Âm báo khách gọi nhân viên</div><div class="t-xs">Kêu chuông khi khách bấm "Gọi nhân viên" trên trang gọi món</div></div>
        <input type="checkbox" class="switch" data-act="setSetting" data-k="callSound" ${DB.settings.callSound!==false?'checked':''} aria-label="Âm báo gọi nhân viên">
      </label>
      <div class="card">
        <div class="t-md" style="margin-bottom:10px">Âm báo &amp; âm lượng</div>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          ${CHIME_IDS.map(k=>`<button class="chip ${Number(DB.settings.chime||1)===k?'on':''}" data-act="pickChime" data-k="${k}" style="flex:1 1 100px;justify-content:center">${esc(CHIME_NAMES[k])}</button>`).join('')}
        </div>
        <button class="btn sm ghost" data-act="tryChime" style="margin-top:8px">${icon('bell')} Nghe thử (kêu như thật, lặp lại 3 giây)</button>
        <input type="range" min="0" max="100" step="5" value="${Number(DB.settings.soundVolume!=null?DB.settings.soundVolume:100)}"
               data-act="setVolume" style="width:100%;margin-top:14px" aria-label="Âm lượng">
        <div class="t-xs" style="text-align:right">Âm lượng trong app: ${Number(DB.settings.soundVolume!=null?DB.settings.soundVolume:100)}%</div>
        <div class="t-xs" style="line-height:1.6;margin-top:6px">Âm lượng thật còn phụ thuộc phím âm lượng của điện thoại: tiếng trong app theo âm lượng <b>đa phương tiện</b>, thông báo khi chạy nền theo âm lượng <b>thông báo</b> — hãy kéo cả hai lên cao.</div>
      </div>
      <div class="sec">Rung &amp; thông báo — riêng máy này</div>
      <label class="card between">
        <div style="flex:1"><div class="t-md">Rung điện thoại khi có thông báo</div><div class="t-xs">Rung cùng lúc với chuông khách gọi / món mới</div></div>
        <input type="checkbox" class="switch" data-act="devPref" data-k="vibrate" ${devicePref('vibrate', true)?'checked':''} aria-label="Rung khi có thông báo">
      </label>
      <label class="card between">
        <div style="flex:1"><div class="t-md">Nhận thông báo khi chạy nền</div><div class="t-xs">Giữ app hoạt động (hiện một thông báo cố định) để vẫn kêu chuông và rung khi đang mở app khác hoặc tắt màn hình</div></div>
        <input type="checkbox" class="switch" data-act="devPref" data-k="background" ${devicePref('background', true)?'checked':''} aria-label="Nhận thông báo khi chạy nền">
      </label>
      <button class="btn sm ghost" data-act="tryNotify">${icon('bell')} Gửi thông báo thử (như khi chạy nền)</button>
      <div class="t-xs" style="line-height:1.6">Nếu không thấy chuông/rung khi chạy nền: bật quyền Thông báo cho app, và tắt "Tối ưu hoá pin" cho app này trong Cài đặt điện thoại.</div>    </div>
    ${navBar('admin')}
  </div>`;
}

/* ============ NHẬT KÝ ============ */
function vLogs(){
  const tab = route.params.tab||'all';
  const list = DB.logs.filter(l=>tab==='all'?true:l.level==='error');
  return `<div class="screen">
    ${hdr('Nhật ký hoạt động', `${DB.logs.length} bản ghi trên thiết bị`, {right:`<button class="iconbtn" data-act="expSrv" data-k="logs" aria-label="Xuất CSV">${icon('printer')}</button>`})}
    <div class="body" data-swipe="tabs" data-tabkey="tab" data-tabs="all|err" data-cur="${esc(tab)}">
      <div class="row" style="gap:6px">
        <button class="btn sm ${tab==='all'?'pri':''}" data-go="logs" data-tab="all" style="flex:1">Tất cả</button>
        <button class="btn sm ${tab==='err'?'pri':''}" data-go="logs" data-tab="err" style="flex:1">Lỗi hệ thống</button>
      </div>
      ${list.length?list.map(l=>`<div class="row" style="gap:12px;padding:11px 0;border-bottom:1px solid var(--line);${l.level==='error'?'background:var(--red-soft);margin:0 -18px;padding-left:18px;padding-right:18px':''}">
        <span class="mono t-xs" style="min-width:38px;${l.level==='error'?'color:var(--red)':''}">${hhmm(l.ts)}</span>
        <div class="t-sm" style="flex:1;${l.level==='error'?'color:var(--red)':''}"><b>${esc(l.who)}</b> ${esc(l.what)}</div>
      </div>`).join('') : '<div class="empty">Chưa có bản ghi nào</div>'}
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ============ DANH MỤC MÓN & KHU BẾP ============ */
function vCategoriesKitchens(){
  const rowOf = (kind, name) => {
    const n = DB.menu.filter(m => (kind === 'cat' ? m.cat : m.kitchen) === name).length;
    return `<div class="card between">
      <div><div class="t-md">${esc(name)}</div><div class="t-xs">${n} món</div></div>
      <div class="row" style="gap:4px">
        <button class="iconbtn" data-act="${kind === 'cat' ? 'editCategory' : 'editKitchen'}" data-name="${esc(name)}" aria-label="Sửa: ${esc(name)}">${icon('edit')}</button>
        <button class="iconbtn" data-act="${kind === 'cat' ? 'delCategory' : 'delKitchen'}" data-name="${esc(name)}" aria-label="Xoá: ${esc(name)}">${icon('trash')}</button>
      </div>
    </div>`;
  };
  return `<div class="screen">
    ${hdr('Danh mục & khu bếp', `${DB.categories.length} danh mục · ${DB.kitchens.length} khu bếp`)}
    <div class="body">
      <div class="sec row between" style="align-items:center">Danh mục món
        <button class="btn sm ghost" data-act="newCategory" style="width:auto">+ Thêm danh mục</button></div>
      ${DB.categories.length ? DB.categories.map(c => rowOf('cat', c)).join('') : '<div class="empty">Chưa có danh mục nào</div>'}

      <div class="sec row between" style="align-items:center;margin-top:18px">Khu bếp
        <button class="btn sm ghost" data-act="newKitchen" style="width:auto">+ Thêm khu bếp</button></div>
      ${DB.kitchens.length ? DB.kitchens.map(k => rowOf('kit', k)).join('') : '<div class="empty">Chưa có khu bếp nào</div>'}
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ============ MÃ QR BÀN ============ */
/* ============ QUẢN LÝ BÀN ============ */
function vTablesAdmin(){
  const area = route.params.area || DB.areas[0];
  const list = DB.tables.filter(t => t.area === area);
  return `<div class="screen">
    ${hdr('Quản lý bàn', `${DB.tables.length} bàn · ${DB.tables.reduce((s,t)=>s+t.seats,0)} ghế`, {right:`<button class="iconbtn" data-act="newTable" aria-label="Thêm bàn" style="background:var(--accent);color:#fff">${icon('plus')}</button>`})}
    <div class="body" data-swipe="area" data-area="${esc(area)}">
      <button class="btn sm ghost" data-go="guestPage" style="width:100%">${icon('printer')} Mã QR gọi món</button>
      <div class="scrollx">
        ${DB.areas.map(a=>{
          const n = DB.tables.filter(t=>t.area===a).length;
          return `<button class="chip ${a===area?'on':''}" data-go="tablesAdmin" data-area="${esc(a)}">${esc(a)} · ${n}</button>`;
        }).join('')}
        <button class="chip" data-act="newArea">+ Khu vực</button>
      </div>
      <div class="t-xs">Vuốt sang trái/phải để đổi khu vực</div>
      ${list.length ? list.map(t=>{
        const s=tableSummary(t);
        return `<button class="card between" data-act="editTable" data-id="${t.id}" style="width:100%;text-align:left">
          <div><div class="t-md">${esc(t.name)}</div>
          <div class="t-xs">${t.seats} ghế · ${s.state==='free'?'Trống':s.busy+' ghế đang dùng'}</div></div>
          <span style="color:var(--faint)">${icon('edit')}</span>
        </button>`;
      }).join('') : '<div class="empty">Khu này chưa có bàn nào</div>'}
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ============ LỊCH SỬ KHO ============ */
function vStockLog(){
  const f = route.params.f || 'all';
  const list = DB.stockMoves.filter(m=>f==='all'?true:m.type===f);
  const tc = {in:['Nhập','b-green'],out:['Xuất','b-red'],auto:['Tự trừ','b-blue']};
  return `<div class="screen">
    ${hdr('Lịch sử nhập/xuất kho', `${DB.stockMoves.length} lượt biến động`, {right:`<button class="iconbtn" data-act="expSrv" data-k="stock" aria-label="Xuất CSV">${icon('printer')}</button>`})}
    <div class="body" data-swipe="tabs" data-tabkey="f" data-tabs="all|in|out|auto" data-cur="${esc(f)}">
      <div class="scrollx">
        ${[['all','Tất cả'],['in','Nhập kho'],['out','Xuất kho'],['auto','Tự trừ theo công thức']].map(([k,lb])=>
          `<button class="chip ${f===k?'on':''}" data-go="stockLog" data-f="${k}">${lb}</button>`).join('')}
      </div>
      ${list.length?list.slice(0,80).map(m=>{
        const [lb,cls]=tc[m.type];
        return `<div class="card between">
          <div style="flex:1;min-width:0">
            <div class="t-md">${esc(m.name)}</div>
            <div class="t-xs">${esc(m.reason||'—')}</div>
            <div class="t-xs mono">${dstr(m.ts)} · ${esc(m.by)}</div>
          </div>
          <div class="col" style="align-items:flex-end;gap:6px">
            <span class="badge ${cls}">${lb}</span>
            <span class="mono t-md" style="color:${m.type==='in'?'var(--green)':'var(--red)'}">${m.type==='in'?'+':'−'}${m.qty} ${esc(m.unit)}</span>
            <span class="mono t-xs">còn ${m.after}</span>
          </div>
        </div>`;
      }).join('') : '<div class="empty">Chưa có biến động kho nào</div>'}
    </div>
    ${navBar('admin')}
  </div>`;
}

/* ============ TRUNG TÂM XUẤT BÁO CÁO ============ */
function vExport(){
  // Kho hiện tại là ảnh chụp tức thời, chọn khoảng ngày không có ý nghĩa — luôn xuất đủ
  const items = [
    ['revenue','Báo cáo doanh thu','Doanh thu theo ngày, số hoá đơn','chart', true],
    ['payments','Lịch sử thanh toán','Mọi hoá đơn đã thu, phương thức, thu ngân','card', true],
    ['orders','Lịch sử đơn hàng','Từng dòng món trong mọi đơn, kèm bàn/ghế','order', true],
    ['stock','Lịch sử nhập/xuất kho','Mọi biến động kho kể cả tự trừ theo công thức','box', true],
    ['inventory','Tồn kho hiện tại','Số dư từng nguyên liệu và cảnh báo','box', false],
    ['logs','Nhật ký hoạt động','Toàn bộ thao tác và lỗi hệ thống','clock', true]
  ];
  const range = periodRange(route.params);
  return `<div class="screen">
    ${hdr('Xuất báo cáo','Tệp Excel (.xlsx) trình bày sẵn, mở được ngay')}
    <div class="body" data-swipe="routes" data-routes="reports|history|exportHub" data-cur="exportHub">
      <div class="row" style="gap:6px">
        <button class="btn sm" data-go="reports" style="flex:1">Doanh thu</button>
        <button class="btn sm" data-go="history" style="flex:1">Lịch sử đơn</button>
        <button class="btn sm pri" style="flex:1">Xuất báo cáo</button>
      </div>
      <div class="sec">Khoảng thời gian lấy dữ liệu</div>
      ${periodBar('exportHub', route.params)}
      <div class="t-xs" style="margin-top:8px">${esc(range.label)} · áp dụng cho các báo cáo có mốc thời gian (doanh thu, thanh toán, đơn hàng, kho, nhật ký). Tồn kho hiện tại luôn xuất đủ vì là số dư tức thời.</div>
      ${items.map(([k,title,desc,ic,ranged])=>`<button class="card row" data-act="expSrv" data-k="${k}" ${ranged?`data-from="${range.from}" data-to="${range.to}"`:''} style="width:100%;text-align:left">
        <span style="color:var(--accent)">${icon(ic)}</span>
        <div style="flex:1;min-width:0"><div class="t-md">${esc(title)}</div><div class="t-xs">${esc(desc)}${ranged?'':' · toàn bộ'}</div></div>
        ${icon('back')}
      </button>`).join('')}
    </div>
    ${navBar('admin')}
  </div>`;
}
