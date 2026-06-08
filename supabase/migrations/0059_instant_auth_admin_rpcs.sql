-- Karochat — Wave 22: admin helpers for the instant-auth edge function.
-- Used by the `instant-auth` edge function (service_role) to create/repair
-- email accounts WITHOUT sending any confirmation email (so no email rate
-- limits) while keeping email-keyed account continuity + the phone guard.
-- Idempotent & additive.

create or replace function public.admin_user_id_by_email(p_email text)
returns uuid
language sql security definer set search_path = public
as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
$$;
revoke all on function public.admin_user_id_by_email(text) from public;
grant execute on function public.admin_user_id_by_email(text) to service_role;

create or replace function public.admin_upsert_contact(p_user uuid, p_email text, p_phone text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_phone text := trim(coalesce(p_phone, ''));
  v_norm  text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_exists boolean;
  v_cur   text;
  v_base  text;
  v_new   text;
  v_i     int := 0;
  v_disp  text;
begin
  if p_user is null then raise exception 'user required'; end if;
  if length(v_norm) < 6 then raise exception 'valid phone required'; end if;
  if exists (
    select 1 from public.profiles
     where id <> p_user and contact_phone is not null
       and regexp_replace(contact_phone, '\D', '', 'g') = v_norm
  ) then
    raise exception 'phone_conflict';
  end if;

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
