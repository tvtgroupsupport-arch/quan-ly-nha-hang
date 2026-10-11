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
    // Chủ quán chưa có bản hỏi máy chủ (meta `license` mất, hoặc vừa khôi phục sang máy mới lúc mạng lỗi): dùng bản công khai đã đồng bộ từ kho trước khi tính khoá mềm
    if (!own && typeof D !== 'undefined' && D && D.license && D.license.expires_at) return D.license;
    return own;
  }
  function status() {
    const lic = current();
    if (!lic || !lic.expires_at) {
      // Chủ quán đã có tài khoản BEPO (bản Google Play) mà chưa từng nhận được bản ghi gói (vd. mất mạng ngay sau khi tạo quán): coi là CHƯA đăng ký → khoá mềm,
      // không để dùng miễn phí cho tới lần hỏi máy chủ sau. Máy nhân viên (không có role owner) và người dùng cũ chưa có tài khoản vẫn như trước.
      if (typeof Cloud !== 'undefined' && Cloud.role === 'owner' && Cloud.hasAccount && typeof APP_CONFIG !== 'undefined' && APP_CONFIG.billingMode === 'play') {
        return { state: 'expired', locked: true, daysLeft: 0, plan: 0, kind: 'none', expiresAt: 0, checkedAt: 0 };
      }
      return { state: 'unknown', locked: false };
    }
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
        const srv = { plan_months: data.plan_months, status: data.status, expires_at: Date.parse(data.expires_at),
                      started_at: Date.parse(data.started_at), checked_at: Date.now() };
        // Người dùng cũ còn dùng thử cục bộ (own.local) vừa tạo/đăng nhập tài khoản: GIỮ hạn cục bộ tới khi nó hết (hạn hiệu lực = lớn hơn của hai hạn).
        // Khi gói mua của tài khoản có hạn lớn hơn → dùng bản máy chủ (bỏ cờ local).
        own = (own && own.local && own.expires_at > srv.expires_at) ? { ...own, checked_at: srv.checked_at } : srv;
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
    // Tài khoản mới chưa từng mua gói (plan_months = 0) mà đã hết hạn: không phải "hết hạn" mà là CHƯA đăng ký (dùng thử do Google Play cấp khi mua gói)
    if (s.state === 'expired' && !s.plan && s.kind !== 'trial') return 'Chưa đăng ký gói cước';
    const kind = s.kind === 'trial' ? 'Dùng thử' : s.plan ? `Gói ${s.plan} tháng` : 'Gói cước';
    if (s.state === 'expired') return `${kind} — đã hết hạn`;
    return `${kind} — còn ${s.daysLeft} ngày (hết hạn ${new Date(s.expiresAt).toLocaleDateString('vi-VN')})`;
  }
  // (Đã bỏ dùng thử cục bộ 14 ngày: dùng thử nay do Google Play cấp qua ưu đãi của gói. Người dùng cũ đang có bản `license` trial cục bộ trong
  //  bộ nhớ (own.local) vẫn dùng tới hết hạn — status() đọc bản đó như thường.)
  return { load, now, status, locked, refresh, describe, current };
})();
