# Deploy — from local build to a real installable

This page is the end-to-end ship checklist. For per-platform store-side
mechanics, see [STORE.md](STORE.md).

## TL;DR

1. **Android**: build AAB → upload to Play Console.
2. **Android sideload**: build APK → upload to `public/karochat.apk` on
   the Next.js site → users download from
   `https://magical-heliotrope-e4d7df.netlify.app/karochat.apk`.
3. **iOS**: archive in Xcode → upload to App Store Connect.
4. **PWA**: already live. Any modern Chrome / Safari on Android or iOS
   shows an "Install" / "Add to Home Screen" affordance — no native
   build required.

---

## Sideloading the APK (the "downloadable installation link")

The simplest distribution path. After the release APK is built:

```bash
# 1. Build a signed release APK
cd "mobile app"
npm run build:android:release

# 2. Copy it into the Next.js public/ folder so Netlify serves it
cp android/app/build/outputs/apk/release/app-release.apk \
   ../public/karochat.apk

# 3. Commit + push (Netlify auto-deploys, or run `netlify deploy --build --prod`)
cd ..
git add public/karochat.apk
git commit -m "Ship v1.0.0 Android APK for sideload"
git push origin main
```

Now anyone can install with:

```
https://magical-heliotrope-e4d7df.netlify.app/karochat.apk
```

Tap the link on an Android device. The browser will:
1. Download the APK.
2. Prompt the user to allow installs from this browser (one-time per
   browser).
3. Install via the system package installer.

> **Tip:** Make a small landing page at `/install` that detects the
> user-agent and shows three buttons: "Get on Play Store", "Direct APK
> download", "Get on App Store". Phase 2.2 polish if you want it.

## Firebase Cloud Messaging (Android)

FCM is what actually delivers a notification to an Android device. The
mobile shell already has the FCM plugin scaffolded — you just need to
drop in the Firebase project credentials.

### One-time setup

1. Go to <https://console.firebase.google.com> → **Add project** →
   `Karochat`. Disable Google Analytics if you don't want it.
2. Click **Add app → Android**.
   - Android package name: `com.karochat.app`
   - App nickname: `Karochat`
   - Debug signing certificate SHA-1 (run on your dev machine):
     ```bash
     cd "mobile app/android"
     ./gradlew signingReport     # prints SHA-1 for debug + release
     ```
3. Download **`google-services.json`** and drop it into
   `mobile app/android/app/google-services.json` (next to `build.gradle`).
   This file is git-ignored — keep it out of the public repo.
4. Re-build: `npm run build:android:release`.

### Server-side: sending a push

Server-side push delivery isn't part of the mobile-shell scope — it
runs on the existing Karochat backend. Sketch of the flow:

1. App registers and stores its token in `public.push_tokens`
   (migration `0052_push_tokens.sql`, already applied).
2. A Supabase edge function (TBD, Phase 4+) listens to inserts on
   `messages` / `friendships` / `sex_ed_anonymous_qa` and looks up
   recipient tokens.
3. The edge function calls FCM HTTP v1
   (`https://fcm.googleapis.com/v1/projects/.../messages:send`) with
   the right Authorization Bearer token (derived from a service-account
   JSON file stored in Supabase secrets).
4. iOS recipients go through APNs instead — same fan-out, different
   transport.

The edge function bit is the next Karochat phase. Without it, tokens
register but no actual push messages are sent yet.

## Apple Push Notification service (iOS)

APNs is the iOS equivalent of FCM. Apple lets you authenticate with
either a `.p8` token (modern, recommended) or a `.p12` certificate
(legacy).

### One-time setup

1. **Apple Developer → Certificates, Identifiers & Profiles → Keys**.
2. **Create a key** → enable **Apple Push Notifications service (APNs)**.
3. Download the **`AuthKey_XXXXXXXXXX.p8`**. **You can only download it
   once** — store it in a password manager.
4. Note the **Key ID** (10 chars) and your **Team ID** (top-right of
   Developer portal).
5. Add the Push Notifications capability to your bundle id at
   **Identifiers → com.karochat.app → Capabilities → Push Notifications**.

The `.p8` file plus Key ID + Team ID is what the server-side push
function uses to mint a JWT and POST to
`https://api.push.apple.com/3/device/<device-token>`.

The mobile shell needs *no* code changes for APNs — just the right
entitlement (already set in `App.entitlements`) + Xcode signing.

## Netlify-side: cache clear & deploy

The mobile shell loads the production Next.js app, so any deploy of
the Next.js code immediately reaches every installed mobile client.
Same workflow you already have:

```bash
cd /path/to/Karo
rm -rf .next
netlify deploy --build --prod
```

There is no separate "mobile build" to push to a server unless you
update `karochat.apk` in `public/`.

## Versioning

Two version numbers to keep in sync when you ship:

| Where                             | Field                | Increment on every shipped build |
|-----------------------------------|----------------------|----------------------------------|
| `android/app/build.gradle`        | `versionCode`        | Always (Play Store rejects builds with same versionCode as a previous one) |
| `android/app/build.gradle`        | `versionName`        | When marketing version changes (`1.0.0 → 1.0.1`) |
| `ios/App/App.xcodeproj`           | `MARKETING_VERSION`  | Same as `versionName` |
| `ios/App/App.xcodeproj`           | `CURRENT_PROJECT_VERSION` | Always |

A small helper script `scripts/bump-version.mjs` lives in this repo's
backlog — for now, edit the files by hand.
