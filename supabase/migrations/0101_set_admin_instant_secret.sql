-- Owner-portal control to rotate the admin sign-in passphrase (app/admin →
-- AdminPassphrase.tsx). Admin-gated; min 6 chars.
create or replace function public.set_admin_instant_secret(p_new text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  if p_new is null or length(trim(p_new)) < 6 then
    raise exception 'passphrase must be at least 6 characters';
  end if;
  update public.app_secrets set admin_instant_secret = trim(p_new) where id = 1;
  return true;
end;
$$;

revoke all on function public.set_admin_instant_secret(text) from anon;
grant execute on function public.set_admin_instant_secret(text) to authenticated;
