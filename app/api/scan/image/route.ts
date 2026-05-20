// Karochat — image scan API. Every uploaded image must pass through this
// route before being saved as a chat message or story. We support pluggable
// scanners:
//
//   1. Cloudflare CSAM Scanning Tool (when CF_CSAM_ACCOUNT_ID + CF_CSAM_API_TOKEN
//      are set as env vars). See https://developers.cloudflare.com/cache/
//      reference/csam-scanning/.
//   2. PhotoDNA (when PHOTODNA_API_KEY is set). The implementation here is
//      a stub but the contract is the same: returns { blocked: true } if the
//      image matched a known-bad hash.
//   3. No scanner configured → returns { blocked: false, scanning_disabled: true }
//      so dev/staging environments don't break.
//
// In all cases we record the call into `image_scans` (Supabase) for audit.
// Positive matches additionally insert a `report` of category='minor' so the
// admin queue picks them up automatically.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Body = {
  publicUrl: string;
  bucket?: string;
  path?: string;
};

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.publicUrl) {
    return NextResponse.json({ error: "publicUrl required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  const CF_ACCOUNT = process.env.CF_CSAM_ACCOUNT_ID;
  const CF_TOKEN = process.env.CF_CSAM_API_TOKEN;
  const PHOTODNA_KEY = process.env.PHOTODNA_API_KEY;

  let blocked = false;
  let provider: "cloudflare" | "photodna" | "none" = "none";
  let providerDetail: string | null = null;

  // 1. Cloudflare CSAM scanning
  if (CF_ACCOUNT && CF_TOKEN) {
    provider = "cloudflare";
    try {
      // Cloudflare's CSAM API expects the image be retrievable from a URL
      // we control (their bot fetches it). We pass through the publicUrl we
      // just got from Supabase storage.
      const r = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/csam-uploads/scan`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${CF_TOKEN}`,
            "content-type": "application/json"
          },
          body: JSON.stringify({ url: body.publicUrl })
        }
      );
      if (r.ok) {
        const j = (await r.json()) as { result?: { match?: boolean } };
        blocked = j?.result?.match === true;
        providerDetail = blocked ? "cf-match" : "cf-clean";
      } else {
        providerDetail = `cf-error-${r.status}`;
      }
    } catch (e: any) {
      providerDetail = `cf-throw-${e?.message ?? "unknown"}`;
    }
  }
  // 2. PhotoDNA fallback (stub — wire to real endpoint when subscribed)
  else if (PHOTODNA_KEY) {
    provider = "photodna";
    try {
      const r = await fetch("https://api.microsoftmoderator.com/photodna/v1.0/Match", {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": PHOTODNA_KEY,
          "content-type": "application/json"
        },
        body: JSON.stringify({ DataRepresentation: "URL", Value: body.publicUrl })
      });
      if (r.ok) {
        const j = (await r.json()) as { IsMatch?: boolean };
        blocked = !!j?.IsMatch;
        providerDetail = blocked ? "pdna-match" : "pdna-clean";
      } else {
        providerDetail = `pdna-error-${r.status}`;
      }
    } catch (e: any) {
      providerDetail = `pdna-throw-${e?.message ?? "unknown"}`;
    }
  }

  // Log audit row (best-effort — never fail the scan because of audit).
  try {
    await supabase.from("image_scans").insert({
      user_id: user.id,
      public_url: body.publicUrl,
      bucket: body.bucket ?? null,
      path: body.path ?? null,
      provider,
      provider_detail: providerDetail,
      blocked
    });
  } catch {
    // ignore — table might not exist on first run
  }

  // If blocked: try to delete the just-uploaded object, and auto-file a
  // priority report so the admin queue sees it immediately.
  if (blocked) {
    if (body.bucket && body.path) {
      try {
        await supabase.storage.from(body.bucket).remove([body.path]);
      } catch {
        // best-effort
      }
    }
    try {
      await supabase.rpc("create_report", {
        p_target_kind: "user",
        p_target_id: user.id,
        p_category: "minor",
        p_body: `Auto-flag: image scan tripped (${providerDetail}).`
      });
    } catch {
      // best-effort
    }
  }

  return NextResponse.json({
    blocked,
    provider,
    scanning_disabled: provider === "none"
  });
}
