-- ============================================================
-- BỘ DỮ LIỆU MẪU 1 NĂM — chỉ để THỬ CÁC BÁO CÁO
-- Chạy trong Supabase → SQL Editor của project KHO DỮ LIỆU CỦA QUÁN (không phải project gói cước).
--
-- • Dùng thực đơn / bàn / nhân viên đang có trong kho. Kho chưa có thực đơn hoặc bàn thì tự tạo bộ mẫu nhỏ (id bắt đầu bằng 'demo-').
-- • Tạo ~6–7 nghìn đơn đã thanh toán trải đều 365 ngày gần nhất (cuối tuần đông hơn, bữa trưa 11–13h30 và tối 17h30–21h30 đông nhất,
--   gần đây đông hơn xa), kèm món, thanh toán tiền mặt / chuyển khoản / VietQR, một số đơn có giảm giá.
-- • Mọi bản ghi đơn / món / thanh toán mẫu có id bắt đầu bằng 'demo-'. Chạy lại script này an toàn (ghi đè, không nhân đôi).
-- • Xoá bộ mẫu: chạy file supabase/sample-data-remove.sql (đánh dấu xoá để các máy cũng xoá theo).
-- • Máy đang liên kết sẽ tự kéo dữ liệu về sau ít phút (mở Quản lý → Đồng bộ → Đồng bộ ngay).
-- Không đụng tới dữ liệu thật: chỉ thêm / ghi đè các dòng có id 'demo-…'.
-- ============================================================
do $demo$
declare
  tz  constant text := 'Asia/Ho_Chi_Minh';
  has_menu   boolean;
  has_tables boolean;
begin
  -- ---------- 1. Danh mục / khu bếp / thực đơn / bàn mẫu (chỉ khi kho chưa có) ----------
  select exists (select 1 from records where collection = 'menu' and not deleted and data->>'active' in ('1','true')) into has_menu;
  select exists (select 1 from records where collection = 'tables' and not deleted and data->>'active' in ('1','true')) into has_tables;

  if not has_menu then
    insert into records (collection, id, data, updated_at) values
      ('categories','demo-c1','{"id":"demo-c1","name":"Khai vị","sort":0}',1),
      ('categories','demo-c2','{"id":"demo-c2","name":"Món chính","sort":1}',1),
      ('categories','demo-c3','{"id":"demo-c3","name":"Đồ uống","sort":2}',1),
      ('categories','demo-c4','{"id":"demo-c4","name":"Tráng miệng","sort":3}',1),
      ('kitchens','demo-k1','{"id":"demo-k1","name":"Bếp chính"}',1),
      ('kitchens','demo-k2','{"id":"demo-k2","name":"Quầy pha chế"}',1)
    on conflict (collection, id) do update set data = excluded.data, deleted = false, updated_at = excluded.updated_at;

    insert into records (collection, id, data, updated_at)
    select 'menu', 'demo-m' || n, jsonb_build_object('id','demo-m'||n,'name',nm,'description','','emoji',em,'image',null,
             'price',pr,'category_id',cat,'kitchen_id',kit,'stock_state','ok','active',1,'updated_at',1), 1
    from (values
      (1,'Gỏi cuốn tôm thịt','🥗',45000,'demo-c1','demo-k1'), (2,'Chả giò hải sản','🥟',55000,'demo-c1','demo-k1'),
      (3,'Phở bò tái','🍜',75000,'demo-c2','demo-k1'),       (4,'Cơm tấm sườn bì','🍚',65000,'demo-c2','demo-k1'),
      (5,'Cơm chiên hải sản','🍤',70000,'demo-c2','demo-k1'), (6,'Bún bò Huế','🍲',70000,'demo-c2','demo-k1'),
      (7,'Lẩu thái (nhỏ)','🍲',220000,'demo-c2','demo-k1'),  (8,'Trà đá','🧊',10000,'demo-c3','demo-k2'),
      (9,'Nước cam ép','🍊',30000,'demo-c3','demo-k2'),      (10,'Bia Sài Gòn','🍺',25000,'demo-c3','demo-k2'),
      (11,'Cà phê sữa','☕',29000,'demo-c3','demo-k2'),       (12,'Chè thái','🍮',35000,'demo-c4','demo-k1')
    ) v(n, nm, em, pr, cat, kit)
    on conflict (collection, id) do update set data = excluded.data, deleted = false, updated_at = excluded.updated_at;
  end if;

  if not has_tables then
    insert into records (collection, id, data, updated_at) values
      ('areas','demo-a1','{"id":"demo-a1","name":"Khu A","sort":0}',1),
      ('areas','demo-a2','{"id":"demo-a2","name":"Ngoài trời","sort":1}',1)
    on conflict (collection, id) do update set data = excluded.data, deleted = false, updated_at = excluded.updated_at;

    insert into records (collection, id, data, updated_at)
    select 'tables', 'demo-t' || n, jsonb_build_object('id','demo-t'||n,'name','Bàn '||lpad(n::text,2,'0'),
             'area_id', case when n <= 4 then 'demo-a1' else 'demo-a2' end, 'seats', s, 'layout','auto','active',1,'updated_at',1), 1
    from (values (1,4),(2,4),(3,6),(4,2),(5,4),(6,6)) v(n, s)
    on conflict (collection, id) do update set data = excluded.data, deleted = false, updated_at = excluded.updated_at;

    insert into records (collection, id, data, updated_at)
    select 'seats', 'demo-t' || t.n || ':' || g, jsonb_build_object('table_id','demo-t'||t.n,'seat_no',g,'qr_token','demo'||t.n||'x'||g,
             'locked',0,'calling',0,'bound_order_id',null,'updated_at',1), 1
    from (values (1,4),(2,4),(3,6),(4,2),(5,4),(6,6)) t(n, s), lateral generate_series(1, t.s) g
    on conflict (collection, id) do update set data = excluded.data, deleted = false, updated_at = excluded.updated_at;
  end if;

  -- ---------- 2. Bảng tra tạm: thực đơn, ghế, nhân viên ----------
  create temp table _menu on commit drop as
    select row_number() over (order by id) as rn, id, data->>'name' as name, (data->>'price')::numeric as price, data->>'kitchen_id' as kitchen_id
    from records where collection = 'menu' and not deleted and data->>'active' in ('1','true');

  create temp table _seat on commit drop as
    select row_number() over (order by s.id) as rn, s.data->>'table_id' as table_id, (s.data->>'seat_no')::int as seat_no
    from records s join records t on t.collection = 'tables' and t.id = s.data->>'table_id' and not t.deleted and t.data->>'active' in ('1','true')
    where s.collection = 'seats' and not s.deleted;

  create temp table _staff on commit drop as
    select row_number() over (order by id) as rn, id from records where collection = 'staff' and not deleted and data->>'active' in ('1','true');

  if (select count(*) from _menu) = 0 then raise exception 'Kho chưa có món nào đang bán — thêm thực đơn trước rồi chạy lại'; end if;
  if (select count(*) from _seat) = 0 then raise exception 'Kho chưa có bàn/ghế nào — thêm bàn trước rồi chạy lại'; end if;

  -- ---------- 3. Sinh đơn: ngày → số đơn → giờ ----------
  create temp table _o on commit drop as
  select row_number() over (order by ts) as n, t.*
  from (
    select ts_local, (extract(epoch from (ts_local at time zone tz)) * 1000)::bigint as ts,
           1 + floor(random() * mc)::int as seat_rn,
           case when r2 < 0.50 then 'cash' when r2 < 0.78 then 'transfer' else 'vietqr' end as method,
           r3 < 0.08 as has_disc,
           1 + floor(random() * 4)::int as nlines,
           sc, 1 + floor(random() * greatest(sc,1))::int as staff_rn,
           (35 + floor(random() * 60))::int as dwell_min
    from (
      select dd.day + (case when r < 0.45 then 11 + random() * 2.5 when r < 0.90 then 17.5 + random() * 4 else 8 + random() * 14 end) * interval '1 hour' as ts_local,
             random() as r2, random() as r3,
             (select count(*) from _seat) as mc, (select count(*) from _staff) as sc
      from (
        select d, ((now() at time zone tz)::date - d) as day,
               greatest(4, round((9 + (364 - d) * 8.0 / 364)
                 * case extract(dow from ((now() at time zone tz)::date - d)) when 0 then 1.5 when 6 then 1.5 when 5 then 1.25 else 1 end
                 * (0.75 + random() * 0.5)))::int as cnt
        from generate_series(0, 364) d
      ) dd
      cross join lateral generate_series(1, dd.cnt) k
      cross join lateral (select random() as r) rr
    ) x
  ) t
  where ts <= (extract(epoch from now()) * 1000)::bigint - 5400000;   -- đơn cuối cùng cách hiện tại ít nhất 90 phút

  create temp table _i on commit drop as
  select o.n, k as line, 1 + floor(power(random(), 1.6) * (select count(*) from _menu))::int as menu_rn,
         case when random() < 0.62 then 1 when random() < 0.7 then 2 else 3 end as qty
  from _o o, lateral generate_series(1, o.nlines) k;

  create temp table _ix on commit drop as
  select i.n, i.line, i.qty, m.id as menu_id, m.name, m.price, m.kitchen_id
  from _i i join _menu m on m.rn = i.menu_rn;

  create temp table _tot on commit drop as
  select n, sum(qty * price)::bigint as sub from _ix group by n;

  -- ---------- 4. Ghi vào records ----------
  insert into records (collection, id, data, updated_at, deleted)
  select 'orders', 'demo-o' || o.n,
         jsonb_build_object('id','demo-o'||o.n,'code','#D'||o.n,'table_id',s.table_id,'seat_no',s.seat_no,'source','staff','status','paid',
           'merged_into',null,'customer_name','','customer_phone','','promo_id',null,
           'created_at',o.ts,'updated_at',o.ts + o.dwell_min * 60000), o.ts + o.dwell_min * 60000, false
  from _o o join _seat s on s.rn = o.seat_rn
  on conflict (collection, id) do update set data = excluded.data, updated_at = excluded.updated_at, deleted = false;

  insert into records (collection, id, data, updated_at, deleted)
  select 'orderItems', 'demo-it' || x.n || '-' || x.line,
         jsonb_build_object('id','demo-it'||x.n||'-'||x.line,'order_id','demo-o'||x.n,'menu_item_id',x.menu_id,'name_snapshot',x.name,
           'price_snapshot',x.price,'kitchen_id',x.kitchen_id,'qty',x.qty,'note','','status','served','batch',1,
           'origin_table',s.table_id,'origin_seat',s.seat_no,'created_at',o.ts,'updated_at',o.ts + 20 * 60000), o.ts + 20 * 60000, false
  from _ix x join _o o on o.n = x.n join _seat s on s.rn = o.seat_rn
  on conflict (collection, id) do update set data = excluded.data, updated_at = excluded.updated_at, deleted = false;

  insert into records (collection, id, data, updated_at, deleted)
  select 'payments', 'demo-pay' || o.n,
         jsonb_build_object('id','demo-pay'||o.n,'order_id','demo-o'||o.n,'method',o.method,'subtotal',t.sub,
           'discount', case when o.has_disc then round(t.sub * 0.1 / 1000) * 1000 else 0 end,
           'total', t.sub - case when o.has_disc then round(t.sub * 0.1 / 1000) * 1000 else 0 end,
           'state','paid','staff_id',(select id from _staff st where st.rn = o.staff_rn),
           'created_at',o.ts + o.dwell_min * 60000,'paid_at',o.ts + o.dwell_min * 60000),
         o.ts + o.dwell_min * 60000, false
  from _o o join _tot t on t.n = o.n
  on conflict (collection, id) do update set data = excluded.data, updated_at = excluded.updated_at, deleted = false;

  raise notice 'Đã tạo % đơn, % dòng món, % thanh toán mẫu.', (select count(*) from _o), (select count(*) from _ix), (select count(*) from _o);
end
$demo$;

-- Kiểm tra nhanh: số đơn / doanh thu mẫu theo tháng
select to_char(to_timestamp((data->>'paid_at')::bigint / 1000.0) at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM') as thang,
       count(*) as so_don, sum((data->>'total')::bigint) as doanh_thu
from records where collection = 'payments' and id like 'demo-pay%' and not deleted
group by 1 order by 1;
