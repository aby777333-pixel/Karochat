-- Karochat — push notification token registry.
--
-- Stores one row per (profile, device) so the server can fan out
-- notifications via FCM (Android) / APNs (iOS) / Web Push (browser).
-- The Capacitor mobile shell POSTs to /api/push/register on app start
-- after the user grants permission; the route calls upsert_push_token.
--
-- Sending notifications is a separate edge-function workstream (Phase
-- 4+). This migration lays the storage / RLS / RPC scaffold so we don't
-- lose tokens in the meantime.
--
-- Idempotent + additive.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios','android','web')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, token)
);
create index if not exists push_tokens_profile_idx on public.push_tokens(profile_id) where active;
create index if not exists push_tokens_active_idx on public.push_tokens(active, platform) where active;

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_owner_read" on public.push_tokens;
create policy "push_tokens_owner_read" on public.push_tokens
  for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "push_tokens_owner_delete" on public.push_tokens;
create policy "push_tokens_owner_delete" on public.push_tokens
  for delete to authenticated
  using (profile_id = auth.uid());

create or replace function public.upsert_push_token(
  p_token text, p_platform text
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if coalesce(nullif(trim(p_token),''),'') = '' then
    raise exception 'token required';
  end if;
  if p_platform not in ('ios','android','web') then
    raise exception 'invalid platform';
  end if;

  insert into public.push_tokens (profile_id, token, platform, active)
  values (v_user, trim(p_token), p_platform, true)
  on conflict (profile_id, token) do update
    set platform = excluded.platform,
        active = true,
        updated_at = now();
end;
$$;
revoke all on function public.upsert_push_token(text, text) from public;
grant execute on function public.upsert_push_token(text, text) to authenticated;

create or replace function public.deactivate_push_token(p_token text)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  update public.push_tokens
     set active = false, updated_at = now()
   where profile_id = v_user and token = trim(p_token);
end;
$$;
revoke all on function public.deactivate_push_token(text) from public;
grant execute on function public.deactivate_push_token(text) to authenticated;
