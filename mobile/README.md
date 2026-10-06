# Roster Board native app (iPhone and Android)

A real native app built with React Native and Expo. It uses the same Supabase
accounts and data as rosterboard.net, so people can switch between the website,
iPhone and Android with the same login.

## What's in it

Everything the website has:

- Sign in, create account, reset password, use without an account; change name, email, password; delete account
- Cloud sync with the same rules as the web app, plus earlier-backup recovery
- Calendar: shifts, overtime/excess (with their base shift), split Excess + Overtime, swaps, leave, events, birthdays, public-holiday badges, pay-period shading, swipe between months, mass-edit
- Day editing: the normal/overtime/excess chooser, split-hours editor, swaps with undo, leave, events (edit, move to another day, reminders)
- Shift types: work or personal, phone time pickers, personal notes and date ranges
- Roster pattern (up to 52 weeks) and one-time calendar fill
- Reports, estimated pay (setup, breakdown, year in review) and PDF roster export
- Sharing, birthdays, light/dark, hide events/birthdays, welcome slides, help, feedback
- Premium through Apple (monthly and lifetime, restore). Enforcement is off
  (`PREMIUM_ENFORCED` in `src/lib/premium.tsx`) until Apple's Paid Apps Agreement is active.

`npm test` checks the sync merge, roster fill and pay estimate against the web
app's own code on random data.

## App Store submission checklist

- Screenshots (6.9" iPhone, 1290×2796): `appstore-screenshots/`
- Turn on `PREMIUM_ENFORCED` once the Paid Apps Agreement is active and the two
  products (`net.rosterboard.app.premium.monthly`, `net.rosterboard.app.premium.lifetime`)
  are set up in App Store Connect
- App Review: a demo account with sample shifts, entered under Sign-In Information
- App Privacy: Contact Info → Email Address and Name; User Content → Other User
  Content (the roster). All used for App Functionality, linked to the user, not
  used for tracking.

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
