-- Karochat — v9 Phase 6.3: Notes (Instagram-style 24h text status).
-- Wires the dormant `notes` table (0042): a short text status (<=60 chars)
-- that lives for 24h above the DM list / friends rail, audience-scoped to
-- public / followers / close_friends. One active note per author — posting
-- a new one replaces the old.
--
-- Visibility model mirrors Phase 6.1 posts ([[project_v9_plan]]): direct RLS
-- read only exposes public + own notes; followers / close_friends notes surface
-- ONLY through the SECURITY DEFINER `list_active_notes()` RPC. Do NOT switch the
-- UI to a direct `.from('notes')` select for the rail or scoped notes vanish.
-- Additive + idempotent.

grant select on public.notes to authenticated;
grant insert, update, delete on public.notes to authenticated;

-- Tighten the 0042 read policy (it exposed every unexpired note regardless of
-- audience). Direct reads now only return public + own; scoped notes come via
-- the definer RPC below.
drop policy if exists "notes_read_unexpired" on public.notes;
create policy "notes_read_unexpired" on public.notes
  for select to authenticated using (
    expires_at > now()
    and (audience_kind = 'public' or author_profile_id = auth.uid())
  );

-- can_see_note — SECURITY DEFINER visibility test (avoids RLS recursion; same
-- shape as can_see_post). public / own / followers (via follows) / close_friends.
create or replace function public.can_see_note(p_note_id uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.notes n
    where n.id = p_note_id and n.expires_at > now() and (
      n.audience_kind = 'public'
      or n.author_profile_id = auth.uid()
      or (n.audience_kind = 'followers' and exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.following_id = n.author_profile_id))
      or (n.audience_kind = 'close_friends' and exists (
            select 1 from public.close_friends cf
            where cf.owner_profile_id = n.author_profile_id
              and cf.friend_profile_id = auth.uid()))
    )
  );
$$;
grant execute on function public.can_see_note(uuid) to authenticated;

-- set_my_note — replace the author's active note (one per author). Caps body to
-- 60 chars, requires non-empty, validates audience. Returns the new note id.
create or replace function public.set_my_note(p_body text, p_audience text default 'followers')
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_body text; v_aud text;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  v_body := btrim(coalesce(p_body, ''));
  if length(v_body) = 0 then raise exception 'Note is empty'; end if;
  if length(v_body) > 60 then v_body := left(v_body, 60); end if;
  v_aud := lower(coalesce(p_audience, 'followers'));
  if v_aud not in ('public', 'followers', 'close_friends') then
    v_aud := 'followers';
  end if;
  delete from public.notes where author_profile_id = auth.uid();
  insert into public.notes(author_profile_id, body, audience_kind,
                           expires_at, created_at)
  values (auth.uid(), v_body, v_aud, now() + interval '24 hours', now())
  returning id into v_id;
  return v_id;
end$$;
grant execute on function public.set_my_note(text, text) to authenticated;

-- clear_my_note — drop the author's note early.
create or replace function public.clear_my_note()
returns void
language sql security definer set search_path = public as $$
  delete from public.notes where author_profile_id = auth.uid();
$$;
grant execute on function public.clear_my_note() to authenticated;

-- list_active_notes — one row per visible author (their latest unexpired note),
-- own first, then most recent. Audience-aware via the same predicate as
-- can_see_note so followers / close_friends notes surface here only.
create or replace function public.list_active_notes()
returns table(
  id                 uuid,
  author_profile_id  uuid,
  body               text,
  audience_kind      text,
  created_at         timestamptz,
  expires_at         timestamptz,
  author_username    text,
  author_display_name text,
  author_avatar_url  text,
  is_mine            boolean
)
language sql security definer stable set search_path = public as $$
  select distinct on (n.author_profile_id)
    n.id, n.author_profile_id, n.body, n.audience_kind, n.created_at, n.expires_at,
    p.username, p.display_name, p.avatar_url,
    (n.author_profile_id = auth.uid()) as is_mine
  from public.notes n
  join public.profiles p on p.id = n.author_profile_id
  where n.expires_at > now()
    and (
      n.audience_kind = 'public'
      or n.author_profile_id = auth.uid()
      or (n.audience_kind = 'followers' and exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.following_id = n.author_profile_id))
      or (n.audience_kind = 'close_friends' and exists (
            select 1 from public.close_friends cf
            where cf.owner_profile_id = n.author_profile_id
              and cf.friend_profile_id = auth.uid()))
    )
  order by n.author_profile_id, n.created_at desc;
$$;
grant execute on function public.list_active_notes() to authenticated;
