/* ============================================================
   MẬT KHẨU ĐĂNG NHẬP APP (nhân viên / chủ quán)
   Băm bằng PBKDF2-SHA256 + muối ngẫu nhiên (WebCrypto). Mật khẩu này
   KHÁC mật khẩu tài khoản Supabase của chủ quán: bản băm được đồng bộ
   xuống mọi máy để đăng nhập được cả khi mất mạng, nên tuyệt đối
   không dùng chung với mật khẩu Supabase.
   ============================================================ */
const AuthLocal = (() => {
  const ITER = 120000;
  const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';      // bỏ ký tự dễ nhầm i l o 0 1
  const toB64 = buf => btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
  const fromB64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

  async function derive(password, salt, iterations) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(password)), 'PBKDF2', false, ['deriveBits']);
    return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  }
  async function hash(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return { s: toB64(salt), h: toB64(await derive(password, salt, ITER)), i: ITER };
  }
  async function verify(password, pw) {
    if (!pw || !pw.s || !pw.h) return false;
    const a = new Uint8Array(await derive(password, fromB64(pw.s), pw.i || ITER)), b = fromB64(pw.h);
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];     // so sánh thời gian không đổi
    return diff === 0;
  }
  /** Mật khẩu tạm 8 ký tự, bốc ngẫu nhiên không lệch */
  function tempPassword() {
    let out = '';
    const limit = 256 - (256 % ALPHABET.length);
    while (out.length < 8) {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      for (const b of bytes) { if (b < limit && out.length < 8) out += ALPHABET[b % ALPHABET.length]; }
    }
    return out;
  }
  return { hash, verify, tempPassword };
})();
