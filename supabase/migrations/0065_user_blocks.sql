-- Karochat — Wave 22: per-user blocking + block-aware DM creation.
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists user_blocks_select_own on public.user_blocks;
create policy user_blocks_select_own on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists user_blocks_insert_own on public.user_blocks;
create policy user_blocks_insert_own on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid());
drop policy if exists user_blocks_delete_own on public.user_blocks;
create policy user_blocks_delete_own on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());

create or replace function public.block_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_key text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if p_target is null or p_target = v_user then return; end if;
  insert into public.user_blocks(blocker_id, blocked_id) values (v_user, p_target) on conflict do nothing;
  if v_user::text < p_target::text then v_key := v_user::text || ':' || p_target::text;
  else v_key := p_target::text || ':' || v_user::text; end if;
  delete from public.room_members rm using public.rooms r
   where rm.room_id = r.id and r.dm_key = v_key and rm.user_id = v_user;
end; $$;
revoke all on function public.block_user(uuid) from public;
grant execute on function public.block_user(uuid) to authenticated;

create or replace function public.unblock_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  delete from public.user_blocks where blocker_id = v_user and blocked_id = p_target;
end; $$;
revoke all on function public.unblock_user(uuid) from public;
grant execute on function public.unblock_user(uuid) to authenticated;

create or replace function public.block_status(p_target uuid)
returns json language sql security definer set search_path = public stable as $$
  select json_build_object(
    'i_blocked',  exists(select 1 from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_target),
    'blocked_me', exists(select 1 from public.user_blocks where blocker_id = p_target and blocked_id = auth.uid())
  );
$$;
revoke all on function public.block_status(uuid) from public;
grant execute on function public.block_status(uuid) to authenticated;

-- get_or_create_dm now refuses when a block exists in either direction
-- (full definition re-applied in the live DB; see project history).
