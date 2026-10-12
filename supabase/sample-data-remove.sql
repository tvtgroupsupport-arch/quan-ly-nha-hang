-- Xoá bộ dữ liệu mẫu 1 năm (supabase/sample-data-1year.sql): đánh dấu xoá mọi dòng có id 'demo-…' để các máy đang liên kết cũng xoá theo.
-- Chạy trong SQL Editor của project kho dữ liệu của quán. Không đụng dữ liệu thật.
update public.records set deleted = true, updated_at = (extract(epoch from now()) * 1000)::bigint
where id like 'demo-%' and not deleted;
select count(*) as da_danh_dau_xoa from public.records where id like 'demo-%' and deleted;
