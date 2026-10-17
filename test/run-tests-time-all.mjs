/* Chạy test/run-tests-time.mjs dưới nhiều múi giờ (đặt TZ cho tiến trình con). Dùng: node --experimental-sqlite --no-warnings test/run-tests-time-all.mjs
   Việt Nam / Hàn Quốc không có giờ mùa hè; Los_Angeles và Sydney có — dùng để lộ lỗi giả định "1 ngày = 24 giờ". */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('./run-tests-time.mjs', import.meta.url));
const zones = ['Asia/Ho_Chi_Minh', 'Asia/Seoul', 'UTC', 'America/Los_Angeles', 'Australia/Sydney'];
let failed = 0;
for (const tz of zones) {
  const r = spawnSync(process.execPath, ['--experimental-sqlite', '--no-warnings', file], { env: { ...process.env, TZ: tz }, encoding: 'utf8' });
  const out = (r.stdout || '') + (r.stderr || '');
  const sum = out.split('\n').find(l => /đạt ·/.test(l)) || '(không có kết quả)';
  console.log(`${r.status === 0 ? '✓' : '✗'} ${sum}`);
  if (r.status !== 0) { failed++; console.log(out.split('\n').filter(l => /✗|Error|^ - /.test(l)).slice(0, 14).map(l => '    ' + l.slice(0, 220)).join('\n')); }
}
process.exit(failed ? 1 : 0);
