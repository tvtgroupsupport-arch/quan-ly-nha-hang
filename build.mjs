/* Xây dựng thư mục www/ cho Capacitor:  node build.mjs  (hoặc: npm run build) */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readConfig, assembleHtml } from './scripts/assemble.mjs';

const cfg = readConfig();
if (!cfg.centralUrl || !cfg.centralAnonKey) {
  console.error('\n✗ Thiếu địa chỉ Supabase trung tâm.\n  Tạo tệp app.config.json (xem app.config.example.json) hoặc đặt biến môi trường\n  CENTRAL_SUPABASE_URL và CENTRAL_SUPABASE_ANON_KEY.\n');
  process.exit(1);
}
if (!cfg.guestPageUrl) {
  console.warn('\n⚠ Thiếu GUEST_PAGE_URL — mục "Mã QR gọi món" trong app sẽ không in được tem.\n  Xem hướng dẫn đăng trang khách lên GitHub Pages trong HUONG-DAN-GITHUB-ACTIONS.md.\n  (App vẫn build được bình thường, phần còn lại không ảnh hưởng.)\n');
}

const { build } = await import('esbuild');
await build({
  entryPoints: [path.join(ROOT, 'src/native/bridge.js')],
  bundle: true, format: 'iife', platform: 'browser', target: ['es2019'], minify: true,
  outfile: path.join(ROOT, 'dist/bridge.js'), logLevel: 'info'
});

const html = assembleHtml({ cfg, bridgeJs: fs.readFileSync(path.join(ROOT, 'dist/bridge.js'), 'utf8') });
fs.mkdirSync(path.join(ROOT, 'www'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'www/index.html'), html);
console.log(`✓ www/index.html (${Math.round(html.length / 1024)} KB)`);

// Ảnh minh hoạ trong màn "Hướng dẫn liên kết Supabase" — nằm trong APK/AAB nên xem được cả khi mất mạng.
{
  const guideSrc = path.join(ROOT, 'src/assets/guide'), guideDst = path.join(ROOT, 'www/guide');
  fs.rmSync(guideDst, { recursive: true, force: true });
  if (fs.existsSync(guideSrc)) { fs.cpSync(guideSrc, guideDst, { recursive: true }); console.log(`✓ www/guide (${fs.readdirSync(guideDst).length} ảnh)`); }
}

// Bản "Google Play" bắt buộc package name RIÊNG (không được trùng bản chuyển khoản — hai bản
// coi như hai app khác nhau với Google, không thể cùng appId). Luôn tự đặt đúng appId theo
// billingMode mỗi lần build (không chỉ ghi đè một chiều), để chạy đi chạy lại ở cùng một
// checkout (vd. build cả hai bản liên tiếp trên máy) không bị dính nhầm appId của lần trước.
{
  const capCfgPath = path.join(ROOT, 'capacitor.config.json');
  const base = JSON.parse(fs.readFileSync(capCfgPath, 'utf8'));
  const baseAppName = base.appName.replace(/ \(Google Play\)$/, '');
  if (cfg.billingMode === 'play') { base.appId = cfg.playAppId; base.appName = baseAppName + ' (Google Play)'; }
  else { base.appId = 'vn.quanly.nhahang'; base.appName = baseAppName; }
  fs.writeFileSync(capCfgPath, JSON.stringify(base, null, 2) + '\n');
  console.log(`✓ capacitor.config.json → appId = ${base.appId}`);
}
