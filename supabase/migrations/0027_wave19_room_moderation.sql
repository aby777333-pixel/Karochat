-- Karochat — Wave 19: group-call & room moderation.
-- Adds bans (so owners can remove + block) and remove/ban/unban RPCs.
-- Idempotent and additive.

-- ============================================================================
-- 1) room_bans: one row per (room, user) when the user is banned. Used by
--    join_public_room / join_room_by_invite / DM flow to reject banned users
--    on next join attempt. RLS lets room owners + admins read; writes go
--    through ban/unban RPCs.
-- ============================================================================
create table if not exists public.room_bans (
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  banned_by uuid references public.profiles(id) on delete set null,
  reason    text,
  banned_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists room_bans_user_idx on public.room_bans (user_id);

alter table public.room_bans enable row level security;

drop policy if exists "rb_read_room_admins" on public.room_bans;
create policy "rb_read_room_admins" on public.room_bans
  for select to authenticated using (
    exists (
      select 1 from public.rooms r
       where r.id = room_bans.room_id and r.owner_id = auth.uid()
    )
    or exists (
      select 1 from public.room_members rm
       where rm.room_id = room_bans.room_id
         and rm.user_id = auth.uid()
         and rm.role in ('owner','admin','moderator')
    )
    -- the banned user can see their own ban row
    or room_bans.user_id = auth.uid()
  );

-- ============================================================================
-- 2) remove_room_member — owner/admin/moderator removes a user from a room.
--    The target user is also banned from re-joining unless the caller passes
--    p_ban := false.
-- ============================================================================
create or replace function public.remove_room_member(
  p_room_id uuid,
  p_user_id uuid,
  p_ban     boolean default true,
  p_reason  text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user        uuid := auth.uid();
  v_room_owner  uuid;
  v_caller_role text;
  v_target_role text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_user = p_user_id then raise exception 'cannot remove yourself — use leave'; end if;

  select r.owner_id into v_room_owner from public.rooms r where r.id = p_room_id;
  if v_room_owner is null then raise exception 'room not found'; end if;

  select rm.role into v_caller_role
    from public.room_members rm
   where rm.room_id = p_room_id and rm.user_id = v_user;

  if not (v_user = v_room_owner or v_caller_role in ('owner','admin','moderator')) then
    raise exception 'only owners / admins / moderators can remove members';
  end if;

  -- Don't let a moderator remove the owner, or anyone else with equal/higher rank.
  if p_user_id = v_room_owner then
    raise exception 'cannot remove the room owner';
  end if;

  select rm.role into v_target_role
    from public.room_members rm
   where rm.room_id = p_room_id and rm.user_id = p_user_id;

  if v_caller_role = 'moderator' and v_target_role in ('owner','admin','moderator') then
    raise exception 'moderators can only remove plain members';
  end if;

  delete from public.room_members
   where room_id = p_room_id and user_id = p_user_id;

  if p_ban then
    insert into public.room_bans (room_id, user_id, banned_by, reason)
      values (p_room_id, p_user_id, v_user, p_reason)
    on conflict (room_id, user_id) do update
      set banned_by = excluded.banned_by,
          reason    = coalesce(excluded.reason, public.room_bans.reason),
          banned_at = now();
  end if;
end;
$$;
revoke all on function public.remove_room_member(uuid, uuid, boolean, text) from public;
grant execute on function public.remove_room_member(uuid, uuid, boolean, text) to authenticated;

-- ============================================================================
-- 3) unban_room_member — reverse a ban.
-- ============================================================================
create or replace function public.unban_room_member(
  p_room_id uuid,
  p_user_id uuid
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user       uuid := auth.uid();
  v_room_owner uuid;
  v_role       text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select r.owner_id into v_room_owner from public.rooms r where r.id = p_room_id;
  if v_room_owner is null then raise exception 'room not found'; end if;
  select rm.role into v_role
    from public.room_members rm
   where rm.room_id = p_room_id and rm.user_id = v_user;
  if not (v_user = v_room_owner or v_role in ('owner','admin','moderator')) then
    raise exception 'only owners / admins / moderators can unban';
  end if;
  delete from public.room_bans
   where room_id = p_room_id and user_id = p_user_id;
end;
$$;
revoke all on function public.unban_room_member(uuid, uuid) from public;
grant execute on function public.unban_room_member(uuid, uuid) to authenticated;

-- ============================================================================
-- 4) Trigger to keep banned users out of join_public_room / join_room_by_invite.
--    Implemented as a BEFORE INSERT trigger on room_members. Banned rows are
--    rejected with a clear error.
-- ============================================================================
create or replace function public.reject_banned_room_member()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.room_bans rb
     where rb.room_id = new.room_id and rb.user_id = new.user_id
  ) then
    raise exception 'user is banned from this room';
  end if;
  return new;
end;
$$;

drop trigger if exists room_members_reject_banned on public.room_members;
create trigger room_members_reject_banned
  before insert on public.room_members
  for each row execute function public.reject_banned_room_member();
