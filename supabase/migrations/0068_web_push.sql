-- Karochat — Web Push (VAPID) background notifications for the Meet-now radar.
--
-- Delivers real lock-screen / background push to browsers + installed PWAs
-- (Android Chrome, desktop Chrome/Edge/Firefox, iOS 16.4+ installed PWAs)
-- via the standard Web Push protocol — no Firebase/APNs account needed.
--
-- Flow: a radar_pings INSERT (wave / call / scan) fires an AFTER trigger that
-- gathers the recipient's push subscriptions and asynchronously (pg_net) POSTs
-- them, with a shared secret, to the Netlify sender route /api/push/send,
-- which signs + sends the push with the VAPID private key.
--
-- Fully additive + fail-safe: if the config row, subscriptions, or VAPID keys
-- are absent, nothing happens and the ping insert is unaffected. The existing
-- in-app realtime + browser notifications keep working regardless.

-- Async HTTP from Postgres (lives in schema "net").
create extension if not exists pg_net;

-- ============================================================================
-- 1) web_push_subscriptions — one row per browser/device push endpoint
-- ============================================================================
create table if not exists public.web_push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.web_push_subscriptions enable row level security;
drop policy if exists wps_owner on public.web_push_subscriptions;
create policy wps_owner on public.web_push_subscriptions
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
create index if not exists wps_profile_idx on public.web_push_subscriptions(profile_id);
grant select, insert, update, delete on public.web_push_subscriptions to authenticated;

create or replace function public.save_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_ua text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_endpoint is null or p_p256dh is null or p_auth is null then
    raise exception 'bad subscription';
  end if;
  insert into public.web_push_subscriptions(profile_id, endpoint, p256dh, auth, user_agent)
  values (v_user, p_endpoint, p_p256dh, p_auth, p_ua)
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id, p256dh = excluded.p256dh,
        auth = excluded.auth, user_agent = excluded.user_agent, updated_at = now();
end; $$;
revoke all on function public.save_push_subscription(text, text, text, text) from public;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.web_push_subscriptions
   where endpoint = p_endpoint and profile_id = auth.uid();
end; $$;
revoke all on function public.delete_push_subscription(text) from public;
grant execute on function public.delete_push_subscription(text) to authenticated;

-- ============================================================================
-- 2) app_secrets — private config (sender URL + shared secret).
--    No grants + RLS-on with no policies => unreachable from the API.
--    Populated out-of-band (not in this migration, to keep the secret out
--    of source control).
-- ============================================================================
create table if not exists public.app_secrets (
  id                 int primary key default 1 check (id = 1),
  radar_push_url     text,
  radar_push_secret  text,
  updated_at         timestamptz not null default now()
);
alter table public.app_secrets enable row level security;

-- ============================================================================
-- 3) Trigger: push to the recipient whenever a radar ping is created
-- ============================================================================
create or replace function public.radar_ping_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_url_cfg text;
  v_secret  text;
  v_subs    jsonb;
  v_name    text;
  v_title   text;
  v_body    text;
  v_url     text;
begin
  select radar_push_url, radar_push_secret into v_url_cfg, v_secret
    from public.app_secrets where id = 1;
  if v_url_cfg is null or v_secret is null then
    return new;
  end if;

  select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
    into v_subs
    from public.web_push_subscriptions s
   where s.profile_id = new.to_profile;
  if v_subs is null then
    return new;
  end if;

  select coalesce(p.display_name, p.username, 'Someone') into v_name
    from public.profiles p where p.id = new.from_profile;

  if new.kind = 'wave' then
    v_title := '👋 ' || v_name || ' waved at you';
    v_body  := coalesce(new.message, 'Someone nearby waved. Open Meet now.');
    v_url   := '/meet/now';
  elsif new.kind = 'call' then
    v_title := '📞 ' || v_name || ' wants to call';
    v_body  := 'Tap to join the call.';
    v_url   := '/rooms/' || coalesce(new.room_id::text, '');
  else
    v_title := '📡 Someone nearby is looking';
    v_body  := coalesce(new.message, 'Open Meet now to see who is around.');
    v_url   := '/meet/now';
  end if;

  begin
    perform net.http_post(
      url := v_url_cfg,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'secret', v_secret,
        'subscriptions', v_subs,
        'notification', jsonb_build_object(
          'title', v_title, 'body', v_body, 'url', v_url, 'tag', 'radar-' || new.kind
        )
      )
    );
  exception when others then
    -- never let a push hiccup break the ping insert
    null;
  end;

  return new;
end; $$;

drop trigger if exists radar_ping_notify_trg on public.radar_pings;
create trigger radar_ping_notify_trg
  after insert on public.radar_pings
  for each row execute function public.radar_ping_notify();
