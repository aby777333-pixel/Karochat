-- Karochat — Wave 22: owner-portal overview metrics (admin-only).
create or replace function public.admin_overview()
returns json
language plpgsql security definer set search_path = public stable
as $$
declare v_admin boolean;
begin
  select is_admin into v_admin from public.profiles where id = auth.uid();
  if not coalesce(v_admin, false) then raise exception 'admin only'; end if;

  return json_build_object(
    'users_total',    (select count(*) from public.profiles),
    'users_guests',   (select count(*) from public.profiles where is_guest),
    'users_online',   (select count(*) from public.profiles where last_seen > now() - interval '5 minutes'),
    'users_24h',      (select count(*) from public.profiles where created_at > now() - interval '24 hours'),
    'rooms_official', (select count(*) from public.rooms where is_official),
    'rooms_user',     (select count(*) from public.rooms where coalesce(is_official,false)=false and coalesce(is_dm,false)=false and coalesce(is_saved,false)=false and coalesce(is_vault,false)=false),
    'dms',            (select count(*) from public.rooms where is_dm),
    'messages_total', (select count(*) from public.messages),
    'messages_24h',   (select count(*) from public.messages where created_at > now() - interval '24 hours'),
    'shorts',         (select count(*) from public.shorts),
    'publications',   (select count(*) from public.publications),
    'stories_live',   (select count(*) from public.stories where expires_at > now()),
    'sexed_articles', (select count(*) from public.sex_ed_articles),
    'reports_open',   (select count(*) from public.reports where status in ('new','triaged')),
    'reports_total',  (select count(*) from public.reports),
    'abuse_24h',      (select count(*) from public.abuse_events where created_at > now() - interval '24 hours'),
    'abuse_total',    (select count(*) from public.abuse_events),
    'blacklist',      (select count(*) from public.ip_blacklist),
    'room_bans',      (select count(*) from public.room_bans)
  );
end;
$$;
revoke all on function public.admin_overview() from public;
grant execute on function public.admin_overview() to authenticated;
