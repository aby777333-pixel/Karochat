-- Karochat — Wave 22: admin-email check for OTP-only admin login.
create or replace function public.is_admin_email(p_email text)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower(trim(p_email)) and p.is_admin
  );
$$;
revoke all on function public.is_admin_email(text) from public;
grant execute on function public.is_admin_email(text) to service_role;
