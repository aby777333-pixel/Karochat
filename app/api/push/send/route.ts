// Karochat — /api/push/send
//
// Internal sender for Web Push. Called server-to-server by the Postgres
// radar_ping_notify() trigger (via pg_net) with a shared secret, the
// recipient's subscriptions, and a notification payload. Signs + sends each
// push with the VAPID private key.
//
// Not a public endpoint: every request must carry the shared secret. If the
// VAPID keys aren't configured the route degrades to a no-op so nothing breaks.

import { NextResponse } from "next/server";
import webpush from "web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUB = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@karochat.co";
const SECRET = process.env.RADAR_PUSH_SECRET;

let configured = false;
if (PUB && PRIV) {
  try {
    webpush.setVapidDetails(SUBJECT, PUB, PRIV);
    configured = true;
  } catch {
    configured = false;
  }
}

type Sub = { endpoint: string; p256dh: string; auth: string };

export async function POST(req: Request) {
  if (!configured) {
    return NextResponse.json({ ok: false, reason: "vapid-missing" }, { status: 200 });
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  if (!SECRET || body?.secret !== SECRET) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const subs: Sub[] = Array.isArray(body?.subscriptions) ? body.subscriptions : [];
  const note = body?.notification ?? {};
  const payload = JSON.stringify({
    title: note.title ?? "Karochat",
    body: note.body ?? "",
    url: note.url ?? "/",
    tag: note.tag ?? "karochat"
  });

  let sent = 0;
  let failed = 0;
  await Promise.all(
    subs.map(async (s) => {
      if (!s?.endpoint || !s?.p256dh || !s?.auth) {
        failed++;
        return;
      }
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
          { TTL: 600 }
        );
        sent++;
      } catch {
        // 404/410 = expired endpoint; other = transient. Drop silently — the
        // client re-subscribes (upsert by endpoint) on its next visit.
        failed++;
      }
    })
  );

  return NextResponse.json({ ok: true, sent, failed });
}
