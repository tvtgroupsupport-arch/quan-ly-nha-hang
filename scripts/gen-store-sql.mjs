/* Sinh supabase/functions/_shared/store-sql.ts từ supabase/store-setup.sql.
   Edge Function provision-step cần nội dung script dựng Supabase của quán, nhưng Edge Function không đọc được
   tệp ngoài thư mục của nó nên phải nhúng sẵn thành chuỗi TypeScript.
   Chạy lại mỗi khi sửa store-setup.sql:  node scripts/gen-store-sql.mjs  (rồi deploy lại provision-step). */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './assemble.mjs';

const sql = fs.readFileSync(path.join(ROOT, 'supabase/store-setup.sql'), 'utf8');
const out = '// TỰ SINH từ supabase/store-setup.sql bằng scripts/gen-store-sql.mjs — KHÔNG sửa tay (test sẽ kiểm tra hai bên khớp nhau).\n'
  + `export const STORE_SQL: string = ${JSON.stringify(sql)};\n`;
fs.writeFileSync(path.join(ROOT, 'supabase/functions/_shared/store-sql.ts'), out);
console.log(`✓ store-sql.ts (${sql.length} ký tự SQL)`);
