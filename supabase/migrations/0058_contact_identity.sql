-- Karochat — Wave 22: email-keyed account continuity + phone uniqueness guard.
-- * check_contact_availability(email, phone) — UX pre-check (anon-callable):
--     does this email already have an account? is this phone tied to a
--     DIFFERENT email?
-- * register_contact — now also rejects reusing a phone already registered to
--   another account (server-side backstop for the "use the registered email"
--   rule).
-- Idempotent & additive.

create or replace function public.check_contact_availability(
  p_email text,
  p_phone text
)
returns json
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_norm  text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_known boolean := false;
  v_owner text;
  v_conflict boolean := false;
  v_masked text;
begin
  -- Email already attached to an account (via contact details or auth email)?
  v_known := exists (select 1 from public.profiles where lower(contact_email) = v_email)
          or exists (select 1 from auth.users where lower(email) = v_email);

  -- Phone already registered to a *different* email?
  if length(v_norm) >= 6 then
    select lower(contact_email) into v_owner
      from public.profiles
     where contact_email is not null
       and contact_phone is not null
       and regexp_replace(contact_phone, '\D', '', 'g') = v_norm
     limit 1;
    if v_owner is not null and v_owner <> v_email then
      v_conflict := true;
      v_masked := regexp_replace(v_owner, '^(.).*(@.*)$', '\1***\2');
    end if;
  end if;

  return json_build_object(
    'email_known', v_known,
    'phone_conflict', v_conflict,
    'masked_email', v_masked
  );
end;
$$;

revoke all on function public.check_contact_availability(text, text) from public;
grant execute on function public.check_contact_availability(text, text) to anon, authenticated;

-- register_contact: add the server-side phone-uniqueness guard.
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
  v_norm  text := regexp_replace(trim(coalesce(p_phone, '')), '\D', '', 'g');
  v_cur   text;
  v_base  text;
  v_new   text;
  v_i     int := 0;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'a valid email is required';
  end if;
  if length(v_norm) < 6 then
    raise exception 'a valid phone number is required';
  end if;

  -- One account per phone: reject if another account already uses this phone.
  if exists (
    select 1 from public.profiles
     where id <> v_user
       and contact_phone is not null
       and regexp_replace(contact_phone, '\D', '', 'g') = v_norm
  ) then
    raise exception 'This phone number is already registered to another account. Please sign in with that email.';
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
