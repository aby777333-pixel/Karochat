-- Karochat — v9 Phase 6.2: Broadcast Channels (Instagram-style one-to-many).
-- Wires the dormant broadcast_channels / _subscriptions / _messages tables
-- (0042): owner posts (text / media / poll), subscribers read + react + vote.
-- Adds the missing owner-insert policy, a subscriber-count trigger, reactions
-- and poll votes, plus read RPCs. Additive + idempotent.

grant select on public.broadcast_channels to anon, authenticated;
grant insert, update, delete on public.broadcast_channels to authenticated;
grant select, insert, delete on public.broadcast_channel_subscriptions to authenticated;
grant select, insert, delete on public.broadcast_messages to authenticated;

-- Owner can post / delete messages in their own channel (0042 only shipped a
-- read policy for these).
drop policy if exists "broadcast_messages_owner_insert" on public.broadcast_messages;
create policy "broadcast_messages_owner_insert" on public.broadcast_messages
  for insert to authenticated with check (
    exists (select 1 from public.broadcast_channels bc
            where bc.id = channel_id and bc.owner_profile_id = auth.uid())
  );
drop policy if exists "broadcast_messages_owner_delete" on public.broadcast_messages;
create policy "broadcast_messages_owner_delete" on public.broadcast_messages
  for delete to authenticated using (
    exists (select 1 from public.broadcast_channels bc
            where bc.id = channel_id and bc.owner_profile_id = auth.uid())
  );

-- subscriber_count maintenance.
create or replace function public.bcast_sub_count_tg()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.broadcast_channels set subscriber_count = subscriber_count + 1
      where id = new.channel_id;
  elsif tg_op = 'DELETE' then
    update public.broadcast_channels set subscriber_count = greatest(subscriber_count - 1, 0)
      where id = old.channel_id;
  end if;
  return null;
end$$;
drop trigger if exists bcast_sub_count on public.broadcast_channel_subscriptions;
create trigger bcast_sub_count
  after insert or delete on public.broadcast_channel_subscriptions
  for each row execute function public.bcast_sub_count_tg();

-- is_channel_member — owner or subscriber (SECURITY DEFINER; used by definer
-- RPCs and to gate reactions/votes).
create or replace function public.is_channel_member(p_channel_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.broadcast_channels c
                 where c.id = p_channel_id and c.owner_profile_id = auth.uid())
      or exists (select 1 from public.broadcast_channel_subscriptions s
                 where s.channel_id = p_channel_id and s.subscriber_profile_id = auth.uid());
$$;
grant execute on function public.is_channel_member(uuid) to authenticated;

-- =====================================================================
-- Reactions (one per user per message; tapping the same emoji clears it)
-- =====================================================================
create table if not exists public.broadcast_message_reactions (
  message_id uuid not null references public.broadcast_messages(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, profile_id)
);
alter table public.broadcast_message_reactions enable row level security;
drop policy if exists "bcast_react_read" on public.broadcast_message_reactions;
create policy "bcast_react_read" on public.broadcast_message_reactions
  for select to authenticated using (
    exists (select 1 from public.broadcast_messages m where m.id = message_id)
  );
drop policy if exists "bcast_react_self" on public.broadcast_message_reactions;
create policy "bcast_react_self" on public.broadcast_message_reactions
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
grant select, insert, update, delete on public.broadcast_message_reactions to authenticated;

create or replace function public.react_broadcast_message(p_message_id uuid, p_emoji text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_channel uuid; v_existing text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select channel_id into v_channel from public.broadcast_messages where id = p_message_id;
  if v_channel is null or not public.is_channel_member(v_channel) then
    raise exception 'Channel not available';
  end if;
  select emoji into v_existing from public.broadcast_message_reactions
    where message_id = p_message_id and profile_id = auth.uid();
  if v_existing is not null and (p_emoji is null or v_existing = p_emoji) then
    delete from public.broadcast_message_reactions
      where message_id = p_message_id and profile_id = auth.uid();
  elsif p_emoji is not null and length(btrim(p_emoji)) > 0 then
    insert into public.broadcast_message_reactions(message_id, profile_id, emoji)
    values (p_message_id, auth.uid(), p_emoji)
    on conflict (message_id, profile_id) do update set emoji = excluded.emoji, created_at = now();
  end if;
end$$;
grant execute on function public.react_broadcast_message(uuid, text) to authenticated;

-- =====================================================================
-- Poll votes (one per user per message)
-- =====================================================================
create table if not exists public.broadcast_poll_votes (
  message_id   uuid not null references public.broadcast_messages(id) on delete cascade,
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  option_index int not null,
  created_at   timestamptz not null default now(),
  primary key (message_id, profile_id)
);
alter table public.broadcast_poll_votes enable row level security;
drop policy if exists "bcast_poll_read" on public.broadcast_poll_votes;
create policy "bcast_poll_read" on public.broadcast_poll_votes
  for select to authenticated using (
    exists (select 1 from public.broadcast_messages m where m.id = message_id)
  );
drop policy if exists "bcast_poll_self" on public.broadcast_poll_votes;
create policy "bcast_poll_self" on public.broadcast_poll_votes
  for all to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());
grant select, insert, update, delete on public.broadcast_poll_votes to authenticated;

create or replace function public.vote_broadcast_poll(p_message_id uuid, p_option_index int)
returns void
language plpgsql security definer set search_path = public as $$
declare v_channel uuid; v_opts int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select channel_id, coalesce(jsonb_array_length(poll_data->'options'), 0)
    into v_channel, v_opts
    from public.broadcast_messages where id = p_message_id;
  if v_channel is null or not public.is_channel_member(v_channel) then
    raise exception 'Channel not available';
  end if;
  if v_opts = 0 then raise exception 'Not a poll'; end if;
  if p_option_index < 0 or p_option_index >= v_opts then raise exception 'Bad option'; end if;
  insert into public.broadcast_poll_votes(message_id, profile_id, option_index)
  values (p_message_id, auth.uid(), p_option_index)
  on conflict (message_id, profile_id) do update set option_index = excluded.option_index, created_at = now();
end$$;
grant execute on function public.vote_broadcast_poll(uuid, int) to authenticated;

-- =====================================================================
-- Read RPCs
-- =====================================================================
create or replace function public.list_broadcast_channels()
returns table(
  id               uuid,
  owner_profile_id uuid,
  name             text,
  description      text,
  avatar_url       text,
  subscriber_count int,
  created_at       timestamptz,
  owner_username   text,
  owner_display_name text,
  is_owner         boolean,
  is_subscribed    boolean
)
language sql security definer stable set search_path = public as $$
  select c.id, c.owner_profile_id, c.name, c.description, c.avatar_url,
         c.subscriber_count, c.created_at,
         p.username, p.display_name,
         (c.owner_profile_id = auth.uid()) as is_owner,
         exists (select 1 from public.broadcast_channel_subscriptions s
                 where s.channel_id = c.id and s.subscriber_profile_id = auth.uid()) as is_subscribed
  from public.broadcast_channels c
  join public.profiles p on p.id = c.owner_profile_id
  order by (c.owner_profile_id = auth.uid()) desc, c.subscriber_count desc, c.created_at desc;
$$;
grant execute on function public.list_broadcast_channels() to authenticated;

create or replace function public.list_channel_messages(p_channel_id uuid)
returns table(
  id               uuid,
  body_markdown    text,
  media_url        text,
  poll_data        jsonb,
  created_at       timestamptz,
  reactions        jsonb,
  my_reaction      text,
  poll_counts      int[],
  my_vote          int
)
language sql security definer stable set search_path = public as $$
  select
    m.id, m.body_markdown, m.media_url, m.poll_data, m.created_at,
    coalesce(
      (select jsonb_object_agg(t.emoji, t.c)
       from (select emoji, count(*) c from public.broadcast_message_reactions r
             where r.message_id = m.id group by emoji) t),
      '{}'::jsonb) as reactions,
    (select emoji from public.broadcast_message_reactions r
     where r.message_id = m.id and r.profile_id = auth.uid()) as my_reaction,
    case when m.poll_data ? 'options' then
      (select array_agg(
         (select count(*)::int from public.broadcast_poll_votes v
          where v.message_id = m.id and v.option_index = g.i)
         order by g.i)
       from generate_series(0, jsonb_array_length(m.poll_data->'options') - 1) g(i))
    else null end as poll_counts,
    (select option_index from public.broadcast_poll_votes v
     where v.message_id = m.id and v.profile_id = auth.uid()) as my_vote
  from public.broadcast_messages m
  where m.channel_id = p_channel_id
    and public.is_channel_member(p_channel_id)
  order by m.created_at desc
  limit 200;
$$;
grant execute on function public.list_channel_messages(uuid) to authenticated;
