-- Karochat — v4: fix infinite recursion in room_members RLS policy
-- The room_members SELECT policy recursed on itself (the OR branch did a
-- SELECT on room_members which re-triggered the same policy). That broke
-- not just room_members reads but also rooms reads, messages reads, and any
-- query whose RLS check touched room_members. Replace the recursive
-- subqueries with a SECURITY DEFINER helper that bypasses RLS for the
-- membership check.
-- Run AFTER 0004_phase4_5_features.sql. Idempotent.

create or replace function public.is_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members
     where room_id = p_room_id
       and user_id = p_user_id
  );
$$;

revoke all on function public.is_room_member(uuid, uuid) from public;
grant execute on function public.is_room_member(uuid, uuid) to authenticated;

drop policy if exists "room_members_read_visible" on public.room_members;
create policy "room_members_read_visible" on public.room_members
  for select to authenticated using (
    user_id = auth.uid()
    or public.is_room_member(room_id, auth.uid())
  );

drop policy if exists "rooms_read_public_or_member" on public.rooms;
create policy "rooms_read_public_or_member" on public.rooms
  for select to authenticated using (
    is_public = true
    or public.is_room_member(id, auth.uid())
  );

drop policy if exists "messages_read_member" on public.messages;
create policy "messages_read_member" on public.messages
  for select to authenticated using (
    public.is_room_member(room_id, auth.uid())
  );

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and public.is_room_member(room_id, auth.uid())
  );
