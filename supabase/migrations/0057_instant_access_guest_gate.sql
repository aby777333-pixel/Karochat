-- Karochat — Wave 22: instant email+phone access + guests limited to the Lobby.
-- * profiles.contact_email / contact_phone
-- * register_contact(email, phone, display?) — instant upgrade to full access
--   (sets is_guest=false), no verification/magic link required.
-- * join_public_room / join_room_by_invite — block guests from any room except
--   the Lobby (backstop; the UI also gates and shows a message).
-- Idempotent & additive. Existing email users (is_guest=false) keep full access.

alter table public.profiles
  add column if not exists contact_email text,
  add column if not exists contact_phone text;

-- ---------------------------------------------------------------------------
-- register_contact — called right after an (anonymous) session is created, or
-- by a guest upgrading in place. Stores contact details, flips the account to
-- full access, and gives guest_* handles a friendlier username/display name.
-- ---------------------------------------------------------------------------
create or replace function public.register_contact(
  p_email text,
  p_phone text,
  p_display_name text default null
)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone, ''));
  v_cur   text;
  v_base  text;
  v_new   text;
  v_i     int := 0;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'a valid email is required';
  end if;
  if length(regexp_replace(v_phone, '\D', '', 'g')) < 7 then
    raise exception 'a valid phone number is required';
  end if;

  select username into v_cur from public.profiles where id = v_user;

  -- Give auto-generated guest handles a nicer username derived from the email.
  if v_cur is null or v_cur like 'guest\_%' then
    v_base := regexp_replace(split_part(v_email, '@', 1), '[^a-z0-9_]', '', 'g');
    if length(v_base) < 3 then v_base := 'karo' || v_base; end if;
    v_base := left(v_base, 18);
    v_new := v_base;
    while exists (select 1 from public.profiles where username = v_new and id <> v_user) loop
      v_i := v_i + 1;
      v_new := left(v_base, 14) || v_i::text;
      if v_i > 9999 then
        v_new := left(v_base, 12) || substr(replace(v_user::text, '-', ''), 1, 6);
        exit;
      end if;
    end loop;
  else
    v_new := v_cur;
  end if;

  update public.profiles
     set is_guest      = false,
         contact_email = v_email,
         contact_phone = v_phone,
         username      = v_new,
         display_name  = coalesce(
           nullif(trim(coalesce(p_display_name, '')), ''),
           case
             when display_name is null or display_name like 'Guest %'
               then initcap(regexp_replace(split_part(v_email, '@', 1), '[^a-zA-Z0-9]', ' ', 'g'))
             else display_name
           end
         )
   where id = v_user;
end;
$$;

revoke all on function public.register_contact(text, text, text) from public;
grant execute on function public.register_contact(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Guests → Lobby only. Re-create the join RPCs with a guest gate.
-- ---------------------------------------------------------------------------
create or replace function public.join_public_room(p_room_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_vis  text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_user and is_guest)
     and p_room_id <> '00000000-0000-0000-0000-00000000aaaa' then
    raise exception 'Guests can only access the Lobby. Add your email and phone for full access.';
  end if;
  select visibility into v_vis from public.rooms where id = p_room_id;
  if v_vis is null then raise exception 'room not found'; end if;
  if v_vis not in ('public','listed') then
    raise exception 'this room is private — use an invite code';
  end if;
  insert into public.room_members (room_id, user_id, role)
    values (p_room_id, v_user, 'member')
    on conflict do nothing;
  return p_room_id;
end;
$function$;

create or replace function public.join_room_by_invite(p_code text)
returns uuid
language plpgsql security definer set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_room uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_code is null or length(trim(p_code)) = 0 then
    raise exception 'invite code required';
  end if;
  select id into v_room
    from public.rooms
    where invite_code = upper(trim(p_code));
  if v_room is null then raise exception 'invalid invite code'; end if;
  if exists (select 1 from public.profiles where id = v_user and is_guest)
     and v_room <> '00000000-0000-0000-0000-00000000aaaa' then
    raise exception 'Guests can only access the Lobby. Add your email and phone for full access.';
  end if;
  insert into public.room_members (room_id, user_id, role)
    values (v_room, v_user, 'member')
    on conflict do nothing;
  return v_room;
end;
$function$;
