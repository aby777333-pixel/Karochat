-- Karochat — User-Created Groups: the gaps on top of the existing Rooms system.
-- Rooms already provide public/private, owner/admin/moderator/member roles,
-- ban/mute/kick, invites, chat/calls/files/pins/polls/reactions/rules/search.
-- This adds the missing bits: group avatar/banner, request-to-join for public
-- groups, and ownership transfer. ADDITIVE + backward-compatible:
-- join_policy defaults to 'open', so every existing room behaves exactly as
-- before (auto-join). Idempotent.

alter table public.rooms add column if not exists avatar_url  text;
alter table public.rooms add column if not exists banner_url  text;
alter table public.rooms add column if not exists join_policy text not null default 'open'
  check (join_policy in ('open','request'));

-- is_room_admin — owner/admin/moderator of a room (SECURITY DEFINER so it can
-- gate request RLS/RPCs without RLS recursion).
create or replace function public.is_room_admin(p_room_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
      and m.role in ('owner','admin','moderator')
  );
$$;
grant execute on function public.is_room_admin(uuid) to authenticated;

-- =====================================================================
-- Join requests (only used when a room sets join_policy='request')
-- =====================================================================
create table if not exists public.room_join_requests (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz,
  decided_by   uuid references public.profiles(id) on delete set null,
  unique (room_id, requester_id)
);
create index if not exists room_join_requests_room_idx on public.room_join_requests(room_id, status);
alter table public.room_join_requests enable row level security;

drop policy if exists "rjr_read" on public.room_join_requests;
create policy "rjr_read" on public.room_join_requests
  for select to authenticated
  using (requester_id = auth.uid() or public.is_room_admin(room_id));
drop policy if exists "rjr_insert_self" on public.room_join_requests;
create policy "rjr_insert_self" on public.room_join_requests
  for insert to authenticated with check (requester_id = auth.uid());
drop policy if exists "rjr_admin_update" on public.room_join_requests;
create policy "rjr_admin_update" on public.room_join_requests
  for update to authenticated using (public.is_room_admin(room_id));
grant select, insert, update on public.room_join_requests to authenticated;

-- =====================================================================
-- join_public_room v2 — preserves existing behaviour for open rooms and for
-- current members/owners; for request-policy rooms it files (or refreshes) a
-- pending request instead of joining.
-- =====================================================================
create or replace function public.join_public_room(p_room_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $function$
declare
  v_user   uuid := auth.uid();
  v_vis    text;
  v_policy text;
  v_owner  uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_user and is_guest)
     and p_room_id <> '00000000-0000-0000-0000-00000000aaaa' then
    raise exception 'Guests can only access the Lobby. Add your email and phone for full access.';
  end if;
  select visibility, coalesce(join_policy, 'open'), owner_id
    into v_vis, v_policy, v_owner
    from public.rooms where id = p_room_id;
  if v_vis is null then raise exception 'room not found'; end if;
  if v_vis not in ('public','listed') then
    raise exception 'this room is private — use an invite code';
  end if;

  -- Owner or existing member → ensure membership and return (unchanged).
  if v_user = v_owner
     or exists (select 1 from public.room_members where room_id = p_room_id and user_id = v_user) then
    insert into public.room_members (room_id, user_id, role)
      values (p_room_id, v_user, 'member') on conflict do nothing;
    return p_room_id;
  end if;

  -- Request-to-join group → file/refresh a pending request, do NOT join.
  if v_policy = 'request' then
    insert into public.room_join_requests (room_id, requester_id, status)
      values (p_room_id, v_user, 'pending')
      on conflict (room_id, requester_id)
      do update set status = 'pending', created_at = now(), decided_at = null, decided_by = null;
    return p_room_id;
  end if;

  -- Open public room → join (unchanged default behaviour).
  insert into public.room_members (room_id, user_id, role)
    values (p_room_id, v_user, 'member') on conflict do nothing;
  return p_room_id;
end;
$function$;

-- =====================================================================
-- Admin decisions + listing
-- =====================================================================
create or replace function public.approve_join_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r public.room_join_requests%rowtype;
begin
  select * into r from public.room_join_requests where id = p_request_id;
  if r.id is null then raise exception 'Request not found'; end if;
  if not public.is_room_admin(r.room_id) then raise exception 'Not allowed'; end if;
  insert into public.room_members (room_id, user_id, role)
    values (r.room_id, r.requester_id, 'member') on conflict do nothing;
  update public.room_join_requests
    set status = 'approved', decided_at = now(), decided_by = auth.uid()
    where id = p_request_id;
end;
$$;
grant execute on function public.approve_join_request(uuid) to authenticated;

create or replace function public.reject_join_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare r public.room_join_requests%rowtype;
begin
  select * into r from public.room_join_requests where id = p_request_id;
  if r.id is null then raise exception 'Request not found'; end if;
  if not public.is_room_admin(r.room_id) then raise exception 'Not allowed'; end if;
  update public.room_join_requests
    set status = 'rejected', decided_at = now(), decided_by = auth.uid()
    where id = p_request_id;
end;
$$;
grant execute on function public.reject_join_request(uuid) to authenticated;

create or replace function public.list_join_requests(p_room_id uuid)
returns table(
  request_id   uuid,
  requester_id uuid,
  username     text,
  display_name text,
  avatar_url   text,
  created_at   timestamptz
)
language sql security definer stable set search_path = public as $$
  select jr.id, jr.requester_id, p.username, p.display_name, p.avatar_url, jr.created_at
  from public.room_join_requests jr
  join public.profiles p on p.id = jr.requester_id
  where jr.room_id = p_room_id and jr.status = 'pending'
    and public.is_room_admin(p_room_id)
  order by jr.created_at asc;
$$;
grant execute on function public.list_join_requests(uuid) to authenticated;

-- =====================================================================
-- Ownership transfer (owner only; new owner must already be a member)
-- =====================================================================
create or replace function public.transfer_room_ownership(p_room_id uuid, p_new_owner uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.rooms where id = p_room_id and owner_id = auth.uid()) then
    raise exception 'Only the owner can transfer ownership.';
  end if;
  if p_new_owner = auth.uid() then return; end if;
  if not exists (select 1 from public.room_members where room_id = p_room_id and user_id = p_new_owner) then
    raise exception 'The new owner must be a member of the group.';
  end if;
  update public.rooms set owner_id = p_new_owner where id = p_room_id;
  update public.room_members set role = 'admin' where room_id = p_room_id and user_id = auth.uid();
  update public.room_members set role = 'owner' where room_id = p_room_id and user_id = p_new_owner;
end;
$$;
grant execute on function public.transfer_room_ownership(uuid, uuid) to authenticated;
