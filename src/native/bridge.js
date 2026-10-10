/* ============================================================
   CẦU NỐI NATIVE — đóng gói bằng esbuild thành dist/bridge.js (IIFE)
   Gom mọi thứ cần plugin Capacitor / thư viện npm vào MỘT chỗ để phần còn lại
   của app (script thường, không dùng import) chỉ nói chuyện qua `NativeBridge`.
   Mỗi hàm có phương án dự phòng cho trình duyệt để chạy thử trên máy tính.
   ============================================================ */
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Network } from '@capacitor/network';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Clipboard } from '@capacitor/clipboard';
import { Browser } from '@capacitor/browser';
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { ScreenBrightness } from '@capacitor-community/screen-brightness';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics } from '@capacitor/haptics';
import { ForegroundService } from '@capawesome-team/capacitor-android-foreground-service';
import * as supabase from '@supabase/supabase-js';
// Đóng sẵn ExcelJS vào APK (không tải từ CDN) để xuất báo cáo Excel được cả khi mất mạng
import ExcelJS from 'exceljs/dist/exceljs.min.js';

const isNative = Capacitor.isNativePlatform();

/* ---------- SQLite (chỉ trên Android) ---------- */
let conn = null;
const sqlite = isNative ? {
  async open(name) {
    const mgr = new SQLiteConnection(CapacitorSQLite);
    const consistent = (await mgr.checkConnectionsConsistency()).result;
    const exists = (await mgr.isConnection(name, false)).result;
    conn = (consistent && exists)
      ? await mgr.retrieveConnection(name, false)
      : await mgr.createConnection(name, false, 'no-encryption', 1, false);
    await conn.open();
  },
  async exec(statements) { await conn.execute(statements, true); },
  async query(statement, values) { const r = await conn.query(statement, values || []); return r.values || []; },
  async batch(set) { await conn.executeSet(set, true); }
} : null;

/* ---------- mạng ---------- */
const network = {
  async get() {
    if (isNative) return (await Network.getStatus()).connected;
    return navigator.onLine !== false;
  },
  onChange(cb) {
    if (isNative) Network.addListener('networkStatusChange', s => cb(s.connected));
    else { window.addEventListener('online', () => cb(true)); window.addEventListener('offline', () => cb(false)); }
  }
};

/* ---------- vòng đời app ---------- */
const app = {
  onResume(cb) {
    if (isNative) App.addListener('resume', cb);
    else document.addEventListener('visibilitychange', () => { if (!document.hidden) cb(); });
  },
  /** handler trả true nếu đã xử lý nút Back; false → thu nhỏ app */
  onBack(handler) {
    if (!isNative) return;
    App.addListener('backButton', () => { if (!handler()) App.minimizeApp(); });
  }
};

/* ---------- khay nhớ tạm ---------- */
async function copy(text) {
  if (isNative) { await Clipboard.write({ string: String(text) }); return; }
  await navigator.clipboard.writeText(String(text));
}
async function readClipboard() {
  if (isNative) { const r = await Clipboard.read(); return r.value || ''; }
  return navigator.clipboard.readText();
}

/* ---------- quét QR (máy nhân viên) ---------- */
async function scan() {
  if (!isNative) throw new Error('Quét QR chỉ chạy trên ứng dụng Android — hãy dán mã vào ô bên dưới');
  const perm = await BarcodeScanner.requestPermissions();
  if (perm.camera !== 'granted' && perm.camera !== 'limited') throw new Error('Cần cấp quyền camera để quét mã');
  try {
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!available) await BarcodeScanner.installGoogleBarcodeScannerModule();
  } catch (e) { /* thiết bị không cần module riêng */ }
  const { barcodes } = await BarcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
  return barcodes && barcodes.length ? barcodes[0].rawValue : null;
}

/* ---------- lưu / chia sẻ tệp (xuất báo cáo Excel, thực đơn) ---------- */
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
async function saveFile(filename, blob) {
  if (isNative) {
    const data = await blobToBase64(blob);
    await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({ title: filename, url: uri, dialogTitle: 'Lưu hoặc gửi tệp' });
    return true;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}

/* ---------- độ sáng màn hình (phóng to mã QR thanh toán cho dễ quét) ---------- */
let _origBrightness = null;
const brightness = {
  /** Tăng sáng tạm thời — chỉ ảnh hưởng app này, không đổi độ sáng hệ thống của máy */
  async boost() {
    if (!isNative) return;
    try {
      if (_origBrightness === null) _origBrightness = (await ScreenBrightness.getBrightness()).brightness;
      await ScreenBrightness.setBrightness({ brightness: 1 });
    } catch (e) { /* một số máy chặn quyền chỉnh độ sáng — bỏ qua, mã QR vẫn phóng to được, chỉ không sáng hơn */ }
  },
  /** Trả lại đúng độ sáng trước đó */
  async restore() {
    if (!isNative || _origBrightness === null) return;
    try { await ScreenBrightness.setBrightness({ brightness: _origBrightness }); } catch (e) {}
    _origBrightness = null;
  }
};

/* ---------- Google Play Billing (chỉ dùng ở bản app "Google Play") ----------
   Không tự quyết định gì về gói cước ở đây — chỉ chuyển tiếp purchaseToken lên
   Edge Function "verify-purchase" (xem src/cloud/play-billing.js) để XÁC MINH VỚI
   GOOGLE rồi mới ghi nhận. Không bao giờ tin thẳng dữ liệu purchaseProduct() trả về. */
const billing = {
  async isSupported() {
    if (!isNative) return false;
    try { return (await NativePurchases.isBillingSupported()).isBillingSupported; } catch (e) { return false; }
  },
  /** appAccountToken: truyền ownerId (uuid) của chủ quán — Google đính kèm lại giá trị này vào
      giao dịch (externalAccountIdentifiers), Edge Function dùng nó để đối chiếu đúng người mua. */
  async getProducts(productIds) {
    const { products } = await NativePurchases.getProducts({ productIdentifiers: productIds, productType: PURCHASE_TYPE.SUBS });
    return products;
  },
  /** planIdentifier = ID base plan trên Play Console — plugin BẮT BUỘC với gói đăng ký trên Android. */
  async purchase(productId, appAccountToken, planIdentifier) {
    const tx = await NativePurchases.purchaseProduct({ productIdentifier: productId, planIdentifier, productType: PURCHASE_TYPE.SUBS, appAccountToken });
    return tx;   // chứa purchaseToken (Android) — gửi thẳng lên verify-purchase, không tự xử lý gì thêm ở đây
  },
  async restore() { return NativePurchases.restorePurchases(); },
  /** Các lượt mua gói hiện có của tài khoản Google trên máy (Android: có purchaseToken). */
  async getPurchases(appAccountToken) {
    try { return (await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS, appAccountToken })).purchases || []; }
    catch (e) { return []; }
  },
  async manage() { try { await NativePurchases.manageSubscriptions(); } catch (e) {} },
};

/* ---------- Mở trang web ngoài (đăng nhập/uỷ quyền Supabase khi tự tạo kho dữ liệu cho quán) ---------- */
const browser = {
  async open(url) {
    if (!/^https:\/\//i.test(String(url))) throw new Error('Chỉ mở được địa chỉ https');
    if (isNative) { await Browser.open({ url }); return; }
    window.open(url, '_blank', 'noopener');
  }
};

/* ---------- Thông báo + rung + chạy nền (chỉ trên Android) ----------
   • notify(): THÔNG BÁO HỆ THỐNG mức cao nhất (hiện đè lên app khác, có chuông riêng của kênh + rung). Chuông là tệp chime_N.wav
     do scripts/make-sounds.mjs sinh vào res/raw lúc build. Kênh thông báo trên Android KHÔNG đổi được âm sau khi tạo, nên mỗi kiểu
     chuông có kênh riêng, và mỗi kiểu có thêm bản "không rung" (tuỳ chọn rung là riêng từng máy).
   • keepAlive(): dịch vụ nền (foreground service) kèm thông báo cố định nhỏ — giữ tiến trình app sống khi chuyển sang app khác
     hoặc tắt màn hình, để đồng bộ vẫn chạy và phát được thông báo trên. */
const CHIME_COUNT = 5;
const chimeChannel = (k, vibrate) => `bao_${k}${vibrate ? '' : '_im'}`;
let _alertsReady = null, _fgOn = false, _notifId = 1000;
const alerts = isNative ? {
  async init() {
    if (_alertsReady !== null) return _alertsReady;
    try {
      let p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
      if (p.display !== 'granted') { _alertsReady = null; return false; }   // lần sau hỏi lại
      for (let k = 1; k <= CHIME_COUNT; k++) {
        for (const vib of [true, false]) {
          await LocalNotifications.createChannel({
            id: chimeChannel(k, vib), name: `Âm báo ${k}${vib ? ' (có rung)' : ' (không rung)'}`, description: 'Khách gọi nhân viên, món mới cho bếp',
            importance: 5, visibility: 1, sound: `chime_${k}.wav`, vibration: vib, lights: true
          });
        }
      }
      try { await ForegroundService.createNotificationChannel({ id: 'nen', name: 'Đang chạy nền', description: 'Giữ app nhận thông báo khi ở chế độ nền', importance: 2 }); } catch (e) {}
      _alertsReady = true; return true;
    } catch (e) { _alertsReady = null; return false; }
  },
  /** Hiện thông báo hệ thống ngay. Trả về false nếu chưa được cấp quyền thông báo. */
  async notify({ title, body, chime, vibrate }) {
    if (!(await this.init())) return false;
    try {
      const k = Math.min(CHIME_COUNT, Math.max(1, Number(chime) || 1));
      await LocalNotifications.schedule({ notifications: [{
        id: (_notifId = _notifId >= 1999 ? 1000 : _notifId + 1), title: String(title || ''), body: String(body || ''),
        channelId: chimeChannel(k, vibrate !== false), smallIcon: 'ic_stat_notify', autoCancel: true
      }] });
      return true;
    } catch (e) { return false; }
  },
  async vibrate() {
    try {
      await Haptics.vibrate({ duration: 700 });
      await new Promise(r => setTimeout(r, 950));
      await Haptics.vibrate({ duration: 700 });
    } catch (e) { try { navigator.vibrate && navigator.vibrate([700, 250, 700]); } catch (e2) {} }
  },
  /** Bật/tắt dịch vụ nền. Bật chỉ thành công khi app đang ở phía trước (luật của Android 12+) — gọi lại định kỳ cho tới khi được. */
  async keepAlive(on) {
    try {
      if (on && !_fgOn) {
        if (!(await this.init())) return;
        await ForegroundService.startForegroundService({
          id: 7001, title: 'BEPO', body: 'Đang nhận thông báo khách gọi và món mới',
          smallIcon: 'ic_stat_notify', notificationChannelId: 'nen', silent: true, serviceType: 1   // 1 = dataSync
        });
        _fgOn = true;
      } else if (!on && _fgOn) {
        await ForegroundService.stopForegroundService(); _fgOn = false;
      }
    } catch (e) { /* app đang ở nền không được phép khởi động dịch vụ — thử lại lần kiểm tra sau */ }
  },
} : null;
window.ExcelJS = ExcelJS;
window.NativeBridge = {
  isNative, platform: Capacitor.getPlatform(),
  ready: async () => {},
  sqlite, supabase, network, app, copy, readClipboard, scan, saveFile, brightness, billing, browser, alerts
};
