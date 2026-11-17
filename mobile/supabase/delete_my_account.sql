-- Roster Board: lets a signed-in user permanently delete their own account
-- from inside the app (required by Apple for apps that offer sign-up).
-- Run once in Supabase → SQL Editor → New query → paste → Run.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  delete from public.app_data    where user_id = uid;
  delete from public.connections where requester_id = uid or target_id = uid;
  delete from auth.users         where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
