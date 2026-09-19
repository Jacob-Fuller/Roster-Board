# Roster Board

A shift calendar web app: custom shift types with auto-calculated duration,
overtime, leave tracking, a repeating roster pattern that bulk-fills the
calendar, month/year analytics with comparisons, pay estimates, per-shift
notes, and CSV/PDF/JSON export. Plain HTML/CSS/JS — no build step, no
server-side code, nothing to install beyond a static file server.

## What's new in this version

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
- `manifest.json` — lets phones/desktops "install" it as an app icon
- `sw.js` — service worker; caches the app so it still opens with no signal
- `icon-192.png`, `icon-512.png` — app icons used by the manifest

Data is stored in the browser's `localStorage`, per device — no account,
no server. Use "Full backup" (Reports tab) to move data between devices,
or host it and open the same URL everywhere so it's at least the same
browser profile. PDF export uses jsPDF, loaded from a CDN — it needs an
internet connection the moment you click Export, even if the rest of the
app works offline.

## Run it locally

```
cd webapp
python3 -m http.server 8000
```

Then open `http://localhost:8000`. (Opening `index.html` directly by
double-clicking mostly works too, but the service worker and "Add to Home
Screen" prompt need it served over `http://` or `https://`.)

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
- `leave` — keyed by date, array of `{id, kind: "annual"|"sick"}`
- `notes` — personal events, keyed by date, array of
  `{id, text, category: "appointment"|"family"|"reminder"|"other", time?}`
- `swaps` — keyed by date, array of `{id, kind: "off"|"on", partner, note,
  linkedDate, linkedSwapId, typeId, baseTypeId?, hours?, shiftEntryId?}` —
  the "off" record always describes the original shift given up; the "on"
  record describes whatever type was actually swapped in (which can differ
  if you picked a different "Swapping for" type)
- `roster` — `{weeks, pattern}`, where `pattern[weekIndex][dayIndex]` is an
  array of type ids for that day of the repeating cycle (`dayIndex` 0 = Monday)
- `settings` — `{hourlyRate}`

If you change what `index.html` caches or add files, bump the `CACHE`
version string at the top of `sw.js` so returning visitors pick up the
update instead of a stale cached copy.

## Where this is headed

This web version is the fast sandbox for nailing down the feature set
before a native iOS build (Swift/SwiftUI) with real accounts and synced
data — noted here so future-you remembers the plan: prove the concept
here first, then port once it feels right.
