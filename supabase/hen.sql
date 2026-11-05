-- Hũ Chi Tiêu: Hẹn ăn nhóm
-- Dán toàn bộ file này vào Supabase → SQL Editor → Run (chạy lại nhiều lần vẫn an toàn).
-- Bạn bè mở link không cần tài khoản: họ chỉ gọi được 2 hàm hct_meet_get / hct_meet_vote
-- và phải biết mã bí mật trong link. Bảng không mở cho người lạ đọc trực tiếp.

create table if not exists public.hct_meetups (
  id uuid primary key default gen_random_uuid(),
  token text unique not null check (length(token) >= 16),
  owner uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null default 'Họp mặt ăn uống',
  week_start date not null,
  note text not null default '',
  place text not null default '',
  foods jsonb not null default '[]'::jsonb,
  chosen text,
  chosen_food text,
  created_at timestamptz not null default now()
);

create table if not exists public.hct_meetup_votes (
  id uuid primary key default gen_random_uuid(),
  meetup_id uuid not null references public.hct_meetups(id) on delete cascade,
  name text not null,
  key text not null,
  slots text[] not null default '{}',
  foods text[] not null default '{}',
  note text not null default '',
  updated_at timestamptz not null default now()
);
create unique index if not exists hct_meetup_votes_name on public.hct_meetup_votes (meetup_id, lower(name));

alter table public.hct_meetups enable row level security;
alter table public.hct_meetup_votes enable row level security;
drop policy if exists "hct owner meetups" on public.hct_meetups;
create policy "hct owner meetups" on public.hct_meetups for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "hct owner votes" on public.hct_meetup_votes;
create policy "hct owner votes" on public.hct_meetup_votes for all to authenticated
  using (exists (select 1 from public.hct_meetups m where m.id = meetup_id and m.owner = auth.uid()))
  with check (exists (select 1 from public.hct_meetups m where m.id = meetup_id and m.owner = auth.uid()));

-- Xem một buổi hẹn theo mã trong link
create or replace function public.hct_meet_get(p_token text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', m.id, 'title', m.title, 'week_start', m.week_start, 'note', m.note, 'place', m.place,
    'foods', m.foods, 'chosen', m.chosen, 'chosen_food', m.chosen_food,
    'is_owner', coalesce(m.owner = auth.uid(), false),
    'votes', coalesce((select json_agg(json_build_object('name', v.name, 'slots', v.slots, 'foods', v.foods,
                'note', v.note, 'updated_at', v.updated_at) order by v.updated_at)
              from public.hct_meetup_votes v where v.meetup_id = m.id), '[]'::json))
  from public.hct_meetups m where m.token = p_token;
$$;

-- Ghi lịch rảnh + món muốn ăn. Mỗi trình duyệt có một khoá riêng nên người khác không sửa được tên của bạn.
create or replace function public.hct_meet_vote(p_token text, p_name text, p_key text,
  p_slots text[], p_foods text[], p_note text)
returns json language plpgsql security definer set search_path = public as $$
declare m public.hct_meetups; v public.hct_meetup_votes; n text := left(btrim(coalesce(p_name, '')), 40);
begin
  select * into m from public.hct_meetups where token = p_token;
  if not found then raise exception 'Không tìm thấy buổi hẹn'; end if;
  if n = '' then raise exception 'Cần nhập tên'; end if;
  if length(coalesce(p_key, '')) < 16 then raise exception 'Thiếu khoá trình duyệt'; end if;
  select * into v from public.hct_meetup_votes where meetup_id = m.id and lower(name) = lower(n);
  if found then
    if v.key <> p_key and m.owner is distinct from auth.uid() then
      raise exception 'Tên này đã có người dùng, hãy đổi tên khác';
    end if;
    update public.hct_meetup_votes
      set slots = coalesce(p_slots[1:40], '{}'), foods = coalesce(p_foods[1:12], '{}'),
          note = left(coalesce(p_note, ''), 120), updated_at = now()
      where id = v.id;
  else
    if (select count(*) from public.hct_meetup_votes where meetup_id = m.id) >= 60 then
      raise exception 'Buổi hẹn đã đủ 60 người';
    end if;
    insert into public.hct_meetup_votes (meetup_id, name, key, slots, foods, note)
      values (m.id, n, p_key, coalesce(p_slots[1:40], '{}'), coalesce(p_foods[1:12], '{}'), left(coalesce(p_note, ''), 120));
  end if;
  return public.hct_meet_get(p_token);
end $$;

revoke all on function public.hct_meet_get(text) from public;
revoke all on function public.hct_meet_vote(text, text, text, text[], text[], text) from public;
grant execute on function public.hct_meet_get(text) to anon, authenticated;
grant execute on function public.hct_meet_vote(text, text, text, text[], text[], text) to anon, authenticated;
