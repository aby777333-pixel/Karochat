-- Karochat — v7 Wave 2: room rules + acknowledgement, regret protocol, polls.
-- Run AFTER 0008_intents_saved_translate.sql. Idempotent.

-- ============================================================================
-- Columns
-- ============================================================================
alter table public.rooms
  add column if not exists rules_markdown text;

alter table public.room_members
  add column if not exists rules_acknowledged_at timestamptz;

alter table public.messages
  add column if not exists regretted_at timestamptz,
  add column if not exists poll_data    jsonb;

-- ============================================================================
-- Views — re-expose new columns on the existing helper views.
-- ============================================================================
drop view if exists public.messages_with_sender;
create view public.messages_with_sender as
select
  m.id,
  m.room_id,
  m.sender_id,
  m.type,
  m.content,
  m.image_url,
  m.reply_to_id,
  m.edited_at,
  m.deleted_at,
  m.reactions,
  m.intent,
  m.regretted_at,
  m.poll_data,
  m.created_at,
  p.username       as sender_username,
  p.display_name   as sender_display_name,
  p.is_guest       as sender_is_guest,
  p.presence_state as sender_presence_state
from public.messages m
left join public.profiles p on p.id = m.sender_id;

grant select on public.messages_with_sender to authenticated;

drop view if exists public.room_members_view;
create view public.room_members_view as
select
  rm.room_id,
  rm.user_id,
  rm.role,
  rm.joined_at,
  rm.rules_acknowledged_at,
  p.username,
  p.display_name,
  p.is_guest,
  p.presence_state,
  p.status_text,
  p.status_emoji,
  p.last_seen
from public.room_members rm
join public.profiles p on p.id = rm.user_id;

grant select on public.room_members_view to authenticated;

-- ============================================================================
-- set_room_rules (owner-only). Writing new rules wipes everyone's ack so they
-- have to read the new copy before chatting again.
-- ============================================================================
create or replace function public.set_room_rules(p_room_id uuid, p_rules text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_owner uuid;
  v_clean text;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  select owner_id into v_owner from public.rooms where id = p_room_id;
  if v_owner is null then raise exception 'room not found'; end if;
  if v_owner <> v_user then raise exception 'only the owner can set rules'; end if;

  v_clean := nullif(trim(coalesce(p_rules, '')), '');

  update public.rooms
     set rules_markdown = v_clean
   where id = p_room_id;

  -- Reset acknowledgements for everyone except the owner (who wrote them).
  update public.room_members
     set rules_acknowledged_at = null
   where room_id = p_room_id
     and user_id <> v_user;

  -- Owner is implicitly acked.
  update public.room_members
     set rules_acknowledged_at = now()
   where room_id = p_room_id
     and user_id = v_user;
end;
$$;

revoke all on function public.set_room_rules(uuid, text) from public;
grant execute on function public.set_room_rules(uuid, text) to authenticated;

-- ============================================================================
-- acknowledge_room_rules — caller marks themselves as having read the rules.
-- ============================================================================
create or replace function public.acknowledge_room_rules(p_room_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  update public.room_members
     set rules_acknowledged_at = now()
   where room_id = p_room_id
     and user_id = v_user;
end;
$$;

revoke all on function public.acknowledge_room_rules(uuid) from public;
grant execute on function public.acknowledge_room_rules(uuid) to authenticated;

-- ============================================================================
-- cast_poll_vote — any room member can vote; the RPC enforces single-choice
-- by removing the voter from every option before adding them to the chosen one.
-- Passing -1 clears the voter from all options (unvote).
-- ============================================================================
create or replace function public.cast_poll_vote(p_message_id uuid, p_option_index int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_room      uuid;
  v_is_member boolean;
  v_data      jsonb;
  v_options   jsonb;
  v_count     int;
  v_i         int;
  v_new       jsonb := '[]'::jsonb;
  v_option    jsonb;
  v_voters    text[];
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  select room_id, poll_data into v_room, v_data
    from public.messages where id = p_message_id;
  if v_data is null then raise exception 'not a poll'; end if;
  if v_room is null then raise exception 'message not found'; end if;

  select public.is_room_member(v_room, v_user) into v_is_member;
  if not v_is_member then raise exception 'not a room member'; end if;

  v_options := v_data->'options';
  if v_options is null or jsonb_typeof(v_options) <> 'array' then
    raise exception 'invalid poll data';
  end if;

  v_count := jsonb_array_length(v_options);
  if v_count = 0 then raise exception 'poll has no options'; end if;
  if p_option_index < -1 or p_option_index >= v_count then
    raise exception 'option index out of range';
  end if;

  for v_i in 0 .. v_count - 1 loop
    v_option := v_options -> v_i;
    v_voters := coalesce(
      array(select jsonb_array_elements_text(v_option -> 'votes')),
      array[]::text[]
    );
    v_voters := array_remove(v_voters, v_user::text);
    if v_i = p_option_index then
      v_voters := array_append(v_voters, v_user::text);
    end if;
    v_option := jsonb_set(v_option, '{votes}', to_jsonb(v_voters));
    v_new := v_new || jsonb_build_array(v_option);
  end loop;

  v_data := jsonb_set(v_data, '{options}', v_new);
  update public.messages set poll_data = v_data where id = p_message_id;
  return v_data;
end;
$$;

revoke all on function public.cast_poll_vote(uuid, int) from public;
grant execute on function public.cast_poll_vote(uuid, int) to authenticated;

-- Expand the message type CHECK constraint so polls can be persisted.
alter table public.messages drop constraint if exists messages_type_check;
alter table public.messages
  add constraint messages_type_check
  check (type in ('text','image','nudge','system','poll'));
