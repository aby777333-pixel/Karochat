-- Karochat — v7 Wave 1: intent flags on messages + Saved (self) rooms
-- Run AFTER 0007_dm_and_invites.sql. Idempotent.

alter table public.messages
  add column if not exists intent text;

alter table public.rooms
  add column if not exists is_saved boolean not null default false;

-- Keep lobby clean: hide DMs and Saved rooms.
drop view if exists public.rooms_browse;
create view public.rooms_browse as
select
  r.id,
  r.name,
  r.description,
  r.visibility,
  r.is_public,
  r.category,
  r.tags,
  r.allow_anonymous,
  r.owner_id,
  r.created_at,
  (select count(*) from public.room_members rm where rm.room_id = r.id) as member_count
from public.rooms r
where r.visibility in ('public','listed')
  and r.is_dm    = false
  and r.is_saved = false;

grant select on public.rooms_browse to authenticated;

-- Saved rooms are personal — never invitable.
create or replace function public.my_invitable_rooms_for(p_target_user_id uuid)
returns table (id uuid, name text, visibility text)
language sql security definer set search_path = public
as $$
  select r.id, r.name, r.visibility
    from public.rooms r
   where r.owner_id = auth.uid()
     and r.is_dm    = false
     and r.is_saved = false
     and not exists (
       select 1 from public.room_members rm
        where rm.room_id = r.id
          and rm.user_id = p_target_user_id
     )
   order by r.created_at desc;
$$;

revoke all on function public.my_invitable_rooms_for(uuid) from public;
grant execute on function public.my_invitable_rooms_for(uuid) to authenticated;

-- get_or_create_saved_room: per-user, single-member "Saved" room
create or replace function public.get_or_create_saved_room()
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id   uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select id into v_id from public.rooms
   where is_saved = true and owner_id = v_user
   limit 1;

  if v_id is not null then
    insert into public.room_members (room_id, user_id, role)
      values (v_id, v_user, 'owner') on conflict do nothing;
    return v_id;
  end if;

  v_id := gen_random_uuid();
  insert into public.rooms (id, name, description, visibility, owner_id, is_saved)
       values (v_id, 'Saved', 'Your private notes & saved messages.', 'secret', v_user, true);

  insert into public.room_members (room_id, user_id, role)
    values (v_id, v_user, 'owner');

  return v_id;
end;
$$;

revoke all on function public.get_or_create_saved_room() from public;
grant execute on function public.get_or_create_saved_room() to authenticated;

-- Extend messages_with_sender to surface the new `intent` column.
drop view if exists public.messages_with_sender;
create view public.messages_with_sender as
select
  m.id,
  m.room_id,
  m.sender_id,
  m.type,
  m.content,
  m.image_url,
  m.reply_to_id,
  m.edited_at,
  m.deleted_at,
  m.reactions,
  m.intent,
  m.created_at,
  p.username       as sender_username,
  p.display_name   as sender_display_name,
  p.is_guest       as sender_is_guest,
  p.presence_state as sender_presence_state
from public.messages m
left join public.profiles p on p.id = m.sender_id;

grant select on public.messages_with_sender to authenticated;
