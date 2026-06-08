-- Karochat — Wave 22: abuse/IP logging + blacklist (behind the safety notice).
-- ip_blacklist (admin-managed), abuse_events (flagged attempts with IP), and a
-- service-role helper used by the instant-auth edge function to refuse
-- blacklisted IPs at login. Idempotent & additive.

create table if not exists public.ip_blacklist (
  ip text primary key,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
);
alter table public.ip_blacklist enable row level security;
drop policy if exists ip_blacklist_admin_read on public.ip_blacklist;
create policy ip_blacklist_admin_read on public.ip_blacklist
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));
drop policy if exists ip_blacklist_admin_write on public.ip_blacklist;
create policy ip_blacklist_admin_write on public.ip_blacklist
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create table if not exists public.abuse_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  ip text,
  user_agent text,
  category text not null,
  snippet text,
  room_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists abuse_events_created_idx on public.abuse_events(created_at desc);
create index if not exists abuse_events_ip_idx on public.abuse_events(ip);
alter table public.abuse_events enable row level security;
drop policy if exists abuse_events_insert_self on public.abuse_events;
create policy abuse_events_insert_self on public.abuse_events
  for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists abuse_events_admin_read on public.abuse_events;
create policy abuse_events_admin_read on public.abuse_events
  for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create or replace function public.is_ip_blacklisted(p_ip text)
returns boolean
language sql security definer set search_path = public stable
as $$ select exists (select 1 from public.ip_blacklist where ip = p_ip); $$;
revoke all on function public.is_ip_blacklisted(text) from public;
grant execute on function public.is_ip_blacklisted(text) to anon, authenticated, service_role;
