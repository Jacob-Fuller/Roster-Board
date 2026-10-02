-- Roster Board security fixes (2 Oct 2026, v61)
-- Run once in Supabase: Dashboard -> SQL Editor -> New query -> paste all -> Run.
-- Safe to run more than once.
--
-- 1. Shared rosters now only hand over work shifts. Personal entries, personal
--    types, shift notes, type notes and swap partner names/notes are stripped
--    on the server, so a connected person can never receive them.
-- 2. Inviting an email no longer reveals whether it has an account, and each
--    person can send at most 20 invites a day.
-- 3. None of the sharing or account functions can be called without signing in.

create or replace function get_shared_roster(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connected boolean;
  v_data jsonb;
  v_types jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select exists (
    select 1 from connections
      where status = 'accepted'
        and ((requester_id = auth.uid() and target_id = p_owner_id)
          or (requester_id = p_owner_id and target_id = auth.uid()))
  ) into v_connected;

  if not v_connected then
    raise exception 'Not connected with this account';
  end if;

  select data into v_data from app_data where user_id = p_owner_id;
  v_types := coalesce(v_data->'types', '[]'::jsonb);

  return jsonb_build_object(
    -- work shift types only, without their notes
    'types', (
      select coalesce(jsonb_agg(t - 'notes'), '[]'::jsonb)
        from jsonb_array_elements(v_types) t
       where coalesce(t->>'kind', 'work') <> 'personal'
    ),
    -- shifts, minus anything of a personal type, minus each shift's private note
    'shifts', (
      select coalesce(jsonb_object_agg(day.key, day.list), '{}'::jsonb)
        from (
          select d.key,
                 (select jsonb_agg(s - 'tag')
                    from jsonb_array_elements(d.value) s
                   where not exists (
                     select 1 from jsonb_array_elements(v_types) t
                      where t->>'id' = s->>'typeId' and t->>'kind' = 'personal')) as list
            from jsonb_each(coalesce(v_data->'shifts', '{}'::jsonb)) d
            where jsonb_typeof(d.value) = 'array'
        ) day
       where day.list is not null
    ),
    -- leave: just the kind and hours
    'leave', (
      select coalesce(jsonb_object_agg(d.key,
               (select coalesce(jsonb_agg(jsonb_build_object('id', l->'id', 'kind', l->'kind', 'hours', l->'hours')), '[]'::jsonb)
                  from jsonb_array_elements(d.value) l)), '{}'::jsonb)
        from jsonb_each(coalesce(v_data->'leave', '{}'::jsonb)) d
       where jsonb_typeof(d.value) = 'array'
    ),
    -- swaps: which shift moved where, but not who with or why
    'swaps', (
      select coalesce(jsonb_object_agg(d.key,
               (select coalesce(jsonb_agg(w - 'partner' - 'note'), '[]'::jsonb)
                  from jsonb_array_elements(d.value) w)), '{}'::jsonb)
        from jsonb_each(coalesce(v_data->'swaps', '{}'::jsonb)) d
       where jsonb_typeof(d.value) = 'array'
    )
  );
end;
$$;

create or replace function invite_connection(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_id uuid;
  v_requester_email text;
  v_existing record;
  v_recent int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  select count(*) into v_recent from connections
   where requester_id = auth.uid() and created_at > now() - interval '1 day';
  if v_recent >= 20 then
    raise exception 'You''ve sent a lot of invites today. Try again tomorrow.';
  end if;

  select id into v_target_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_target_id is null then
    -- Same outcome as a real invite, so this can't be used to check who has an account.
    return;
  end if;
  if v_target_id = auth.uid() then
    raise exception 'You can''t connect with yourself';
  end if;

  select email into v_requester_email from auth.users where id = auth.uid();

  select * into v_existing from connections
    where (requester_id = auth.uid() and target_id = v_target_id)
       or (requester_id = v_target_id and target_id = auth.uid())
    limit 1;

  if found then
    if v_existing.status in ('accepted', 'pending') then
      return; -- already connected or already asked: nothing to do
    end if;
    delete from connections where id = v_existing.id;
  end if;

  insert into connections (requester_id, target_id, requester_email, target_email, status)
  values (auth.uid(), v_target_id, v_requester_email, lower(trim(p_email)), 'pending');
end;
$$;

-- Only signed-in users can call these (Postgres lets anyone call new functions by default).
revoke execute on function invite_connection(text) from public, anon;
revoke execute on function respond_connection(uuid, boolean) from public, anon;
revoke execute on function remove_connection(uuid) from public, anon;
revoke execute on function get_shared_roster(uuid) from public, anon;
grant execute on function invite_connection(text) to authenticated;
grant execute on function respond_connection(uuid, boolean) to authenticated;
grant execute on function remove_connection(uuid) to authenticated;
grant execute on function get_shared_roster(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_proc where proname = 'delete_my_account') then
    execute 'revoke execute on function delete_my_account() from public, anon';
    execute 'grant execute on function delete_my_account() to authenticated';
  else
    raise notice 'delete_my_account is not installed yet - also run native/supabase/delete_my_account.sql (required for the App Store).';
  end if;
end $$;

-- Optional check after running: each of these should show a row.
-- select policyname, cmd from pg_policies where tablename in ('app_data', 'connections');
