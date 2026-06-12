-- 0071_user_suggestions.sql
-- =====================================================================
-- User suggestions board — a friendly community wall where anyone can
-- propose ways to make Karochat better. Surfaces at /suggestions and
-- as a "Suggestions" tile in the lobby Community group.
--
-- Design: all writes go through SECURITY DEFINER RPCs (consistent with
-- the rest of the app); table reads are RLS-allowed for authenticated
-- so future realtime hooks can work. Self-contained — touches no
-- existing tables, views, or functions.
-- =====================================================================

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(content) between 5 and 1000),
  status text not null default 'new'
    check (status in ('new','planned','done','declined')),
  created_at timestamptz not null default now()
);
create index if not exists suggestions_created_idx
  on public.suggestions (created_at desc);
create index if not exists suggestions_profile_idx
  on public.suggestions (profile_id, created_at desc);

alter table public.suggestions enable row level security;
drop policy if exists "suggestions_read_authenticated" on public.suggestions;
create policy "suggestions_read_authenticated" on public.suggestions
  for select to authenticated using (true);
-- No insert/update/delete policies — writes only via the RPCs below.

create table if not exists public.suggestion_hearts (
  suggestion_id uuid not null references public.suggestions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (suggestion_id, profile_id)
);
alter table public.suggestion_hearts enable row level security;
drop policy if exists "suggestion_hearts_read_authenticated" on public.suggestion_hearts;
create policy "suggestion_hearts_read_authenticated" on public.suggestion_hearts
  for select to authenticated using (true);

-- ---------------------------------------------------------------------
-- submit_suggestion — rate-limited to 5/day; guests read-only.
-- ---------------------------------------------------------------------
create or replace function public.submit_suggestion(p_content text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_today int;
  v_id uuid;
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.profiles where id = v_user and is_guest) then
    raise exception 'guests cannot post suggestions — sign in with a full account first';
  end if;
  if length(trim(coalesce(p_content, ''))) < 5 then
    raise exception 'say a little more — at least a few words';
  end if;

  select count(*) into v_today from public.suggestions
   where profile_id = v_user and created_at > now() - interval '1 day';
  if v_today >= 5 then
    raise exception 'you''ve shared 5 ideas today — let others have the floor, come back tomorrow';
  end if;

  insert into public.suggestions (profile_id, content)
  values (v_user, trim(p_content))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.submit_suggestion(text) from public;
grant execute on function public.submit_suggestion(text) to authenticated;

-- ---------------------------------------------------------------------
-- list_suggestions — newest first, with author + hearts + caller flags.
-- ---------------------------------------------------------------------
create or replace function public.list_suggestions(p_limit int default 100)
returns table (
  suggestion_id uuid,
  content text,
  status text,
  created_at timestamptz,
  author_username text,
  author_display_name text,
  author_avatar_url text,
  heart_count bigint,
  i_hearted boolean,
  mine boolean
)
language sql security definer set search_path = public stable
as $$
  select s.id, s.content, s.status, s.created_at,
         p.username, p.display_name, p.avatar_url,
         coalesce((select count(*) from public.suggestion_hearts h
                    where h.suggestion_id = s.id), 0),
         exists (select 1 from public.suggestion_hearts h
                  where h.suggestion_id = s.id and h.profile_id = auth.uid()),
         (s.profile_id = auth.uid())
  from public.suggestions s
  join public.profiles p on p.id = s.profile_id
  order by s.created_at desc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;
revoke all on function public.list_suggestions(int) from public;
grant execute on function public.list_suggestions(int) to authenticated;

-- ---------------------------------------------------------------------
-- toggle_suggestion_heart — returns the new state (true = hearted).
-- ---------------------------------------------------------------------
create or replace function public.toggle_suggestion_heart(p_suggestion_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from public.suggestion_hearts
              where suggestion_id = p_suggestion_id and profile_id = v_user) then
    delete from public.suggestion_hearts
     where suggestion_id = p_suggestion_id and profile_id = v_user;
    return false;
  else
    insert into public.suggestion_hearts (suggestion_id, profile_id)
    values (p_suggestion_id, v_user)
    on conflict do nothing;
    return true;
  end if;
end;
$$;
revoke all on function public.toggle_suggestion_heart(uuid) from public;
grant execute on function public.toggle_suggestion_heart(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- delete_my_suggestion — authors can take back their own idea.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_suggestion(p_suggestion_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  delete from public.suggestions
   where id = p_suggestion_id and profile_id = v_user;
end;
$$;
revoke all on function public.delete_my_suggestion(uuid) from public;
grant execute on function public.delete_my_suggestion(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- admin_set_suggestion_status / admin_delete_suggestion — operator tools.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_suggestion_status(
  p_suggestion_id uuid,
  p_status text
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles
                  where id = v_user and is_admin is true) then
    raise exception 'admin only';
  end if;
  if p_status not in ('new','planned','done','declined') then
    raise exception 'invalid status';
  end if;
  update public.suggestions set status = p_status where id = p_suggestion_id;
end;
$$;
revoke all on function public.admin_set_suggestion_status(uuid,text) from public;
grant execute on function public.admin_set_suggestion_status(uuid,text) to authenticated;

create or replace function public.admin_delete_suggestion(p_suggestion_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles
                  where id = v_user and is_admin is true) then
    raise exception 'admin only';
  end if;
  delete from public.suggestions where id = p_suggestion_id;
end;
$$;
revoke all on function public.admin_delete_suggestion(uuid) from public;
grant execute on function public.admin_delete_suggestion(uuid) to authenticated;
