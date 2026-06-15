-- Karochat — Personal Organizer: private tasks, schedule & notes.
--
-- A single owner-only table backing the Organizer's Tasks (to-dos), Schedule
-- (events / reminders / meetings / forward-planning, all with a due time) and
-- Notes. Strictly private (RLS: owner only). Files use the existing private
-- shared_files store, so no new bucket here. Purely additive + idempotent.

create table if not exists public.organizer_items (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('task', 'event', 'note')),
  title      text not null,
  body       text,
  due_at     timestamptz,
  done       boolean not null default false,
  priority   text check (priority in ('low', 'normal', 'high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organizer_items_owner_idx
  on public.organizer_items (owner_id, kind, created_at desc);
create index if not exists organizer_items_due_idx
  on public.organizer_items (owner_id, due_at) where due_at is not null;

alter table public.organizer_items enable row level security;

drop policy if exists "organizer_items_read" on public.organizer_items;
create policy "organizer_items_read" on public.organizer_items
  for select to authenticated using (owner_id = auth.uid());

drop policy if exists "organizer_items_insert" on public.organizer_items;
create policy "organizer_items_insert" on public.organizer_items
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "organizer_items_update" on public.organizer_items;
create policy "organizer_items_update" on public.organizer_items
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "organizer_items_delete" on public.organizer_items;
create policy "organizer_items_delete" on public.organizer_items
  for delete to authenticated using (owner_id = auth.uid());

grant select, insert, update, delete on public.organizer_items to authenticated;
