# Karochat

> Meet your mate, chat, make friends, accept, adapt, share and care, live and let live, be happy because life is too short, and the future is uncertain.

Realtime cross-platform messenger. v0 is a web app (Next.js 14 + Supabase) that installs as a PWA on desktop, Android, and iOS from the same codebase. Native Tauri (desktop) and Expo (mobile) shells are planned per the design brief in `Nudge_Claude_Code_Super_Prompt.docx`.

## What's in v0

- Email magic-link sign in (Supabase Auth)
- Username/display-name onboarding
- Single global lobby with realtime messages (Supabase Realtime)
- Live online-presence count
- Dark glassmorphism UI, PWA-installable

## One-time setup

### 1. Get your Supabase keys

Open https://supabase.com/dashboard/project/dxgduusbdvslusbushxi/settings/api and copy the **anon public** key.

Create `.env.local` from the template:

```powershell
Copy-Item .env.example .env.local
```

Edit `.env.local` and paste the anon key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 2. Run the database migration

Open the Supabase SQL editor at
https://supabase.com/dashboard/project/dxgduusbdvslusbushxi/sql/new
and paste the contents of `supabase/migrations/0001_init.sql`. Run it.

This creates the `profiles` and `messages` tables, RLS policies, the `messages_with_sender` view, and enables realtime on `messages`.

### 3. Configure auth redirect URLs

In Supabase → **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (for local dev)
- **Redirect URLs**: add `http://localhost:3000/auth/callback`

When you deploy to Netlify, add the Netlify URL (e.g. `https://magical-heliotrope-e4d7df.netlify.app`) and its `/auth/callback`.

### 4. Install and run

```powershell
npm install
npm run dev
```

Open http://localhost:3000.

## Deploying to Netlify

This repo includes `netlify.toml` configured for the official Next.js plugin.

1. Connect the GitHub repo to your Netlify project (`magical-heliotrope-e4d7df`).
2. Add env vars in Netlify → Site settings → Environment:
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://dxgduusbdvslusbushxi.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your anon key
   - `NEXT_PUBLIC_SITE_URL` = your Netlify production URL
3. Add the Netlify URL + `/auth/callback` to Supabase redirect URLs.
4. Push. Netlify builds with `npm run build` and the Next.js plugin handles SSR.

## Cross-platform

- **Web**: works in every modern browser.
- **Desktop / Android / iOS**: installable as a PWA via the browser's "Install app" / "Add to home screen" prompt. The manifest, theme color, and standalone display mode are wired up.
- **Native shells**: planned. Tauri 2.x for desktop and Expo for mobile are the chosen stacks (see `Nudge_Claude_Code_Super_Prompt.docx`). They will wrap this same web build.

## Project layout

```
app/
  page.tsx              # landing + login (magic link)
  LoginForm.tsx
  auth/callback/route.ts
  onboarding/           # pick username + display name
  chat/                 # the lobby
components/             # Brand, Button
lib/supabase/           # browser, server, middleware clients
supabase/migrations/    # SQL — paste into Supabase SQL editor
public/                 # PWA icon + manifest
```

## Roadmap (from the design brief)

This v0 stops at Phase 3-lite. The brief plans 14 phases — DMs and groups, presence states, nudges, voice/video via LiveKit, AI features (Sarvam + OpenAI + Whisper), rooms, themes, admin dashboard, and signed desktop/mobile builds. The v0 schema and UI are deliberately structured so those land as additions, not rewrites.
