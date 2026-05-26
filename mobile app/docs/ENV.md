# Environment & configuration

## Which URL does the shell load?

The native shell ships with a hard-coded production URL:

```ts
// mobile app/capacitor.config.ts
server: {
  url: "https://magical-heliotrope-e4d7df.netlify.app"
}
```

You can override this for a single build by setting `CAP_SERVER_URL`
before running `cap sync`:

```bash
# Point a debug build at next dev running on your laptop
CAP_SERVER_URL=http://192.168.1.42:3000 npm run sync
CAP_SERVER_URL=http://192.168.1.42:3000 npm run run:android
```

The value is baked into `android/app/src/main/assets/capacitor.config.json`
and `ios/App/App/capacitor.config.json` at `sync` time, so the same
binary always points at the same URL.

## Custom domain

When you move Karochat to its own domain (e.g. `karochat.com`):

1. Update `capacitor.config.ts`:
   ```ts
   server: {
     url: "https://karochat.com",
     allowNavigation: [
       "karochat.com",
       "*.karochat.com",
       // … all your other allowed hosts
     ]
   }
   ```
2. Update `AndroidManifest.xml`'s `<data android:host="..." />` deep-link
   intent filter.
3. Update `Info.plist`'s `WKAppBoundDomains` array.
4. Update `App.entitlements`'s `applinks:karochat.com`.
5. Run `npm run sync`, build a new release, ship.

## Per-environment builds (staging / prod)

The cleanest split is **separate Android applicationIds + iOS bundle
ids per environment**, with the same source code.

```ts
// capacitor.config.ts — read appId from env
const ENV = process.env.CAP_ENV ?? "production";
const config: CapacitorConfig = {
  appId: ENV === "staging" ? "com.karochat.app.staging" : "com.karochat.app",
  appName: ENV === "staging" ? "Karochat (Staging)" : "Karochat",
  server: {
    url: ENV === "staging"
      ? "https://staging.karochat.com"
      : "https://karochat.com"
  }
  // …
};
```

Then build with:
```bash
CAP_ENV=staging npm run sync && npm run build:android:release
CAP_ENV=production npm run sync && npm run build:android:release
```

Both APKs install side-by-side on the same device, so QA can test both.

## Required env vars on the server (Netlify)

The mobile shell adds no new server-side env variables. The existing
Karochat env vars cover everything the shell needs through the WebView:

| Variable                          | Purpose                          |
|-----------------------------------|----------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`        | Supabase project URL             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | Supabase anon key                |
| `NEXT_PUBLIC_SITE_URL`            | Used for OG / redirect URLs      |
| `OPENAI_API_KEY`                  | Karo AI surface                  |
| `OPENAI_MODEL`                    | Defaults to gpt-4o-mini          |
| `LIVEKIT_URL`, `..._API_KEY`, `..._API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL` | Voice + video calls |

When push delivery lands (Phase 4+), add:

| Variable           | Purpose                            |
|--------------------|------------------------------------|
| `FCM_PROJECT_ID`   | Firebase project that owns FCM     |
| `FCM_SERVICE_ACCOUNT_JSON` | Base64-encoded service account key |
| `APNS_KEY`         | `AuthKey_*.p8` file contents       |
| `APNS_KEY_ID`      | 10-char Key ID                     |
| `APNS_TEAM_ID`     | 10-char Apple Team ID              |

These go into Supabase secrets (for an edge function) — not into
Netlify env, since the Netlify side never sends pushes.

## Tooling versions known to work

| Tool             | Version that built v1.0.0 |
|------------------|---------------------------|
| Node             | 20.x or 24.x              |
| npm              | 10.x or 11.x              |
| Capacitor CLI    | 6.2.1                     |
| Android Gradle Plugin | 8.7 (set by Capacitor)  |
| Gradle           | 8.10.2 (wrapper bundled)  |
| JDK              | 17                        |
| compileSdk       | 34                        |
| minSdk           | 22                        |
| targetSdk        | 34                        |
| Xcode            | 15.4+                     |
| iOS deployment target | 13.0                  |
| CocoaPods        | 1.15+                     |

These are pinned in `mobile app/package.json` and
`mobile app/android/variables.gradle`. Don't auto-update without
running through the full BUILD.md flow on a clean machine first.
