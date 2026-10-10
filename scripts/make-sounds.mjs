/* Sinh các tệp âm báo cho THÔNG BÁO HỆ THỐNG của Android: android/app/src/main/res/raw/chime_1.wav … chime_5.wav.
   Dùng đúng bộ tổng hợp trong src/web/chime-synth.js (cùng âm với tiếng trong app). Mỗi tệp lặp lượt âm báo tới ~3 giây
   để nghe rõ ngay cả khi ồn. Chạy lại nhiều lần không sao (ghi đè). Được gọi từ scripts/patch-android.mjs. */
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './assemble.mjs';

const SR = 22050, MIN_SECONDS = 3;

export function loadSynth() {
  const src = fs.readFileSync(path.join(ROOT, 'src/web/chime-synth.js'), 'utf8');
  return new Function(`${src}\nreturn { CHIME_IDS, CHIMES, chimePhraseSeconds, synthChime };`)();
}

/** PCM 16-bit mono → tệp WAV */
export function wavBytes(samples, sr) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24); buf.writeUInt32LE(sr * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  return buf;
}

export function makeSounds(outDir) {
  const { CHIME_IDS, synthChime, chimePhraseSeconds } = loadSynth();
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const k of CHIME_IDS) {
    const phrase = synthChime(k, SR);
    const rounds = Math.max(2, Math.ceil(MIN_SECONDS / chimePhraseSeconds(k)));
    const all = new Float32Array(phrase.length * rounds);
    for (let r = 0; r < rounds; r++) all.set(phrase, r * phrase.length);
    const file = path.join(outDir, `chime_${k}.wav`);
    fs.writeFileSync(file, wavBytes(all, SR));
    written.push(file);
  }
  return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const out = path.join(ROOT, 'android/app/src/main/res/raw');
  console.log(`✓ Đã sinh ${makeSounds(out).length} tệp âm báo vào ${out}`);
}
