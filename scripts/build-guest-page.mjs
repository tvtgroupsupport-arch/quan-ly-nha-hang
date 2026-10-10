/* Dựng trang gọi món TĨNH, DÙNG CHUNG cho mọi quán — ghi ra docs/index.html để GitHub Pages
   phục vụ. Chạy: node scripts/build-guest-page.mjs (workflow .github/workflows/pages.yml tự
   chạy file này mỗi khi có thay đổi, không cần làm tay). */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './assemble.mjs';

// guest-page.js định nghĩa buildGuestPageHtml() ở phạm vi hàm thường (không phải module JS),
// nên nạp bằng cách bọc trong Function thay vì import — tránh phải tách lại thành module riêng.
const src = fs.readFileSync(path.join(ROOT, 'src/cloud/guest-page.js'), 'utf8');
const build = new Function(src + '; return buildGuestPageHtml;')();
let html = build();

// Đa ngôn ngữ cho khách nước ngoài: nhúng bộ dịch dùng chung với app (cùng bảng dịch) vào trang. Mặc định theo ngôn ngữ của
// trình duyệt (tiếng Việt → giữ nguyên, ngôn ngữ khác → tiếng Anh); nút 🌐 góc phải trên để đổi tay.
const i18nParts = ['src/web/i18n-en-1.js', 'src/web/i18n-en-2.js', 'src/web/i18n-en-3.js', 'src/web/i18n-en-4.js', 'src/web/i18n.js']
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
const i18nBoot = `
(function () {
  try {
    initI18n();
    if (!hasLangChoice()) setLang(suggestedLang());
    var b = document.getElementById('langBtn');
    function label() { b.textContent = '🌐 ' + (getLang() === 'vi' ? 'EN' : 'VI'); }
    b.addEventListener('click', function () { setLang(getLang() === 'vi' ? 'en' : 'vi'); label(); document.title = trText('Gọi món'); });
    label(); document.title = trText('Gọi món');
  } catch (e) { /* lỗi dịch không được làm hỏng trang gọi món */ }
})();`;
html = html.replace('/*__I18N__*/', () => (i18nParts + '\n' + i18nBoot).replace(/<\/script/gi, '<\\/script'));

const outDir = path.join(ROOT, 'docs');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`✓ docs/index.html (${Math.round(html.length / 1024)} KB) — sẵn sàng cho GitHub Pages`);

// Trang chính sách bảo mật + hướng dẫn xoá tài khoản: Google Play yêu cầu có địa chỉ web công khai → chép nguyên vào docs/.
for (const f of ['chinh-sach-bao-mat.html', 'xoa-tai-khoan.html']) {
  fs.copyFileSync(path.join(ROOT, 'play-listing', f), path.join(outDir, f));
  console.log(`✓ docs/${f}`);
}
