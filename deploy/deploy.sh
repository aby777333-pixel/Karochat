#!/usr/bin/env bash
# Karochat — one-shot droplet deploy.
#
# Run this ON the karochat.co server, from inside the Karochat repo folder:
#
#     cd /path/to/Karochat   &&   bash deploy/deploy.sh
#
# It pulls main, rebuilds, and restarts the app via PM2 (auto-detecting the
# process). This alone fixes the ISP-blocked sign-in: the new
# app/sb-proxy/[...path]/route.ts makes /sb-proxy/* forward to Supabase from
# inside Next, so users on networks that block *.supabase.co get in.
#
# The nginx /sb-proxy block (for Realtime over WebSocket) is a separate,
# optional step — see deploy/nginx-sb-proxy.conf. The app deploy below does NOT
# need it.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
echo "▶ repo: $(pwd)"

echo "▶ pulling main…"
git fetch origin main
git reset --hard origin/main      # match remote exactly (no local drift on prod)

echo "▶ installing deps…"
if [ -f package-lock.json ]; then npm ci; else npm install; fi

echo "▶ building…"
npm run build

echo "▶ restarting via PM2…"
# Find the PM2 process whose cwd is this repo; fall back to a name match.
PROC="$(pm2 jlist 2>/dev/null \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const a=JSON.parse(s);const here=process.cwd();const m=a.find(p=>p.pm2_env&&p.pm2_env.pm_cwd===here)||a.find(p=>/karo/i.test(p.name));if(m)console.log(m.name)}catch(e){}})' \
  2>/dev/null || true)"

if [ -n "${PROC:-}" ]; then
  echo "  → pm2 restart $PROC"
  pm2 restart "$PROC" --update-env
else
  echo "  ! Could not auto-detect the PM2 process. Current list:"
  pm2 list || true
  echo "  ! Restart it manually, e.g.:  pm2 restart <name>"
  exit 1
fi

echo "▶ verifying /sb-proxy (expect HTTP 200 + application/json, NOT text/html)…"
sleep 2
curl -s -o /dev/null -w "  status=%{http_code} type=%{content_type}\n" \
  "https://karochat.co/sb-proxy/auth/v1/health" \
  -H "apikey: ${SUPABASE_ANON_KEY:-no-key}" || true

echo "✅ done. If status=200 and type=application/json, the proxy is live."
echo "   (Realtime over the proxy still needs the nginx block — deploy/nginx-sb-proxy.conf)"
