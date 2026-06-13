-- Karochat — Follow / Subscribe (creator audiences).
--
-- One-directional follows (distinct from mutual friends) so creators can build
-- an audience: followers, following counts, and a follow/unfollow toggle.
-- Foundation for the creator economy (targeted live alerts, subscriber feeds,
-- etc.). Purely additive + idempotent. Nothing existing is changed.

create table if not exists public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_not_self check (follower_id <> following_id)
);
alter table public.follows enable row level security;

drop policy if exists follows_read on public.follows;
create policy follows_read on public.follows
  for select to authenticated using (true);

drop policy if exists follows_ins on public.follows;
create policy follows_ins on public.follows
  for insert to authenticated with check (follower_id = auth.uid());

drop policy if exists follows_del on public.follows;
create policy follows_del on public.follows
  for delete to authenticated using (follower_id = auth.uid());

create index if not exists follows_following_idx on public.follows(following_id);
create index if not exists follows_follower_idx on public.follows(follower_id);
grant select, insert, delete on public.follows to authenticated;

-- follow_user(target) — idempotent.
create or replace function public.follow_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if v_user = p_target then return; end if;
  insert into public.follows (follower_id, following_id)
  values (v_user, p_target)
  on conflict do nothing;
end; $$;
revoke all on function public.follow_user(uuid) from public;
grant execute on function public.follow_user(uuid) to authenticated;

-- unfollow_user(target).
create or replace function public.unfollow_user(p_target uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.follows
   where follower_id = auth.uid() and following_id = p_target;
end; $$;
revoke all on function public.unfollow_user(uuid) from public;
grant execute on function public.unfollow_user(uuid) to authenticated;

-- follow_stats(user) — followers / following counts + whether I follow them.
create or replace function public.follow_stats(p_user uuid)
returns table(followers int, following int, is_following boolean)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.follows f where f.following_id = p_user),
    (select count(*)::int from public.follows f where f.follower_id  = p_user),
    exists(
      select 1 from public.follows f
       where f.follower_id = auth.uid() and f.following_id = p_user
    );
$$;
revoke all on function public.follow_stats(uuid) from public;
grant execute on function public.follow_stats(uuid) to authenticated;
