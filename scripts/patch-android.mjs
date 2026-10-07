/* Sau `npx cap add android` / `cap sync`: bổ sung quyền và cấu hình Manifest mà Capacitor không tự thêm.
   Chạy lại nhiều lần không sao (idempotent). */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './assemble.mjs';

const file = path.join(ROOT, 'android/app/src/main/AndroidManifest.xml');
if (!fs.existsSync(file)) { console.log('Chưa có thư mục android/ — chạy "npx cap add android" trước.'); process.exit(0); }
let x = fs.readFileSync(file, 'utf8');

const perms = [
  'android.permission.INTERNET',
  'android.permission.ACCESS_NETWORK_STATE',
  'android.permission.CAMERA'            // quét mã QR liên kết máy nhân viên
];
for (const p of perms) {
  if (!x.includes(`android:name="${p}"`)) x = x.replace('</manifest>', `    <uses-permission android:name="${p}" />\n</manifest>`);
}
// Camera không bắt buộc (máy bàn/tablet không camera vẫn cài được)
if (!x.includes('android.hardware.camera')) {
  x = x.replace('</manifest>', '    <uses-feature android:name="android.hardware.camera" android:required="false" />\n</manifest>');
}
// Không sao lưu dữ liệu app lên Google (chứa phiên đăng nhập Supabase)
if (!/android:allowBackup=/.test(x)) x = x.replace('<application', '<application android:allowBackup="false"');
else x = x.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
// Bàn phím ảo không che ô nhập
if (!/android:windowSoftInputMode=/.test(x)) x = x.replace('<activity', '<activity android:windowSoftInputMode="adjustResize"');

fs.writeFileSync(file, x);
console.log('✓ Đã cập nhật AndroidManifest.xml');

/* ---------- Ký bản release (chỉ khi đã có android/app/release.keystore — xem android-play.yml) ----------
   Mật khẩu KHÔNG được ghi cứng vào file này — đọc từ biến môi trường lúc Gradle chạy, giữ ở
   GitHub Secrets, không bao giờ nằm trong mã nguồn. */
const gradleFile = path.join(ROOT, 'android/app/build.gradle');
const keystoreFile = path.join(ROOT, 'android/app/release.keystore');
if (fs.existsSync(gradleFile) && fs.existsSync(keystoreFile)) {
  let g = fs.readFileSync(gradleFile, 'utf8');
  if (!g.includes('signingConfigs')) {
    const signingBlock = `    signingConfigs {
        release {
            storeFile file('release.keystore')
            storePassword System.getenv('ANDROID_KEYSTORE_PASSWORD')
            keyAlias System.getenv('ANDROID_KEY_ALIAS')
            keyPassword System.getenv('ANDROID_KEY_PASSWORD')
        }
    }
`;
    if (!g.includes('android {')) throw new Error('build.gradle không có khối "android {" như mong đợi — cấu trúc Capacitor đã đổi, cần xem lại script này.');
    g = g.replace('android {', 'android {\n' + signingBlock);
    if (!/release\s*\{/.test(g)) throw new Error('build.gradle không có khối "release {" trong buildTypes — không vá được chữ ký.');
    g = g.replace(/release\s*\{/, 'release {\n            signingConfig signingConfigs.release');
    fs.writeFileSync(gradleFile, g);
    console.log('✓ Đã thêm cấu hình ký bản release vào build.gradle');
  }
} else {
  console.log('(Chưa có khoá ký release.keystore — bỏ qua bước ký, build ra bản debug như bình thường.)');
}
