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
import { CapacitorSQLite, SQLiteConnection } from '@capacitor-community/sqlite';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { ScreenBrightness } from '@capacitor-community/screen-brightness';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
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
  async purchase(productId, appAccountToken) {
    const tx = await NativePurchases.purchaseProduct({ productIdentifier: productId, productType: PURCHASE_TYPE.SUBS, appAccountToken });
    return tx;   // chứa purchaseToken (Android) — gửi thẳng lên verify-purchase, không tự xử lý gì thêm ở đây
  },
  async restore() { return NativePurchases.restorePurchases(); },
  async manage() { try { await NativePurchases.manageSubscriptions(); } catch (e) {} },
};

window.ExcelJS = ExcelJS;
window.NativeBridge = {
  isNative, platform: Capacitor.getPlatform(),
  ready: async () => {},
  sqlite, supabase, network, app, copy, readClipboard, scan, saveFile, brightness, billing
};
