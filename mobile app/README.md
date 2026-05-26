# Karochat Mobile

Native Android + iOS shell for the Karochat web application, built with
[Capacitor](https://capacitorjs.com/). The native app loads the
production web application inside a managed `WebView`, so the entire
existing Next.js codebase (rooms, books, sex-ed library, students
network, Karo AI, LiveKit calls, Supabase auth) runs as-is — there is
no separate mobile API surface or duplicated business logic.

> **Why a WebView wrapper and not React Native?**
> Karochat is heavily server-rendered (App Router, server components,
> server actions, API routes, Supabase RLS-aware queries). Re-platforming
> the UI into React Native would mean rewriting and maintaining two copies
> of every feature. The Capacitor approach ships the same code paths to
> every surface, and we still get native plugins for push notifications,
> share sheets, haptics, secure storage, etc.

---

## What's in this folder

```
mobile app/
├── README.md                         (this file)
├── package.json                      Capacitor + plugins
├── capacitor.config.ts               Main app config (id, name, server URL, plugin opts)
├── tsconfig.json
├── .env.example                      Override CAP_SERVER_URL for dev
├── .gitignore
├── android/                          Native Android Studio project
├── ios/                              Native Xcode project (build on macOS)
├── www/index.html                    Offline fallback shell
├── resources/                        Source icon + splash (1024×1024 / 2732×2732)
├── scripts/build-assets-source.mjs   Generates resources/* from logo.png
└── docs/
    ├── BUILD.md       Local build chain (Android + iOS)
    ├── DEPLOY.md      End-to-end ship: build → sign → upload → publish
    ├── SIGNING.md     Generating + protecting your release keystore + APNs key
    ├── STORE.md       Google Play + Apple App Store submission checklists
    └── ENV.md         Env variables, multi-env builds, dev-against-localhost
```

## Quick start (Android, on a machine with Android Studio installed)

```bash
cd "mobile app"
npm install
npm run sync                 # mirror native projects with capacitor.config.ts

# Debug APK (no signing required)
npm run build:android:debug
# → android/app/build/outputs/apk/debug/app-debug.apk

# Release APK (needs a keystore — see docs/SIGNING.md)
npm run build:android:release
# → android/app/build/outputs/apk/release/app-release.apk

# Release AAB (this is what Play Store wants)
npm run bundle:android:release
# → android/app/build/outputs/bundle/release/app-release.aab
```

## Quick start (iOS, must be on macOS with Xcode 15+)

```bash
cd "mobile app"
npm install
npm run sync
cd ios/App && pod install
npm run open:ios             # opens App.xcworkspace in Xcode

# In Xcode: Product → Archive → Distribute App → App Store Connect.
```

## Plugin surface

| Plugin                              | Used for                                              |
|-------------------------------------|--------------------------------------------------------|
| `@capacitor/app`                    | Back-button handling, app state events                 |
| `@capacitor/browser`                | Open external links in an in-app Safari/Chrome custom tab |
| `@capacitor/device`                 | Device info for telemetry / debug                      |
| `@capacitor/haptics`                | Touch feedback on nudges, reactions                    |
| `@capacitor/keyboard`               | Smooth keyboard show/hide, resize body                 |
| `@capacitor/network`                | Online/offline state surfacing                         |
| `@capacitor/preferences`            | Encrypted-at-rest key-value store (replaces localStorage in native context) |
| `@capacitor/push-notifications`     | FCM + APNs registration, foreground/background delivery |
| `@capacitor/share`                  | Native share sheet for room invites, quote cards       |
| `@capacitor/splash-screen`          | Branded launch splash                                  |
| `@capacitor/status-bar`             | Status bar styling                                     |

## App identity

| Field                 | Value                      |
|-----------------------|----------------------------|
| App name              | `Karochat`                 |
| Android applicationId | `com.karochat.app`         |
| iOS bundle id         | `com.karochat.app`         |
| Initial version       | `1.0.0` (versionCode `1`) |
| Min Android SDK       | 22 (Android 5.1)           |
| Target Android SDK    | 34 (Android 14)            |
| Min iOS               | 13.0                       |

## Distribution paths

This scaffold ships three independent ways for a user to install:

1. **Direct APK download** — hosted at `/karochat.apk` on the production
   Netlify site (see [docs/DEPLOY.md](docs/DEPLOY.md#sideloading-the-apk)).
   Users who don't want to use the Play Store can sideload after enabling
   "Install from unknown sources" on their device.
2. **Google Play Store** — upload the `.aab` produced by
   `npm run bundle:android:release`. See [docs/STORE.md](docs/STORE.md#google-play-store).
3. **Apple App Store** — Archive in Xcode and upload via Transporter or
   `xcrun altool`. See [docs/STORE.md](docs/STORE.md#apple-app-store).

## What still needs the operator's hands

This scaffold is build-ready, but a few things require credentials only
you should have:

- [ ] **Android keystore** — generate once, keep offline. See
      [docs/SIGNING.md](docs/SIGNING.md#android-keystore).
- [ ] **Firebase project** + `google-services.json` for FCM push.
      See [docs/DEPLOY.md](docs/DEPLOY.md#firebase-cloud-messaging-android).
- [ ] **Apple Developer Program enrolment** ($99/yr) — required to ship
      to the App Store and use APNs push.
- [ ] **Apple `AuthKey_*.p8`** for APNs push.
      See [docs/DEPLOY.md](docs/DEPLOY.md#apple-push-notification-service-ios).
- [ ] **Play Console listing** — graphics, store description, content
      rating questionnaire. See [docs/STORE.md](docs/STORE.md).
- [ ] **App Store Connect listing** — same as above for iOS.

## License + ownership

This mobile shell points at the production Karochat web app, which is
covered by Karochat's existing legal stack (Terms, Privacy Policy,
Community Guidelines, DMCA). The shell adds no separate data
collection — every request still flows through the same web app and
Supabase backend you already operate.
