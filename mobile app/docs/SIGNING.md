# Signing — keystores, p8 files, and how not to lose them

This page covers everything that has to be done **exactly once** and
**must not be lost**. Losing your Android keystore means you cannot
update the app on Play Store — you'd have to publish a new app with a
different package name. Losing your APNs key just means you generate a
new one and update the server.

## Android keystore

### 1. Generate

Do this once per app, on a trusted machine. The `karochat-release.jks`
file + the passwords it asks for are the only proof that future builds
are "the same app" Play Store knows.

```bash
cd "mobile app/android"

keytool -genkeypair -v \
  -keystore karochat-release.jks \
  -alias karochat \
  -keyalg RSA -keysize 4096 -validity 10000
```

Answer the prompts:
- **Keystore password** — generate a strong random one (1Password / Bitwarden).
- **Key password** — can be the same as the keystore password.
- Distinguished name fields — your business name, city, country code.
  These get baked into the cert and are visible on Play Console signing reports.

### 2. Wire it into Gradle

```bash
# In mobile app/android/
cp keystore.properties.example keystore.properties
```

Edit `keystore.properties`:

```properties
storeFile=karochat-release.jks
storePassword=<the keystore password>
keyAlias=karochat
keyPassword=<the key password>
```

Both `keystore.properties` and `*.jks` are in `.gitignore`. Verify:

```bash
git status --ignored "mobile app/android/keystore.properties" \
                     "mobile app/android/karochat-release.jks"
# Both should appear under "Ignored files".
```

### 3. Verify signing works

```bash
cd "mobile app"
npm run build:android:release
keytool -printcert -jarfile \
  android/app/build/outputs/apk/release/app-release.apk
```

You should see your CN / O / C values. **If you see `CN=Android Debug`,
the keystore wasn't picked up — recheck the file paths in
`keystore.properties`.**

### 4. Back it up

The keystore is the most precious file in this repository's universe.

- **Put a copy in your password manager** (1Password supports file
  attachments).
- **Put another copy on an offline encrypted USB drive** in a different
  physical location.
- **Print the SHA-256 fingerprint** (`keytool -list -v -keystore
  karochat-release.jks`) and store it with your business records — if
  you ever need to prove app ownership to Google or Apple, that
  fingerprint matters.
- **Do not** put it in cloud storage that's accessible to a corporate
  team beyond yourself unless you understand the implications.

### Play Store "App Signing by Google Play"

Play Console offers an opt-in feature where Google holds the *upload*
key (the keystore you just made) but generates a separate *signing*
key that they hold themselves. The advantages:
- If you lose the upload keystore, Google can rotate to a new one.
- Smaller APKs get split + signed per-device automatically.

**Recommendation: enable Play Store App Signing on first upload.**
You still need the upload key for every upload — it just no longer is
the irreplaceable one.

## iOS code signing

This is mostly Xcode's job. Once per developer account:

1. **Apple Developer → Certificates, Identifiers & Profiles**.
2. **Identifiers → +** → App IDs → App → continue.
3. Bundle ID: `com.karochat.app`. Description: `Karochat`.
4. Enable capabilities:
   - Push Notifications
   - Associated Domains
5. **Profiles → + → App Store** → choose this app id → name it
   `Karochat App Store` → download.
6. In Xcode, on the `App` target → **Signing & Capabilities**:
   - Uncheck "Automatically manage signing" if you want to use the
     profile manually, otherwise leave it checked and pick your team.

## APNs key

See [DEPLOY.md → Apple Push Notification service](DEPLOY.md#apple-push-notification-service-ios)
for the actual download steps.

Once you have `AuthKey_XXXXXXXXXX.p8`:

- **Save it in your password manager.** Apple does not let you re-download.
- The server-side push function (Phase 4+) will need: the file contents,
  the Key ID (10 chars), and the Team ID (also 10 chars).
- Set them as Supabase secrets, not as committed env vars:
  ```bash
  supabase secrets set APNS_KEY="$(cat AuthKey_XXXXXXXXXX.p8)" \
                       APNS_KEY_ID=XXXXXXXXXX \
                       APNS_TEAM_ID=YYYYYYYYYY
  ```

## What happens when keys are compromised

| Compromise              | What to do |
|-------------------------|------------|
| Android keystore leaked | If using Play App Signing, rotate the upload key via Play Console (Settings → App Signing → Request upload key reset). Otherwise, you cannot recover — publish as a new app id. |
| `google-services.json` leaked | It's not a secret per se (contains your project / sender id) — but if you used any private API keys in it, regenerate them in Firebase Console. |
| APNs `.p8` leaked       | **Apple Developer → Keys → revoke**. Generate a new one. Update Supabase secrets. |
| App Store Connect API key leaked | **App Store Connect → Users and Access → Keys → revoke**. Generate new. |
