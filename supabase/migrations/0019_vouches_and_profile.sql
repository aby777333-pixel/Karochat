-- Karochat — v12 Wave 14: vouches + public profile snapshot RPC.
-- Run AFTER 0018_delete_room.sql. Idempotent.

create table if not exists public.vouches (
  id                uuid primary key default gen_random_uuid(),
  voucher_id        uuid not null references public.profiles(id) on delete cascade,
  vouched_id        uuid not null references public.profiles(id) on delete cascade,
  note              text not null check (length(note) between 1 and 240),
  created_at        timestamptz not null default now(),
  revoked_at        timestamptz,
  constraint vouches_no_self check (voucher_id <> vouched_id)
);

create unique index if not exists vouches_pair_idx
  on public.vouches (voucher_id, vouched_id)
  where revoked_at is null;

create index if not exists vouches_vouched_idx
  on public.vouches (vouched_id, created_at desc)
  where revoked_at is null;

alter table public.vouches enable row level security;

drop policy if exists "vouches_read_all" on public.vouches;
create policy "vouches_read_all" on public.vouches
  for select to authenticated using (true);

-- Rate-limit (5 active vouches per month per voucher) is enforced inside
-- give_vouch — date_trunc isn't IMMUTABLE so it can't live in a unique
-- index expression. Active-vouch is also idempotent — re-vouching the same
-- person updates the note.
create or replace function public.give_vouch(p_vouched_id uuid, p_note text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_id          uuid;
  v_count_month int;
  v_clean       text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_vouched_id is null then raise exception 'recipient required'; end if;
  if v_user = p_vouched_id then raise exception 'cannot vouch for yourself'; end if;
  v_clean := nullif(trim(coalesce(p_note, '')), '');
  if v_clean is null then raise exception 'a vouch needs a note'; end if;
  if length(v_clean) > 240 then raise exception 'note too long'; end if;
  if not exists (select 1 from public.profiles where id = p_vouched_id) then
    raise exception 'user not found';
  end if;

  select id into v_id from public.vouches
   where voucher_id = v_user and vouched_id = p_vouched_id and revoked_at is null;
  if v_id is not null then
    update public.vouches set note = v_clean where id = v_id;
    return v_id;
  end if;

  select count(*) into v_count_month from public.vouches
   where voucher_id = v_user
     and revoked_at is null
     and created_at >= date_trunc('month', now());
  if v_count_month >= 5 then
    raise exception 'you''ve given 5 vouches this month — keep them meaningful';
  end if;

  v_id := gen_random_uuid();
  insert into public.vouches (id, voucher_id, vouched_id, note)
       values (v_id, v_user, p_vouched_id, v_clean);
  return v_id;
end;
$$;

revoke all on function public.give_vouch(uuid, text) from public;
grant execute on function public.give_vouch(uuid, text) to authenticated;

create or replace function public.revoke_vouch(p_vouched_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  update public.vouches
     set revoked_at = now()
   where voucher_id = v_user
     and vouched_id = p_vouched_id
     and revoked_at is null;
end;
$$;

revoke all on function public.revoke_vouch(uuid) from public;
grant execute on function public.revoke_vouch(uuid) to authenticated;

drop view if exists public.vouches_received_view;
create view public.vouches_received_view as
select
  v.id,
  v.vouched_id,
  v.voucher_id,
  v.note,
  v.created_at,
  p.username       as voucher_username,
  p.display_name   as voucher_display_name,
  p.is_guest       as voucher_is_guest,
  p.presence_state as voucher_presence_state
from public.vouches v
left join public.profiles p on p.id = v.voucher_id
where v.revoked_at is null
order by v.created_at desc;

grant select on public.vouches_received_view to anon, authenticated;

-- Public profile snapshot — anon-readable (used by /u/[handle]).
create or replace function public.get_public_profile(p_username text)
returns table (
  id                  uuid,
  username            text,
  display_name        text,
  is_guest            boolean,
  presence_state      text,
  status_text         text,
  status_emoji        text,
  mood                text,
  mood_expires_at     timestamptz,
  traveling_in_city   text,
  traveling_until     timestamptz,
  created_at          timestamptz,
  vibe_kindness       int,
  vibe_realness       int,
  vibe_quality        int,
  vouch_count         int
)
language sql security definer set search_path = public stable
as $$
  select
    p.id,
    p.username,
    p.display_name,
    p.is_guest,
    p.presence_state,
    p.status_text,
    p.status_emoji,
    p.mood,
    p.mood_expires_at,
    p.traveling_in_city,
    p.traveling_until,
    p.created_at,
    coalesce((select count(*)::int from public.vibes v
               where v.ratee_profile_id = p.id and v.dimension = 'kindness'), 0),
    coalesce((select count(*)::int from public.vibes v
               where v.ratee_profile_id = p.id and v.dimension = 'realness'), 0),
    coalesce((select count(*)::int from public.vibes v
               where v.ratee_profile_id = p.id and v.dimension = 'quality'), 0),
    coalesce((select count(*)::int from public.vouches vv
               where vv.vouched_id = p.id and vv.revoked_at is null), 0)
  from public.profiles p
  where lower(p.username) = lower(trim(p_username))
  limit 1;
$$;

revoke all on function public.get_public_profile(text) from public;
grant execute on function public.get_public_profile(text) to anon, authenticated;
