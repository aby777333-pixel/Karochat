// Karochat — Resend transactional email wrapper.
//
// One function: sendResendEmail(). Returns a structured result instead of
// throwing so the caller (the verify/send route) can keep the request 200
// and surface per-channel status to the client even when the provider is
// not configured or the API call fails.
//
// Required env vars (set on Netlify):
//   RESEND_API_KEY    — your Resend secret key
//   RESEND_FROM       — e.g. "Karochat <verify@karochat.app>"
//
// When RESEND_API_KEY is missing we return { ok: false, skipped: true }
// so the route still responds successfully and the operator can wire the
// provider in afterwards without breaking the verification flow.

export type SendEmailResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  status?: number;
  body?: string;
  id?: string;
};

export async function sendResendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "Karochat <onboarding@resend.dev>";
  if (!key) {
    return {
      ok: false,
      skipped: true,
      reason: "RESEND_API_KEY is not set on this environment."
    };
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        reply_to: opts.replyTo
      })
    });
    const raw = await resp.text();
    let id: string | undefined;
    try {
      const parsed = JSON.parse(raw) as { id?: string };
      id = parsed?.id;
    } catch {
      // Non-JSON body — keep the raw text in body for debugging.
    }
    return {
      ok: resp.ok,
      status: resp.status,
      body: raw,
      id,
      reason: resp.ok ? undefined : `Resend returned HTTP ${resp.status}.`
    };
  } catch (e: any) {
    return {
      ok: false,
      reason: `Resend fetch failed: ${String(e?.message ?? e)}`
    };
  }
}
