// Karochat — /api/students/verify/send
//
// Server-side dispatcher for the verification email + SMS. Called by the
// VerificationGate right after start_verification succeeds. The route:
//   1. Resolves the caller's most recent verification row.
//   2. Decides which recipient(s) to message based on the row's method:
//        - edu_email        → email to verification_metadata.edu_email
//        - guardian_consent → email to guardian_email AND SMS to guardian_phone
//        - id_upload / result_upload → nothing to send (auto-verified)
//   3. Builds the consent URL ${SITE_URL}/students/verify/{token}?via=…
//   4. Sends via Resend / Twilio. Both wrappers gracefully skip when env
//      vars are missing — the route still returns 200 so the UI can show
//      "we tried, provider not configured".
//   5. Stamps consent_email_sent_at / consent_phone_sent_at via the
//      record_verification_send RPC so the UI can show "sent at".
//
// Response shape (always 200 on the happy path, 4xx only for auth/missing):
//   {
//     status: 'verified' | 'pending',
//     email: { attempted: bool, ok: bool, skipped?: bool, reason?: string },
//     sms:   { attempted: bool, ok: bool, skipped?: bool, reason?: string }
//   }

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendResendEmail } from "@/lib/notify/resend";
import { sendTwilioSms } from "@/lib/notify/twilio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Channel = {
  attempted: boolean;
  ok: boolean;
  skipped?: boolean;
  reason?: string;
};

function siteOrigin(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  // Fallback to the request host — useful in deploy-preview contexts
  // where NEXT_PUBLIC_SITE_URL points at production.
  try {
    return new URL(req.url).origin;
  } catch {
    return "https://magical-heliotrope-e4d7df.netlify.app";
  }
}

function consentUrl(origin: string, token: string, via: "email" | "phone") {
  return `${origin}/students/verify/${encodeURIComponent(token)}?via=${via}`;
}

function emailHtml(opts: {
  studentName: string;
  link: string;
  isGuardian: boolean;
  isMinor: boolean;
}) {
  const role = opts.isGuardian ? "parent / guardian" : "student";
  const heading = opts.isGuardian
    ? `Consent for ${opts.studentName} to join the Karochat Students Network`
    : `Confirm your Karochat student verification`;
  const body = opts.isGuardian
    ? `${opts.studentName} is asking to join Karochat's Students Network — a verified-students learning community with study squads, Help Beacons, and tutor office hours. Because they're under 18, we need your one-time consent before they can use it.`
    : `Tap the button below to confirm this email address is yours and finish unlocking the Karochat Students Network.`;
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#0b0d14;color:#e7e9f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b0d14;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="background:#11141e;border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:28px 32px;">
        <tr><td>
          <p style="margin:0;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#7df1cd;">Karochat · Students Network</p>
          <h1 style="margin:6px 0 14px 0;font-size:22px;font-weight:600;color:#fff;">${heading}</h1>
          <p style="margin:0 0 18px 0;font-size:14px;line-height:1.55;color:#c8ccd6;">${body}</p>
          <p style="margin:0 0 22px 0;">
            <a href="${opts.link}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#7df1cd;color:#0b0d14;font-weight:600;font-size:14px;text-decoration:none;">${opts.isGuardian ? "I consent — confirm now" : "Confirm my email"}</a>
          </p>
          <p style="margin:0 0 8px 0;font-size:12px;color:#8b90a0;">Or copy this link into your browser:</p>
          <p style="margin:0 0 18px 0;font-size:12px;color:#8b90a0;word-break:break-all;"><a href="${opts.link}" style="color:#7df1cd;text-decoration:none;">${opts.link}</a></p>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:18px 0;"/>
          <p style="margin:0 0 6px 0;font-size:11px;color:#8b90a0;">If you didn't expect this email, you can safely ignore it — nothing happens until you tap the button. The link expires when the ${role} resubmits the form.</p>
          ${opts.isMinor ? `<p style="margin:0;font-size:11px;color:#8b90a0;">Karochat applies extra safety rules to under-18 accounts: sessions auto-record, no cross-age DMs, and parent digest.</p>` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function emailText(opts: { studentName: string; link: string; isGuardian: boolean }) {
  if (opts.isGuardian) {
    return `${opts.studentName} is asking to join Karochat's Students Network.\n\nBecause they're under 18, we need your one-time consent. Tap to confirm:\n\n${opts.link}\n\nIf you didn't expect this, ignore the message — nothing happens until you tap the link.\n\n— Karochat`;
  }
  return `Confirm your Karochat student verification by tapping this link:\n\n${opts.link}\n\nIf you didn't request this, ignore it.\n\n— Karochat`;
}

function smsBody(opts: { studentName: string; link: string }) {
  return `Karochat: ${opts.studentName} is asking to join the Students Network. Tap to consent (one-time link): ${opts.link} — reply STOP to opt out.`;
}

export async function POST(req: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }

  // Resolve the caller's latest verification row + their display name.
  // get_my_verification was extended in migration 0040 to return the
  // consent_token + send timestamps.
  const [{ data: verifRows, error: verifErr }, { data: profileRow }] =
    await Promise.all([
      supabase.rpc("get_my_verification"),
      supabase
        .from("profiles")
        .select("username, display_name")
        .eq("id", user.id)
        .maybeSingle()
    ]);
  if (verifErr) {
    return NextResponse.json({ error: verifErr.message }, { status: 400 });
  }
  const verif = Array.isArray(verifRows) ? verifRows[0] : verifRows;
  if (!verif) {
    return NextResponse.json(
      { error: "no verification row found — submit the form first" },
      { status: 404 }
    );
  }

  const studentName =
    (profileRow?.display_name as string | null) ??
    (profileRow?.username as string | null) ??
    "A Karochat student";

  // Auto-verified methods don't need a send.
  if (verif.status === "verified") {
    return NextResponse.json({
      status: "verified",
      email: { attempted: false, ok: true, skipped: true, reason: "auto-verified" },
      sms: { attempted: false, ok: true, skipped: true, reason: "auto-verified" }
    });
  }

  if (!verif.consent_token) {
    return NextResponse.json(
      { error: "verification row has no consent_token — re-submit the form" },
      { status: 409 }
    );
  }

  const origin = siteOrigin(req);
  const method = verif.verification_method as string;
  const isMinor = !!verif.is_minor;

  // Decide recipients per method.
  let emailTo: string | null = null;
  let smsTo: string | null = null;
  let recipientIsGuardian = false;

  if (method === "edu_email") {
    // The edu_email lives in verification_metadata. Fetch it directly
    // since get_my_verification doesn't surface the jsonb payload.
    const { data: row } = await supabase
      .from("student_verifications")
      .select("verification_metadata")
      .eq("id", verif.id)
      .maybeSingle();
    const meta = (row?.verification_metadata ?? {}) as Record<string, any>;
    emailTo = typeof meta.edu_email === "string" ? meta.edu_email.trim() : null;
    recipientIsGuardian = false;
  } else if (method === "guardian_consent") {
    emailTo = (verif.guardian_email as string | null)?.trim() || null;
    smsTo = (verif.guardian_phone as string | null)?.trim() || null;
    recipientIsGuardian = true;
  }

  const email: Channel = { attempted: false, ok: false };
  const sms: Channel = { attempted: false, ok: false };

  // --- Email -------------------------------------------------------------
  if (emailTo) {
    const link = consentUrl(origin, verif.consent_token as string, "email");
    const subject = recipientIsGuardian
      ? `Consent needed — ${studentName} on Karochat`
      : "Confirm your Karochat student verification";
    email.attempted = true;
    const r = await sendResendEmail({
      to: emailTo,
      subject,
      html: emailHtml({ studentName, link, isGuardian: recipientIsGuardian, isMinor }),
      text: emailText({ studentName, link, isGuardian: recipientIsGuardian })
    });
    email.ok = r.ok;
    email.skipped = r.skipped;
    email.reason = r.reason;
    if (r.ok) {
      await supabase.rpc("record_verification_send", {
        p_verification_id: verif.id,
        p_channel: "email"
      });
    }
  } else {
    email.reason = "no recipient email on file";
  }

  // --- SMS ---------------------------------------------------------------
  if (smsTo) {
    const link = consentUrl(origin, verif.consent_token as string, "phone");
    sms.attempted = true;
    const r = await sendTwilioSms({
      to: smsTo,
      body: smsBody({ studentName, link })
    });
    sms.ok = r.ok;
    sms.skipped = r.skipped;
    sms.reason = r.reason;
    if (r.ok) {
      await supabase.rpc("record_verification_send", {
        p_verification_id: verif.id,
        p_channel: "phone"
      });
    }
  } else {
    sms.reason = "no recipient phone on file";
  }

  return NextResponse.json({
    status: verif.status,
    email,
    sms
  });
}
