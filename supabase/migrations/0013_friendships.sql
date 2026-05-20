-- Karochat — v10 Wave 6: friendships (buddy list).
-- Yahoo-Messenger-style: positive-only, per-direction pending requests,
-- categorized groups. Run AFTER 0012_search_rooms.sql. Idempotent.

create table if not exists public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles(id) on delete cascade,
  recipient_id  uuid not null references public.profiles(id) on delete cascade,
  status        text not null check (status in ('pending','accepted')),
  group_label   text not null default 'Friends',
  created_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  constraint friendships_no_self check (requester_id <> recipient_id)
);

-- One pending/accepted row per direction. If two users both send a
-- request to each other, the second call auto-accepts the existing row
-- inside request_friend() rather than creating a duplicate.
create unique index if not exists friendships_dir_idx
  on public.friendships (requester_id, recipient_id);

create index if not exists friendships_requester_status_idx
  on public.friendships (requester_id, status);

create index if not exists friendships_recipient_status_idx
  on public.friendships (recipient_id, status);

alter table public.friendships enable row level security;

drop policy if exists "friendships_read_involved" on public.friendships;
create policy "friendships_read_involved" on public.friendships
  for select to authenticated using (
    requester_id = auth.uid() or recipient_id = auth.uid()
  );

-- All writes go through SECURITY DEFINER RPCs.

-- ============================================================================
-- request_friend: idempotent; if the other direction already has a pending
-- row, this call accepts it (mutual-want-shortcut). If accepted already,
-- returns 'accepted'. If pending in this direction already, returns 'pending'.
-- ============================================================================
create or replace function public.request_friend(p_target_user_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_other uuid := p_target_user_id;
  v_row   public.friendships%rowtype;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_other is null then raise exception 'target required'; end if;
  if v_user = v_other then raise exception 'cannot friend yourself'; end if;
  if not exists (select 1 from public.profiles where id = v_other) then
    raise exception 'user not found';
  end if;

  -- Already friends? Idempotent.
  select * into v_row from public.friendships
   where status = 'accepted'
     and ((requester_id = v_user and recipient_id = v_other)
       or (requester_id = v_other and recipient_id = v_user));
  if found then return 'accepted'; end if;

  -- Already sent in this direction? Idempotent.
  select * into v_row from public.friendships
   where requester_id = v_user and recipient_id = v_other and status = 'pending';
  if found then return 'pending'; end if;

  -- Other side already pinged us? Auto-accept.
  select * into v_row from public.friendships
   where requester_id = v_other and recipient_id = v_user and status = 'pending';
  if found then
    update public.friendships
       set status = 'accepted', accepted_at = now()
     where id = v_row.id;
    return 'accepted';
  end if;

  insert into public.friendships (requester_id, recipient_id, status)
       values (v_user, v_other, 'pending');
  return 'pending';
end;
$$;

revoke all on function public.request_friend(uuid) from public;
grant execute on function public.request_friend(uuid) to authenticated;

-- ============================================================================
-- accept_friend: caller is the recipient of a pending request.
-- ============================================================================
create or replace function public.accept_friend(p_requester_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  update public.friendships
     set status = 'accepted', accepted_at = now()
   where requester_id = p_requester_user_id
     and recipient_id = v_user
     and status       = 'pending';
end;
$$;

revoke all on function public.accept_friend(uuid) from public;
grant execute on function public.accept_friend(uuid) to authenticated;

-- ============================================================================
-- decline_friend: caller is the recipient; deletes the pending row.
-- ============================================================================
create or replace function public.decline_friend(p_requester_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  delete from public.friendships
   where requester_id = p_requester_user_id
     and recipient_id = v_user
     and status       = 'pending';
end;
$$;

revoke all on function public.decline_friend(uuid) from public;
grant execute on function public.decline_friend(uuid) to authenticated;

-- ============================================================================
-- remove_friend: either side can drop the friendship.
-- Also cancels a pending request you sent.
-- ============================================================================
create or replace function public.remove_friend(p_other_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  delete from public.friendships
   where ((requester_id = v_user and recipient_id = p_other_user_id)
       or (requester_id = p_other_user_id and recipient_id = v_user));
end;
$$;

revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ============================================================================
-- set_friend_group: caller renames their side's group label for that friend.
-- ============================================================================
create or replace function public.set_friend_group(
  p_other_user_id uuid,
  p_group_label   text
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_label text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  v_label := coalesce(nullif(trim(p_group_label), ''), 'Friends');
  if length(v_label) > 40 then raise exception 'group label too long'; end if;
  update public.friendships
     set group_label = v_label
   where status = 'accepted'
     and ((requester_id = v_user and recipient_id = p_other_user_id)
       or (requester_id = p_other_user_id and recipient_id = v_user));
end;
$$;

revoke all on function public.set_friend_group(uuid, text) from public;
grant execute on function public.set_friend_group(uuid, text) to authenticated;

-- ============================================================================
-- my_friends_view: accepted friendships flattened to one row per friend,
-- joined with their profile + presence.
-- ============================================================================
drop view if exists public.my_friends_view;
create view public.my_friends_view as
select
  case when f.requester_id = auth.uid() then f.recipient_id else f.requester_id end
                                                       as friend_id,
  case when f.requester_id = auth.uid() then p_rec.username
       else p_req.username end                          as username,
  case when f.requester_id = auth.uid() then p_rec.display_name
       else p_req.display_name end                      as display_name,
  case when f.requester_id = auth.uid() then p_rec.is_guest
       else p_req.is_guest end                          as is_guest,
  case when f.requester_id = auth.uid() then p_rec.presence_state
       else p_req.presence_state end                    as presence_state,
  case when f.requester_id = auth.uid() then p_rec.status_text
       else p_req.status_text end                       as status_text,
  case when f.requester_id = auth.uid() then p_rec.status_emoji
       else p_req.status_emoji end                      as status_emoji,
  case when f.requester_id = auth.uid() then p_rec.mood
       else p_req.mood end                              as mood,
  case when f.requester_id = auth.uid() then p_rec.mood_expires_at
       else p_req.mood_expires_at end                   as mood_expires_at,
  f.group_label,
  coalesce(f.accepted_at, f.created_at)                 as since
from public.friendships f
left join public.profiles p_req on p_req.id = f.requester_id
left join public.profiles p_rec on p_rec.id = f.recipient_id
where f.status = 'accepted'
  and (f.requester_id = auth.uid() or f.recipient_id = auth.uid());

grant select on public.my_friends_view to authenticated;

-- ============================================================================
-- my_friend_requests_view: pending requests INCOMING to the caller.
-- ============================================================================
drop view if exists public.my_friend_requests_view;
create view public.my_friend_requests_view as
select
  f.requester_id,
  p.username,
  p.display_name,
  p.is_guest,
  p.presence_state,
  f.created_at
from public.friendships f
left join public.profiles p on p.id = f.requester_id
where f.status = 'pending'
  and f.recipient_id = auth.uid();

grant select on public.my_friend_requests_view to authenticated;

-- ============================================================================
-- friendship_status: helper for UI — what's the state between caller and
-- target? Returns 'none' | 'pending_out' | 'pending_in' | 'friends'.
-- ============================================================================
create or replace function public.friendship_status(p_other_user_id uuid)
returns text
language plpgsql security definer set search_path = public stable
as $$
declare
  v_user uuid := auth.uid();
  v_row  public.friendships%rowtype;
begin
  if v_user is null then return 'none'; end if;
  if v_user = p_other_user_id then return 'self'; end if;
  select * into v_row from public.friendships
   where ((requester_id = v_user and recipient_id = p_other_user_id)
       or (requester_id = p_other_user_id and recipient_id = v_user))
   limit 1;
  if not found then return 'none'; end if;
  if v_row.status = 'accepted' then return 'friends'; end if;
  if v_row.requester_id = v_user then return 'pending_out'; end if;
  return 'pending_in';
end;
$$;

revoke all on function public.friendship_status(uuid) from public;
grant execute on function public.friendship_status(uuid) to authenticated;
