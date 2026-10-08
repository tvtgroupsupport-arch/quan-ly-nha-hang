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

/* Google Play từ chối .aab có versionCode trùng bản đã tải lên trước đó → mỗi lần build trên GitHub Actions
   lấy số lần chạy workflow làm versionCode (luôn tăng dần). Build trên máy riêng (không có biến này) giữ nguyên. */
const runNo = parseInt(process.env.GITHUB_RUN_NUMBER || '', 10);
const appGradle = path.join(ROOT, 'android/app/build.gradle');
if (runNo > 0 && fs.existsSync(appGradle)) {
  let a = fs.readFileSync(appGradle, 'utf8');
  if (!/versionCode\s+\d+/.test(a)) throw new Error('build.gradle không có versionCode — cấu trúc Capacitor đã đổi, cần xem lại script này.');
  a = a.replace(/versionCode\s+\d+/, `versionCode ${runNo}`).replace(/versionName\s+"[^"]*"/, `versionName "1.0.${runNo}"`);
  fs.writeFileSync(appGradle, a);
  console.log(`✓ versionCode = ${runNo}, versionName = 1.0.${runNo}`);
}

/* Google Play yêu cầu targetSdk >= 36 (Capacitor 7 mặc định 35 → Play Console báo lỗi khi tải .aab).
   Chỉ nâng targetSdk, giữ nguyên compileSdk để không phụ thuộc bản AGP/SDK của Capacitor 7. */
const MIN_TARGET_SDK = 36;
const varsFile = path.join(ROOT, 'android/variables.gradle');
if (fs.existsSync(varsFile)) {
  let v = fs.readFileSync(varsFile, 'utf8');
  const m = v.match(/targetSdkVersion\s*=\s*(\d+)/);
  if (!m) throw new Error('variables.gradle không có targetSdkVersion — cấu trúc Capacitor đã đổi, cần xem lại script này.');
  if (Number(m[1]) < MIN_TARGET_SDK) {
    v = v.replace(/targetSdkVersion\s*=\s*\d+/, `targetSdkVersion = ${MIN_TARGET_SDK}`);
    fs.writeFileSync(varsFile, v);
    console.log(`✓ Đã nâng targetSdkVersion ${m[1]} → ${MIN_TARGET_SDK} (yêu cầu của Google Play)`);
  }

  /* Tính năng tự động bảo vệ của Play yêu cầu minSdk >= 24 (Capacitor 7 mặc định 23 → Play Console từ chối .aab). */
  const MIN_MIN_SDK = 24;
  const mm = v.match(/minSdkVersion\s*=\s*(\d+)/);
  if (!mm) throw new Error('variables.gradle không có minSdkVersion — cấu trúc Capacitor đã đổi, cần xem lại script này.');
  if (Number(mm[1]) < MIN_MIN_SDK) {
    v = v.replace(/minSdkVersion\s*=\s*\d+/, `minSdkVersion = ${MIN_MIN_SDK}`);
    fs.writeFileSync(varsFile, v);
    console.log(`✓ Đã nâng minSdkVersion ${mm[1]} → ${MIN_MIN_SDK} (yêu cầu của Google Play)`);
  }
}

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
    // Vá khối release TRONG buildTypes TRƯỚC, rồi mới chèn signingConfigs — nếu làm ngược, regex sẽ khớp nhầm "release {" của signingConfigs.
    const buildTypesRelease = /(buildTypes\s*\{[\s\S]*?)release\s*\{/;
    if (!buildTypesRelease.test(g)) throw new Error('build.gradle không có khối "release {" trong buildTypes — không vá được chữ ký.');
    g = g.replace(buildTypesRelease, '$1release {\n            signingConfig signingConfigs.release');
    g = g.replace('android {', 'android {\n' + signingBlock);
    fs.writeFileSync(gradleFile, g);
    console.log('✓ Đã thêm cấu hình ký bản release vào build.gradle');
  }
} else {
  console.log('(Chưa có khoá ký release.keystore — bỏ qua bước ký, build ra bản debug như bình thường.)');
}
