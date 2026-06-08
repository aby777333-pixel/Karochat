-- Karochat — Wave 22: remove ALL phone-uniqueness restrictions.
-- Per owner: let anyone use any email or phone; never block on a reused phone.
-- Re-defines register_contact, admin_upsert_contact, check_contact_availability
-- without the phone guard. Idempotent & additive.

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

  select username into v_cur from public.profiles where id = v_user;

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

create or replace function public.admin_upsert_contact(p_user uuid, p_email text, p_phone text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone, ''));
  v_exists boolean;
  v_cur   text;
  v_base  text;
  v_new   text;
  v_i     int := 0;
  v_disp  text;
begin
  if p_user is null then raise exception 'user required'; end if;

  select username into v_cur from public.profiles where id = p_user;
  v_exists := found;
  v_disp := initcap(regexp_replace(split_part(v_email, '@', 1), '[^a-zA-Z0-9]', ' ', 'g'));

  if not v_exists or v_cur is null or v_cur like 'guest\_%' then
    v_base := regexp_replace(split_part(v_email, '@', 1), '[^a-z0-9_]', '', 'g');
    if length(v_base) < 3 then v_base := 'karo' || v_base; end if;
    v_base := left(v_base, 18);
    v_new := v_base;
    while exists (select 1 from public.profiles where username = v_new and id <> p_user) loop
      v_i := v_i + 1;
      v_new := left(v_base, 14) || v_i::text;
      if v_i > 9999 then
        v_new := left(v_base, 12) || substr(replace(p_user::text, '-', ''), 1, 6);
        exit;
      end if;
    end loop;
  else
    v_new := v_cur;
  end if;

  if v_exists then
    update public.profiles
       set is_guest = false,
           contact_email = v_email,
           contact_phone = v_phone,
           username = v_new,
           display_name = case
             when display_name is null or display_name like 'Guest %' then v_disp
             else display_name end
     where id = p_user;
  else
    insert into public.profiles (id, username, display_name, is_guest, contact_email, contact_phone)
    values (p_user, v_new, v_disp, false, v_email, v_phone);
  end if;
end;
$$;
revoke all on function public.admin_upsert_contact(uuid, text, text) from public;
grant execute on function public.admin_upsert_contact(uuid, text, text) to service_role;

-- Keep the function for compatibility but never report a phone conflict.
create or replace function public.check_contact_availability(p_email text, p_phone text)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_known boolean;
begin
  v_known := exists (select 1 from public.profiles where lower(contact_email) = v_email)
          or exists (select 1 from auth.users where lower(email) = v_email);
  return json_build_object('email_known', v_known, 'phone_conflict', false, 'masked_email', null);
end;
$$;
revoke all on function public.check_contact_availability(text, text) from public;
grant execute on function public.check_contact_availability(text, text) to anon, authenticated;
