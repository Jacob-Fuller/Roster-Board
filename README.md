# Roster Board

Shift calendar app for iPhone, Android and the web (rosterboard.net).

- `mobile/` — the app (React Native / Expo, TypeScript). Builds for iOS, Android and the web.
- `mobile/fastlane/` and `.github/workflows/mobile-ios.yml` — iPhone builds to TestFlight
  (commit with `[testflight]` in the message on the `native-app` branch).
- `.github/workflows/web-publish.yml` — builds the web version and publishes it to `main`,
  which Render serves at rosterboard.net.
- `mobile/supabase/` — SQL for the Supabase backend (accounts, cloud backup, roster sharing).
- `mobile/APP-STORE-LISTING.md` — App Store listing text and notes.
- `mobile/test/web-reference.html` — the original web app, kept only so the tests can check
  the app's pay, roster and sync maths against it.
