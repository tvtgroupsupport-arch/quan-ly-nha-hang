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
const html = build();

const outDir = path.join(ROOT, 'docs');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html);
console.log(`✓ docs/index.html (${Math.round(html.length / 1024)} KB) — sẵn sàng cho GitHub Pages`);
