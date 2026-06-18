-- Admin sign-in passphrase. Admins keep instant email+phone access, but the
-- instant-auth edge function additionally requires a secret that is NOT
-- derivable from the email (unlike the deterministic password) — so knowing the
-- admin email alone can't get you into the owner portal. Set the value out of
-- band (update app_secrets.admin_instant_secret).
alter table public.app_secrets add column if not exists admin_instant_secret text;

create or replace function public.verify_admin_instant_secret(p_secret text)
returns boolean
language sql
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.app_secrets
    where id = 1
      and admin_instant_secret is not null
      and admin_instant_secret <> ''
      and admin_instant_secret = p_secret
  );
$$;

revoke all on function public.verify_admin_instant_secret(text) from anon, authenticated;
