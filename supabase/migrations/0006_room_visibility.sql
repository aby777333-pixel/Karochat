-- Karochat — v5: expand rooms.is_public into a four-level visibility model.
--   public  : in lobby, anyone can join
--   listed  : in lobby, lock icon, request-to-join (request flow in 0007)
--   unlisted: not in lobby, joinable via invite code
--   secret  : not in lobby, joinable only via in-app invite to a profile id
-- Also adds category, tags, allow_anonymous on rooms. Backwards-compatible:
-- is_public stays as a generated column mirroring (visibility = 'public') so
-- old code still works. Run AFTER 0005_fix_rls_recursion.sql. Idempotent.

drop view if exists public.rooms_browse;
drop policy if exists "rooms_read_public_or_member" on public.rooms;

alter table public.rooms
  add column if not exists visibility       text,
  add column if not exists category         text,
  add column if not exists tags             text[] not null default '{}'::text[],
  add column if not exists allow_anonymous  boolean not null default true;

update public.rooms
   set visibility = case when is_public then 'public' else 'unlisted' end
 where visibility is null;

alter table public.rooms drop constraint if exists rooms_visibility_check;
alter table public.rooms
  add constraint rooms_visibility_check
  check (visibility in ('public','listed','unlisted','secret'));

alter table public.rooms alter column visibility set not null;
alter table public.rooms alter column visibility set default 'public';

alter table public.rooms drop column if exists is_public;
alter table public.rooms
  add column is_public boolean
  generated always as (visibility = 'public') stored;

create index if not exists rooms_visibility_idx
  on public.rooms (visibility, created_at desc)
  where visibility in ('public','listed');

create index if not exists rooms_category_idx
  on public.rooms (category)
  where category is not null;

drop policy if exists "rooms_read_visible" on public.rooms;
create policy "rooms_read_visible" on public.rooms
  for select to authenticated using (
    visibility in ('public','listed')
    or public.is_room_member(id, auth.uid())
  );

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
where r.visibility in ('public','listed');

grant select on public.rooms_browse to authenticated;

drop function if exists public.create_room(text, text, boolean);
create or replace function public.create_room(
  p_name        text,
  p_description text,
  p_visibility  text default 'public',
  p_category    text default null,
  p_tags        text[] default '{}'::text[]
) returns table (id uuid, invite_code text, visibility text)
language plpgsql security definer set search_path = public
as $$
declare
  v_id   uuid := gen_random_uuid();
  v_code text;
  v_user uuid := auth.uid();
  v_vis  text := coalesce(nullif(trim(p_visibility), ''), 'public');
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if length(coalesce(trim(p_name), '')) = 0 then raise exception 'name required'; end if;
  if v_vis not in ('public','listed','unlisted','secret') then
    raise exception 'invalid visibility';
  end if;

  if v_vis in ('unlisted','secret') then
    loop
      v_code := upper(
        regexp_replace(encode(gen_random_bytes(8), 'base64'), '[^A-Za-z0-9]', '', 'g')
      );
      v_code := substr(v_code, 1, 8);
      exit when length(v_code) = 8
        and not exists (select 1 from public.rooms where invite_code = v_code);
    end loop;
  end if;

  insert into public.rooms (id, name, description, visibility, invite_code,
                            owner_id, category, tags)
       values (v_id, trim(p_name),
               nullif(trim(coalesce(p_description, '')), ''),
               v_vis, v_code, v_user,
               nullif(trim(coalesce(p_category, '')), ''),
               coalesce(p_tags, '{}'::text[]));

  insert into public.room_members (room_id, user_id, role)
    values (v_id, v_user, 'owner');

  return query select v_id, v_code, v_vis;
end;
$$;

revoke all on function public.create_room(text, text, text, text, text[]) from public;
grant execute on function public.create_room(text, text, text, text, text[]) to authenticated;

create or replace function public.join_public_room(p_room_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_vis  text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select visibility into v_vis from public.rooms where id = p_room_id;
  if v_vis is null then raise exception 'room not found'; end if;
  if v_vis <> 'public' then
    raise exception 'this room is not publicly joinable — use an invite or request access';
  end if;

  insert into public.room_members (room_id, user_id, role)
    values (p_room_id, v_user, 'member')
    on conflict do nothing;
  return p_room_id;
end;
$$;
