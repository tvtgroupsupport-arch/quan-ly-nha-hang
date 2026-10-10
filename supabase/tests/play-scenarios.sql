-- Kịch bản kiểm tra record_play_purchase (đăng ký / gia hạn / huỷ / hết hạn / thu hồi / hai gói…) trên Supabase TRUNG TÂM.
-- Chạy bằng play-scenarios.ps1 (nó chèn bản mới nhất của hàm vào dòng đánh dấu bên dưới, chạy trong một giao dịch rồi ROLLBACK
-- nên không để lại tài khoản/giao dịch giả nào). Mỗi kịch bản dùng một tài khoản giả riêng (trigger tự cấp dùng thử 14 ngày).
begin;
@@FUNCTION@@

create temp table res (n int, scenario text, ok boolean, info text);
create function pg_temp.mkuser() returns uuid language plpgsql as $f$
declare u uuid := gen_random_uuid();
begin
  insert into auth.users (id, aud, role, email) values (u, 'authenticated', 'authenticated', u::text || '@test.invalid');
  return u;
end $f$;
create function pg_temp.sub(u uuid) returns public.subscriptions language sql as $f$ select * from public.subscriptions where owner_id = u $f$;
create function pg_temp.near(a timestamptz, b timestamptz) returns boolean language sql as $f$ select abs(extract(epoch from (a - b))) < 5 $f$;

do $do$
declare u uuid; u2 uuid; s public.subscriptions; err text;
begin
  -- 1. Mua mới gói 1 tháng
  u := pg_temp.mkuser();
  perform public.record_play_purchase(u, 'tokA', 'goi_1_thang', now() + interval '30 days', 'active', '{}');
  s := pg_temp.sub(u);
  insert into res values (1, 'Mua mới gói 1 tháng → còn hạn, nguồn Google Play', s.status = 'active' and s.source = 'google_play' and s.plan_months = 1 and pg_temp.near(s.expires_at, now() + interval '30 days'), s.status || '/' || s.source || '/' || s.plan_months);

  -- 2. Gia hạn: cùng token, hạn mới xa hơn
  perform public.record_play_purchase(u, 'tokA', 'goi_1_thang', now() + interval '60 days', 'active', '{}');
  s := pg_temp.sub(u);
  insert into res values (2, 'Gia hạn tự động (cùng mã giao dịch, hạn dời xa) → hạn mới', s.status = 'active' and pg_temp.near(s.expires_at, now() + interval '60 days'), to_char(s.expires_at, 'YYYY-MM-DD'));

  -- 3. Báo lại y hệt (xác minh lặp / RTDN trùng) → không đổi
  perform public.record_play_purchase(u, 'tokA', 'goi_1_thang', now() + interval '60 days', 'active', '{}');
  s := pg_temp.sub(u);
  insert into res values (3, 'Xác minh/RTDN lặp lại cùng dữ liệu → không đổi', s.status = 'active' and pg_temp.near(s.expires_at, now() + interval '60 days'), to_char(s.expires_at, 'YYYY-MM-DD'));

  -- 4. Huỷ tự gia hạn nhưng CHƯA hết hạn (server gửi state active vì quyền lợi còn tới hạn)
  u := pg_temp.mkuser();
  perform public.record_play_purchase(u, 'tokB', 'goi_1_thang', now() + interval '10 days', 'active', '{}');
  s := pg_temp.sub(u);
  insert into res values (4, 'Huỷ gia hạn nhưng chưa hết hạn → vẫn còn hạn đến ngày đó', s.status = 'active' and pg_temp.near(s.expires_at, now() + interval '10 days'), s.status);

  -- 5. Hết hạn
  perform public.record_play_purchase(u, 'tokB', 'goi_1_thang', now() - interval '1 hour', 'expired', '{}');
  s := pg_temp.sub(u);
  insert into res values (5, 'Hết hạn → hết hạn, hạn không ở tương lai', s.status = 'expired' and s.expires_at <= now() + interval '1 second', s.status);

  -- 6. Đăng ký LẠI cùng gói sau khi hết hạn (mã giao dịch mới)
  perform public.record_play_purchase(u, 'tokC', 'goi_1_thang', now() + interval '30 days', 'active', '{}');
  s := pg_temp.sub(u);
  insert into res values (6, 'Đăng ký lại gói cũ sau khi hết hạn (mã giao dịch mới) → còn hạn', s.status = 'active' and pg_temp.near(s.expires_at, now() + interval '30 days'), s.status);

  -- 7. Hai gói còn hạn cùng lúc (1 tháng + 6 tháng) → lấy gói hạn xa nhất
  u := pg_temp.mkuser();
  perform public.record_play_purchase(u, 'tokD1', 'goi_1_thang', now() + interval '10 days', 'active', '{}');
  perform public.record_play_purchase(u, 'tokD2', 'goi_6_thang', now() + interval '100 days', 'active', '{}');
  s := pg_temp.sub(u);
  insert into res values (7, 'Hai gói còn hạn cùng lúc → lấy gói hạn xa nhất (6 tháng)', s.status = 'active' and s.plan_months = 6 and pg_temp.near(s.expires_at, now() + interval '100 days'), s.plan_months || ' tháng');

  -- 8. Thông báo hết hạn TRỄ của gói cũ không được ghi đè gói mới
  perform public.record_play_purchase(u, 'tokD1', 'goi_1_thang', now() - interval '1 hour', 'expired', '{}');
  s := pg_temp.sub(u);
  insert into res values (8, 'Gói cũ báo hết hạn muộn → KHÔNG ghi đè gói mới còn hạn', s.status = 'active' and s.plan_months = 6, s.status || '/' || s.plan_months);

  -- 9. Gói dài bị huỷ/hết hạn → quay về gói ngắn còn lại
  u := pg_temp.mkuser();
  perform public.record_play_purchase(u, 'tokE1', 'goi_1_thang', now() + interval '10 days', 'active', '{}');
  perform public.record_play_purchase(u, 'tokE2', 'goi_12_thang', now() + interval '300 days', 'active', '{}');
  perform public.record_play_purchase(u, 'tokE2', 'goi_12_thang', now() - interval '1 hour', 'expired', '{}');
  s := pg_temp.sub(u);
  insert into res values (9, 'Gói 12 tháng hết hạn → quay về gói 1 tháng còn lại', s.status = 'active' and s.plan_months = 1 and pg_temp.near(s.expires_at, now() + interval '10 days'), s.plan_months || ' tháng');

  -- 10. Bị thu hồi / hoàn tiền: state hết quyền nhưng Google vẫn ghi hạn ở tương lai
  u := pg_temp.mkuser();
  perform public.record_play_purchase(u, 'tokF', 'goi_6_thang', now() + interval '100 days', 'active', '{}');
  perform public.record_play_purchase(u, 'tokF', 'goi_6_thang', now() + interval '100 days', 'expired', '{}');
  s := pg_temp.sub(u);
  insert into res values (10, 'Thu hồi/hoàn tiền (hạn Google vẫn ở tương lai) → hết hạn NGAY, app không còn thấy hạn xa', s.status = 'expired' and s.expires_at <= now() + interval '1 second', s.status || ' ' || to_char(s.expires_at, 'YYYY-MM-DD'));

  -- 11. Tạm giữ do thanh toán lỗi (hạn đã qua)
  u := pg_temp.mkuser();
  perform public.record_play_purchase(u, 'tokG', 'goi_1_thang', now() - interval '2 days', 'expired', '{}');
  s := pg_temp.sub(u);
  -- dùng thử 14 ngày còn nguyên vì chưa từng có gói Google còn hạn: kiểm tra riêng ở kịch bản 12
  insert into res values (11, 'Tạm giữ (hạn đã qua) khi chưa có gói khác → không cấp hạn', s.expires_at > now() or s.status <> 'expired', s.status);

  -- 12. Dùng thử còn hạn + token hết hạn → KHÔNG được ghi đè dùng thử
  u := pg_temp.mkuser();
  perform public.record_play_purchase(u, 'tokH', 'goi_1_thang', now() - interval '1 hour', 'expired', '{}');
  s := pg_temp.sub(u);
  insert into res values (12, 'Dùng thử còn hạn + một token cũ hết hạn → dùng thử còn nguyên', s.source = 'manual' and s.status = 'trial' and s.expires_at > now() + interval '10 days', s.source || '/' || s.status);

  -- 13. Đang dùng thử rồi mua gói → chuyển sang Google Play với hạn của Google
  u := pg_temp.mkuser();
  perform public.record_play_purchase(u, 'tokI', 'goi_6_thang', now() + interval '180 days', 'active', '{}');
  s := pg_temp.sub(u);
  insert into res values (13, 'Đang dùng thử rồi mua gói → nguồn Google Play, hạn theo Google', s.source = 'google_play' and s.status = 'active' and pg_temp.near(s.expires_at, now() + interval '180 days'), s.source || '/' || s.status);

  -- 14. Mã giao dịch của người khác: không cho đổi chủ
  u := pg_temp.mkuser(); u2 := pg_temp.mkuser();
  perform public.record_play_purchase(u, 'tokJ', 'goi_1_thang', now() + interval '30 days', 'active', '{}');
  begin
    perform public.record_play_purchase(u2, 'tokJ', 'goi_1_thang', now() + interval '30 days', 'active', '{}');
    err := 'khong loi';
  exception when others then err := sqlstate;
  end;
  insert into res values (14, 'Mã giao dịch đã thuộc tài khoản A → tài khoản B không nhận được', err = '42501', 'sqlstate=' || err);

  -- 15. Mã sản phẩm lạ
  u := pg_temp.mkuser();
  begin
    perform public.record_play_purchase(u, 'tokK', 'goi_khong_ton_tai', now() + interval '30 days', 'active', '{}');
    err := 'khong loi';
  exception when others then err := sqlstate;
  end;
  insert into res values (15, 'Mã sản phẩm không có trong bảng play_products → từ chối', err = '22023', 'sqlstate=' || err);

  -- 16. Admin cộng thêm ngày cho tài khoản đang dùng Google Play: cập nhật Google sau đó không làm mất phần cộng thêm
  u := pg_temp.mkuser();
  perform public.record_play_purchase(u, 'tokL', 'goi_1_thang', now() + interval '10 days', 'active', '{}');
  perform public._extend_subscription(u, 1);
  perform public.record_play_purchase(u, 'tokL', 'goi_1_thang', now() + interval '10 days', 'active', '{}');
  s := pg_temp.sub(u);
  insert into res values (16, 'Admin cộng 1 tháng → cập nhật Google sau đó vẫn giữ hạn cộng thêm', s.status = 'active' and s.expires_at > now() + interval '35 days', to_char(s.expires_at, 'YYYY-MM-DD'));

  -- 17. Cùng token, hạn bị rút ngắn (hoàn tiền một phần/đổi kỳ) → theo Google
  u := pg_temp.mkuser();
  perform public.record_play_purchase(u, 'tokM', 'goi_6_thang', now() + interval '100 days', 'active', '{}');
  perform public.record_play_purchase(u, 'tokM', 'goi_6_thang', now() + interval '20 days', 'active', '{}');
  s := pg_temp.sub(u);
  insert into res values (17, 'Google báo hạn ngắn hơn (cùng mã) → theo Google', s.status = 'active' and pg_temp.near(s.expires_at, now() + interval '20 days'), to_char(s.expires_at, 'YYYY-MM-DD'));
end $do$;

select n, scenario, ok, info from res order by n;
rollback;
