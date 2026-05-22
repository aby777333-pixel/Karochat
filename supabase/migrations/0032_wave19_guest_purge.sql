-- Karochat — Wave 19.9: guest accounts wipe themselves on sign-out;
-- email accounts persist as normal.
--
-- The product rule: anyone who signs in with an email keeps their
-- profile, rooms, friendships, messages, etc. across sessions. Anyone
-- who used "Continue as guest" (Supabase Anonymous Auth, surfaced as
-- profiles.is_guest = true) is on a session-only identity — when they
-- sign out, their footprint disappears.
--
-- Idempotent and additive.

-- ============================================================================
-- purge_guest_account — caller wipes their own guest profile + every
-- piece of content tied to it. No-op for non-guest accounts (a
-- safeguard so a stray client call can't nuke a real account).
--
-- What gets removed (via explicit deletes + the existing ON DELETE
-- CASCADE chains from auth.users / profiles):
--   • rooms they own           → cascades messages, members, pins…
--   • their messages elsewhere → cascade from auth.users delete
--   • their room memberships   → cascade from auth.users delete
--   • their friendships, vibes, vouches, stories, shorts, beacons…
--   • their profile + auth.users row itself
--
-- Storage objects (avatars / chat images / voice notes) are not
-- cascade-cleaned by Postgres — those orphan in the bucket. That's an
-- accepted trade-off; can be cleaned up by a periodic job later.
-- ============================================================================
create or replace function public.purge_guest_account()
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_is_guest boolean;
begin
  if v_user is null then
    -- Silent no-op: caller isn't signed in.
    return;
  end if;

  select is_guest into v_is_guest
    from public.profiles
   where id = v_user;

  -- Only run for guest accounts; protect against accidental wipes of
  -- email accounts even if the client mistakenly calls us.
  if v_is_guest is not true then
    return;
  end if;

  -- 1) Delete rooms they own. Cascades messages, room_members,
  --    message_reads, room_bans, etc. that reference the room.
  delete from public.rooms where owner_id = v_user;

  -- 2) Delete the auth.users row. Cascades:
  --    profiles → friendships, vibes, vouches, stories, shorts,
  --    room_members elsewhere, messages elsewhere, etc. (all child
  --    tables either CASCADE on profile/auth-user delete or SET NULL,
  --    which is fine — those rows can outlive the guest).
  delete from auth.users where id = v_user;
end;
$$;

revoke all on function public.purge_guest_account() from public;
grant execute on function public.purge_guest_account() to authenticated;
