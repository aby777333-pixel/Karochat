-- Karochat — v9 Phase 6.4: Vanish-mode DMs (Instagram-style seen-then-gone).
-- Complements the existing TTL "disappearing messages" (time-based) with a
-- per-DM vanish toggle: while ON, messages are flagged `vanish` and are hard-
-- deleted from the recipient's side when they leave/close the chat (after
-- they've seen them). Mutual flag persisted on rooms; live toggle sync rides a
-- Supabase broadcast channel (rooms isn't in the realtime publication).
-- Additive + idempotent.

alter table public.rooms    add column if not exists vanish_mode boolean not null default false;
alter table public.messages add column if not exists vanish      boolean not null default false;

-- set_vanish_mode — toggle the room's vanish flag. DM members only.
create or replace function public.set_vanish_mode(p_room_id uuid, p_on boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = auth.uid()
  ) then
    raise exception 'Not in this chat';
  end if;
  update public.rooms set vanish_mode = coalesce(p_on, false) where id = p_room_id;
end$$;
grant execute on function public.set_vanish_mode(uuid, boolean) to authenticated;

-- purge_seen_vanish_messages — the caller is leaving the chat; delete the
-- vanish messages they RECEIVED here (sent by the other party). Their own
-- outgoing vanish messages are cleared when the other party leaves. The
-- recipient deleting the row makes it disappear on the sender's side too via
-- the realtime DELETE event. SECURITY DEFINER so it can delete the peer's rows.
create or replace function public.purge_seen_vanish_messages(p_room_id uuid)
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if auth.uid() is null then return 0; end if;
  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id and rm.user_id = auth.uid()
  ) then
    return 0;
  end if;
  delete from public.messages
   where room_id = p_room_id and vanish = true and sender_id <> auth.uid();
  get diagnostics v_count = row_count;
  return v_count;
end$$;
grant execute on function public.purge_seen_vanish_messages(uuid) to authenticated;

-- Authoritative tagging: any non-system message inserted into a room whose
-- vanish_mode is ON is flagged vanish=true, regardless of which client send
-- path produced it. Server-side truth beats the client's (possibly stale) flag.
create or replace function public.messages_vanish_tag_tg()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type is distinct from 'system'
     and exists (select 1 from public.rooms r where r.id = new.room_id and r.vanish_mode) then
    new.vanish := true;
  end if;
  return new;
end$$;
drop trigger if exists messages_vanish_tag on public.messages;
create trigger messages_vanish_tag
  before insert on public.messages
  for each row execute function public.messages_vanish_tag_tg();
