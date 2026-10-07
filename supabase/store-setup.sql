-- ============================================================================
--  QUẢN LÝ NHÀ HÀNG — script dựng Supabase CỦA QUÁN (chạy 1 lần duy nhất)
-- ============================================================================
--  Cách dùng (chủ quán làm trên máy tính hoặc điện thoại):
--   1. Tạo dự án Supabase miễn phí tại supabase.com (đây là dự án RIÊNG của quán,
--      dữ liệu bán hàng nằm hoàn toàn ở đây — nhà cung cấp phần mềm không truy cập được).
--   2. Authentication → Sign In / Providers:
--        • bật "Allow anonymous sign-ins"   (máy nhân viên dùng)
--        • Email → TẮT "Confirm email"      (chủ quán đăng nhập ngay sau khi tạo)
--   3. SQL Editor → New query → dán TOÀN BỘ nội dung tệp này → Run.
--   4. Project Settings → API → chép "Project URL" và khoá "anon / publishable"
--      (KHÔNG chép service_role) rồi dán vào app ở bước "Liên kết Supabase".
--
--  Mô hình bảo mật:
--   • Mọi bản ghi nằm trong bảng `records`. Không ai có quyền INSERT/UPDATE/DELETE
--     trực tiếp — mọi thay đổi đi qua hàm push_records() để kiểm quyền từng bản ghi.
--   • Máy CHỦ QUÁN (đăng nhập email/mật khẩu, được ghi nhận trong app_owner): toàn quyền.
--   • Máy NHÂN VIÊN (đăng nhập ẩn danh, liên kết bằng mã QR dùng một lần, hết hạn 5 phút):
--       – chỉ ghi dữ liệu vận hành: đơn, món gọi, thanh toán, kho, đặt bàn, trạng thái ghế, nhật ký
--       – chỉ đổi được tình trạng còn/hết của món và lượt dùng khuyến mãi
--       – KHÔNG xoá được bất cứ thứ gì, KHÔNG đổi được nhân viên/quyền/cài đặt/thiết bị.
--   Lớp chặn này nằm trong Postgres nên nhân viên có sửa mã app cũng không vượt qua được.
-- ============================================================================

-- ---------- Bảng ----------
create table if not exists public.app_owner (
  singleton  boolean primary key default true check (singleton),
  owner_id   uuid not null,
  claimed_at timestamptz not null default now()
);

create table if not exists public.staff_devices (
  id           uuid primary key,              -- = auth.uid() ẩn danh của máy đó
  device_name  text not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  revoked_at   timestamptz
);

create table if not exists public.pairing_tickets (
  token      text primary key,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz,
  used_by    uuid
);

create sequence if not exists public.records_seq;
create sequence if not exists public.guest_order_seq;   -- mã đơn khách tạo: #G1, #G2... không bao giờ trùng mã máy tự sinh

create table if not exists public.records (
  collection text    not null,
  id         text    not null,
  data       jsonb   not null default '{}'::jsonb,
  updated_at bigint  not null,                 -- mốc logic do máy khách đặt, dùng để chọn bản mới hơn
  deleted    boolean not null default false,   -- "bia mộ": để máy khác biết bản ghi đã bị chủ quán xoá
  device_id  uuid,
  seq        bigint  not null default nextval('public.records_seq'),  -- con trỏ kéo dữ liệu, do máy chủ cấp
  primary key (collection, id)
);
create index if not exists records_seq_idx on public.records (seq);
-- Tra mã QR của ghế thật nhanh — bảng ghế vẫn chỉ là các dòng JSON trong `records` như mọi loại dữ liệu khác
create index if not exists records_seat_token_idx on public.records ((data ->> 'qr_token')) where collection = 'seats';

-- Một đơn chỉ được có MỘT thanh toán thành công — chặn tiền bị ghi hai lần khi 2 máy cùng offline
create unique index if not exists one_paid_payment_per_order
  on public.records ((data->>'order_id'))
  where collection = 'payments' and deleted = false and (data->>'state') = 'paid';

create or replace function public.records_bump_seq() returns trigger
language plpgsql as $$
begin
  new.seq := nextval('public.records_seq');
  return new;
end $$;

drop trigger if exists records_bump_seq on public.records;
create trigger records_bump_seq before insert or update on public.records
  for each row execute function public.records_bump_seq();

-- ---------- Hàm nhận diện vai trò (dùng trong chính sách RLS) ----------
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_owner where owner_id = auth.uid());
$$;

create or replace function public.is_active_device() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff_devices where id = auth.uid() and revoked_at is null);
$$;

-- ---------- RLS ----------
alter table public.app_owner       enable row level security;
alter table public.staff_devices   enable row level security;
alter table public.pairing_tickets enable row level security;
alter table public.records         enable row level security;

drop policy if exists records_read on public.records;
create policy records_read on public.records for select to authenticated
  using (public.is_owner() or public.is_active_device());

drop policy if exists devices_read on public.staff_devices;
create policy devices_read on public.staff_devices for select to authenticated
  using (public.is_owner() or id = auth.uid());

-- Không có chính sách INSERT/UPDATE/DELETE nào: ghi chỉ qua các hàm bên dưới.
revoke all on public.records, public.staff_devices, public.pairing_tickets, public.app_owner
  from anon, authenticated;
grant select on public.records, public.staff_devices to authenticated;

/* ============================================================
   KHO ẢNH THỰC ĐƠN (Supabase Storage) — thay cho việc nhúng ảnh base64 thẳng vào cột dữ liệu.
   Lý do đổi: ảnh nhúng base64 làm phình to cả dung lượng CSDL (giới hạn 500MB gói miễn phí) lẫn
   băng thông (mỗi lần đồng bộ/khách xem thực đơn đều tải lại nguyên ảnh dù chỉ đổi giá hay tên món).
   Chuyển sang Storage: cột `image` của món giờ chỉ còn một đường dẫn ngắn, ảnh tải riêng, có thể cache.
   Bucket CÔNG KHAI (ai cũng xem được ảnh) — đúng và cần thiết, vì khách quét QR gọi món (không đăng
   nhập) cũng phải xem được ảnh món. Chỉ GHI (tải lên/xoá/sửa) mới cần quyền chủ quán/máy nhân viên. */
insert into storage.buckets (id, name, public, file_size_limit)
  values ('menu-images', 'menu-images', true, 2097152)   -- giới hạn 2MB/ảnh — đủ dư so với ảnh đã nén phía app (thường vài chục-trăm KB)
  on conflict (id) do nothing;

drop policy if exists menu_images_read on storage.objects;
create policy menu_images_read on storage.objects for select to public
  using (bucket_id = 'menu-images');

drop policy if exists menu_images_write on storage.objects;
create policy menu_images_write on storage.objects for insert to authenticated
  with check (bucket_id = 'menu-images' and (public.is_owner() or public.is_active_device()));

drop policy if exists menu_images_update on storage.objects;
create policy menu_images_update on storage.objects for update to authenticated
  using (bucket_id = 'menu-images' and (public.is_owner() or public.is_active_device()));

drop policy if exists menu_images_delete on storage.objects;
create policy menu_images_delete on storage.objects for delete to authenticated
  using (bucket_id = 'menu-images' and (public.is_owner() or public.is_active_device()));

-- ---------- Hàm nghiệp vụ ----------
create or replace function public.store_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'ready', true,
    'version', 1,
    'has_owner', exists (select 1 from public.app_owner),
    'is_owner', public.is_owner(),
    'is_device', public.is_active_device(),
    'device_revoked', exists (select 1 from public.staff_devices where id = auth.uid() and revoked_at is not null)
  );
$$;

-- Người đăng nhập thật đầu tiên trở thành chủ quán (chỉ một lần duy nhất cho dự án)
create or replace function public.claim_owner() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Tài khoản ẩn danh không thể làm chủ quán' using errcode = '42501';
  end if;
  if exists (select 1 from public.app_owner where owner_id = auth.uid()) then
    return true;
  end if;
  begin
    insert into public.app_owner (singleton, owner_id) values (true, auth.uid());
  exception when unique_violation then
    raise exception 'Dự án Supabase này đã có chủ quán khác' using errcode = '42501';
  end;
  return true;
end $$;

-- Chủ quán tạo mã mời: dùng một lần, hết hạn sau 5 phút
create or replace function public.create_pairing_ticket() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_exp   timestamptz;
begin
  if not public.is_owner() then
    raise exception 'Chỉ chủ quán được tạo mã mời' using errcode = '42501';
  end if;
  delete from public.pairing_tickets where expires_at < now() - interval '1 day';
  v_token := replace(gen_random_uuid()::text, '-', '');   -- 32 ký tự hex = 122 bit ngẫu nhiên, dùng một lần, sống 5 phút
  v_exp   := now() + interval '5 minutes';
  insert into public.pairing_tickets (token, created_by, expires_at) values (v_token, auth.uid(), v_exp);
  return jsonb_build_object('token', v_token, 'expires_at', v_exp);
end $$;

-- Máy nhân viên (đã đăng nhập ẩn danh) đổi mã mời lấy tư cách thiết bị
create or replace function public.redeem_pairing_ticket(p_token text, p_device_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name text := left(btrim(coalesce(p_device_name, '')), 60);
begin
  if auth.uid() is null then
    raise exception 'Chưa đăng nhập' using errcode = '28000';
  end if;
  if public.is_owner() then
    raise exception 'Máy của chủ quán không cần liên kết như máy nhân viên' using errcode = '42501';
  end if;
  if v_name = '' then v_name := 'Máy nhân viên'; end if;

  update public.pairing_tickets
     set used_at = now(), used_by = auth.uid()
   where token = p_token and used_at is null and expires_at > now();
  if not found then
    raise exception 'Mã không hợp lệ hoặc đã hết hạn' using errcode = '22023';
  end if;

  insert into public.staff_devices (id, device_name, last_seen_at)
  values (auth.uid(), v_name, now())
  on conflict (id) do update
    set device_name = excluded.device_name, revoked_at = null, last_seen_at = now();

  return jsonb_build_object('device_id', auth.uid());
end $$;

create or replace function public.revoke_device(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Chỉ chủ quán được thu hồi thiết bị' using errcode = '42501';
  end if;
  update public.staff_devices set revoked_at = now() where id = p_id and revoked_at is null;
  return found;
end $$;

-- Xoá hẳn khỏi danh sách (khác thu hồi: thu hồi giữ lại dòng để biết lịch sử, xoá là dọn hẳn).
-- Chỉ xoá được thiết bị ĐÃ thu hồi trước đó — tránh bấm nhầm xoá một máy đang hoạt động.
create or replace function public.delete_device(p_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then
    raise exception 'Chỉ chủ quán được xoá thiết bị' using errcode = '42501';
  end if;
  delete from public.staff_devices where id = p_id and revoked_at is not null;
  return found;
end $$;

create or replace function public.touch_device() returns void
language sql security definer set search_path = public as $$
  update public.staff_devices set last_seen_at = now() where id = auth.uid() and revoked_at is null;
$$;

-- Cổng ghi DUY NHẤT vào bảng records — kiểm quyền từng bản ghi
create or replace function public.push_records(p_recs jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_owner   boolean := public.is_owner();
  v_dev     boolean := public.is_active_device();
  v_uid     uuid    := auth.uid();
  v_results jsonb   := '[]'::jsonb;
  v_rows    int;
  v_status  text;
  v_reason  text;
  r         record;
  -- Máy nhân viên được ghi các loại dữ liệu vận hành này
  v_staff_rw constant text[] := array['orders','orderItems','payments','stockMoves','reservations','seats','logs'];
  v_known    constant text[] := array['areas','tables','seats','categories','kitchens','menu','recipes',
                                      'ingredients','promos','staff','reservations','orders','orderItems',
                                      'payments','stockMoves','logs','restaurant','settings','license'];
begin
  if not (v_owner or v_dev) then
    raise exception 'Thiết bị chưa được liên kết hoặc đã bị thu hồi' using errcode = '42501';
  end if;
  if jsonb_typeof(p_recs) <> 'array' or jsonb_array_length(p_recs) > 500 then
    raise exception 'Dữ liệu đồng bộ không hợp lệ' using errcode = '22023';
  end if;

  for r in
    select * from jsonb_to_recordset(p_recs)
      as x(collection text, id text, data jsonb, updated_at bigint, deleted boolean)
  loop
    v_status := null; v_reason := null;
    begin
      if r.collection is null or r.id is null or r.updated_at is null
         or coalesce(jsonb_typeof(r.data), '') <> 'object' then
        raise exception 'Bản ghi thiếu trường bắt buộc' using errcode = '22023';
      end if;
      if not (r.collection = any (v_known)) then
        raise exception 'Loại dữ liệu không được hỗ trợ: %', r.collection using errcode = '22023';
      end if;
      if octet_length(r.data::text) > 700000 then
        raise exception 'Bản ghi quá lớn' using errcode = '22023';
      end if;

      if not v_owner then
        if coalesce(r.deleted, false) then
          raise exception 'Máy nhân viên không được xoá dữ liệu' using errcode = '42501';
        end if;
        if r.collection = any (v_staff_rw) then
          null;  -- được phép
        elsif r.collection = 'menu' then
          if not exists (select 1 from public.records m
                          where m.collection = 'menu' and m.id = r.id and not m.deleted
                            and (m.data - array['stock_state','updated_at']) = (r.data - array['stock_state','updated_at'])) then
            raise exception 'Máy nhân viên chỉ được đổi tình trạng còn/hết món' using errcode = '42501';
          end if;
        elsif r.collection = 'promos' then
          if not exists (select 1 from public.records m
                          where m.collection = 'promos' and m.id = r.id and not m.deleted
                            and (m.data - array['used_count','updated_at']) = (r.data - array['used_count','updated_at'])) then
            raise exception 'Máy nhân viên chỉ được ghi lượt dùng khuyến mãi' using errcode = '42501';
          end if;
        else
          raise exception 'Chỉ máy chủ quán được thay đổi mục này' using errcode = '42501';
        end if;
      end if;

      -- Bản mới hơn thắng (so mốc updated_at); bản đã bị chủ quán xoá thì máy phụ không "sống lại" được
      insert into public.records as t (collection, id, data, updated_at, deleted, device_id)
      values (r.collection, r.id, r.data, r.updated_at, coalesce(r.deleted, false), v_uid)
      on conflict (collection, id) do update
        set data = excluded.data, updated_at = excluded.updated_at,
            deleted = excluded.deleted, device_id = excluded.device_id
        where t.updated_at <= excluded.updated_at
          and (v_owner or not t.deleted);
      get diagnostics v_rows = row_count;
      v_status := case when v_rows = 1 then 'applied' else 'stale' end;
    exception
      when unique_violation then
        v_status := 'duplicate';
        v_reason := 'Đơn này đã được thanh toán ở máy khác';
      when others then
        v_status := 'rejected';
        v_reason := sqlerrm;
    end;
    v_results := v_results || jsonb_build_object(
      'collection', r.collection, 'id', r.id, 'status', v_status, 'reason', v_reason);
  end loop;

  return v_results;
end $$;

/* ============================================================
   KHÁCH QUÉT QR GỌI MÓN
   Khách KHÔNG đăng nhập gì cả — không tài khoản, không ẩn danh. Mỗi hàm tự
   kiểm bằng mã QR của đúng ghế đó (p_seat_token), không dựa vào auth.uid().
   Vì chạy SECURITY DEFINER nên bỏ qua RLS của bảng `records` — bù lại, mỗi
   hàm CHỈ được trả về/ghi đúng những trường cần thiết, không bao giờ lộ
   nguyên bảng. Khách chỉ ghi được: món vào ĐÚNG đơn của ghế mình, và cờ
   "đang gọi nhân viên" của ĐÚNG ghế mình — không đọc/sửa được gì khác.
   ============================================================ */

/** Tìm đúng dòng ghế theo mã QR; báo lỗi rõ ràng nếu mã sai hoặc ghế đã khoá. */
create or replace function public._guest_seat(p_token text, p_require_unlocked boolean default true, out seat_id text, out seat_data jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_token is null or length(p_token) < 4 or length(p_token) > 120 then
    raise exception 'Mã QR không hợp lệ' using errcode = '22023';
  end if;
  select id, data into seat_id, seat_data from public.records
    where collection = 'seats' and data ->> 'qr_token' = p_token and not deleted limit 1;
  if seat_id is null then raise exception 'Mã QR không hợp lệ hoặc đã bị đổi' using errcode = '22023'; end if;
  if p_require_unlocked and coalesce((seat_data ->> 'locked')::int, 0) = 1 then
    raise exception 'Bàn này đã khoá mã QR — vui lòng gọi nhân viên' using errcode = '42501';
  end if;
end $$;

/** Thực đơn + thông tin quán cho đúng ghế đã quét — khách xem được trước khi gọi món. */
create or replace function public.guest_menu(p_seat_token text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_seat record;
begin
  select * into v_seat from public._guest_seat(p_seat_token, false);
  return jsonb_build_object(
    'locked', coalesce((v_seat.seat_data ->> 'locked')::int, 0) = 1,
    'restaurant', coalesce((select data from public.records where collection = 'restaurant' and id = 'main' and not deleted), '{}'::jsonb),
    'table_name', (select data ->> 'name' from public.records where collection = 'tables' and id = (v_seat.seat_data ->> 'table_id') and not deleted),
    'seat_no', (v_seat.seat_data ->> 'seat_no')::int,
    'categories', coalesce((select jsonb_agg(data order by coalesce((data ->> 'sort')::int, 0))
                             from public.records where collection = 'categories' and not deleted), '[]'::jsonb),
    'menu', coalesce((select jsonb_agg(data) from public.records
                       where collection = 'menu' and not deleted and coalesce((data ->> 'active')::int, 0) = 1), '[]'::jsonb),
    -- Đơn đang mở của đúng ghế này (nếu có) — để khách tự xem lại món đã gọi, không cần hỏi nhân viên
    'order', (select jsonb_build_object(
        'id', o.id, 'code', o.data ->> 'code', 'status', o.data ->> 'status',
        'items', coalesce((select jsonb_agg(jsonb_build_object(
                    'name', i.data ->> 'name_snapshot', 'qty', (i.data ->> 'qty')::int,
                    'note', i.data ->> 'note', 'status', i.data ->> 'status',
                    'price', (i.data ->> 'price_snapshot')::numeric)
                  order by (i.data ->> 'created_at')::bigint)
                  from public.records i
                  where i.collection = 'orderItems' and not i.deleted
                    and (i.data ->> 'order_id') = o.id and (i.data ->> 'status') <> 'cancelled'), '[]'::jsonb))
      from public.records o
      where o.collection = 'orders' and not o.deleted
        and o.id = (v_seat.seat_data ->> 'bound_order_id') and (o.data ->> 'status') = 'open')
  );
end $$;

/** Khách bấm "Gọi nhân viên" — chỉ bật cờ calling của đúng ghế mình, không đụng gì khác. */
create or replace function public.guest_call(p_seat_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_seat record; v_now bigint := (extract(epoch from now()) * 1000)::bigint;
begin
  select * into v_seat from public._guest_seat(p_seat_token, true);
  insert into public.records (collection, id, data, updated_at, deleted)
  values ('seats', v_seat.seat_id, v_seat.seat_data || jsonb_build_object('calling', 1, 'updated_at', v_now), v_now, false)
  on conflict (collection, id) do update
    set data = excluded.data, updated_at = excluded.updated_at
    where public.records.updated_at <= excluded.updated_at;
  return true;
end $$;

/** Khách gửi món. Tự tìm/tạo đơn của ghế, cộng đợt gọi mới, trừ kho theo công thức —
    làm đúng những việc local-engine.js làm khi NHÂN VIÊN gọi món, để đồng bộ về các
    máy staff là một bản ghi y hệt, không cần xử lý riêng gì ở phía app. */
create or replace function public.guest_order(p_seat_token text, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_seat record; v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_order_id text; v_order_data jsonb; v_is_new boolean := false;
  v_batch int; v_confirm boolean := false; v_status text;
  v_line record; v_menu jsonb; v_qty int; v_item_id text; v_item jsonb;
  v_rec jsonb; v_used numeric; v_mv_id text; v_ing jsonb; v_qty_after numeric;
  v_count int := 0;
begin
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 40 then
    raise exception 'Chưa chọn món' using errcode = '22023';
  end if;
  select * into v_seat from public._guest_seat(p_seat_token, true);

  v_order_id := v_seat.seat_data ->> 'bound_order_id';
  if v_order_id is not null then
    select data into v_order_data from public.records
      where collection = 'orders' and id = v_order_id and not deleted and (data ->> 'status') = 'open';
    if not found then v_order_id := null; end if;
  end if;

  if v_order_id is null then
    v_is_new := true;
    v_order_id := 'o' || replace(gen_random_uuid()::text, '-', '');
    v_order_data := jsonb_build_object(
      'id', v_order_id, 'code', '#G' || nextval('public.guest_order_seq'),
      'table_id', v_seat.seat_data ->> 'table_id', 'seat_no', (v_seat.seat_data ->> 'seat_no')::int,
      'source', 'qr', 'status', 'open', 'merged_into', null,
      'customer_name', '', 'customer_phone', '', 'promo_id', null,
      'created_at', v_now, 'updated_at', v_now);
    insert into public.records (collection, id, data, updated_at, deleted) values ('orders', v_order_id, v_order_data, v_now, false);
    insert into public.records (collection, id, data, updated_at, deleted)
    values ('seats', v_seat.seat_id, v_seat.seat_data || jsonb_build_object('bound_order_id', v_order_id, 'updated_at', v_now), v_now, false)
    on conflict (collection, id) do update set data = excluded.data, updated_at = excluded.updated_at
      where public.records.updated_at <= excluded.updated_at;
  else
    update public.records set data = data || jsonb_build_object('updated_at', v_now), updated_at = v_now
      where collection = 'orders' and id = v_order_id;
  end if;

  -- Số đợt gọi: đếm trên các món hiện có của đơn, để lần gọi thêm luôn tách đợt mới, không gộp vào đợt đang nấu
  select coalesce(max((data ->> 'batch')::int), 0) + 1 into v_batch
    from public.records where collection = 'orderItems' and (data ->> 'order_id') = v_order_id and not deleted;
  select coalesce((data ->> 'confirmFirstOrder')::boolean, false) into v_confirm
    from public.records where collection = 'settings' and id = 'main' and not deleted;
  v_status := case when v_confirm and v_is_new then 'pending' else 'queued' end;

  for v_line in select * from jsonb_to_recordset(p_lines) as x("menuItemId" text, qty int, note text) loop
    v_count := v_count + 1;
    if v_count > 40 then exit; end if;
    select data into v_menu from public.records
      where collection = 'menu' and id = v_line."menuItemId" and not deleted and coalesce((data ->> 'active')::int, 0) = 1;
    if v_menu is null then raise exception 'Món không tồn tại' using errcode = '22023'; end if;
    if (v_menu ->> 'stock_state') = 'out' then raise exception '% đã hết hàng', (v_menu ->> 'name') using errcode = '22023'; end if;
    v_qty := greatest(1, least(50, coalesce(v_line.qty, 1)));
    v_item_id := 'it' || replace(gen_random_uuid()::text, '-', '');
    v_item := jsonb_build_object(
      'id', v_item_id, 'order_id', v_order_id, 'menu_item_id', v_line."menuItemId",
      'name_snapshot', v_menu ->> 'name', 'price_snapshot', (v_menu ->> 'price')::numeric, 'kitchen_id', v_menu ->> 'kitchen_id',
      'qty', v_qty, 'note', left(coalesce(v_line.note, ''), 200), 'status', v_status, 'batch', v_batch,
      'origin_table', v_seat.seat_data ->> 'table_id', 'origin_seat', (v_seat.seat_data ->> 'seat_no')::int,
      'created_at', v_now, 'updated_at', v_now);
    insert into public.records (collection, id, data, updated_at, deleted) values ('orderItems', v_item_id, v_item, v_now, false);

    -- Trừ kho theo công thức, giống hệt local-engine.js khi nhân viên gọi món
    for v_rec in select data from public.records
        where collection = 'recipes' and (data ->> 'menu_item_id') = v_line."menuItemId" and not deleted
    loop
      v_used := round(coalesce((v_rec ->> 'qty_per_serve')::numeric, 0) * v_qty, 3);
      if v_used = 0 then continue; end if;
      select data into v_ing from public.records where collection = 'ingredients' and id = (v_rec ->> 'ingredient_id') and not deleted;
      -- qty_after chỉ để hiển thị tham khảo trong nhật ký kho — số tồn THẬT luôn được mỗi máy tự
      -- tính lại từ (tồn đầu + tổng mọi phiếu), nên ước lượng ở đây lệch một chút cũng không sai dữ liệu.
      v_qty_after := coalesce((v_ing ->> 'qty')::numeric, 0) - v_used;
      v_mv_id := 'sm' || replace(gen_random_uuid()::text, '-', '');
      insert into public.records (collection, id, data, updated_at, deleted) values ('stockMoves', v_mv_id, jsonb_build_object(
        'id', v_mv_id, 'ingredient_id', v_rec ->> 'ingredient_id', 'type', 'auto', 'qty', v_used, 'qty_after', v_qty_after,
        'reason', 'Theo công thức ' || (v_menu ->> 'name') || ' (khách gọi qua QR)', 'ref_order_id', v_order_id,
        'staff_id', null, 'created_at', v_now), v_now, false);
    end loop;
  end loop;

  return jsonb_build_object('order_id', v_order_id, 'order_code', v_order_data ->> 'code', 'items', v_count, 'status', v_status);
end $$;

/* ============================================================
   DỌN DỮ LIỆU CŨ — tránh CSDL đầy dần theo thời gian (giới hạn 500MB gói miễn phí Supabase).
   App tự gọi hàm này ĐỊNH KỲ (tối đa 1 lần/ngày, xem Cloud.maybeCleanup() phía client) ngay trong
   lúc máy chủ quán đồng bộ bình thường — không cần cron/máy chủ riêng nào khác.
   Chỉ xoá: (1) bản ghi ĐÃ đánh dấu xoá từ hơn 30 ngày (chắc chắn mọi máy đã đồng bộ xong),
   (2) đơn ĐÃ THANH TOÁN XONG quá cũ (mặc định giữ 24 tháng — đủ so sánh doanh thu theo năm,
   chỉnh được qua p_months_keep), (3) nhật ký hoạt động quá 6 tháng, (4) lịch sử kho quá 12 tháng.
   KHÔNG BAO GIỜ đụng tới đơn còn đang mở — chỉ status='paid' mới bị tính tới ở mục (2). */
create or replace function public.cleanup_old_data(p_months_keep int default 24) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_now_ms bigint := (extract(epoch from now()) * 1000)::bigint;
  v_deleted_cutoff bigint := v_now_ms - 30 * 86400000;                    -- 30 ngày
  v_orders_cutoff   bigint := v_now_ms - (greatest(p_months_keep, 6) * 30 * 86400000);  -- tối thiểu 6 tháng, không cho xoá gần hơn
  v_logs_cutoff     bigint := v_now_ms - 6 * 30 * 86400000;                -- 6 tháng
  v_stock_cutoff    bigint := v_now_ms - 12 * 30 * 86400000;               -- 12 tháng
  v_purged_deleted int; v_purged_orders int; v_purged_logs int; v_purged_stock int;
  v_order_ids text[];
begin
  if not public.is_owner() then raise exception 'Chỉ chủ quán được dọn dữ liệu' using errcode = '42501'; end if;

  with del as (delete from public.records where deleted = true and updated_at < v_deleted_cutoff returning 1)
    select count(*) into v_purged_deleted from del;

  select array_agg(id) into v_order_ids from public.records
    where collection = 'orders' and not deleted and (data ->> 'status') = 'paid' and updated_at < v_orders_cutoff;
  if v_order_ids is not null and array_length(v_order_ids, 1) > 0 then
    with del as (
      delete from public.records
        where (collection = 'orderItems' and (data ->> 'order_id') = any(v_order_ids))
           or (collection = 'payments'   and (data ->> 'order_id') = any(v_order_ids))
           or (collection = 'orders'     and id = any(v_order_ids))
        returning 1)
      select count(*) into v_purged_orders from del;
  else v_purged_orders := 0; end if;

  with del as (delete from public.records where collection = 'logs' and updated_at < v_logs_cutoff returning 1)
    select count(*) into v_purged_logs from del;
  with del as (delete from public.records where collection = 'stockMoves' and updated_at < v_stock_cutoff returning 1)
    select count(*) into v_purged_stock from del;

  return jsonb_build_object('purged_tombstones', v_purged_deleted, 'purged_orders_rows', v_purged_orders,
    'purged_logs', v_purged_logs, 'purged_stock_moves', v_purged_stock, 'months_kept', greatest(p_months_keep, 6));
end $$;

-- ---------- Quyền thực thi hàm ----------
revoke execute on function public.is_owner(), public.is_active_device(), public.store_status(),
  public.claim_owner(), public.create_pairing_ticket(), public.redeem_pairing_ticket(text, text),
  public.revoke_device(uuid), public.delete_device(uuid), public.touch_device(), public.push_records(jsonb),
  public.guest_menu(text), public.guest_call(text), public.guest_order(text, jsonb), public.cleanup_old_data(int)
  from public, anon, authenticated;
grant execute on function public.is_owner(), public.is_active_device(), public.store_status(),
  public.claim_owner(), public.create_pairing_ticket(), public.redeem_pairing_ticket(text, text),
  public.revoke_device(uuid), public.delete_device(uuid), public.touch_device(), public.push_records(jsonb),
  public.cleanup_old_data(int)
  to authenticated;
-- Khách không đăng nhập gì cả — ba hàm này cấp thẳng cho vai trò "anon" (khoá công khai của dự án)
grant execute on function public.guest_menu(text), public.guest_call(text), public.guest_order(text, jsonb) to anon;

-- ---------- Realtime: máy khác nhận thay đổi gần như tức thì ----------
do $$
begin
  alter publication supabase_realtime add table public.records;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

notify pgrst, 'reload schema';
