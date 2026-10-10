/* Ghép các tệp nguồn thành MỘT script (và một trang HTML). Dùng chung cho build thật và cho bộ kiểm thử,
   để kiểm thử chạy đúng trên chính đoạn mã sẽ đóng gói vào APK. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Thứ tự nạp quan trọng: engine → lưu trữ/đồng bộ → lõi giao diện → màn hình → app */
export const SOURCE_FILES = [
  'src/web/qr.js',
  'src/web/vietqr.js',
  'src/web/local-engine.js',
  'src/cloud/auth-local.js',
  'src/cloud/records.js',
  'src/cloud/persist.js',
  'src/cloud/sync.js',
  'src/cloud/cloud.js',
  'src/cloud/license.js',
  'src/web/chime-synth.js',
  'src/web/i18n-en-1.js',
  'src/web/i18n-en-2.js',
  'src/web/i18n-en-3.js',
  'src/web/i18n-en-4.js',
  'src/web/i18n.js',
  'src/web/core.js',
  'src/web/views.js',
  'src/web/views-extra.js',
  'src/cloud/views-cloud.js',
  'src/cloud/play-billing.js',
  'src/cloud/auto-provision.js',
  'src/cloud/guide-supabase.js',
  'src/web/pdf-qr.js',
  'src/web/reports.js',
  'src/web/app.js'
];

export function readConfig() {
  const file = path.join(ROOT, 'app.config.json');
  let cfg = {};
  if (fs.existsSync(file)) cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  cfg.centralUrl = process.env.CENTRAL_SUPABASE_URL || cfg.centralUrl || '';
  cfg.centralAnonKey = process.env.CENTRAL_SUPABASE_ANON_KEY || cfg.centralAnonKey || '';
  cfg.supportText = process.env.SUPPORT_TEXT || cfg.supportText || '';
  // Trang khách gọi món — MỘT trang tĩnh dùng chung cho mọi quán, bạn tự đăng lên GitHub Pages
  // một lần duy nhất (xem .github/workflows/pages.yml). Không có trang này thì "Mã QR gọi món"
  // trong app không in tem được, nhưng toàn bộ phần còn lại của app vẫn chạy bình thường.
  cfg.guestPageUrl = process.env.GUEST_PAGE_URL || cfg.guestPageUrl || '';
  // 'manual' = chuyển khoản tay (mặc định, app sideload qua GitHub Actions như từ trước tới nay).
  // 'play' = mua qua Google Play Billing — CHỈ dùng khi build riêng bản nộp lên Play Store
  // (xem HUONG-DAN-GOOGLE-PLAY.md); bản này cần package name riêng, không dùng chung với bản chuyển khoản.
  cfg.billingMode = process.env.BILLING_MODE || cfg.billingMode || 'manual';
  // Nhãn phiên bản — để BẠN tự biết chắc đang cài đúng bản mới nhất khi tải APK về, nhất là lúc
  // đang thử đi thử lại nhiều lần sửa lỗi liên tiếp. Tự sinh từ số lần chạy workflow + giờ build +
  // 7 ký tự đầu mã commit (GitHub Actions tự cấp GITHUB_RUN_NUMBER/GITHUB_SHA, không cần tự gõ tay).
  // Build trên máy riêng (không qua Actions) thì chỉ có giờ build, không có số lần chạy/mã commit.
  {
    const run = process.env.GITHUB_RUN_NUMBER ? `#${process.env.GITHUB_RUN_NUMBER} · ` : '';
    const sha = process.env.GITHUB_SHA ? ' · ' + process.env.GITHUB_SHA.slice(0, 7) : '';
    const now = new Date().toISOString().replace('T', ' ').slice(0, 16);
    cfg.buildVersion = `${run}${now}${sha}`;
  }
  // Tên hiển thị của app dưới biểu tượng trên điện thoại (đặt bằng biến APP_NAME trên GitHub hoặc trường appName trong app.config.json; để trống = mặc định).
  cfg.appName = (process.env.APP_NAME || cfg.appName || '').trim();
  cfg.playAppId = process.env.PLAY_APP_ID || cfg.playAppId || 'vn.quanly.nhahang.play';
  return cfg;
}

/** Hằng số được nướng vào app lúc build: địa chỉ Supabase trung tâm + script SQL cho Supabase của quán */
export function buildPrelude(cfg) {
  const sql = fs.readFileSync(path.join(ROOT, 'supabase/store-setup.sql'), 'utf8');
  const pub = { centralUrl: cfg.centralUrl, centralAnonKey: cfg.centralAnonKey, supportText: cfg.supportText, guestPageUrl: cfg.guestPageUrl, billingMode: cfg.billingMode, buildVersion: cfg.buildVersion };
  return `const APP_CONFIG = ${JSON.stringify(pub)};\nconst STORE_SQL = ${JSON.stringify(sql)};\n`;
}

export function assembleScript(cfg) {
  const parts = [buildPrelude(cfg)];
  for (const f of SOURCE_FILES) parts.push(`\n/* ===== ${f} ===== */\n` + fs.readFileSync(path.join(ROOT, f), 'utf8'));
  return parts.join('\n');
}

export function assembleHtml({ cfg, bridgeJs }) {
  const css = fs.readFileSync(path.join(ROOT, 'src/web/styles.css'), 'utf8');
  // Chuỗi "</script>" nằm trong mã sẽ làm trình duyệt tưởng hết thẻ script → thoát ký tự
  const esc = js => js.replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#D9581F">
<title>Quản Lý Nhà Hàng</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap">
<style>
${css}
</style>
</head>
<body>
<div id="app"></div>
<script>
${esc(bridgeJs)}
</script>
<script>
${esc(assembleScript(cfg))}
</script>
</body>
</html>
`;
}
