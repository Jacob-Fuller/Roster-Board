-- Free Premium for you and your family in the Roster Board app.
-- Run once in Supabase -> SQL Editor. Then add or remove people any time in
-- Table Editor -> complimentary_access (one row per Roster Board login email).

create table if not exists public.complimentary_access (
  email text primary key,
  note text,
  created_at timestamptz not null default now()
);

alter table public.complimentary_access enable row level security;

-- Each signed-in person can only see whether their own email is on the list.
drop policy if exists "read own complimentary access" on public.complimentary_access;
create policy "read own complimentary access" on public.complimentary_access
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Nobody can add themselves from the app; only you, from the Supabase dashboard.
revoke insert, update, delete on public.complimentary_access from anon, authenticated;

-- Add your own Roster Board login email here (and family members' if you like):
insert into public.complimentary_access (email, note) values
  ('YOUR-ROSTER-BOARD-EMAIL@example.com', 'Owner')
on conflict (email) do nothing;
