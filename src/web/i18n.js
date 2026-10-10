/* ============================================================
   ĐA NGÔN NGỮ — chọn ngôn ngữ hiển thị riêng từng máy (Tiếng Việt / English).
   Cách làm: mã nguồn viết bằng tiếng Việt; khi chọn ngôn ngữ khác, mọi chữ HIỂN THỊ ra màn hình (nội dung văn bản, placeholder,
   title, aria-label) được dịch ngay tại tầng giao diện (DOM) bằng bảng dịch trong i18n-en-*.js. Nhờ vậy logic app (so sánh vai trò
   'Chủ quán', mã trạng thái…) không bị ảnh hưởng, và thêm một ngôn ngữ mới chỉ cần thêm một bảng dịch + một dòng trong LANGS.
   Dữ liệu người dùng tự nhập (tên khách, ghi chú) giữ nguyên vì không có trong bảng dịch.
   Bảng dịch khớp theo CỤM từ dài nhất trước, không phân biệt hoa/thường, và giữ kiểu hoa/thường của chữ gốc.
   test: mọi đoạn tiếng Việt trong mã nguồn đều phải có bản dịch (scripts/extract-vi.mjs).
   ============================================================ */
const LANGS = {
  vi: { name: 'Tiếng Việt', flag: '🇻🇳' },
  en: { name: 'English', flag: '🇬🇧', table: () => [].concat(I18N_EN_1, I18N_EN_2, I18N_EN_3, I18N_EN_4) }
};
const LANG_KEY = 'lang';

let _lang = 'vi';
const _i18n = {};   // { [lang]: { map: Map(khoá thường → bản dịch), re: RegExp|null, cache: Map } }

function _norm(s) { return String(s).normalize('NFC'); }
function _escRe(s) { return s.replace(/[.*+?^${}()|[\]\\\/-]/g, '\\$&'); }

function _compile(lang) {
  if (_i18n[lang]) return _i18n[lang];
  const def = LANGS[lang];
  const map = new Map();
  if (def && def.table) {
    for (const [vi, tr] of def.table()) {
      const k = _norm(vi).trim().toLowerCase();
      if (k && !map.has(k)) map.set(k, tr);
    }
  }
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  let re = null;
  if (keys.length) {
    const alt = keys.map(k => (/^\p{L}/u.test(k) ? '(?<!\\p{L})' : '') + _escRe(k) + (/\p{L}$/u.test(k) ? '(?!\\p{L})' : '')).join('|');
    re = new RegExp(alt, 'giu');
  }
  return (_i18n[lang] = { map, re, cache: new Map() });
}

/** Giữ kiểu hoa/thường của chữ gốc: "Ghế" → "Seat", "ghế" → "seats" (không đụng tới từ viết tắt như QR, VND) */
function _adaptCase(src, out) {
  const a = src.charAt(0), o = out.charAt(0);
  if (!o || !/\p{L}/u.test(o)) return out;
  const upSrc = a !== a.toLowerCase(), upOut = o !== o.toLowerCase();
  if (upSrc && !upOut) return o.toUpperCase() + out.slice(1);
  if (!upSrc && upOut && /\p{L}/u.test(a) && !/^\p{Lu}{2}/u.test(out) && !/^\p{Lu}[a-z]*\p{Lu}/u.test(out)) return o.toLowerCase() + out.slice(1);
  return out;
}

/** Sửa số ít/số nhiều sau khi dịch: "Seats 3" → "Seat 3" (nhãn + số), "1 seats" → "1 seat" */
const _SING = { seats: 'seat', dishes: 'dish', bills: 'bill', tables: 'table', orders: 'order', guests: 'guest', portions: 'portion', changes: 'change', rows: 'row',
  records: 'record', labels: 'label', items: 'item', movements: 'movement', categories: 'category', devices: 'device', reservations: 'reservation',
  ingredients: 'ingredient', months: 'month', days: 'day', bookings: 'booking', areas: 'area' };
function _enGrammar(s) {
  return s
    .replace(/(\d)VND\b/g, '$1 VND')
    .replace(/\b(Seats|seats) (?=\d)/g, (m, w) => (w === 'Seats' ? 'Seat ' : 'seat '))
    .replace(/(^|[^\d.,])1 (seats|dishes|bills|tables|orders|guests|portions|changes|rows|records|labels|items|movements|categories|devices|reservations|ingredients|months|days|bookings|areas)\b/g,
      (m, pre, w) => `${pre}1 ${_SING[w]}`);
}
/** Dịch một đoạn chữ. lang không có bảng dịch (vi) → trả nguyên văn. */
function trText(text, lang) {
  lang = lang || _lang;
  if (text == null || lang === 'vi') return text;
  const c = _compile(lang);
  if (!c.map.size) return text;
  const s = String(text);
  if (c.cache.has(s)) return c.cache.get(s);
  let out = s;
  if (/\S/.test(s)) {
    const norm = _norm(s);
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(norm);
    const hit = c.map.get(m[2].toLowerCase());
    if (hit !== undefined) out = m[1] + _adaptCase(m[2], hit) + m[3];
    else if (c.re) out = norm.replace(c.re, (found) => _adaptCase(found, c.map.get(found.toLowerCase()) ?? found));
  }
  if (out !== s && lang === 'en') out = _enGrammar(out);
  if (c.cache.size > 4000) c.cache.clear();
  c.cache.set(s, out);
  return out;
}

function getLang() { return _lang; }
function hasLangChoice() { try { return !!localStorage.getItem(LANG_KEY); } catch (e) { return true; } }
function loadLang() {
  let l = null;
  try { l = localStorage.getItem(LANG_KEY); } catch (e) {}
  _lang = LANGS[l] ? l : 'vi';
  return _lang;
}
/** Ngôn ngữ gợi ý theo ngôn ngữ của điện thoại (chỉ để đánh dấu sẵn ở màn chọn, người dùng vẫn phải chọn) */
function suggestedLang() {
  try { const n = String((typeof navigator !== 'undefined' && navigator.language) || '').toLowerCase(); return n.startsWith('vi') ? 'vi' : 'en'; } catch (e) { return 'en'; }
}
function setLang(l) {
  if (!LANGS[l]) return;
  _lang = l;
  try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  try { if (typeof document !== 'undefined') document.documentElement.lang = l; } catch (e) {}
  _applyAll();
}

/* ---------- Dịch trực tiếp trên DOM ---------- */
const _SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, CODE: 1, PRE: 1, NOSCRIPT: 1, SVG: 1, svg: 1 };
const _ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];

function _trTextNode(n) {
  const cur = n.nodeValue;
  if (n.__en !== undefined && cur === n.__en) return;      // vừa do mình đặt
  n.__vi = cur;
  const out = trText(cur);
  if (out !== cur) { n.__en = out; n.nodeValue = out; } else n.__en = undefined;
}
function _trAttrs(el) {
  for (const a of _ATTRS) {
    if (!el.hasAttribute || !el.hasAttribute(a)) continue;
    const cur = el.getAttribute(a);
    el.__viA = el.__viA || {}; el.__enA = el.__enA || {};
    if (el.__enA[a] !== undefined && cur === el.__enA[a]) continue;
    el.__viA[a] = cur;
    const out = trText(cur);
    if (out !== cur) { el.__enA[a] = out; el.setAttribute(a, out); } else el.__enA[a] = undefined;
  }
}
function _walk(root, fn) {
  if (!root) return;
  if (root.nodeType === 3) { fn(root, null); return; }
  if (root.nodeType !== 1 || _SKIP[root.nodeName] || (root.hasAttribute && root.hasAttribute('data-notr'))) return;
  fn(null, root);
  for (let c = root.firstChild; c; c = c.nextSibling) _walk(c, fn);
}
function _translateTree(root) {
  if (_lang === 'vi') return;
  _walk(root, (t, el) => { if (t) _trTextNode(t); else _trAttrs(el); });
}
/** Trả lại chữ gốc tiếng Việt (khi đổi ngược về Tiếng Việt) */
function _restoreTree(root) {
  _walk(root, (t, el) => {
    if (t) { if (t.__en !== undefined && t.nodeValue === t.__en && t.__vi !== undefined) t.nodeValue = t.__vi; t.__en = undefined; }
    else if (el.__viA) for (const a of Object.keys(el.__viA)) { if (el.__enA[a] !== undefined && el.getAttribute(a) === el.__enA[a]) el.setAttribute(a, el.__viA[a]); el.__enA[a] = undefined; }
  });
}
let _titleVi = null;
function _applyAll() {
  if (typeof document === 'undefined' || !document.body) return;
  try { if (_titleVi === null) _titleVi = document.title; document.title = trText(_titleVi); } catch (e) {}
  try { if (_lang === 'vi') _restoreTree(document.body); else _translateTree(document.body); } catch (e) {}
}
let _observer = null;
function initI18n() {
  loadLang();
  try { if (typeof document !== 'undefined') document.documentElement.lang = _lang; } catch (e) {}
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.body) return;
  if (_observer) return;
  _observer = new MutationObserver(muts => {
    if (_lang === 'vi') return;
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(n => _translateTree(n));
      else if (m.type === 'characterData') { if (m.target.nodeType === 3 && m.target.parentNode && !_SKIP[m.target.parentNode.nodeName]) _trTextNode(m.target); }
      else if (m.type === 'attributes') _trAttrs(m.target);
    }
  });
  _observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: _ATTRS });
  _applyAll();
}

/* ---------- Màn chọn ngôn ngữ (lần đầu mở app) ---------- */
function vLang() {
  const sug = suggestedLang(), cur = hasLangChoice() ? getLang() : sug;
  return `<div class="screen"><div class="body" style="justify-content:center;gap:14px;padding:28px 22px" data-notr>
    <div style="font-size:44px;text-align:center">🌐</div>
    <div class="t-lg" style="text-align:center">Choose your language<br>Chọn ngôn ngữ</div>
    ${Object.keys(LANGS).map(k => `<button class="btn ${k === cur ? 'pri' : 'ghost'}" data-act="pickLang" data-k="${k}" style="font-size:18px;padding:16px">${LANGS[k].flag} ${LANGS[k].name}</button>`).join('')}
    <div class="t-xs" style="text-align:center;line-height:1.6">You can change this later in Manage → Display language.<br>Có thể đổi sau trong Quản lý → Ngôn ngữ hiển thị.</div>
  </div></div>`;
}
