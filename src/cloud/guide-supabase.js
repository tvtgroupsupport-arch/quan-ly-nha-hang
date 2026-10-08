/* ============================================================
   HƯỚNG DẪN LIÊN KẾT SUPABASE — màn hình trong app, mở từ màn "Liên kết Supabase của quán".
   Dành cho chủ quán chưa biết gì về Supabase: làm lần lượt 5 bước (đăng xuất → đăng ký → xác nhận email →
   tạo tổ chức → quay lại bấm "Tạo tự động"). Ảnh nằm trong gói app (www/guide/, nguồn src/assets/guide/)
   nên xem được cả khi mất mạng. Khung đỏ nét đứt chỉ đúng chỗ cần bấm.
   Toạ độ khung tính theo ảnh gốc 900x2000 (đổi sang % nên đúng ở mọi cỡ màn hình).
   ============================================================ */
const GUIDE_IMG_DIR = 'guide/';
const GUIDE_IW = 900, GUIDE_IH = 2000;

const GUIDE_FIGS = {
  g0: [
    { img: '09-app-tao-tai-khoan.jpg', cap: 'Màn <i>Tạo tài khoản lưu trữ dữ liệu</i>: <b>Email</b> này chính là email dùng cho Supabase.', marks: [{ x: 36, y: 486, w: 828, h: 104, label: 'Email dùng cho Supabase' }] },
    { img: '10-app-thiet-lap-quan.jpg', cap: 'Màn <i>Thiết lập quán</i>: phần <b>Tài khoản đăng nhập app</b> — KHÁC tài khoản lưu trữ.', marks: [{ x: 36, y: 552, w: 828, h: 68 }, { x: 36, y: 852, w: 828, h: 540 }] },
  ],
  g1: [
    { img: '01-menu-sign-out.jpg', cap: 'Bấm biểu tượng tài khoản → <b>Sign out</b>.', marks: [{ x: 273, y: 1015, w: 597, h: 92, label: 'Bấm đây', below: true }] },
    { img: '02-sign-in-sau-khi-dang-xuat.jpg', cap: 'Đã đăng xuất. Bấm <b>Sign up</b> ở cuối trang.', marks: [{ x: 540, y: 1752, w: 160, h: 58, label: 'Bấm đây' }] },
  ],
  g2: [
    { img: '03-sign-up-trong.jpg', cap: 'Trang <b>Get started</b>. Bỏ qua 3 nút phía trên, dùng ô Email bên dưới chữ “or”.', marks: [{ x: 55, y: 650, w: 790, h: 410, label: 'KHÔNG bấm', bad: true }, { x: 55, y: 1240, w: 790, h: 90, label: 'Gõ email ở đây' }] },
    { img: '04-sign-up-da-dien.jpg', cap: 'Điền email + mật khẩu (đủ 5 điều kiện) rồi bấm <b>Sign up</b>.', marks: [{ x: 55, y: 980, w: 790, h: 100 }, { x: 55, y: 1162, w: 790, h: 100 }, { x: 55, y: 1572, w: 790, h: 116, label: 'Bấm Sign up' }] },
    { img: '05-check-your-email.jpg', cap: 'Thấy <b>Check your email</b> là đã gửi thư xác nhận. Hết hạn sau 10 phút.', marks: [{ x: 55, y: 920, w: 790, h: 250 }] },
  ],
  g3: [
    { img: '06-gmail-hop-thu.jpg', cap: 'Trong Gmail: mở thư từ <b>Supabase</b> (không thấy thì xem mục Thư rác).', marks: [{ x: 15, y: 808, w: 870, h: 228, label: 'Mở thư này' }] },
    { img: '07-gmail-confirm.jpg', cap: 'Bấm nút <b>Confirm Email Address</b>.', marks: [{ x: 88, y: 1300, w: 724, h: 98, label: 'Bấm đây', below: true }] },
  ],
  g4: [
    { img: '08-tao-organization.jpg', cap: 'Form <b>Create a new organization</b>: Name tuỳ ý, Type <b>Personal</b>, Plan <b>Free</b>, rồi <b>Create organization</b>.', marks: [{ x: 30, y: 632, w: 840, h: 112 }, { x: 38, y: 1280, w: 824, h: 92 }, { x: 545, y: 1548, w: 320, h: 76, label: 'Bấm đây', below: true }] },
  ],
  g5: [
    { img: '12-app-lien-ket-ban-dau.jpg', cap: 'Trong app: nhập <b>mật khẩu lưu trữ</b> rồi bấm <b>Tạo tự động bằng Supabase</b>.', marks: [{ x: 62, y: 956, w: 776, h: 104, label: 'Nhập mật khẩu lưu trữ' }, { x: 62, y: 1078, w: 776, h: 104, label: 'Bấm đây', below: true }] },
    { img: '15-supabase-authorize.jpg', cap: 'Trình duyệt mở trang <b>Authorize</b>: kiểm tra đúng tổ chức vừa tạo, rồi bấm <b>Authorize</b>.', marks: [{ x: 77, y: 808, w: 746, h: 90, label: 'Tổ chức của bạn' }, { x: 77, y: 1466, w: 746, h: 72, label: 'Bấm đây', below: true }] },
    { img: '13-app-dang-chay.jpg', cap: 'Quay lại app: thanh tiến trình chạy <b>1–3 phút</b>. Đừng đóng app.', marks: [{ x: 62, y: 808, w: 776, h: 130 }] },
  ],
  gErr1: [
    { img: '11-no-organizations.jpg', cap: 'Trang Authorize khi chưa có tổ chức → bấm <b>Create an organization</b>.', marks: [{ x: 196, y: 1348, w: 354, h: 66, label: 'Bấm đây' }] },
  ],
  gErr2: [
    { img: '14-app-loi-sai-email.jpg', cap: 'App báo email Supabase không khớp → làm lại Bước 1 rồi bấm <b>Tiếp tục / thử lại</b>.', marks: [{ x: 62, y: 1090, w: 776, h: 210 }, { x: 62, y: 1314, w: 776, h: 102, label: 'Bấm sau khi đăng nhập đúng email', below: true }] },
  ],
};

/** Dải ảnh vuốt ngang, mỗi ảnh có khung đỏ chỉ chỗ cần bấm + chú thích. */
function guideGallery(id) {
  const pct = (v, total) => (v / total * 100).toFixed(2);
  return `<div class="gd-gallery">${(GUIDE_FIGS[id] || []).map(f => `<figure class="gd-fig"><div class="gd-pic">
      <img src="${GUIDE_IMG_DIR}${f.img}" alt="${f.cap.replace(/<[^>]+>/g, '')}" loading="lazy">${(f.marks || []).map(m =>
        `<span class="gd-mark${m.bad ? ' bad' : ''}${m.below ? ' below' : ''}" style="left:${pct(m.x, GUIDE_IW)}%;top:${pct(m.y, GUIDE_IH)}%;width:${pct(m.w, GUIDE_IW)}%;height:${pct(m.h, GUIDE_IH)}%">${m.label ? `<i>${m.label}</i>` : ''}</span>`).join('')}
    </div><figcaption>${f.cap}</figcaption></figure>`).join('')}</div>`;
}

function guideStep(n, title, body, gallery, note) {
  return `<div class="card gd-step">
    <div class="gd-step-head"><div class="gd-num${n === 0 ? ' zero' : ''}">${n}</div><div><div class="t-md">${title}</div>${note ? `<div class="t-xs">${note}</div>` : ''}</div></div>
    ${body}${gallery ? guideGallery(gallery) : ''}
  </div>`;
}

function vSupabaseGuide() {
  return `<div class="screen">
    ${hdr('Hướng dẫn liên kết Supabase', 'Làm một lần, khoảng 10 phút')}
    <div class="body gd">
      <div class="t-sm" style="line-height:1.6">App sẽ tự tạo kho dữ liệu riêng cho quán của bạn trên Supabase (miễn phí). Bạn chỉ cần chuẩn bị <b>một tài khoản Supabase</b> trước, theo 5 bước dưới đây.</div>

      <div class="gd-box warn"><b>Quan trọng nhất:</b> tài khoản Supabase phải dùng <b>đúng email bạn đã nhập khi tạo tài khoản lưu trữ dữ liệu trong app</b>. App sẽ kiểm tra và từ chối nếu khác email. Khi đăng ký Supabase, <b>không bấm “Continue with GitHub” hay “Continue with ChatGPT”</b> — hãy đăng ký bằng email.</div>

      <div class="card">
        <div class="t-md" style="margin-bottom:6px">Chuẩn bị trước</div>
        <ul class="gd-check">
          <li>Điện thoại đang có mạng (Wi‑Fi hoặc 4G).</li>
          <li>Email của tài khoản lưu trữ (email bạn đã nhập trong app) và <b>mở được hộp thư</b> của email đó.</li>
          <li>Một mật khẩu mới cho Supabase: ít nhất 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt. Ghi lại ở nơi an toàn.</li>
        </ul>
      </div>

      <div class="card">
        <div class="t-md" style="margin-bottom:6px">Có 2 loại tài khoản — đừng nhầm lẫn</div>
        <table class="gd-two">
          <tr><th></th><th>1. Tài khoản lưu trữ dữ liệu</th><th>2. Tài khoản đăng nhập app</th></tr>
          <tr><td>Gồm</td><td><b>Email</b> + <b>mật khẩu lưu trữ</b></td><td><b>Tên đăng nhập app</b> + <b>mật khẩu đăng nhập app</b></td></tr>
          <tr><td>Dùng để</td><td>Lưu dữ liệu quán trên Supabase, gói cước, khôi phục khi đổi máy</td><td>Đăng nhập app bán hàng hằng ngày</td></tr>
          <tr><td>Liên quan Supabase</td><td><b>Có</b> — dùng cùng email để đăng ký Supabase</td><td><b>Không</b></td></tr>
        </table>
        <div class="t-xs" style="margin-top:8px">Nên đặt hai mật khẩu <b>khác nhau</b>. Khi app hỏi “mật khẩu lưu trữ”, hãy nhập mật khẩu của tài khoản số 1.</div>
      </div>

      ${guideStep(0, 'Bạn đã tạo tài khoản lưu trữ dữ liệu trong app',
        `<div class="t-sm" style="line-height:1.6">Màn <b>Tạo tài khoản lưu trữ dữ liệu</b> hỏi email và <b>mật khẩu lưu trữ</b>. <b>Đúng email này</b> sẽ dùng để đăng ký Supabase ở các bước dưới. Màn <b>Thiết lập quán</b> sau đó hỏi <b>tài khoản đăng nhập app</b> — đó là một tài khoản khác. Quên email? Xem ngay trong khung vàng ở màn Liên kết.</div>`,
        'g0', 'Việc này đã làm lúc mới cài app.')}

      ${guideStep(1, 'Đăng xuất Supabase cũ (nếu có)',
        `<div class="t-sm" style="line-height:1.6">Nếu trình duyệt đang đăng nhập Supabase bằng tài khoản khác (ví dụ GitHub), trang web sẽ tự vào tài khoản đó và <b>không cho đăng ký bằng email mới</b>.</div>
        <ol><li>Bấm nút <b>Mở Supabase</b> bên dưới.</li><li>Bấm <b>biểu tượng tài khoản</b> (hình tròn, góc phải trên) → chọn <span class="k">Sign out</span> ở cuối menu.</li><li>Thấy <b>“Successfully logged out”</b> và trang <b>Welcome back</b> là xong. Bấm <span class="k">Sign up</span> ở cuối trang.</li></ol>
        <button class="btn ghost sm" data-act="c_guideOpen" data-url="https://supabase.com/dashboard">Mở Supabase</button>`,
        'g1', 'Bỏ qua bước này nếu điện thoại chưa từng dùng Supabase.')}

      ${guideStep(2, 'Đăng ký tài khoản bằng email',
        `<ol><li>Ở trang <b>Get started</b>, kéo xuống phần <b>sau chữ “or”</b>.</li>
          <li>Ô <b>Email</b>: gõ <b>đúng email của tài khoản lưu trữ</b>.</li>
          <li>Ô <b>Password</b>: đặt mật khẩu mới. Đủ 5 điều kiện: <b>chữ hoa, chữ thường, số, ký tự đặc biệt (ví dụ @ # $ %), từ 8 ký tự</b>.</li>
          <li>Bấm <span class="k">Sign up</span>. Thấy <b>“Check your email”</b> là đã gửi thư xác nhận.</li></ol>
        <div class="gd-box bad"><b>Đừng bấm</b> “Continue with GitHub”, “Continue with ChatGPT” hay “Continue with SSO” — Supabase sẽ dùng email của tài khoản đó chứ không phải email của bạn.</div>
        <button class="btn ghost sm" data-act="c_guideOpen" data-url="https://supabase.com/dashboard/sign-up">Mở trang đăng ký Supabase</button>`,
        'g2')}

      ${guideStep(3, 'Mở email và xác nhận <span class="gd-tag">bắt buộc</span>',
        `<div class="t-sm" style="line-height:1.6">Chưa xác nhận thì <b>chưa dùng được tài khoản</b>.</div>
        <ol><li>Mở ứng dụng email (Gmail…) — đúng email vừa đăng ký.</li>
          <li>Tìm thư từ <b>Supabase</b>, tiêu đề bắt đầu bằng <b>“Confirm your email and launch you…”</b>. Không thấy? Xem mục <b>Thư rác / Spam / Quảng cáo</b>.</li>
          <li>Mở thư, bấm nút xanh <span class="k">Confirm Email Address</span>. Trình duyệt mở Supabase và bạn được đăng nhập luôn.</li></ol>
        <div class="gd-box warn"><b>Liên kết trong thư chỉ có hiệu lực 10 phút.</b> Quá 10 phút, hãy đăng ký lại ở bước 2 để nhận thư mới.</div>`,
        'g3')}

      ${guideStep(4, 'Tạo một “tổ chức” (Organization)',
        `<div class="t-sm" style="line-height:1.6">Supabase bắt buộc phải có một tổ chức thì app mới tạo được kho dữ liệu. Sau khi xác nhận email, nếu chưa có, hãy tạo (hoặc bấm <b>New organization</b>):</div>
        <ol><li><b>Name</b>: gõ tên quán (nên gõ không dấu).</li><li><b>Type</b>: để <b>Personal</b>.</li><li><b>Plan</b>: để <b>Free – $0/month</b>. <b>Đừng chọn gói trả phí.</b></li><li>Bấm <span class="k">Create organization</span>.</li></ol>
        <div class="gd-box warn">Nếu Supabase hỏi tiếp <b>“Create a new project”</b> thì <b>bỏ qua</b>. App sẽ tự tạo dự án cho bạn.</div>`,
        'g4')}

      ${guideStep(5, 'Quay lại app và bấm “Tạo tự động”',
        `<ol><li>Quay lại màn <b>Liên kết Supabase của quán</b> trong app.</li>
          <li>Nhập <b>mật khẩu lưu trữ</b> (mật khẩu bạn đặt khi tạo tài khoản lưu trữ dữ liệu — <b>không phải</b> mật khẩu Supabase, <b>không phải</b> mật khẩu đăng nhập app).</li>
          <li>Bấm <span class="k">Tạo tự động bằng Supabase</span>.</li>
          <li>Trình duyệt mở trang <b>Authorize</b>: chọn tổ chức vừa tạo rồi bấm <span class="k">Authorize</span>.</li>
          <li>Quay lại app, thanh tiến trình chạy <b>1–3 phút</b>. <b>Đừng đóng app.</b> Xong, app tự đồng bộ và chuyển sang màn đăng nhập.</li></ol>`,
        'g5')}

      <div class="sec" style="margin-top:12px">Gặp lỗi?</div>
      <details class="card gd-det"><summary>Trang Supabase báo “No organizations found”</summary>
        <div class="t-sm" style="line-height:1.6;margin-top:8px">Bạn chưa tạo tổ chức. Bấm <b>Create an organization</b> (Type <b>Personal</b>, Plan <b>Free</b>), rồi quay lại app bấm <b>Tạo tự động</b> lần nữa.</div>${guideGallery('gErr1')}</details>
      <details class="card gd-det"><summary>Không nhận được email xác nhận</summary>
        <div class="t-sm" style="line-height:1.6;margin-top:8px">Đợi 2 phút, xem thư rác, kiểm tra gõ đúng email chưa. Vẫn không có: ở trang đăng nhập Supabase bấm <b>Forgot password?</b> hoặc đăng ký lại để nhận thư mới. Nên dùng Gmail.</div></details>
      <details class="card gd-det"><summary>Liên kết trong thư báo hết hạn</summary>
        <div class="t-sm" style="line-height:1.6;margin-top:8px">Liên kết chỉ có hiệu lực 10 phút. Đăng ký lại ở Bước 2 bằng cùng email để nhận thư mới.</div></details>
      <details class="card gd-det"><summary>Trang đăng ký tự vào tài khoản GitHub, không cho nhập email</summary>
        <div class="t-sm" style="line-height:1.6;margin-top:8px">Điện thoại đang đăng nhập Supabase bằng GitHub. Làm <b>Bước 1</b> (Sign out) rồi mở lại trang đăng ký.</div></details>
      <details class="card gd-det"><summary>App báo “Tài khoản Supabase … không dùng email …”</summary>
        <div class="t-sm" style="line-height:1.6;margin-top:8px">Bạn đã Authorize bằng tài khoản Supabase có email khác. Sign out Supabase (Bước 1), đăng nhập lại bằng <b>đúng email tài khoản lưu trữ</b>, rồi bấm <b>Tạo tự động</b> lại.</div>${guideGallery('gErr2')}</details>
      <details class="card gd-det"><summary>App báo “đã đủ số dự án miễn phí”</summary>
        <div class="t-sm" style="line-height:1.6;margin-top:8px">Tài khoản Supabase này đã có 2 dự án miễn phí. Vào supabase.com, tạm dừng hoặc xoá một dự án không dùng (hoặc nâng cấp gói), rồi bấm <b>Tiếp tục</b> trong app.</div></details>
      <details class="card gd-det"><summary>Đang chạy thì app bị tắt hoặc mất mạng</summary>
        <div class="t-sm" style="line-height:1.6;margin-top:8px">Không sao. Mở lại app → màn Liên kết Supabase → nhập mật khẩu lưu trữ → bấm <b>Tạo tự động</b>. App làm tiếp đúng chỗ đang dở, không tạo dự án thứ hai.</div></details>
      <details class="card gd-det"><summary>Thanh tiến trình đứng rất lâu ở “Dự án đang khởi động”</summary>
        <div class="t-sm" style="line-height:1.6;margin-top:8px">Supabase đôi khi mất tới 3–4 phút. Hãy đợi. Quá 10 phút thì bấm <b>Tiếp tục / thử lại</b>.</div></details>

      <div class="gd-box ok"><b>Mật khẩu Supabase</b> chỉ dùng để bạn vào trang quản lý Supabase khi cần; app không lưu nó. Dữ liệu bán hàng của quán nằm trong tài khoản Supabase của chính bạn.</div>
      <button class="btn pri" data-act="back">Quay lại màn Liên kết</button>
    </div>
  </div>`;
}
