# Store publishing — Play Store + App Store

Both stores ask similar questions: who built the app, what it does,
who can use it, what data it collects. This page is a checklist for
the first submission.

---

## Google Play Store

### Account setup (one-time)

1. Sign up at <https://play.google.com/console>. **One-time $25 fee.**
2. Verify identity (passport or government ID). Takes 1-3 days.
3. **Developer account name** — this is what users see attributed to
   the app. Pick carefully; changing it later is painful.

### App creation

1. **Play Console → Create app**.
2. **App name**: Karochat.
3. **Default language**: English (United States) — change if you
   prefer en-IN.
4. **App / game**: App.
5. **Free / paid**: Free.
6. Sign the Play Console developer agreements + US export laws +
   pre-marketing acceptance.

### Store listing — required assets

| Asset                        | Spec                          | Where to get it                          |
|------------------------------|-------------------------------|------------------------------------------|
| App icon                     | 512×512 PNG, no alpha         | `mobile app/resources/icon.png` (just upload) |
| Feature graphic              | 1024×500 PNG/JPG, no alpha    | Create a banner in Canva or Figma        |
| Phone screenshots            | 2-8 screenshots, 1080×1920 or 16:9 | Run the app, take screenshots on a real device or emulator |
| 7-inch tablet (optional)     | 1024×768 minimum              | Optional but recommended                  |
| 10-inch tablet (optional)    | 1080×1920 minimum             | Optional but recommended                  |
| Short description            | 80 chars                      | "Free, anon-friendly chat. Rooms, DMs, voice, books, sex ed, AI." |
| Full description             | 4000 chars                    | Write a real one — see template below    |
| Privacy policy URL           | Hosted on your domain         | `https://magical-heliotrope-e4d7df.netlify.app/legal/privacy` |

#### Full description template

```
Karochat — chat, make friends, share, care.

Rooms by topic, region, and identity — 2,400+ to drop into, plus
unlimited custom rooms you create yourself. Direct messages with
disappearing media. Voice and video rooms powered by LiveKit. Books
library with 0% author royalty take. Sex education library written
by educators (age-tiered, queer-affirming). Student verification
network. Karo, an AI co-pilot that lives in every room.

What makes Karochat different:
• Anonymous sign-in. No phone number required for the chat surface.
• Multi-identity personas — up to 3 per account, switch any time.
• Privacy modes — open, friends-only, invisible, decoy, stealth.
• Panic exit — Ctrl/⌘+Shift+Backspace to leave fast.
• No ads in the chat. Sponsor slots only on rails for desktop.

Get started:
• Open the app, type a name, you're in.
• Tap a category to see live rooms, or hit + to create your own.
• Add friends, send DMs, give vibes.
• Tap @karo in any room for a quick AI assist.

Made with ♥ in India. Free forever for the chat surface.
```

### Content rating

Karochat has adult content (Adult & Sex-Positive rooms), sexual
references, and user-generated content. The Play Store IARC
questionnaire will land it at **Adults Only (Mature 17+)**. Be honest
on every question — misrepresentation gets apps suspended. Topics that
matter:

- **Sex / nudity** — "Mild" (descriptions in sex-ed content). Karochat
  has no nudity image uploads as a moderated rule; if you allow
  user-uploaded nudity in adult rooms, mark "Strong".
- **Crude humor** — "None" or "Mild" depending on your rooms.
- **Violence** — "None".
- **Drugs, tobacco, alcohol** — "None" unless you have rooms
  specifically about them.
- **Gambling** — "None".
- **User interaction** — **Yes**. Users can interact, share content,
  exchange info.

### Data safety form

Play Store requires you to declare exactly what data you collect.
Karochat's surface is what matters here:

| Data                | Collected? | Required?     | Shared?  | Purpose                          |
|---------------------|------------|---------------|----------|----------------------------------|
| Email               | Yes        | Optional      | No       | Account login                     |
| Phone number        | Yes        | Optional (guardian consent for minors) | No | Account recovery + minor verification |
| Username            | Yes        | Required      | Yes (public) | Identity in chat                |
| Photos              | Yes        | Optional      | Yes (visible to room members) | Chat attachments + stories |
| Voice recordings    | Yes        | Optional      | Yes (visible to room members) | Voice notes + calls |
| Approx. location    | No         | —             | —        | Not collected                     |
| Precise location    | No         | —             | —        | Not collected                     |
| Web browsing history| No         | —             | —        | Not collected                     |
| App activity        | Yes (in-app actions) | Required | No  | Operations, abuse prevention      |
| Crash logs          | Yes        | Required      | No       | Operations                        |
| Device IDs          | No         | —             | —        | Not collected                     |
| User communications | Yes        | Required      | No (within Karochat only) | The whole point of the app |

### Upload + roll out

1. **Production → Create new release**.
2. Upload `mobile app/android/app/build/outputs/bundle/release/app-release.aab`.
3. Release name: `1.0.0`.
4. Release notes (per language) — keep them honest, under 500 chars per language.
5. **Review release → Start rollout to production**.
6. First review takes **1-7 days**. Subsequent updates: usually hours.

> **Recommendation**: do a **closed testing track first** with 5-10
> trusted testers (your existing Karochat usernames). Catches crash
> reports and ANRs before they hit the open store.

---

## Apple App Store

### Account setup (one-time)

1. **Apple Developer Program** — <https://developer.apple.com/programs>.
   **$99/year**, recurring. Pay with a card or via reseller.
2. Verify identity (passport, DUNS number for companies).
3. **App Store Connect** — <https://appstoreconnect.apple.com>. Same
   login as Developer.

### App creation

1. **My Apps → +** → **New App**.
2. **Platform**: iOS.
3. **Name**: Karochat. (Maxes out at 30 chars.)
4. **Primary language**: English (U.S.).
5. **Bundle ID**: `com.karochat.app` (must already exist in Developer
   → Identifiers — see [SIGNING.md](SIGNING.md#ios-code-signing)).
6. **SKU**: `karochat-ios-1`. (Internal — never shown to users.)
7. **Full access** (you, and any team admins).

### Required metadata

| Field                  | Spec / value                         |
|------------------------|--------------------------------------|
| App icon               | 1024×1024 PNG, no alpha (Xcode handles this; lives in `ios/App/App/Assets.xcassets/AppIcon.appiconset`) |
| Screenshots (6.5" iPhone) | At least 1, up to 10. 1242×2688 portrait. Required size. |
| Screenshots (6.7" iPhone Pro Max) | Same as 6.5", different aspect — 1290×2796 |
| Screenshots (12.9" iPad Pro) | Required if your app supports iPad. 2048×2732 |
| Description            | Same as Play Store full description, max 4000 chars |
| Promotional text       | 170 chars, can be updated without re-submitting |
| Keywords               | 100 chars total, comma-separated. e.g. `chat,friends,rooms,anonymous,india,LGBTQ,books,sex ed` |
| Support URL            | `https://magical-heliotrope-e4d7df.netlify.app/legal/community` |
| Marketing URL          | Optional. Your landing page if you have one. |
| Privacy policy URL     | `https://magical-heliotrope-e4d7df.netlify.app/legal/privacy` |

### Age rating

Apple's questionnaire is similar to Google's IARC. Karochat lands at
**17+** for:

- Frequent / intense mature / suggestive themes — **Yes** (sex ed,
  adult rooms).
- Frequent / intense sexual content or nudity — **No** (no nudity
  uploaded; descriptions only).
- Unrestricted web access — **Yes** (links in chat, browser plugin).
- User-generated content — **Yes**.

### Sign in with Apple

If you offer **sign-in with Google / Facebook / phone** as
alternatives, Apple requires you to also offer **Sign in with Apple**
on iOS. Karochat today uses Supabase magic-link + anonymous sign-in —
neither is a "third-party sign in", so you're exempt. **If you add
Google sign-in later, you must also add Sign in with Apple.**

### Push notifications privacy

App Store reviewers check that your push permission ask explains *why*
the app needs notifications. Karochat asks ~6s after first load, after
the user has seen the lobby — this is fine. The string itself lives in
`Info.plist → NSUserNotificationsUsageDescription` (already filled in).

### Upload + review

1. Build an archive in Xcode (see [BUILD.md](BUILD.md#step-by-step-first-ever-ios-archive)).
2. **Window → Organizer → Distribute App → App Store Connect → Upload**.
3. Wait ~10 minutes for processing.
4. In App Store Connect, the build will appear under **My Apps →
   Karochat → TestFlight** *and* **App Store → 1.0 Prepare for
   Submission → Build**.
5. **Submit for Review**. First review: 1-3 days. Subsequent: hours to
   1 day.

> **Recommendation**: use **TestFlight** with 5-10 testers first.
> Catches crashes Apple's automated checks don't.

### Common rejection reasons (and how Karochat avoids them)

1. **Guideline 4.2 — Minimum Functionality** ("Your app is a wrapped
   website"). Karochat is functionally a chat app with persistent
   sessions, native push, deep links, native share — well past
   minimum functionality. The first review may still flag this; reply
   pointing out the native plugins in use.
2. **Guideline 5.1.1 — Data Collection and Storage**. Your privacy
   policy URL must be reachable, written in plain language, and
   accurately describe what Karochat collects. Don't skip this.
3. **Guideline 1.2 — User-Generated Content**. You must have a way to
   report objectionable content + block abusive users + a 24h-SLA
   response. Karochat already has /admin/reports, friend block, room
   moderation. Document it in the App Review notes.
4. **Sex ed content (17+ rating)**. Apple's reviewers occasionally
   reject sex-ed apps — keep the educational framing very explicit.
   The "education, not medical care" banner on every /sexed page
   helps.

### Pricing + availability

- **Free**. (You can charge later via in-app purchases.)
- **Available in all territories** unless you have a legal reason not
  to ship somewhere.
- **Pre-orders** — skip on v1.

---

## Both stores: post-launch

- **Crash reports**: Play Console → Crashes & ANRs; App Store Connect
  → TestFlight or Xcode Organizer. Aim for under 1% crash rate.
- **Updates**: increment versionCode / CFBundleVersion on every
  upload. Re-submit. Review on subsequent updates is fast.
- **Pulling an app**: Play Console → Setup → Advanced → Unpublish app.
  App Store Connect → Pricing → "Remove from Sale".

Both stores will email you when they need anything (rejection, change
of terms, policy updates). Don't ignore those emails.
