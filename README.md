# Roster Board

A shift calendar web app: custom shift types with auto-calculated duration,
overtime, leave tracking, a repeating roster pattern that bulk-fills the
calendar, month/year analytics with comparisons, pay estimates, per-shift
notes, and CSV/PDF/JSON export. Plain HTML/CSS/JS — no build step, no
server-side code, nothing to install beyond a static file server.

## What's new in this version

- **Reminders for personal events**: a "Remind me at this time" checkbox
  next to the note time/text fields. If checked (and you allow notification
  permission when prompted), the app shows a browser notification at that
  time — while the app is open on your device (checked every 30s). This is
  not a true background push notification, so it won't fire if the app
  isn't open/running at that moment — worth knowing since iOS is strict
  about backgrounded web apps.
- **Note time defaults to 00:00**: the time field for personal events now
  shows 00:00 by default (instead of quietly defaulting to the current
  time), so it's clear it's an empty time box waiting for input.
- **About moved to the bottom of the Account tab**, after Invite a
  friend/Share your roster/Connected.
- **Theme is now Light or Dark only** — removed "System" from Appearance,
  since it added a third option without much benefit; first run still
  picks based on your device's current setting, then remembers your choice.
- **Roster pattern grid — bottom-right corner fixed**: the pattern grid's
  cells are `<button>` elements, and they were never stripped of the
  browser's own default button border. That extra border was invisible on
  three corners but poked out past the rounded corner on the bottom-right
  cell specifically. Removed the default border — all four corners are
  clean now.
- **Shift chips on the calendar — centered and resized to fit**: shift name
  chips (Dayshift, Nightshift, etc.) are now centered in the cell instead
  of hugging the left edge, and automatically shrink their font size so
  longer names like "Nightshift" fit on one line instead of being cut off
  mid-word.
- **Personal events possibly not syncing before closing the app**: cloud
  sync was debounced by 1.2 seconds after any change, so adding a note and
  immediately closing/backgrounding the app (common on a phone) could mean
  that note never reached the cloud, and would then look like it
  "disappeared" when opening on another device. The app now flushes any
  pending sync immediately when it's backgrounded or closed, instead of
  waiting out the debounce.
- **Connections errors are now visible**: if accepting/declining/removing a
  shared-roster connection fails (e.g. a Supabase permissions/grant issue),
  the app now shows the real error message on screen and logs it to the
  console, instead of a toast that disappears after 2 seconds. There's also
  a manual refresh button next to "Connected" on the Account tab. If accept
  isn't sticking for you, check what this error says — see "Shared rosters
  troubleshooting" below.
- **Account is now a drill-down page**: the Account tab's top "Account" card
  is now a single tappable row (like a Settings app) instead of showing
  everything at once — tap it to go into a dedicated Account page with
  Change name, Change email and Change password, and Sign out at the very
  bottom of that page.
- **Pay calculator removed**: the itemized pay/payslip section on Reports
  (hourly rate, overtime multiplier, recurring pay items, estimated net pay)
  has been taken out for now.
- **Roster pattern grid fixed**: the pattern grid's borders are now uniform
  on every side — no more uneven gap between the day-of-week header and the
  week row below it.
- **Cleaner day sheet**: the "No shift types yet — add one from the Types
  tab first" message no longer shows under the shift picker when you open a
  day on the Calendar tab.
- **Privacy Policy link fixed**: it now opens in the same window instead of
  trying to open a new tab, which could silently fail when the app is
  installed as a Home Screen app on iPhone.
- **Account tab**: the last tab is now called Account (previously Shared) and
  is the home for everything account-related — signed-in email/sign out,
  Change password, Appearance (theme), About us/Help/Contact us/Privacy
  Policy, and the existing Invite a friend + Share your roster sections all
  live here now, in that order. Reports no longer has an Account section.
- **Light/dark theme**: Appearance card on the Account tab lets you pick
  System (follows your device), Light, or Dark — takes effect immediately
  and syncs with your account like everything else.
- **Change password**: set a new password right from the Account tab
  without needing a reset email, as long as you're signed in.
- **About us / Help / Contact us / Privacy Policy**: quick info links added
  to the Account tab — About us and Help open an in-app info screen, Contact
  us opens an email, Privacy Policy opens the existing privacy page.
- **Header only shows on Calendar**: the month title, weekday row, and the
  hours/overtime/shifts stat row used to appear at the top of every tab —
  they now only show on the Calendar tab, so the other tabs have more room.
- **Shifts tab** (renamed from Types): same place you manage shift types,
  just a clearer name. Tab order is now Calendar, Roster, Shifts, Reports,
  Account.
- **Annual Leave and Sick Leave now ask how many hours**: instead of logging
  as a fixed full day, tapping either one prompts for the number of hours —
  useful since a sick day might be 1, 2, or 12 hours depending on the job.
  Both are now capitalized throughout ("Annual Leave", "Sick Leave"), and
  the calendar chip, day sheet, and PDF export all show the hours logged.
  The explanatory subtext under the built-in shift types (e.g. "Enter hours
  each time") has been removed from the Shifts tab list to keep it tidy —
  the built-in types themselves are unchanged.
- **Roster tab visual fix**: cleaned up a rendering artifact that could show
  thin black gaps between cells at the edge of the weekly pattern grid.
- **Invite a friend**: the Shared tab now has an "Invite a friend" section
  above the roster-connect section — a "Share invite" button that opens your
  phone's native share sheet (or copies a message + the app's link to your
  clipboard on desktop) so you can send it to someone who doesn't have the
  app yet. Separate from connecting rosters — this is just for getting
  someone onto the app so you can connect with them afterwards.
- **Password recovery + Privacy Policy**: added a "Forgot password?" link on
  the login screen (emails a reset link via Supabase; opening it lets you set
  a new password right in the app) and a Privacy Policy page (`privacy.html`,
  linked from the login screen and Reports → Account) explaining what data is
  collected, how it's stored, and how the Shared rosters feature keeps
  personal data out of what's shared.
- **Shared rosters**: a new Shared tab lets you connect with another account
  (invite by email, they accept or decline) so you can each see the other's
  work schedule — shift types, overtime, leave and swaps, read-only, month by
  month. Nothing else is shared: personal events/notes, pay rate, and reports
  never leave your own account. Sharing is mutual once accepted — remove a
  connection any time from either side with the ✕. Needs one more one-time
  SQL step in Supabase — see "Setting up your Supabase project" below.
- **Login screen redesign**: full-screen branded background (app icon, name,
  tagline) instead of the dimmed calendar showing through behind the sign-in
  card.
- **Accounts + cloud sync (Supabase)**: on open, the app now asks you to sign up
  or log in. Signing in syncs your data (types, shifts, notes, leave, swaps,
  roster, settings) to a Supabase project instead of just the local browser —
  the same account will work across other apps under the same brand later on,
  and your data now follows you between devices instead of staying stuck on
  one phone/browser. See "Setting up your Supabase project" below for the
  one-time setup this needs. Sign out from Reports → Account.
- **Optional Node server for Render "Web Service"**: added `server.js` and
  `package.json` so the app can also run as a Node web service (e.g. on
  Render, Railway, Fly.io) instead of only a static site — see "Put it on
  the web" below. It's still the same plain client-side app; the server
  just serves the files with the right content types.

- **No more duplicate chip after a swap**: a shift that was just swapped in
  no longer shows both a "Swapped on" banner and a separate plain chip for
  the same shift — the banner covers it.
- **Swap banners match the overtime look**: "Swapped off"/"Swapped on" on
  the calendar are now a two-part banner like the Overtime tile — a small
  red strip on top with the swap state, and the shift name/color below as
  the dominant part.
- **Choose what you're swapping for**: the swap form now has a "Swapping
  for" dropdown, defaulting to the same shift type, but you can pick a
  different one — e.g. you swap away a Dayshift but pay it back with a
  Nightshift. The swap labels on both dates reflect whichever type was
  actually used.
- **Overtime banner proportions flipped**: the "Overtime" wording is now
  the smaller strip and the shift name (Dayshift, Hospital, etc.) is the
  larger, dominant part — in both the day sheet picker and the calendar
  chip.
- **Overtime is now linked to a shift**: in the day sheet, each shift type
  gets its own "Overtime" tile — a small pink strip labeled Overtime above
  the shift's own name and color — so tapping it directly logs overtime for
  that shift (e.g. "Overtime – Dayshift"). The resulting chip uses the
  shift's own color with a thin pink line across the top.
- **Swapped labels always sit on top**: "Swapped off"/"Swapped on" render
  above the shift chips on a calendar day, one line per state if a day has
  both (e.g. something swapped away and something else swapped in).
- **Edit overtime hours**: a logged overtime shift now has its own edit
  (clock) button in the day sheet, so you can correct the hours after the
  fact without deleting and re-adding it.
- **Overtime chip on the calendar**: an overtime shift on the calendar now
  shows the same pink "Overtime" strip + shift name/color look used in the
  day sheet picker, instead of a plain colored chip.
- **Overtime is now opt-in per shift type**: when creating or editing a
  type there's an "Allow overtime for this shift type" checkbox (on by
  default). Untick it for anything that isn't a work shift — a gym
  session, a personal tab you're using the calendar for — and it won't
  clutter the day sheet with an Overtime tile that doesn't apply.
- **Swap labels are now banners**: "Swapped off"/"Swapped on" render as
  small red badges, properly centered with even space on both sides, that
  auto-size to fill the day cell while staying on one line.
- **Overtime chip shows the full shift name**: the "Overtime" tile on the
  calendar now shrinks its text to fit instead of truncating with "…", so
  "Dayshift 3h" shows in full rather than "Dayshif...".
- **Personal events**: every day now has a "Personal events" section alongside
  your shifts — for appointments, family/social plans, reminders, anything
  that isn't work. Pick a category (Appointment, Family & social, Reminder,
  Other), optionally give it a time, and it shows as its own bulleted line
  right on the calendar cell — not just a corner dot — and in the day sheet.
  This makes the app a general everyday calendar, not just a shift roster.
- **Types tab**: shift types are now set by start/end time (e.g. 7:00–19:00)
  instead of typing raw hours — duration is calculated for you, including
  overnight shifts that cross midnight.
- **Overtime** is a built-in type that asks how many hours each time you log
  it on a day, since it varies instead of being a fixed shift length.
- **Leave**: log Annual leave or Sick leave on any day from the day sheet;
  it shows on the calendar and rolls into the reports totals, separate from
  worked hours.
- **Shift notes**: tap the pencil on any logged shift to attach a short note
  (e.g. "swapped with Sam") — shows as a small dot on the calendar chip.
- **Roster tab**: build a repeating multi-week shift pattern once, then pick
  a start date and how long to repeat it (3 months to 2 years) to bulk-fill
  the calendar. It's a one-time stamp — swap individual days afterwards the
  normal way, same as any other calendar entry.
- **Swap a shift**: tap the ⇄ icon on any logged shift to move it to another
  date, choose what shift type you're swapping for (defaults to the same
  type, but can differ — you can swap away a Dayshift and pay it back with
  a Nightshift), and record who you swapped with and why. It removes the
  shift from the original day and adds it to the new one, leaving a
  "Swapped off" banner on the original date and "Swapped on" on the new one
  — tap either to see the partner/note, or undo the swap entirely.
- **Reports tab**: switch between Month and Year. Shows total hours,
  overtime, days worked, leave taken, an hourly-rate pay estimate, a
  breakdown by shift type, weekday vs weekend, and a comparison against the
  previous period. Year view adds a year-in-review card (busiest month,
  totals). Export the period as CSV, a polished PDF roster (month view), or
  a full JSON backup.

## Files

- `index.html` — the whole app (markup, styles, logic)
- `privacy.html` — the Privacy Policy page, linked from the login screen and Account
- `manifest.json` — lets phones/desktops "install" it as an app icon
- `sw.js` — service worker; caches the app so it still opens with no signal
- `icon-192.png`, `icon-512.png` — app icons used by the manifest
- `server.js`, `package.json` — an optional tiny Node static-file server,
  only needed if you're hosting this as a "Web Service" (Render, Railway,
  Fly.io, etc.) rather than a "Static Site". Not used for GitHub Pages,
  Netlify, Vercel, or opening the file locally.

Data is stored in the browser's `localStorage`, per device — no account,
no server. Use "Full backup" (Reports tab) to move data between devices,
or host it and open the same URL everywhere so it's at least the same
browser profile. PDF export uses jsPDF, loaded from a CDN — it needs an
internet connection the moment you click Export, even if the rest of the
app works offline.

## Setting up your Supabase project

The app is already pointed at your Supabase project (URL + publishable key
are in `index.html` — safe to be public, they only allow what your database
rules permit). One thing still needs to be created inside that project: the
table that stores each account's data.

1. In the Supabase dashboard, open **SQL Editor** → **New query**.
2. Paste this and click **Run**:

   ```sql
   create table if not exists app_data (
     user_id uuid primary key references auth.users(id) on delete cascade,
     data jsonb not null default '{}'::jsonb,
     updated_at timestamptz not null default now()
   );

   alter table app_data enable row level security;

   create policy "Users can read their own data"
     on app_data for select
     using (auth.uid() = user_id);

   create policy "Users can insert their own data"
     on app_data for insert
     with check (auth.uid() = user_id);

   create policy "Users can update their own data"
     on app_data for update
     using (auth.uid() = user_id);
   ```

   This creates one row per account holding a JSON blob of everything the app
   already stores locally, and locks it down so a user can only ever read or
   write their own row — nobody else's data is reachable, even though the
   publishable key is public.
3. Optional, for faster testing: Authentication → Providers → Email → turn
   off "Confirm email" so new accounts can log in immediately instead of
   needing to click a confirmation link first. Leave it on for real users.
4. Authentication → URL Configuration → set **Site URL** to your real
   deployed URL (e.g. `https://roster-board.onrender.com`) and add
   `https://roster-board.onrender.com/*` under **Redirect URLs**, so email
   confirmation links work instead of pointing at localhost.

That's the account/sync setup — sign-up, login, and sync are already wired up
in the app itself. This is also the foundation for sharing one account/login
across other apps under the same brand later: they'd point at this same
Supabase project and reuse the same `auth.users` accounts.

### Shared rosters — one more SQL step

Run this in the same SQL Editor to add the "Shared" tab's connect/accept
system and a locked-down function that hands over only the work-roster part
of a connected account's data:

```sql
create table if not exists connections (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  requester_email text not null,
  target_email text not null,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, target_id)
);

alter table connections enable row level security;

create policy "Users can view their own connections"
  on connections for select
  using (auth.uid() = requester_id or auth.uid() = target_id);

-- No insert/update policies on purpose — all writes go through the
-- functions below, which check the rules themselves.

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
begin
  select id into v_target_id from auth.users where lower(email) = lower(p_email) limit 1;
  if v_target_id is null then
    raise exception 'No account found with that email';
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
    if v_existing.status = 'accepted' then
      raise exception 'You''re already connected with this person';
    elsif v_existing.status = 'pending' then
      raise exception 'A request is already pending with this person';
    else
      delete from connections where id = v_existing.id;
    end if;
  end if;

  insert into connections (requester_id, target_id, requester_email, target_email, status)
  values (auth.uid(), v_target_id, v_requester_email, p_email, 'pending');
end;
$$;

create or replace function respond_connection(p_connection_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update connections
    set status = case when p_accept then 'accepted' else 'declined' end,
        responded_at = now()
    where id = p_connection_id and target_id = auth.uid() and status = 'pending';

  if not found then
    raise exception 'Request not found';
  end if;
end;
$$;

create or replace function remove_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from connections
    where id = p_connection_id
      and (requester_id = auth.uid() or target_id = auth.uid());
end;
$$;

create or replace function get_shared_roster(p_owner_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_connected boolean;
  v_data jsonb;
begin
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

  return jsonb_build_object(
    'types', coalesce(v_data->'types', '[]'::jsonb),
    'shifts', coalesce(v_data->'shifts', '{}'::jsonb),
    'leave', coalesce(v_data->'leave', '{}'::jsonb),
    'swaps', coalesce(v_data->'swaps', '{}'::jsonb)
  );
end;
$$;

grant execute on function invite_connection(text) to authenticated;
grant execute on function respond_connection(uuid, boolean) to authenticated;
grant execute on function remove_connection(uuid) to authenticated;
grant execute on function get_shared_roster(uuid) to authenticated;
```

Notes on how this stays private:
- `get_shared_roster` only ever returns `types`, `shifts`, `leave` and
  `swaps` — it never touches `notes` (personal events) or `settings` (hourly
  rate), so those two never leave the owner's own account no matter what.
- It also refuses to return anything unless an `accepted` connection exists
  between the caller and the account being viewed, checked server-side.
- A person can only be invited by an email that already has an account —
  there's no way to probe for arbitrary emails otherwise, since the function
  only ever says "sent" or "no account found."

### Shared rosters troubleshooting

If sending an invite works but **Accept doesn't move the request into
"Connected"**, the app now shows the real error inline under "Requests for
you" instead of just a toast — check what it says first (there's also a
refresh button next to "Connected" in case it's just a stale list).

The most common cause is that the SQL block above didn't fully run — this
happens if it was run more than once, since `create policy` (unlike `create
table`) errors on a policy that already exists, which stops the script
partway through and can leave `respond_connection` (or its `grant`) missing
even though `invite_connection` is fine (invites use a different function,
which is why sending works but accepting doesn't).

To check: in the Supabase dashboard, go to **Database → Functions** and
confirm `invite_connection`, `respond_connection`, `remove_connection`, and
`get_shared_roster` are all listed. If any are missing, or if the inline
error mentions "permission denied" or "does not exist", run this safe,
repeatable version in the SQL Editor — it can be run any number of times
without erroring:

```sql
drop policy if exists "Users can view their own connections" on connections;
create policy "Users can view their own connections"
  on connections for select
  using (auth.uid() = requester_id or auth.uid() = target_id);

grant execute on function invite_connection(text) to authenticated;
grant execute on function respond_connection(uuid, boolean) to authenticated;
grant execute on function remove_connection(uuid) to authenticated;
grant execute on function get_shared_roster(uuid) to authenticated;
```

(The `create or replace function` statements from the original block are
already safe to re-run any time — only `create policy` needed the `drop
policy if exists` guard above.)

## Run it locally

```
cd webapp
python3 -m http.server 8000
```

Then open `http://localhost:8000`. (Opening `index.html` directly by
double-clicking mostly works too, but the service worker and "Add to Home
Screen" prompt need it served over `http://` or `https://`.)

Or, with Node instead of Python:
```
cd webapp
node server.js
```
Then open `http://localhost:3000`.

## Put it on the web

Any static hosting works, since it's just files.

**GitHub Pages** (free, keeps a URL)
1. Create a new GitHub repo and push these files to it.
2. Repo Settings → Pages → Source: deploy from the `main` branch, `/root`.
3. Your app is live at `https://<username>.github.io/<repo>/`.

**Netlify Drop** (fastest, no account strictly required)
1. Go to https://app.netlify.com/drop
2. Drag the `webapp` folder onto the page.
3. You get a live URL immediately; claim it with a free account to keep it.

**Vercel**
1. `npx vercel` from inside the `webapp` folder (needs a free Vercel account).
2. Follow the prompts; it deploys as a static site.

**Your own server / cPanel / S3 / etc.**
Just upload the files to any folder a web server serves — nothing to build.

**Render, Railway, Fly.io — as a "Web Service"** (rather than a static site)
1. Push these files to a GitHub repo (same as the GitHub Pages step above).
2. On Render: **New +** → **Web Service** → pick the repo.
3. Build Command: `npm install` (or leave blank — there's nothing to install).
4. Start Command: `npm start` (runs `server.js`, a tiny built-in Node file
   server — no external packages needed).
5. Deploy. You get a live URL the same as the static-site options above.

This isn't required — a Static Site does the exact same job for this app
with no server to keep running — but it's here in case you'd rather keep
everything set up the same way as another Node-based app of yours.

## Installing it like an app

Once it's hosted over HTTPS, opening it in a mobile browser (Chrome on
Android, Safari on iOS) shows an "Add to Home Screen" / install option,
using `manifest.json` and `icon-*.png` to create a real app icon that
opens full-screen.

## Making changes

Everything lives in `index.html` — HTML in the body, CSS in the `<style>`
block, and the app logic in the `<script>` block at the bottom (vanilla
JavaScript, no framework). Data model, in `localStorage` under the key
`rosterBoard.v2`:
- `types` — your custom shift types (`{id, name, color, ink, startTime,
  endTime, hours, overtimeEligible, order}`) — `overtimeEligible` defaults
  to `true` when absent (older data), and controls whether that type gets
  an Overtime tile in the day sheet
- `shifts` — keyed by date (`YYYY-MM-DD`), each an array of
  `{id, typeId, hours?, tag?, baseTypeId?}` — `hours` is only set on
  overtime entries, and `baseTypeId` links an overtime entry to the shift
  type it's overtime for (used for its "Overtime – Dayshift" label and color)
- `leave` — keyed by date, array of `{id, kind: "annual"|"sick", hours}`
- `notes` — personal events, keyed by date, array of
  `{id, text, category: "appointment"|"family"|"reminder"|"other", time?,
  remind?, notified?}` — `remind` is set when the "Remind me" checkbox was
  used, `notified` flips to `true` once that reminder has fired so it
  doesn't repeat
- `swaps` — keyed by date, array of `{id, kind: "off"|"on", partner, note,
  linkedDate, linkedSwapId, typeId, baseTypeId?, hours?, shiftEntryId?}` —
  the "off" record always describes the original shift given up; the "on"
  record describes whatever type was actually swapped in (which can differ
  if you picked a different "Swapping for" type)
- `roster` — `{weeks, pattern}`, where `pattern[weekIndex][dayIndex]` is an
  array of type ids for that day of the repeating cycle (`dayIndex` 0 = Monday)
- `settings` — `{hourlyRate, theme}` — `hourlyRate` is currently unused (the
  pay calculator was removed); `theme` is `"system"|"light"|"dark"`

If you change what `index.html` caches or add files, bump the `CACHE`
version string at the top of `sw.js` so returning visitors pick up the
update instead of a stale cached copy.

Cloud side: a signed-in account's data lives in Supabase, table `app_data`,
one row per user (`user_id`, `data` — the same JSON shape as `localStorage`,
`updated_at`). The app writes to both `localStorage` and this table on every
save (debounced ~1.2s for the cloud write), and pulls the cloud copy down on
login so the same account sees its data on any device.

## Where this is headed

This web version is the fast sandbox for nailing down the feature set
before a native iOS build (Swift/SwiftUI) with real accounts and synced
data — noted here so future-you remembers the plan: prove the concept
here first, then port once it feels right.
