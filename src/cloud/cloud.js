/* ============================================================
   LIÊN KẾT SUPABASE
   Hai dự án Supabase hoàn toàn tách biệt:
     • TRUNG TÂM (của nhà cung cấp, địa chỉ nướng sẵn lúc build): tài khoản chủ quán + gói cước
     • CỦA QUÁN (chủ quán tự tạo): toàn bộ dữ liệu bán hàng
   Hai vai trò máy:
     • owner — máy gốc của chủ quán, đăng nhập email/mật khẩu, toàn quyền
     • staff — máy nhân viên, đăng nhập ẩn danh, vào bằng mã QR dùng một lần
   ============================================================ */

const INVITE_PREFIX = 'QLNH1';

const Cloud = (() => {
  const C = { role: null, store: null, central: null, cfg: {}, ownerPw: null };

  function mkClient(url, key, storageKey) {
    if (typeof NativeBridge === 'undefined' || !NativeBridge.supabase) throw new Error('Thiếu thư viện Supabase');
    return NativeBridge.supabase.createClient(url, key, {
      auth: { storageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
  }

  /** Đổi lỗi kỹ thuật của Supabase sang câu tiếng Việt dễ hiểu */
  function friendly(e) {
    const m = (e && (e.message || e.msg)) || String(e);
    if (/Invalid login credentials/i.test(m)) return 'Sai email hoặc mật khẩu';
    if (/Email not confirmed/i.test(m)) return 'Email chưa được xác nhận — mở thư xác nhận rồi đăng nhập lại';
    if (/already registered|already been registered/i.test(m)) return 'Email này đã có tài khoản — hãy chọn Đăng nhập';
    if (/Password should be at least/i.test(m)) return 'Mật khẩu quá ngắn (tối thiểu 6 ký tự)';
    if (/Anonymous sign-ins are disabled/i.test(m)) return 'Dự án Supabase của quán chưa bật "Allow anonymous sign-ins"';
    if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Không kết nối được mạng';
    if (e && (e.code === 'PGRST202' || /Could not find the function/i.test(m))) return 'Dự án Supabase chưa chạy script SQL dựng bảng';
    if (/rate limit/i.test(m)) return 'Thử quá nhiều lần, vui lòng đợi ít phút';
    return m;
  }

  /* ---------- khởi động ---------- */
  function init() {
    const cfg = Persist.getMeta('cfg', {}) || {};
    C.cfg = cfg;
    C.role = cfg.role || null;
    C.store = null;
    if (cfg.storeUrl && cfg.storeAnon && C.role) {
      try { C.store = mkClient(cfg.storeUrl, cfg.storeAnon, 'sb-store'); } catch (e) { console.warn(e); }
    }
    Records.codeTag = C.role === 'staff' ? (cfg.deviceTag || '') : '';
    return cfg;
  }
  function saveCfg(patch) {
    C.cfg = { ...C.cfg, ...patch };
    C.role = C.cfg.role || null;
    return Persist.setMeta('cfg', C.cfg);
  }

  function central() {
    if (C.central) return C.central;
    if (typeof APP_CONFIG === 'undefined' || !APP_CONFIG.centralUrl || !APP_CONFIG.centralAnonKey) {
      throw new Error('Bản ứng dụng này chưa được cấu hình máy chủ gói cước (app.config.json)');
    }
    C.central = mkClient(APP_CONFIG.centralUrl, APP_CONFIG.centralAnonKey, 'sb-central');
    return C.central;
  }

  /* ---------- tài khoản chủ quán (Supabase trung tâm) ---------- */
  async function ownerSignUp(email, password, shopName) {
    const { data, error } = await central().auth.signUp({ email, password, options: { data: { shop_name: shopName || '' } } });
    if (error) throw new Error(friendly(error));
    if (!data.session) return { needConfirm: true };
    C.ownerPw = password;
    return { ok: true };
  }
  async function ownerSignIn(email, password) {
    const { error } = await central().auth.signInWithPassword({ email, password });
    if (error) throw new Error(friendly(error));
    C.ownerPw = password;
    return { ok: true };
  }
  async function centralEmail() {
    const { data } = await central().auth.getUser();
    return data && data.user ? data.user.email : null;
  }
  async function getStoreLink() {
    const { data, error } = await central().rpc('get_store_link');
    if (error) throw new Error(friendly(error));
    return data || null;
  }

  /* ---------- liên kết Supabase của quán (chủ quán) ---------- */
  async function signInStoreOwner(client, email, password) {
    let r = await client.auth.signInWithPassword({ email, password });
    if (r.error && /Invalid login credentials/i.test(r.error.message)) {
      r = await client.auth.signUp({ email, password });
      if (r.error) throw new Error(friendly(r.error));
      if (!r.data.session) {
        throw new Error('Dự án Supabase của quán đang bật "Confirm email". Vào Authentication → Providers → Email, tắt "Confirm email" rồi thử lại.');
      }
    } else if (r.error) {
      throw new Error(friendly(r.error));
    }
  }

  /** Chủ quán nối app với dự án Supabase riêng của quán. `fresh`=true: đẩy dữ liệu đang có lên. */
  async function linkStoreAsOwner({ url, anonKey, email, password }) {
    url = String(url || '').trim().replace(/\/+$/, '');
    anonKey = String(anonKey || '').trim();
    if (!/^https:\/\/[A-Za-z0-9._-]+(:\d+)?$/.test(url)) throw new Error('Địa chỉ Supabase không hợp lệ (dạng https://xxxx.supabase.co)');
    if (anonKey.length < 20) throw new Error('Khoá API không hợp lệ');
    if (/service_role/i.test(anonKey) || (anonKey.split('.').length === 3 && (() => {
      try { return JSON.parse(atob(anonKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'; } catch (e) { return false; }
    })())) throw new Error('Đây là khoá service_role (khoá quản trị) — TUYỆT ĐỐI không dùng. Hãy chép khoá "anon / publishable".');

    const client = mkClient(url, anonKey, 'sb-store');
    await signInStoreOwner(client, email, password);
    const st = await client.rpc('store_status');
    if (st.error) throw new Error(friendly(st.error));
    const cl = await client.rpc('claim_owner');
    if (cl.error) throw new Error(friendly(cl.error));

    const sv = await central().rpc('save_store_link', { p_url: url, p_anon: anonKey });
    if (sv.error) throw new Error(friendly(sv.error));

    C.store = client;
    await saveCfg({ role: 'owner', storeUrl: url, storeAnon: anonKey });
    Records.codeTag = '';
    // Gửi toàn bộ dữ liệu đang có lên Supabase
    await Persist.flush();
    Records.ensureQty0(D);
    await Persist.writeRows(Records.markAllDirty(), []);
    await License.refresh(true);      // đưa thông tin gói cước vào dữ liệu đồng bộ để máy nhân viên biết hạn
    await Persist.flush();
    Sync.start();
    return { ok: true };
  }

  /** Máy mới của chủ quán: đăng nhập lại cùng tài khoản và kéo toàn bộ dữ liệu về */
  async function restoreOwner({ email, password }) {
    const link = await getStoreLink();
    if (!link) throw new Error('Tài khoản này chưa liên kết Supabase của quán');
    const client = mkClient(link.url, link.anon_key, 'sb-store');
    await signInStoreOwner(client, email, password);
    const st = await client.rpc('store_status');
    if (st.error) throw new Error(friendly(st.error));
    if (!st.data.is_owner) throw new Error('Tài khoản này không phải chủ của dự án Supabase đã liên kết');
    C.store = client;
    await Persist.wipe();
    D = emptyD();
    await saveCfg({ role: 'owner', storeUrl: link.url, storeAnon: link.anon_key });
    Records.codeTag = '';
    // Kéo dữ liệu THẬT về trước — tuyệt đối không để bất cứ gì có cơ hội đẩy D rỗng này lên
    // trước khi kéo xong, kẻo đè mất tên quán/cài đặt/dữ liệu thật đang có trên Supabase.
    await Sync.pullOnly();
    Sync.start();
    return { ok: true };
  }

  /* ---------- mã mời cho máy nhân viên ---------- */
  async function createInvite() {
    if (C.role !== 'owner' || !C.store) throw new Error('Chỉ máy chủ quán đã liên kết Supabase mới tạo được mã mời');
    const { data, error } = await C.store.rpc('create_pairing_ticket');
    if (error) throw new Error(friendly(error));
    // Định dạng gọn để mã QR thưa, dễ quét trên màn hình điện thoại: QLNH1|địa chỉ|khoá|mã mời
    const payload = [INVITE_PREFIX, C.cfg.storeUrl, C.cfg.storeAnon, data.token].join('|');
    return { payload, expiresAt: Date.parse(data.expires_at) };
  }
  function parseInvite(text) {
    const s = String(text || '').trim();
    if (!s.startsWith(INVITE_PREFIX + '|')) throw new Error('Đây không phải mã mời của ứng dụng');
    const [, u, k, t, extra] = s.split('|');
    if (extra !== undefined || !u || !k || !t) throw new Error('Mã mời bị lỗi, hãy quét lại');
    if (!/^https:\/\/[A-Za-z0-9._-]+(:\d+)?$/.test(u) || !/^[0-9a-f]{32}$/.test(t)) throw new Error('Mã mời không hợp lệ');
    return { v: 1, u, k, t };
  }
  /** Máy nhân viên: đổi mã mời lấy tư cách thiết bị */
  async function joinAsStaff(payload, deviceName) {
    const inv = parseInvite(payload);
    const client = mkClient(inv.u, inv.k, 'sb-store');
    let r = await client.auth.getSession();
    if (!r.data.session) {
      const a = await client.auth.signInAnonymously();
      if (a.error) throw new Error(friendly(a.error));
    }
    const rd = await client.rpc('redeem_pairing_ticket', { p_token: inv.t, p_device_name: deviceName || 'Máy nhân viên' });
    if (rd.error) throw new Error(friendly(rd.error));
    const uid = rd.data.device_id || '';
    C.store = client;
    await Persist.wipe();
    D = emptyD();
    await saveCfg({ role: 'staff', storeUrl: inv.u, storeAnon: inv.k, deviceId: uid,
                    deviceName: deviceName || 'Máy nhân viên', deviceTag: uid.replace(/-/g, '').slice(-2).toUpperCase() });
    Records.codeTag = C.cfg.deviceTag;
    // Kéo dữ liệu THẬT về trước, cùng lý do như restoreOwner() — xem chú thích ở đó.
    await Sync.pullOnly();
    Sync.start();
    return { ok: true };
  }

  async function listDevices() {
    const { data, error } = await C.store.from('staff_devices').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(friendly(error));
    return data || [];
  }
  async function revokeDevice(id) {
    const { error } = await C.store.rpc('revoke_device', { p_id: id });
    if (error) throw new Error(friendly(error));
  }
  /** Xoá hẳn khỏi danh sách — chỉ xoá được thiết bị đã thu hồi trước đó */
  async function deleteDevice(id) {
    const { error } = await C.store.rpc('delete_device', { p_id: id });
    if (error) throw new Error(friendly(error));
  }

  /* ---------- thoát / thu hồi ---------- */
  async function unlinkAll() {
    Sync.stop();
    try { if (C.store) await C.store.auth.signOut(); } catch (e) {}
    try { if (C.central) await C.central.auth.signOut(); } catch (e) {}
    await Persist.wipe();
    D = emptyD();
    C.role = null; C.store = null; C.central = null; C.cfg = {}; C.ownerPw = null;
    Records.codeTag = '';
  }
  /** Máy nhân viên bị chủ quán thu hồi: xoá bản sao dữ liệu trên máy */
  async function onRevoked() {
    await unlinkAll();
    TOKEN = null; ME = null;
    route = { name: 'setup', params: { notice: 'Máy này đã bị chủ quán thu hồi quyền truy cập. Dữ liệu trên máy đã được xoá.' } };
    render();
  }

  return {
    get role() { return C.role; }, get store() { return C.store; }, get cfg() { return C.cfg; },
    get ownerPw() { return C.ownerPw; }, set ownerPw(v) { C.ownerPw = v; },
    get linked() { return !!(C.store && C.role); },
    init, saveCfg, central, friendly,
    ownerSignUp, ownerSignIn, centralEmail, getStoreLink,
    linkStoreAsOwner, restoreOwner, createInvite, parseInvite, joinAsStaff,
    listDevices, revokeDevice, deleteDevice, unlinkAll, onRevoked
  };
})();
