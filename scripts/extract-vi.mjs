/* Trích MỌI đoạn chữ tiếng Việt hiển thị cho người dùng trong mã nguồn (bỏ chú thích) — dùng để kiểm tra bản dịch đã đủ chưa.
   Một "đoạn" = chuỗi liên tục không chứa < > ` ' " $ { } xuống dòng, có ít nhất một chữ cái có dấu tiếng Việt.
   Dùng bởi test (kiểm tra mọi đoạn đều có bản dịch trong src/web/i18n-en.js) và để lập danh sách khi cần dịch thêm.
   Chạy tay: node scripts/extract-vi.mjs  → in danh sách đoạn chưa có bản dịch tiếng Anh. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SOURCE_FILES } from './assemble.mjs';

const VI = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
export const EXTRA_FILES = ['src/native/bridge.js'];   // tệp ngoài danh sách gộp, nếu cần
const ENT = { '&amp;': '&', '&nbsp;': ' ', '&middot;': '·', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&times;': '×', '&rarr;': '→', '&larr;': '←' };

export function stripComments(src) {
  return src
    .replace(/(^|\s)\/\*[\s\S]*?\*\//g, '$1')   // chỉ chú thích mở sau khoảng trắng: tránh nhầm chuỗi như accept="image/*"
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');
}

export function extractFragments(src) {
  const out = new Set();
  const code = stripComments(src);
  for (const m of code.matchAll(/[^<>`'"${}\n\\]+/g)) {
    let s = m[0];
    if (!VI.test(s)) continue;
    s = s.replace(/&[#a-z0-9]+;/gi, e => ENT[e] ?? e).replace(/\s+/g, ' ').trim().normalize('NFC');
    if (s && VI.test(s)) out.add(s);
  }
  return out;
}

export function allFragments() {
  const all = new Map();
  for (const f of [...SOURCE_FILES, ...EXTRA_FILES]) {
    if (/src\/web\/i18n/.test(f)) continue;   // bảng dịch và màn chọn ngôn ngữ (song ngữ cố định)
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const s of extractFragments(fs.readFileSync(p, 'utf8'))) { if (!all.has(s)) all.set(s, f); }
  }
  return all;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const all = allFragments();
  const outFile = process.argv[2];
  const lines = [...all].map(([s, f]) => `${f}\t${s}`);
  if (outFile) { fs.writeFileSync(outFile, lines.join('\n'), 'utf8'); console.log(`${lines.length} đoạn → ${outFile}`); }
  else console.log(lines.length + ' đoạn tiếng Việt');
}
