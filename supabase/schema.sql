-- Hũ Chi Tiêu: dán toàn bộ file này vào Supabase → SQL Editor → Run
-- Tất cả bảng có tiền tố hct_ để dùng chung project với app khác mà không đụng nhau.

create table if not exists public.hct_transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  note text not null default '',
  cat text not null,
  amount bigint not null check (amount > 0),
  wallet text not null default 'cash',
  who text not null default 'me',
  draft boolean not null default false,
  recurring_id uuid,
  ts bigint,
  created_at timestamptz not null default now()
);
create index if not exists hct_transactions_user_date on public.hct_transactions (user_id, date);

create table if not exists public.hct_recurring (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  note text not null,
  cat text not null,
  amount bigint not null,
  wallet text not null default 'ck',
  who text not null default 'me',
  day int not null check (day between 1 and 31),
  last_month text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.hct_jars (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  icon text,
  target bigint not null default 0,
  saved bigint not null default 0,
  deadline date,
  ts bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.hct_debts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  person text not null,
  amount bigint not null,
  kind text not null check (kind in ('lend','borrow')),
  due date,
  paid boolean not null default false,
  note text default '',
  ts bigint,
  created_at timestamptz not null default now()
);

create table if not exists public.hct_settings (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Chỉ chủ tài khoản đọc/ghi được dữ liệu của mình
do $$
declare t text;
begin
  foreach t in array array['hct_transactions','hct_recurring','hct_jars','hct_debts','hct_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "hct own rows" on public.%I', t);
    execute format('create policy "hct own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Nâng cấp từ bản cũ (chạy lại an toàn): thêm trường 'chi cho ai'
alter table public.hct_transactions add column if not exists who text not null default 'me';
alter table public.hct_recurring add column if not exists who text not null default 'me';
