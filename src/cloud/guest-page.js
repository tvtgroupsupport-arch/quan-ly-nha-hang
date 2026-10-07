/* ============================================================
   TRANG GỌI MÓN CHO KHÁCH — MỘT trang TĨNH, DÙNG CHUNG cho mọi quán, do bạn
   (nhà cung cấp) đăng lên GitHub Pages đúng MỘT LẦN DUY NHẤT (xem workflow
   .github/workflows/pages.yml) — KHÔNG phải mỗi quán tự đăng riêng.

   Lý do đổi cách này: Supabase Storage CỐ TÌNH không bao giờ phục vụ file
   .html như trang web thật (luôn trả về dạng văn bản thô, vì lý do bảo
   mật — xem supabase.com/docs/guides/storage/quickstart, mục "Files").
   Đây là giới hạn của nền tảng, không sửa được bằng cách cấu hình lại.

   Vì một trang dùng chung cho mọi quán, nó không thể biết trước địa chỉ
   Supabase/khoá của từng quán — mã QR của mỗi ghế giờ gửi kèm luôn 3 thứ
   qua tham số đường dẫn: ?store=<địa chỉ Supabase của quán>&key=<khoá
   anon>&t=<mã riêng của ghế>. Khoá "anon" vốn dĩ là khoá CÔNG KHAI (an
   toàn khi lộ ra, được bảo vệ bởi RLS chứ không phải bằng cách giấu khoá),
   nên việc này không phải rò rỉ thông tin bí mật.
   ============================================================ */

/** Dựng toàn bộ trang HTML gọi món — một bản DUY NHẤT, dùng chung cho mọi quán. */
function buildGuestPageHtml() {
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Gọi món</title>
<style>
  :root{--accent:#D9581F;--ink:#1A1613;--muted:#6b645d;--line:#e6e0d8;--bg:#FBF8F3;--green:#3F7D5C;--red:#AB3D31}
  *{box-sizing:border-box} body{margin:0;font:15px/1.5 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--bg);color:var(--ink);padding-bottom:84px}
  .hdr{background:var(--accent);color:#fff;padding:18px 16px 14px;position:sticky;top:0;z-index:5}
  .hdr h1{margin:0;font-size:19px} .hdr .sub{font-size:13px;opacity:.9;margin-top:2px}
  .cats{display:flex;gap:8px;overflow-x:auto;padding:12px 16px;background:#fff;position:sticky;top:64px;z-index:4;box-shadow:0 1px 0 var(--line)}
  .cats button{flex:none;padding:7px 15px;border-radius:999px;border:1px solid var(--line);background:#fff;font:600 13px inherit;color:#555}
  .cats button.on{background:var(--accent);border-color:var(--accent);color:#fff}
  .catblock{padding:16px 16px 2px} .catblock h2{font-size:14px;margin:0 0 10px;color:var(--accent)}
  .item{display:flex;gap:12px;background:#fff;border-radius:14px;padding:12px;margin-bottom:10px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .item .thumb{width:60px;height:60px;border-radius:10px;flex:none;overflow:hidden;background:#F3EEE6;display:flex;align-items:center;justify-content:center;font-size:26px}
  .item .thumb img{width:100%;height:100%;object-fit:cover}
  .item .body{flex:1;min-width:0} .item .name{font-weight:700;font-size:14.5px}
  .item .desc{font-size:12px;color:var(--muted);margin-top:2px}
  .item .price{font-family:monospace;font-weight:700;color:var(--accent);margin-top:6px;font-size:14px}
  .item .out{color:var(--red);font-size:12px;margin-top:4px}
  .step{display:flex;align-items:center;gap:10px;margin-top:8px}
  .step button{width:30px;height:30px;border-radius:8px;border:1px solid var(--line);background:#fff;font-size:17px;line-height:1}
  .step button.pri{background:var(--accent);border-color:var(--accent);color:#fff}
  .step .n{min-width:18px;text-align:center;font-weight:700}
  .bar{position:fixed;left:0;right:0;bottom:0;background:#fff;border-top:1px solid var(--line);padding:12px 16px env(safe-area-inset-bottom,12px);display:flex;gap:10px;align-items:center;z-index:6}
  .bar .tot{flex:1} .bar .tot b{font-size:17px} .bar .tot div{font-size:11.5px;color:var(--muted)}
  button.go{background:var(--accent);color:#fff;border:none;border-radius:10px;padding:12px 20px;font:700 14.5px inherit}
  button.go:disabled{opacity:.4}
  .callbtn{position:fixed;right:14px;bottom:84px;background:#fff;border:1px solid var(--line);border-radius:999px;padding:10px 16px;font:600 13px inherit;box-shadow:0 2px 8px rgba(0,0,0,.12);z-index:6}
  .callbtn.done{color:var(--green);border-color:var(--green)}
  .msg{margin:40px 20px;text-align:center;color:var(--muted);line-height:1.7}
  .toast{position:fixed;left:50%;bottom:150px;transform:translateX(-50%);background:#222;color:#fff;padding:9px 16px;border-radius:8px;font-size:13px;z-index:9;display:none}
  .sheet{position:fixed;inset:0;background:rgba(0,0,0,.4);display:none;align-items:flex-end;z-index:8}
  .sheet.on{display:flex} .sheet .box{background:#fff;border-radius:16px 16px 0 0;padding:18px 16px calc(18px + env(safe-area-inset-bottom,0px));width:100%;max-height:75vh;overflow:auto}
  .sheet h3{margin:0 0 12px} .sline{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)}
  .myorder{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:#FFF3EA;border:none;border-bottom:2px solid var(--accent);padding:14px 16px;position:sticky;top:64px;z-index:4;font:700 16px inherit;color:var(--accent)}
  .myorder b{font-size:17px}
  .myorder .go{margin-left:auto;font-size:20px}
  .obadge{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:700;margin-left:6px}
  .ob-pending{background:#F5EEDA;color:#93701A} .ob-queued{background:#E6EBF4;color:#4A5F8A}
  .ob-cooking{background:#F5EEDA;color:#93701A} .ob-served{background:#E7F1EA;color:var(--green)}
  .oitem{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--line);gap:10px}
  .oitem .nm{font-weight:700;font-size:14.5px} .oitem .nt{font-size:12px;color:var(--muted);margin-top:2px}
  .back{background:none;border:none;color:inherit;font:700 15px inherit;padding:4px 0;margin-bottom:4px}
</style>
</head>
<body>
<div id="app"><div class="msg">Đang tải thực đơn…</div></div>
<div id="toast" class="toast"></div>
<button class="callbtn" id="callBtn" style="display:none">🔔 Gọi nhân viên</button>
<div class="sheet" id="cartSheet"><div class="box" id="cartBox"></div></div>

<script type="module">
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Một trang dùng chung cho mọi quán — địa chỉ Supabase, khoá anon và mã ghế đều lấy
// từ mã QR (tham số đường dẫn), không có gì nhúng sẵn trong trang.
const params = new URLSearchParams(location.search);
const STORE_URL = params.get('store') || '';
const ANON_KEY = params.get('key') || '';
const TOKEN = params.get('t') || '';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmt = n => (Math.round(n) || 0).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.') + 'đ';
const $ = id => document.getElementById(id);
let sb = null, state = null, cart = {}, curCat = 0, called = false, view = 'menu', poller = null;
const ST_LABEL = { pending: 'Chờ xác nhận', queued: 'Đã gửi bếp', cooking: 'Đang làm', served: 'Đã phục vụ' };
const ST_CLASS = { pending: 'ob-pending', queued: 'ob-queued', cooking: 'ob-cooking', served: 'ob-served' };

function toast(msg) { const t = $('toast'); t.textContent = msg; t.style.display = 'block'; clearTimeout(toast._t); toast._t = setTimeout(() => t.style.display = 'none', 2400); }

async function boot() {
  if (!STORE_URL || !ANON_KEY || !TOKEN) { $('app').innerHTML = '<div class="msg">Mã QR không hợp lệ hoặc thiếu thông tin — quét lại mã QR dán tại bàn.</div>'; return; }
  try { sb = createClient(STORE_URL, ANON_KEY); } catch (e) { $('app').innerHTML = '<div class="msg">Mã QR không hợp lệ — quét lại mã QR dán tại bàn.</div>'; return; }
  await load();
  clearInterval(poller);
  // Nhân viên xác nhận/bếp đổi trạng thái món bên phía họ — khách không tự biết trừ khi tải lại,
  // nên âm thầm làm mới mỗi 15 giây để "Đơn của tôi" tự cập nhật, không cần khách bấm gì.
  poller = setInterval(poll, 15000);
}
async function load() {
  const { data, error } = await sb.rpc('guest_menu', { p_seat_token: TOKEN });
  if (error) { $('app').innerHTML = \`<div class="msg">\${esc(error.message || 'Không tải được thực đơn')}</div>\`; return; }
  state = data;
  $('callBtn').style.display = state.locked ? 'none' : '';
  render();
}
/** Làm mới âm thầm — không phá giao diện nếu lỗi/mất mạng tạm thời */
async function poll() {
  try {
    const { data, error } = await sb.rpc('guest_menu', { p_seat_token: TOKEN });
    if (error || !data) return;
    state = data;
    render();
  } catch (e) { /* bỏ qua, thử lại lần sau */ }
}
function render() {
  if (state.locked) { clearInterval(poller); $('app').innerHTML = '<div class="msg">Mã QR của bàn này đã khoá.<br>Vui lòng gọi nhân viên để được hỗ trợ.</div>'; return; }
  if (view === 'order') return renderOrder();
  renderMenu();
}
function orderBadgeHtml() {
  const o = state.order;
  if (!o || !o.items.length) return '';
  const n = o.items.reduce((s, i) => s + i.qty, 0);
  return \`<button class="myorder" id="myOrderBtn">📋 <span>Đơn của tôi — <b>\${n} món</b></span><span class="go">›</span></button>\`;
}
function renderMenu() {
  const cats = state.categories.map(c => ({ ...c, items: state.menu.filter(m => m.category_id === c.id) })).filter(c => c.items.length);
  if (!cats.length) { $('app').innerHTML = '<div class="msg">Thực đơn hiện chưa có món nào.</div>'; return; }
  if (curCat >= cats.length) curCat = 0;
  $('app').innerHTML = \`
    <div class="hdr"><h1>\${esc(state.restaurant.name || 'Thực đơn')}</h1>
      <div class="sub">\${esc(state.table_name || '')} · Ghế \${state.seat_no}</div></div>
    \${orderBadgeHtml()}
    <div class="cats">\${cats.map((c, i) => \`<button class="\${i === curCat ? 'on' : ''}" data-ci="\${i}">\${esc(c.name)}</button>\`).join('')}</div>
    \${cats.map((c, i) => \`<div class="catblock" style="\${i === curCat ? '' : 'display:none'}" data-cb="\${i}">
      <h2>\${esc(c.name)}</h2>
      \${c.items.map(m => {
        const out = m.stock_state === 'out', qty = cart[m.id] || 0;
        return \`<div class="item">
          <div class="thumb">\${m.image ? \`<img src="\${m.image}">\` : (m.emoji || '🍽️')}</div>
          <div class="body">
            <div class="name">\${esc(m.name)}</div>
            \${m.description ? \`<div class="desc">\${esc(m.description)}</div>\` : ''}
            \${out ? '<div class="out">Tạm hết món</div>' : \`<div class="price">\${fmt(m.price)}</div>
              <div class="step">
                <button data-mi="\${m.id}" data-d="-1">−</button><span class="n">\${qty}</span>
                <button class="pri" data-mi="\${m.id}" data-d="1">+</button>
              </div>\`}
          </div>
        </div>\`;
      }).join('')}
    </div>\`).join('')}
  \`;
  updateBar();
}
/** Danh sách món đã gọi — khách tự xem được, không cần hỏi nhân viên. Tự cập nhật trạng thái mỗi 15 giây. */
function renderOrder() {
  document.getElementById('cartBar')?.remove();
  const o = state.order;
  if (!o || !o.items.length) { view = 'menu'; return renderMenu(); }
  const total = o.items.reduce((s, i) => s + i.qty * i.price, 0);
  $('app').innerHTML = \`
    <div class="hdr"><button class="back" id="backBtn" style="color:#fff">‹ Quay lại thực đơn</button>
      <h1 style="margin-top:4px">Đơn của tôi</h1>
      <div class="sub">\${esc(o.code || '')} · \${esc(state.table_name || '')} · Ghế \${state.seat_no}</div></div>
    <div style="padding:14px 16px">
      \${o.items.map(i => \`<div class="oitem">
          <div><div class="nm">\${esc(i.name)} ×\${i.qty}</div>
            \${i.note ? \`<div class="nt">Ghi chú: \${esc(i.note)}</div>\` : ''}
            <div class="nt">\${fmt(i.price * i.qty)}</div></div>
          <span class="obadge \${ST_CLASS[i.status] || 'ob-queued'}">\${ST_LABEL[i.status] || i.status}</span>
        </div>\`).join('')}
      <div class="oitem" style="border:none;font-weight:700"><div>Tổng cộng</div><div>\${fmt(total)}</div></div>
      <button class="go" id="moreBtn" style="width:100%;margin-top:10px">Gọi thêm món</button>
    </div>
  \`;
  $('backBtn').onclick = $('moreBtn').onclick = () => { view = 'menu'; render(); };
}
/** Đưa danh mục đang chọn ra giữa thanh cuộn ngang, cho dễ thấy đang ở danh mục nào */
function centerActiveCat() {
  requestAnimationFrame(() => {
    const el = document.querySelector('.cats button.on'), box = el && el.parentElement;
    if (!box) return;
    const br = box.getBoundingClientRect(), er = el.getBoundingClientRect();
    box.scrollTo({ left: Math.max(0, box.scrollLeft + (er.left - br.left) - (br.width - er.width) / 2), behavior: 'smooth' });
  });
}
function updateBar() {
  document.getElementById('cartBar')?.remove();
  const n = Object.values(cart).reduce((s, q) => s + q, 0);
  if (!n) return;
  const total = Object.entries(cart).reduce((s, [id, q]) => s + q * (state.menu.find(m => m.id === id)?.price || 0), 0);
  const bar = document.createElement('div'); bar.className = 'bar'; bar.id = 'cartBar';
  bar.innerHTML = \`<div class="tot"><b>\${fmt(total)}</b><div>\${n} món đã chọn</div></div>
    <button class="go" id="reviewBtn">Xem lại &amp; gửi</button>\`;
  document.body.appendChild(bar);
  $('reviewBtn').onclick = openCart;
}
function openCart() {
  const rows = Object.entries(cart).filter(([, q]) => q > 0);
  const total = rows.reduce((s, [id, q]) => s + q * (state.menu.find(m => m.id === id)?.price || 0), 0);
  $('cartBox').innerHTML = \`<h3>Món đã chọn</h3>
    \${rows.map(([id, q]) => { const m = state.menu.find(x => x.id === id);
      return \`<div class="sline"><span>\${esc(m.name)} ×\${q}</span><span class="mono">\${fmt(q * m.price)}</span></div>\`; }).join('')}
    <div class="sline" style="border:none;font-weight:700"><span>Tổng cộng</span><span>\${fmt(total)}</span></div>
    <button class="go" id="sendBtn" style="width:100%;margin-top:14px">Gửi món xuống bếp</button>
    <button style="width:100%;margin-top:8px;background:none;border:none;color:#888;padding:10px" id="closeBtn">Đóng</button>\`;
  $('cartSheet').classList.add('on');
  $('sendBtn').onclick = sendOrder;
  $('closeBtn').onclick = () => $('cartSheet').classList.remove('on');
}
async function sendOrder() {
  const lines = Object.entries(cart).filter(([, q]) => q > 0).map(([menuItemId, qty]) => ({ menuItemId, qty }));
  if (!lines.length) return;
  const btn = $('sendBtn'); btn.disabled = true; btn.textContent = 'Đang gửi…';
  const { data, error } = await sb.rpc('guest_order', { p_seat_token: TOKEN, p_lines: lines });
  if (error) { toast(error.message || 'Không gửi được, thử lại'); btn.disabled = false; btn.textContent = 'Gửi món xuống bếp'; return; }
  cart = {};
  $('cartSheet').classList.remove('on');
  toast(data.status === 'pending' ? \`Đã gửi \${data.items} món — đang chờ nhân viên xác nhận\` : \`Đã gửi \${data.items} món xuống bếp\`);
  view = 'order';
  await load();   // tải lại để lấy đủ danh sách món (gồm cả các đợt gọi trước đó), rồi hiện ngay màn "Đơn của tôi"
}
async function callStaff() {
  if (called) return;
  called = true; $('callBtn').classList.add('done'); $('callBtn').textContent = '✓ Đã báo nhân viên';
  const { error } = await sb.rpc('guest_call', { p_seat_token: TOKEN });
  if (error) { called = false; $('callBtn').classList.remove('done'); $('callBtn').textContent = '🔔 Gọi nhân viên'; toast(error.message); return; }
  setTimeout(() => { called = false; $('callBtn').classList.remove('done'); $('callBtn').textContent = '🔔 Gọi nhân viên'; }, 60000);
}

/* ---------- vuốt trái/phải để đổi danh mục thực đơn ---------- */
let swX = null, swY = null;
document.addEventListener('touchstart', e => {
  if (view !== 'menu' || !e.target.closest('.catblock')) { swX = null; return; }
  swX = e.touches[0].clientX; swY = e.touches[0].clientY;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (swX === null) return;
  const dx = e.changedTouches[0].clientX - swX, dy = e.changedTouches[0].clientY - swY;
  swX = null;
  if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.6) return;   // phải là vuốt ngang rõ ràng, không phải cuộn dọc
  const cats = state.categories.map(c => ({ ...c, items: state.menu.filter(m => m.category_id === c.id) })).filter(c => c.items.length);
  if (cats.length < 2) return;
  curCat = (curCat + (dx < 0 ? 1 : -1) + cats.length) % cats.length;
  render(); centerActiveCat();
}, { passive: true });

document.addEventListener('click', e => {
  if (e.target.closest('#myOrderBtn')) { view = 'order'; render(); return; }
  const cat = e.target.closest('button[data-ci]');
  if (cat) { curCat = Number(cat.dataset.ci); render(); centerActiveCat(); return; }
  const step = e.target.closest('button[data-mi]');
  if (step) {
    const id = step.dataset.mi, d = Number(step.dataset.d);
    cart[id] = Math.max(0, Math.min(50, (cart[id] || 0) + d));
    render();
    const tgt = document.querySelector(\`[data-cb="\${curCat}"]\`);
    if (tgt) tgt.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (e.target.id === 'callBtn') callStaff();
});
boot();
<\/script>
</body>
</html>
`;
}

