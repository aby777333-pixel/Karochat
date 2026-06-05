-- Karochat — admin moderation for moments (stories).
--
-- RLS policy `stories_delete_own` only lets an author delete their own
-- moment. Operators need to be able to take down anyone's moment from the
-- lobby strip, so this adds a SECURITY DEFINER RPC gated on
-- profiles.is_admin (same pattern as the books / publications admin RPCs).
--
-- Only deletes the row; any uploaded image left in storage is harmless and
-- expires from the strip on its own.
--
-- Idempotent. Safe to re-run.

create or replace function public.admin_delete_story(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_admin boolean;
  v_deleted int;
begin
  select coalesce(pr.is_admin, false) into v_admin
    from public.profiles pr where pr.id = auth.uid();
  if not coalesce(v_admin, false) then
    raise exception 'admin only';
  end if;

  delete from public.stories where id = p_id;
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;
revoke all on function public.admin_delete_story(uuid) from public;
grant execute on function public.admin_delete_story(uuid) to authenticated;
