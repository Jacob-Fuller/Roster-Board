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
- Premium through Apple: $4.99/month or $24.99 lifetime, with restore. Free users
  get 3 shift types and no roster fill, pay estimate, full reports or PDF export.

`npm test` checks the sync merge, roster fill and pay estimate against the web
app's own code on random data.

## App Store submission checklist

- Screenshots (6.9" iPhone, 1290×2796): `appstore-screenshots/`
- Before submitting: the Paid Apps Agreement must be active and both products
  set up in App Store Connect and attached to the version:
  `net.rosterboard.app.premium.monthly` (auto-renewable subscription, 1 month, $4.99)
  and `net.rosterboard.app.premium.lifetime` (non-consumable, $24.99)
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
- A commit whose message contains `[android]` runs **Native app for Android**:
  builds a test APK, opens it on an Android emulator, takes screenshots, and
  publishes the APK and screenshots to the `android-builds` branch.

## Android (Google Play) still to do

- A Google Play Console developer account (one-off fee)
- An upload key, stored as GitHub secrets, so the workflow can build a signed
  release bundle (.aab) for Play
- Premium on Android needs Google Play Billing products; until then Premium
  is hidden on Android and everything is unlocked

