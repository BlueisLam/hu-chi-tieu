-- Hũ Chi Tiêu: dán toàn bộ file này vào Supabase → SQL Editor → Run

create table if not exists public.transactions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  date date not null,
  note text not null default '',
  cat text not null,
  amount bigint not null check (amount > 0),
  wallet text not null default 'cash',
  draft boolean not null default false,
  recurring_id uuid,
  ts bigint,
  created_at timestamptz not null default now()
);
create index if not exists transactions_user_date on public.transactions (user_id, date);

create table if not exists public.recurring (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  note text not null,
  cat text not null,
  amount bigint not null,
  wallet text not null default 'ck',
  day int not null check (day between 1 and 31),
  last_month text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.jars (
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

create table if not exists public.debts (
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

create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Chỉ chủ tài khoản đọc/ghi được dữ liệu của mình
do $$
declare t text;
begin
  foreach t in array array['transactions','recurring','jars','debts','settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;
