-- Admin-only export of the client/user list (contact details + activity).
-- Powers the "Clients (CSV)" download in the owner portal
-- (app/admin/clients/export). Caller must be an admin; columns are qualified
-- to avoid the plpgsql RETURNS TABLE name-collision gotcha.
create or replace function public.admin_export_clients()
returns table (
  username text,
  display_name text,
  email text,
  phone text,
  account_type text,
  presence text,
  last_seen timestamptz,
  joined timestamptz
)
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin
  ) then
    raise exception 'not authorized';
  end if;

  return query
    select
      p.username,
      p.display_name,
      p.contact_email,
      p.contact_phone,
      case when p.is_guest then 'guest' else 'member' end,
      p.presence_state,
      p.last_seen,
      p.created_at
    from public.profiles p
    order by p.created_at desc;
end;
$$;

revoke all on function public.admin_export_clients() from anon;
grant execute on function public.admin_export_clients() to authenticated;
