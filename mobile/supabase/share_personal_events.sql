-- Lets people choose to share their personal events with connected people
-- (Account -> Shared rosters -> Personal events: Show / Hide). Hidden by default.
-- Run once in Supabase -> SQL Editor. Safe to run more than once.
-- Same as get_shared_roster in native/supabase/security_fixes.sql, plus 'notes'
-- (event name, category, time) only when the owner has chosen to show them.

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
  v_share_events boolean;
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
  v_share_events := coalesce((v_data->'settings'->>'shareEvents')::boolean, false);

  return jsonb_build_object(
    'types', (
      select coalesce(jsonb_agg(t - 'notes'), '[]'::jsonb)
        from jsonb_array_elements(v_types) t
       where coalesce(t->>'kind', 'work') <> 'personal'
    ),
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
    'leave', (
      select coalesce(jsonb_object_agg(d.key,
               (select coalesce(jsonb_agg(jsonb_build_object('id', l->'id', 'kind', l->'kind', 'hours', l->'hours')), '[]'::jsonb)
                  from jsonb_array_elements(d.value) l)), '{}'::jsonb)
        from jsonb_each(coalesce(v_data->'leave', '{}'::jsonb)) d
       where jsonb_typeof(d.value) = 'array'
    ),
    'swaps', (
      select coalesce(jsonb_object_agg(d.key,
               (select coalesce(jsonb_agg(w - 'partner' - 'note'), '[]'::jsonb)
                  from jsonb_array_elements(d.value) w)), '{}'::jsonb)
        from jsonb_each(coalesce(v_data->'swaps', '{}'::jsonb)) d
       where jsonb_typeof(d.value) = 'array'
    ),
    'notes', case when v_share_events then (
      select coalesce(jsonb_object_agg(d.key,
               (select coalesce(jsonb_agg(jsonb_build_object('id', n->'id', 'text', n->'text', 'category', n->'category',
                                                             'time', n->'time', 'allDay', n->'allDay')), '[]'::jsonb)
                  from jsonb_array_elements(d.value) n)), '{}'::jsonb)
        from jsonb_each(coalesce(v_data->'notes', '{}'::jsonb)) d
       where jsonb_typeof(d.value) = 'array'
    ) else '{}'::jsonb end
  );
end;
$$;

revoke execute on function get_shared_roster(uuid) from public, anon;
grant execute on function get_shared_roster(uuid) to authenticated;
