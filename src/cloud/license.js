/* ============================================================
   GÓI CƯỚC
   Nguồn sự thật: bảng subscriptions trên Supabase TRUNG TÂM (chỉ bạn sửa được).
     • Máy chủ quán hỏi trung tâm (get_my_subscription), nhớ kết quả cục bộ,
       và ghi vào dữ liệu đồng bộ (collection `license`) để máy nhân viên biết.
     • Hết hạn → KHOÁ MỀM: vẫn đăng nhập, xem và xuất báo cáo được, chủ quán vào
       được màn Gia hạn; chỉ chặn thao tác ghi (gọi món, thanh toán...).
     • Chống chỉnh lùi đồng hồ: lưu mốc thời gian lớn nhất từng thấy (kể cả giờ
       máy chủ) và luôn dùng mốc đó nếu đồng hồ máy bị lùi.
   Giới hạn thật: mã nguồn nằm trên máy khách nên người rành kỹ thuật vẫn có
   thể gỡ đoạn kiểm tra — đây là rào cản cơ bản, không phải chống crack tuyệt đối.
   ============================================================ */
const License = (() => {
  const DAY = 86400000;
  let own = null;          // máy chủ quán: kết quả lần hỏi trung tâm gần nhất
  let clockHw = 0;
  let lastPersist = 0;

  function load() {
    own = Persist.getMeta('license', null);
    clockHw = Persist.getMeta('clock_hw', 0) || 0;
  }
  /** "Bây giờ" đáng tin: không bao giờ nhỏ hơn mốc lớn nhất từng thấy */
  function now() {
    const t = Date.now();
    if (t > clockHw) {
      clockHw = t;
      if (t - lastPersist > 60000) { lastPersist = t; Persist.setMeta('clock_hw', clockHw); }
    }
    return clockHw;
  }
  function current() {
    if (typeof Cloud !== 'undefined' && Cloud.role === 'staff') return (typeof D !== 'undefined' && D && D.license) || null;
    return own;
  }
  function status() {
    const lic = current();
    if (!lic || !lic.expires_at) return { state: 'unknown', locked: false };
    const left = lic.expires_at - now();
    const state = left <= 0 ? 'expired' : left < 7 * DAY ? 'expiring' : 'ok';
    return { state, locked: state === 'expired', daysLeft: Math.max(0, Math.ceil(left / DAY)),
             plan: lic.plan_months, kind: lic.status, expiresAt: lic.expires_at, checkedAt: lic.checked_at };
  }
  const locked = () => status().locked;

  /** Máy chủ quán: hỏi trung tâm. Không có mạng thì giữ nguyên kết quả cũ. */
  async function refresh(force) {
    // force: dùng lúc thiết lập (chưa có vai trò máy) — vẫn hỏi trung tâm bằng phiên đăng nhập chủ quán vừa tạo
    if (!force && (typeof Cloud === 'undefined' || Cloud.role !== 'owner')) return status();
    try {
      const { data, error } = await Cloud.central().rpc('get_my_subscription');
      if (error) throw error;
      if (data) {
        const serverNow = Date.parse(data.server_now);
        if (serverNow > clockHw) clockHw = serverNow;
        own = { plan_months: data.plan_months, status: data.status, expires_at: Date.parse(data.expires_at),
                started_at: Date.parse(data.started_at), checked_at: Date.now() };
        Persist.setMeta('license', own); Persist.setMeta('clock_hw', clockHw);
        // Chia sẻ cho máy nhân viên qua dữ liệu đồng bộ
        const pub = { plan_months: own.plan_months, status: own.status, expires_at: own.expires_at, checked_at: own.checked_at };
        if (typeof D !== 'undefined' && D && JSON.stringify(D.license) !== JSON.stringify(pub)) { D.license = pub; saveD(); }
      }
    } catch (e) { /* offline: dùng bản đã nhớ */ }
    return status();
  }
  function describe() {
    const s = status();
    if (s.state === 'unknown') return 'Chưa có thông tin gói cước';
    const kind = s.kind === 'trial' ? 'Dùng thử' : s.plan ? `Gói ${s.plan} tháng` : 'Gói cước';
    if (s.state === 'expired') return `${kind} — đã hết hạn`;
    return `${kind} — còn ${s.daysLeft} ngày (hết hạn ${new Date(s.expiresAt).toLocaleDateString('vi-VN')})`;
  }
  /** Dùng ngay không cần tài khoản: gói dùng thử 14 ngày TÍNH TRÊN MÁY. Mốc bắt đầu nhớ riêng ngoài bộ nhớ dữ liệu app nên xoá dữ liệu/làm lại quán
      không "làm mới" được 14 ngày (chỉ xoá hẳn dữ liệu ứng dụng hoặc cài lại mới mất mốc — đây là rào cản cơ bản, không chống crack). */
  function startLocalTrial(days) {
    const t = Date.now(); let start = t;
    try { const s = Number(localStorage.getItem('bepo_trial_start')); if (s > 0 && s <= t) start = s; else localStorage.setItem('bepo_trial_start', String(t)); } catch (e) {}
    own = { plan_months: 0, status: 'trial', expires_at: start + (days || 14) * DAY, started_at: start, checked_at: t, local: true };
    Persist.setMeta('license', own);
    const pub = { plan_months: 0, status: 'trial', expires_at: own.expires_at, checked_at: t };
    if (typeof D !== 'undefined' && D) { D.license = pub; saveD(); }
    return status();
  }
  return { load, now, status, locked, refresh, describe, current, startLocalTrial };
})();
