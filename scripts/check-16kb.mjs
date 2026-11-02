/* Kiểm tra .aab / .apk có hỗ trợ trang bộ nhớ 16 KB không (Google Play bắt buộc với bản 64-bit: "Ứng dụng của bạn không hỗ trợ kích thước trang bộ nhớ 16 KB").
   Duyệt mọi file .so trong gói, đọc ELF và lấy căn chỉnh nhỏ nhất của các đoạn LOAD (p_align) — phải ≥ 16384 với arm64-v8a và x86_64.
   Dùng: node scripts/check-16kb.mjs <đường dẫn .aab|.apk>     (thoát mã 1 nếu có tệp chưa đạt; chạy trong android-play.yml sau khi build)
   Cách sửa khi báo lỗi: nâng thư viện chứa tệp đó lên bản có hỗ trợ 16 KB, hoặc loại tệp nếu không dùng (xem scripts/patch-android.mjs, NATIVE_EXCLUDES). */
import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.error('Dùng: node scripts/check-16kb.mjs <đường dẫn .aab|.apk>'); process.exit(2); }
const buf = fs.readFileSync(file);

function entries(b) {
  let e = b.length - 22;
  while (e > 0 && b.readUInt32LE(e) !== 0x06054b50) e--;
  const n = b.readUInt16LE(e + 10);
  let p = b.readUInt32LE(e + 16);
  const out = [];
  for (let i = 0; i < n; i++) {
    const method = b.readUInt16LE(p + 10), csz = b.readUInt32LE(p + 20);
    const nl = b.readUInt16LE(p + 28), el = b.readUInt16LE(p + 30), cl = b.readUInt16LE(p + 32), lo = b.readUInt32LE(p + 42);
    out.push({ name: b.toString('utf8', p + 46, p + 46 + nl), method, csz, lo });
    p += 46 + nl + el + cl;
  }
  return out;
}
function dataOf(b, en) {
  const nl = b.readUInt16LE(en.lo + 26), el = b.readUInt16LE(en.lo + 28), s = en.lo + 30 + nl + el;
  const raw = b.subarray(s, s + en.csz);
  return en.method === 0 ? raw : zlib.inflateRawSync(raw);
}
function alignOf(d) {
  if (d.length < 64 || d.readUInt32BE(0) !== 0x7f454c46) return null;
  const is64 = d[4] === 2;
  const phoff = Number(is64 ? d.readBigUInt64LE(32) : d.readUInt32LE(28));
  const phs = d.readUInt16LE(is64 ? 54 : 42), n = d.readUInt16LE(is64 ? 56 : 44);
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const o = phoff + i * phs;
    if (d.readUInt32LE(o) !== 1) continue;      // PT_LOAD
    min = Math.min(min, Number(is64 ? d.readBigUInt64LE(o + 48) : d.readUInt32LE(o + 28)));
  }
  return min;
}

const bad = [], ok = [];
for (const en of entries(buf)) {
  if (!/\.so$/.test(en.name)) continue;
  const al = alignOf(dataOf(buf, en));
  if (al === null) continue;
  const is64Abi = /arm64-v8a|x86_64/.test(en.name);
  (is64Abi && al < 16384 ? bad : ok).push([en.name, al]);
}
console.log(`Đã quét ${bad.length + ok.length} tệp .so trong ${file}`);
ok.filter(([n]) => /arm64-v8a/.test(n)).forEach(([n, a]) => console.log(`  ✔ ${n}  (căn ${a})`));
if (bad.length) {
  console.log(`\n✗ ${bad.length} tệp 64-bit CHƯA hỗ trợ trang 16 KB (Google Play sẽ từ chối):`);
  bad.forEach(([n, a]) => console.log(`  ✗ ${n}  (căn ${a}, cần ≥ 16384)`));
  process.exit(1);
}
console.log('\n✔ Mọi tệp .so 64-bit đều căn chỉnh 16 KB.');
