# Roster Board native app (iPhone and Android)

A real native app built with React Native and Expo. It uses the same Supabase
accounts and data as rosterboard.net, so people can switch between the website,
iPhone and Android with the same login.

## What's in it so far

- Sign in, create account, reset password, use without an account
- Cloud sync with the same rules as the web app (merge by record, deletions
  respected, compare-and-swap so two devices can't overwrite each other, retries,
  earlier-backup recovery). `npm test` checks the merge against the web app's
  own code in `../index.html`.
- Calendar month view with shifts, overtime, leave, personal events and birthdays
- Day editing: add/remove shifts, overtime, excess hours, leave and events
- Shift types: create, edit, delete (work or personal, phone time pickers)
- Account: sync status, light/dark, hide events/birthdays, privacy, support,
  sign out, delete account

Still to bring across from the web app: Roster pattern, Reports and pay, swaps,
pay tags, birthday editing, sharing, event reminders, Premium purchases.

## Building (no Mac needed)

- Every push that changes `mobile/` runs **Native app check** on GitHub: installs,
  runs the sync tests, type-checks, builds a web preview and takes screenshots.
  Results land on the `native-app-ci` branch.
- A commit whose message contains `[testflight]` runs **Native app to TestFlight**,
  which builds the iPhone app on GitHub's Macs and uploads it, using the same
  App Store Connect key and signing certificate as the earlier iPhone builds.

## Running locally

    npm install
    npx expo start
