/* ============================================================
   ÂM BÁO — tổng hợp âm thanh bằng toán học (không cần tệp âm thanh có bản quyền).
   Dùng chung cho hai nơi:
     • app (core.js)  : phát trong ứng dụng bằng Web Audio khi đang mở app
     • scripts/make-sounds.mjs : sinh tệp .wav đưa vào res/raw của Android — đây là âm của THÔNG BÁO HỆ THỐNG
       (nghe được cả khi app chạy nền / đang mở app khác)
   Năm kiểu quen thuộc trên điện thoại: chuông "Ding", "Ting-tong" (chuông cửa), "Tin nhắn", "Báo thức", "Chuông reo".
   Âm được nén mềm (tanh) và chuẩn hoá sát mức tối đa → nghe to và dày hơn nhiều so với sóng sin thuần.
   ============================================================ */
const CHIME_NAMES = { 1: 'Ding', 2: 'Ting-tong', 3: 'Tin nhắn', 4: 'Báo thức', 5: 'Chuông reo' };
const CHIME_IDS = [1, 2, 3, 4, 5];
const CHIME_TIMBRE = { 1: 'bell', 2: 'bell', 3: 'bell', 4: 'beep', 5: 'ring' };
const CHIMES = {
  // mỗi kiểu: danh sách [độ trễ bắt đầu, tần số, độ dài] tính bằng giây
  1: [[0, 880, 0.9]],                                                        // một tiếng "ding" ngân dài
  2: [[0, 988, 0.5], [0.45, 740, 0.9]],                                      // "ting-tong" chuông cửa
  3: [[0, 1319, 0.2], [0.18, 1760, 0.35]],                                   // hai nốt ngắn tăng dần như tin nhắn
  4: [[0, 1000, 0.12], [0.2, 1000, 0.12], [0.4, 1000, 0.12], [0.6, 1000, 0.12]],   // bốn tiếng bíp dồn dập
  5: [[0, 440, 0.45], [0.55, 440, 0.45]]                                     // chuông điện thoại reo hai nhịp
};
const CHIME_GAP = 0.25;   // nghỉ giữa hai lượt lặp (giây)

/** Độ dài một lượt (kể cả khoảng nghỉ cuối) tính bằng giây */
function chimePhraseSeconds(kind) {
  const notes = CHIMES[kind] || CHIMES[1];
  return Math.max(...notes.map(([d, , len]) => d + len)) + CHIME_GAP;
}

/** Vẽ MỘT lượt âm báo thành mảng mẫu Float32 (-1..1) ở tần số lấy mẫu `sr` */
function synthChime(kind, sr) {
  const notes = CHIMES[kind] || CHIMES[1];
  const timbre = CHIME_TIMBRE[kind] || 'bell';
  const total = Math.ceil(chimePhraseSeconds(kind) * sr);
  const out = new Float32Array(total);
  for (const [delay, freq, len] of notes) {
    const start = Math.floor(delay * sr), n = Math.floor(len * sr);
    for (let i = 0; i < n && start + i < total; i++) {
      const t = i / sr, ph = 2 * Math.PI * freq * t;
      let s, env;
      if (timbre === 'bell') {
        // chuông: nhiều hoạ âm, hoạ âm cao tắt nhanh hơn
        s = Math.sin(ph) + 0.5 * Math.sin(2 * ph) * Math.exp(-3 * t) + 0.3 * Math.sin(3 * ph) * Math.exp(-5 * t) + 0.15 * Math.sin(4.2 * ph) * Math.exp(-8 * t);
        env = Math.min(1, t / 0.004) * Math.exp(-3.2 * t / len);
      } else if (timbre === 'beep') {
        // bíp điện tử: sóng vuông gọn (các hoạ âm lẻ), giữ nguyên độ to rồi ngắt
        s = Math.sin(ph) + Math.sin(3 * ph) / 3 + Math.sin(5 * ph) / 5 + Math.sin(7 * ph) / 7;
        env = Math.min(1, t / 0.006) * Math.min(1, (len - t) / 0.01);
      } else {
        // chuông reo: hai tần số lệch nhau, rung biên độ 20 Hz như chuông điện thoại bàn
        s = (Math.sin(ph) + Math.sin(2 * Math.PI * freq * 1.09 * t)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 20 * t));
        env = Math.min(1, t / 0.01) * Math.min(1, (len - t) / 0.03);
      }
      out[start + i] += s * env;
    }
  }
  let peak = 0;
  for (let i = 0; i < total; i++) { const a = Math.abs(out[i]); if (a > peak) peak = a; }
  if (peak > 0) {
    const drive = 2.2, norm = 1 / Math.tanh(drive);
    for (let i = 0; i < total; i++) out[i] = Math.tanh((out[i] / peak) * drive) * norm * 0.98;
  }
  return out;
}
