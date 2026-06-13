-- Karochat — Live Broadcasts: go live and invite the whole community.
--
-- When a creator goes live (from the Infotainment hub), start_broadcast()
-- records an active live session and fans a Web Push out to every opted-in
-- user (so even offline people get an "X is live — join" notification, via the
-- same app_secrets → /api/push/send pipeline as radar pings / calls). The
-- live_broadcasts table is realtime-published so the lobby shows a "Live now"
-- banner and GlobalNotifier rings an in-app toast on every page / room.
--
-- Fully additive + fail-safe: if push config/subscriptions are absent nothing
-- happens and the broadcast still starts. Nothing existing is changed.

-- ── Table ───────────────────────────────────────────────────────────────────
create table if not exists public.live_broadcasts (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references public.profiles(id) on delete cascade,
  room_id     uuid not null references public.rooms(id) on delete cascade,
  title       text not null,
  mode        text not null default 'video' check (mode in ('video','audio')),
  is_active   boolean not null default true,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);
alter table public.live_broadcasts enable row level security;

drop policy if exists lb_read on public.live_broadcasts;
create policy lb_read on public.live_broadcasts
  for select to authenticated using (true);

drop policy if exists lb_host_ins on public.live_broadcasts;
create policy lb_host_ins on public.live_broadcasts
  for insert to authenticated with check (host_id = auth.uid());

drop policy if exists lb_host_upd on public.live_broadcasts;
create policy lb_host_upd on public.live_broadcasts
  for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());

create index if not exists lb_active_idx on public.live_broadcasts(is_active, started_at desc);
grant select, insert, update on public.live_broadcasts to authenticated;

-- Realtime so the lobby banner + GlobalNotifier update live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public'
       and tablename = 'live_broadcasts'
  ) then
    alter publication supabase_realtime add table public.live_broadcasts;
  end if;
end $$;

-- ── start_broadcast(room, title, mode) → broadcast id ───────────────────────
create or replace function public.start_broadcast(
  p_room_id uuid, p_title text, p_mode text default 'video'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user    uuid := auth.uid();
  v_mode    text := case when p_mode = 'audio' then 'audio' else 'video' end;
  v_id      uuid;
  v_name    text;
  v_title   text := coalesce(nullif(trim(p_title), ''), 'Live');
  v_url_cfg text;
  v_secret  text;
  v_subs    jsonb;
  v_url     text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from public.room_members where room_id = p_room_id and user_id = v_user
  ) then
    raise exception 'not a room member';
  end if;

  -- One active broadcast per host.
  update public.live_broadcasts set is_active = false, ended_at = now()
   where host_id = v_user and is_active;

  insert into public.live_broadcasts (host_id, room_id, title, mode)
  values (v_user, p_room_id, v_title, v_mode)
  returning id into v_id;

  -- Fan out a single Web Push batch to every opted-in user except the host.
  select radar_push_url, radar_push_secret into v_url_cfg, v_secret
    from public.app_secrets where id = 1;
  if v_url_cfg is not null and v_secret is not null then
    select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
      into v_subs
      from (
        select distinct on (endpoint) endpoint, p256dh, auth
          from public.web_push_subscriptions
         where profile_id <> v_user
         limit 1000
      ) s;
    if v_subs is not null then
      select coalesce(display_name, username, 'Someone') into v_name
        from public.profiles where id = v_user;
      v_url := '/rooms/' || p_room_id::text || '?call=' || v_mode;
      begin
        perform net.http_post(
          url := v_url_cfg,
          headers := jsonb_build_object('Content-Type', 'application/json'),
          body := jsonb_build_object(
            'secret', v_secret,
            'subscriptions', v_subs,
            'notification', jsonb_build_object(
              'title', '🔴 ' || v_name || ' is live',
              'body',  v_title || ' — tap to join.',
              'url',   v_url,
              'tag',   'live'
            )
          )
        );
      exception when others then null;
      end;
    end if;
  end if;

  return v_id;
end; $$;
revoke all on function public.start_broadcast(uuid, text, text) from public;
grant execute on function public.start_broadcast(uuid, text, text) to authenticated;

-- ── stop_broadcast(id) ──────────────────────────────────────────────────────
create or replace function public.stop_broadcast(p_broadcast_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  update public.live_broadcasts set is_active = false, ended_at = now()
   where id = p_broadcast_id and host_id = auth.uid();
end; $$;
revoke all on function public.stop_broadcast(uuid) from public;
grant execute on function public.stop_broadcast(uuid) to authenticated;

-- ── active_broadcasts() → currently-live sessions (last 8h) ─────────────────
create or replace function public.active_broadcasts()
returns table(
  id uuid, host_id uuid, room_id uuid, title text, mode text,
  host_name text, started_at timestamptz, member_count int
)
language sql stable security definer set search_path = public as $$
  select b.id, b.host_id, b.room_id, b.title, b.mode,
    coalesce(p.display_name, p.username, 'Someone') as host_name,
    b.started_at,
    (select count(*)::int from public.room_members rm where rm.room_id = b.room_id) as member_count
  from public.live_broadcasts b
  join public.profiles p on p.id = b.host_id
  where b.is_active
    and b.started_at > now() - interval '8 hours'
  order by b.started_at desc
  limit 50;
$$;
revoke all on function public.active_broadcasts() from public;
grant execute on function public.active_broadcasts() to authenticated;
