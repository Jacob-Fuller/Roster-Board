# Roster Board for iPhone: setup checklist

This folder turns the Roster Board web app (in the repo root) into a native iPhone
app using Capacitor. Everything that can be prepared without a Mac is already here.
The steps below are the parts that need a Mac, Xcode and your Apple account.

## What's already done

- `capacitor.config.json`: app ID `net.rosterboard.app`, app name "Roster Board",
  navy launch colour.
- `package.json`: Capacitor packages and one-line commands, listed below.
- `scripts/copy-web.js`: copies the web app into the native project.
- `resources/`: 1024×1024 app icon with no transparency, as Apple requires, plus
  launch screen images. `resources/AppIcon.appiconset` can be dropped straight
  into Xcode.
- `appstore-screenshots/`: six captioned 1290×2796 screenshots, the size accepted
  for the 6.9" iPhone slot in App Store Connect.
- `supabase/delete_my_account.sql`: in-app account deletion, which Apple requires.
- Web app changes for the native app: password-reset emails link to
  rosterboard.net, and the web-only offline cache is skipped inside the app.

## 1. One-off: in-app account deletion (2 minutes, any computer)

Apple rejects apps that let people sign up but not delete their account in the app.

1. Supabase → your Roster Board project → **SQL Editor** → **New query**.
2. Paste the contents of `supabase/delete_my_account.sql` → **Run**.
3. In the app: Account → Delete account now deletes everything immediately.
   Until the SQL is run, the button falls back to emailing contact@rosterboard.net.

## 2. Apple Developer account

Enrol at developer.apple.com/programs. There is an annual fee, and approval can take
a day or two. Enrolling as an individual is quickest. Enrolling as an organisation,
for example "Emberfall Interactive", needs a D-U-N-S number.

## 3. Mac with Xcode (MacInCloud or similar)

You need the latest Xcode from the Mac App Store, Node.js 20 or newer, and git.
Then in Terminal on the Mac:

```bash
git clone https://github.com/Jacob-Fuller/Roster-Board.git
cd Roster-Board/native
npm install
npm run ios:add      # creates the ios/ Xcode project, app icon and launch screen
npm run ios:open     # opens it in Xcode
```

Commit the new `native/ios/` folder afterwards so it doesn't need regenerating.

## 4. In Xcode

1. Select **App** in the left sidebar, then the **Signing & Capabilities** tab,
   then tick **Automatically manage signing** and pick your team.
2. Bundle Identifier: `net.rosterboard.app`. Version `1.0`, Build `1`.
3. **General → Deployment Info:** iPhone only, Portrait only, matching the web app.
4. Check **Assets → AppIcon** shows the navy/gold calendar. If it's blank, drag in
   `resources/AppIcon.appiconset`.
5. Run it on an iPhone simulator. Sign in, add a shift, and check that
   Account says "All changes backed up".

## 5. App Store Connect (appstoreconnect.apple.com)

1. **My Apps → + → New App:** iOS, name "Roster Board", bundle ID
   `net.rosterboard.app`, SKU `rosterboard-ios`.
2. **Privacy Policy URL:** https://www.rosterboard.net/privacy.html
3. **Support URL:** https://www.rosterboard.net
4. **Category:** Productivity (secondary: Business).
5. **App Privacy:** the app collects
   - **Email address:** for app functionality and account management; linked to
     the user; not used for tracking.
   - **User content** (shifts, notes, events): for app functionality; linked to
     the user; not used for tracking.
   - No tracking, no ads, no analytics.
6. **Screenshots:** upload `appstore-screenshots/iphone-6.9-1.png` to `-6.png`
   into the 6.9" iPhone slot.
7. **Description, keywords and promo text:** see `APP-STORE-LISTING.md`.
8. **App Review information:** create a demo account, such as
   review@rosterboard.net, with some shifts in it. Put its email and password
   here, because Apple won't approve an app with a login they can't test.

## 6. Upload and submit

In Xcode, choose **Product → Archive**. When it finishes, choose
**Distribute App → App Store Connect → Upload**. After about 15 minutes the build
appears in App Store Connect under TestFlight. Install it on your own iPhone
through the TestFlight app and test it. Then select the build on the version page
and choose **Submit for Review**.

## Updating the iPhone app later

The iPhone app contains its own copy of the web app, so website updates don't reach
it automatically. After changing the web app:

```bash
cd native
npm run ios          # copies the latest web app into the Xcode project
```

Then bump the Build number in Xcode, Archive, and upload again.

## Notes

- Data in the native app is stored inside the app, and iOS doesn't clear it the
  way Safari can. It still backs up to the same Supabase account, so the website
  and the iPhone app share the same data.
- Apple sometimes rejects "website in a wrapper" apps (guideline 4.2). Roster Board
  works offline, stores data on the device and has a native icon, launch screen
  and account features, so it should pass. If a reviewer pushes back, the usual fix
  is to add a native touch such as haptics or a home-screen widget.
