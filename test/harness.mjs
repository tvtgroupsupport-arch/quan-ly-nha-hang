/* Khung kiểm thử: mỗi "thiết bị" là một bản chạy ĐỘC LẬP của đúng đoạn mã đã ghép để đóng gói vào APK
   (cùng engine, lưu trữ SQLite, đồng bộ, màn hình), với SQLite thật (node:sqlite), Supabase giả, đồng hồ và bộ hẹn giờ giả. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { webcrypto } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { assembleScript } from '../scripts/assemble.mjs';
import { FakeProject, makeSupabase } from './fake-supabase.mjs';
import { ROOT } from '../scripts/assemble.mjs';

/** Trang khách tĩnh (guest-page.js) không còn nhúng vào app — dựng riêng để kiểm thử, giống
    hệt cách scripts/build-guest-page.mjs dựng cho GitHub Pages. */
export function buildGuestPageHtmlForTest() {
  const src = fs.readFileSync(path.join(ROOT, 'src/cloud/guest-page.js'), 'utf8');
  return new Function(src + '; return buildGuestPageHtml;')()();
}

export const CENTRAL_URL = 'https://central.test';
export const STORE_URL = 'https://quan-a.test';
export const ANON = 'sb_publishable_' + 'x'.repeat(30);
export const GUEST_PAGE_URL = 'https://tvtgroupsupport-arch.github.io/quan-ly-nha-hang/';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'qlnh-'));
let SCRIPT = null;
const tail = `
;return {
  get D() { return D; }, set D(v) { D = v; },
  get route() { return route; }, set route(v) { route = v; },
  get ME() { return ME; }, set ME(v) { ME = v; },
  get TOKEN() { return TOKEN; },
  get DB() { return DB; },
  document, window, go,
  QR, Persist, Records, Sync, Cloud, License, AuthLocal, apiLocal, refresh, render, createStore, emptyD, VIEWS, handleAct, tableChairsSvg, guestUrl,
  hasNewStaffCall, hasNewKitchenTicket, playChime, get chimeCalls() { return _chimeCalls; }, get toneCalls() { return _toneCalls; },
  openQrZoom, closeQrZoom, get qrZoomOpen() { return !!qrZoomEl; }, uploadMenuImage,
  playPurchase, playRestore, vSubscriptionPlay, normalizePlayProducts, playProductId,
  AutoProv, autoProvCard,
  get playBusy() { return _playBusy; }, get playProducts() { return _playProducts; },
  buildMenuPageHtml, exportMenuPage, addLog, engineGuard, can, INVITE_PREFIX
};`;

export function newWorld() {
  const central = new FakeProject(CENTRAL_URL, 'central');
  const store = new FakeProject(STORE_URL, 'store');
  return { central, store, registry: { [CENTRAL_URL]: central, [STORE_URL]: store }, clock: { skew: 0 } };
}

export async function newDevice(world, name, opts = {}) {
  if (!SCRIPT) SCRIPT = assembleScript({ centralUrl: CENTRAL_URL, centralAnonKey: ANON, supportText: '', guestPageUrl: GUEST_PAGE_URL });
  const file = opts.dbFile || path.join(tmp, `${name}-${Math.random().toString(36).slice(2)}.db`);
  const dev = { name, file, online: true, saved: [], scanResult: null, clip: '', timers: [], sessions: opts.sessions || {}, inputs: {}, netCb: null, clockOffset: 0 };

  const FakeDate = class extends Date {
    constructor(...a) { if (a.length === 0) super(Date.now() + dev.clockOffset); else super(...a); }
    static now() { return Date.now() + dev.clockOffset; }
  };
  // Hẹn giờ: chỉ độ trễ 40ms (nhịp giả lập của engine) chạy ngay; còn lại chờ test gọi runTimers() cho xác định
  let tid = 0;
  const setTimeoutFake = (fn, ms) => {
    if (ms === 40) { setImmediate(fn); return ++tid; }
    const id = ++tid; dev.timers.push({ id, fn }); return id;
  };
  const clearTimeoutFake = id => { dev.timers = dev.timers.filter(t => t.id !== id); };

  let sdb = null;
  const sqlite = {
    async open() { sdb = new DatabaseSync(file); },
    async exec(sql) { sdb.exec(sql); },
    async query(sql, p) { return sdb.prepare(sql).all(...(p || [])); },
    async batch(set) {
      sdb.exec('BEGIN');
      try { for (const s of set) sdb.prepare(s.statement).run(...(s.values || [])); sdb.exec('COMMIT'); }
      catch (e) { sdb.exec('ROLLBACK'); throw e; }
    }
  };
  const supa = makeSupabase(world.registry, dev.sessions);
  const nb = {
    isNative: true, platform: 'android', ready: async () => {},
    sqlite, supabase: supa,
    network: { get: async () => dev.online, onChange: cb => { dev.netCb = cb; } },
    app: { onResume() {}, onBack() {} },
    copy: async t => { dev.clip = t; }, readClipboard: async () => dev.clip,
    scan: async () => dev.scanResult,
    saveFile: async (n, b) => { dev.saved.push({ name: n, size: b.size }); return true; },
    brightness: { boost: async () => { dev.brightnessBoosts = (dev.brightnessBoosts || 0) + 1; },
                  restore: async () => { dev.brightnessRestores = (dev.brightnessRestores || 0) + 1; } },
    browser: { open: async (url) => { (dev.browserOpened = dev.browserOpened || []).push(url); } },
    billing: {
      isSupported: async () => dev.billingSupported !== false,
      getProducts: async (ids) => (dev.billingProducts || ids.map(id => ({ identifier: id, title: id, priceString: '0đ' }))),
      getPurchases: async () => dev.billingOwned || [],
      purchase: async (productId, appAccountToken, planIdentifier) => {
        dev.lastPurchaseCall = { productId, appAccountToken, planIdentifier };
        if (dev.billingPurchaseImpl) return dev.billingPurchaseImpl(productId, appAccountToken);
        return { purchaseToken: 'tok-' + productId, productId };
      },
      restore: async () => { dev.billingRestoreCalls = (dev.billingRestoreCalls || 0) + 1; },
      manage: async () => { dev.billingManageCalls = (dev.billingManageCalls || 0) + 1; },
    },
  };
  const els = {};
  const el = () => ({ style: {}, innerHTML: '', value: '', dataset: {}, appendChild() {}, remove() {}, querySelectorAll: () => [], addEventListener() {}, classList: { toggle() {} } });
  const documentFake = {
    getElementById: id => dev.inputs[id] || (els[id] = els[id] || el()),
    createElement: () => el(), addEventListener() {}, body: { style: { setProperty(k, v) { this[k] = v; } }, appendChild() {} }, head: { appendChild() {} },
    querySelector: () => null, querySelectorAll: () => [], activeElement: null, hidden: false
  };
  const storage = {}; const localStorage = { getItem: k => storage[k] ?? null, setItem: (k, v) => { storage[k] = String(v); }, removeItem: k => { delete storage[k]; } };
  // AudioContext giả — đủ để playChime()/_tone() chạy thật sự (lên lịch đúng số nốt), không chỉ no-op
  // vì audioCtx() === null, để test đo được chuông có LẶP LẠI đúng hay không.
  class FakeAudioContext {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createOscillator() { return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} }; }
    createGain() { return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} } }; }
    resume() { return Promise.resolve(); }
  }
  const windowFake = { localStorage, addEventListener() {}, scrollTo() {}, AudioContext: FakeAudioContext };
  const consoleFake = { log() {}, warn() {}, error: (...a) => { if (process.env.TEST_VERBOSE) console.error(...a); } };

  // fetch(): mặc định mô phỏng "không có mạng" (đúng với sandbox này) — reject ngay, không chờ timeout thật,
  // để các màn hình dùng fetch() (vd. tải danh sách ngân hàng VietQR) rơi vào nhánh dự phòng một cách NHANH
  // và ỔN ĐỊNH khi test, thay vì phụ thuộc mạng thật của môi trường chạy test. Ghi đè bằng dev.fetchImpl khi
  // một bài test cụ thể cần mô phỏng "có mạng, API trả dữ liệu".
  // data: URL không đi qua mạng thật (trình duyệt tự giải mã cục bộ) — Node có hỗ trợ sẵn, cho qua
  // thẳng fetch thật của Node thay vì chặn như các địa chỉ http(s) khác.
  const fetchFake = (...a) => (typeof a[0] === 'string' && a[0].startsWith('data:') ? fetch(...a) :
    (dev.fetchImpl || (() => Promise.reject(new Error('fetch: không có mạng (giả lập)'))))(...a));

  const factory = new Function('window', 'document', 'localStorage', 'NativeBridge', 'navigator', 'location', 'crypto', 'Date',
    'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'TextEncoder', 'btoa', 'atob', 'console', 'URL', 'Blob', 'FileReader', 'fetch', 'requestAnimationFrame',
    SCRIPT + tail);
  const api = factory(windowFake, documentFake, localStorage, nb, { userAgent: 'test', onLine: true }, { host: 'localhost', href: 'https://localhost/', origin: 'https://localhost', hash: '' },
    webcrypto, FakeDate, setTimeoutFake, clearTimeoutFake, () => 0, () => {}, queueMicrotask, TextEncoder, btoa, atob, consoleFake,
    { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, class { constructor(parts, o) { this.size = parts.reduce((s, p) => s + (p.length || p.byteLength || 0), 0); this.type = (o || {}).type; } },
    class {}, fetchFake, fn => setImmediate(fn));

  Object.defineProperties(dev, Object.getOwnPropertyDescriptors(api));   // giữ nguyên getter/setter (D, route, ME...)
  dev.api = (p, o) => api.apiLocal(p, o);
  // đợi boot() tự chạy xong
  for (let i = 0; i < 20; i++) await new Promise(r => setImmediate(r));
  /** Chờ tới khi điều kiện đúng (tối đa ~10 giây) — tránh phụ thuộc số vòng chờ cố định */
  dev.until = async (cond, ms = 10000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await cond()) return true; await new Promise(r => setTimeout(r, 5)); }
    return false;
  };
  dev.setInput = (id, v) => { dev.inputs[id] = { value: v }; };
  dev.clearInputs = () => { dev.inputs = {}; };
  dev.runTimers = async () => { const t = dev.timers; dev.timers = []; for (const x of t) await x.fn(); };
  /** ghi xuống đĩa ngay (thay cho hẹn giờ 250ms) */
  dev.save = async () => { await api.Persist.flush(); await api.Persist.idle(); };
  /** một vòng đồng bộ đầy đủ: ghi đĩa → đẩy → kéo */
  dev.sync = async () => { await dev.save(); await api.Sync.syncNow(); await api.Persist.idle(); };
  dev.login = async (username, password) => {
    const r = await api.apiLocal('/auth/login', { method: 'POST', body: { username, password } });
    api.ME = r.staff; await api.refresh(); return r;
  };
  dev.setOnline = on => { dev.online = on; api.Sync.setOnline(on); };
  dev.reopen = (w) => newDevice(w || world, name, { dbFile: file, sessions: dev.sessions });
  return dev;
}

/** Bộ chạy test tối giản */
export function suite() {
  const results = { pass: 0, fail: 0, failures: [] };
  let group = '';
  return {
    results,
    group(name) { group = name; console.log('\n▸ ' + name); },
    ok(cond, msg) {
      if (cond) { results.pass++; console.log('   ✓ ' + msg); }
      else { results.fail++; results.failures.push(group + ' → ' + msg); console.log('   ✗ ' + msg); }
    },
    eq(a, b, msg) {
      const ok = JSON.stringify(a) === JSON.stringify(b);
      this.ok(ok, ok ? msg : `${msg}  (nhận ${JSON.stringify(a)}, mong ${JSON.stringify(b)})`);
    },
    async rejects(fn, re, msg) {
      let e = null; try { await fn(); } catch (x) { e = x; }
      this.ok(!!e && (!re || re.test(e.message || '')), msg + (e ? ` [${e.message}]` : ' [không có lỗi]'));
    }
  };
}
