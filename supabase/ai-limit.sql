-- Hũ Chi Tiêu: giới hạn số lượt hỏi AI mỗi người mỗi ngày
-- Dán vào Supabase → SQL Editor → Run (chạy lại nhiều lần vẫn an toàn).
-- Bảng không có policy nào nên người dùng không tự sửa được số đếm; chỉ hàm hct_ai_take được ghi.

create table if not exists public.hct_ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  n int not null default 0,
  primary key (user_id, day)
);
alter table public.hct_ai_usage enable row level security;

create or replace function public.hct_ai_take(p_limit int default 20)
returns json language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d date := (now() at time zone 'Asia/Ho_Chi_Minh')::date; lim int := least(greatest(coalesce(p_limit, 20), 1), 500); cur int;
begin
  if uid is null then raise exception 'Cần đăng nhập'; end if;
  insert into public.hct_ai_usage (user_id, day, n) values (uid, d, 0) on conflict do nothing;
  select n into cur from public.hct_ai_usage where user_id = uid and day = d for update;
  if cur >= lim then return json_build_object('ok', false, 'used', cur, 'limit', lim); end if;
  update public.hct_ai_usage set n = n + 1 where user_id = uid and day = d;
  return json_build_object('ok', true, 'used', cur + 1, 'limit', lim);
end $$;

revoke all on function public.hct_ai_take(int) from public;
grant execute on function public.hct_ai_take(int) to authenticated;
