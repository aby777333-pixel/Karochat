# Build chain — local builds for Android + iOS

This page covers running a build on your own machine. The CI / Play
Store / App Store paths are in [DEPLOY.md](DEPLOY.md) and
[STORE.md](STORE.md).

## Prerequisites

### All platforms
- **Node.js 20+** (you have 24 — fine)
- **npm 10+** (you have 11 — fine)
- `cd "mobile app" && npm install` — already done once.

### Android
- **JDK 17** (preferred) or JDK 21. Test with `java -version`.
  - Recommended install: **Android Studio Koala (2024.1) or newer** bundles
    JDK + SDK + emulator in one download.
  - Alternative: install Eclipse Temurin from <https://adoptium.net>.
- **Android SDK** (API level 34, build-tools 34.x).
  - If installed via Android Studio, `ANDROID_HOME` is typically
    `%LOCALAPPDATA%\Android\Sdk` (Windows) or `~/Library/Android/sdk`
    (macOS). Set it in your shell profile:
    ```bash
    export ANDROID_HOME="$HOME/Library/Android/sdk"
    export PATH="$PATH:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"
    ```
- **Gradle** is bundled per-project as `gradlew` / `gradlew.bat` — you
  don't need a system install.

### iOS (macOS only)
- **macOS 13+ with Xcode 15+** from the App Store.
- **CocoaPods** — install via `sudo gem install cocoapods` (or
  `brew install cocoapods`).
- **Apple Developer Program** membership for device testing (Personal
  Team works for sideload-on-your-own-device).

## Build matrix

| Output           | Command                              | Notes                          |
|------------------|--------------------------------------|--------------------------------|
| Debug APK        | `npm run build:android:debug`        | Unsigned. Sideload on any device with USB debugging. |
| Release APK      | `npm run build:android:release`      | Needs `keystore.properties` — see [SIGNING.md](SIGNING.md). |
| Release AAB      | `npm run bundle:android:release`     | This is the artefact you upload to Play Console. |
| iOS Archive      | Xcode → Product → Archive            | Requires macOS + Xcode.        |
| iOS .ipa export  | Xcode → Window → Organizer → Distribute | Or `xcodebuild -exportArchive …`. |

## Step-by-step: first-ever Android release APK

```bash
# 1. Sync the JS / config layer into the native project
cd "mobile app"
npm install                          # only first time, or after a plugin add
npm run sync                         # re-runs after capacitor.config.ts edits

# 2. Generate or copy your release keystore (see SIGNING.md)
cp android/keystore.properties.example android/keystore.properties
# … edit android/keystore.properties with your real values …
# … drop your karochat-release.jks into android/ …

# 3. Build
npm run build:android:release        # APK
#   OR
npm run bundle:android:release       # AAB for Play Console

# 4. Find the artefact
ls android/app/build/outputs/apk/release/        # app-release.apk
ls android/app/build/outputs/bundle/release/     # app-release.aab

# 5. Sanity-check signing
keytool -printcert -jarfile android/app/build/outputs/apk/release/app-release.apk
```

## Step-by-step: first-ever iOS Archive

```bash
cd "mobile app"
npm install
npm run sync
cd ios/App && pod install
cd ../..
npm run open:ios                     # opens App.xcworkspace
```

In Xcode:

1. Top bar: select **App** scheme + **Any iOS Device (arm64)** as target.
2. **Signing & Capabilities** tab on the `App` target:
   - Team → your Apple Developer team.
   - Bundle id → `com.karochat.app`.
   - Ensure **Push Notifications** capability is enabled.
   - Ensure **Associated Domains** capability is present with
     `applinks:magical-heliotrope-e4d7df.netlify.app` (already in
     `App.entitlements`, but Xcode must register it with the team).
3. **Product → Archive**. Wait for it to finish.
4. **Window → Organizer** → select the latest archive →
   **Distribute App → App Store Connect → Upload**.

## Iterating: how to actually develop

The fastest dev loop is to run `next dev` on your laptop and point a
debug build of the mobile shell at it.

```bash
# Terminal 1 — Next.js dev
cd /path/to/Karo
npm run dev                          # serves http://localhost:3000

# Terminal 2 — figure out your LAN IP
ipconfig            # Windows — find "IPv4 Address"
# OR
ifconfig | grep "inet " | grep -v 127.0.0.1   # macOS / Linux

# Terminal 3 — mobile shell pointed at your laptop
cd "mobile app"
CAP_SERVER_URL=http://192.168.1.42:3000 npm run sync
CAP_SERVER_URL=http://192.168.1.42:3000 npm run run:android
```

When pointing at HTTP, also flip `cleartext: true` in
`capacitor.config.ts`. Never ship a release build with cleartext.

## Troubleshooting

### Gradle errors mentioning the folder name
The folder is literally `mobile app` (with a space). On some Windows
machines this confuses Gradle. Workarounds, in order of preference:
1. Run builds from a Git Bash / WSL shell — both handle the path fine.
2. Use `gradlew.bat` directly (Windows native), quoting the path:
   `cd "android" && .\gradlew.bat assembleRelease`.
3. Last resort: rename the folder to `mobile-app` and update
   `tsconfig.json` paths.

### `Failed to install JDK` from `cap sync`
Capacitor doesn't install JDK for you. Install Android Studio (which
ships JDK 17) and ensure `JAVA_HOME` is set.

### iOS pod install fails on M1/M2 Macs
Run with the Rosetta architecture once:
`arch -x86_64 pod install`. Subsequent runs work without it.

### "Unable to find xcodebuild" warning on Windows
Expected. iOS builds only happen on macOS.
