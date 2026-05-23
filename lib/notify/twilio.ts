// Karochat — Twilio SMS wrapper.
//
// One function: sendTwilioSms(). Returns a structured result instead of
// throwing so the caller can keep the request 200 and surface per-channel
// status to the client even when the provider isn't configured.
//
// Required env vars (set on Netlify):
//   TWILIO_ACCOUNT_SID   — Twilio account SID (starts with "AC…")
//   TWILIO_AUTH_TOKEN    — Twilio auth token
//   TWILIO_FROM          — verified sending number in E.164 (e.g. "+15551234567")
//                          or a Messaging Service SID (starts with "MG…").
//
// When any of those is missing we return { ok: false, skipped: true } so
// the route still responds successfully and the operator can wire the
// provider in afterwards.

export type SendSmsResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  status?: number;
  body?: string;
  sid?: string;
};

export async function sendTwilioSms(opts: {
  to: string;
  body: string;
}): Promise<SendSmsResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const tok = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  if (!sid || !tok || !from) {
    return {
      ok: false,
      skipped: true,
      reason: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM not all set."
    };
  }
  try {
    // From may be either an E.164 number or a Messaging Service SID
    // (MGxxxx…). Twilio accepts the latter via the MessagingServiceSid
    // form field, not From.
    const params = new URLSearchParams({ To: opts.to, Body: opts.body });
    if (from.startsWith("MG")) {
      params.set("MessagingServiceSid", from);
    } else {
      params.set("From", from);
    }
    const auth = Buffer.from(`${sid}:${tok}`).toString("base64");
    const resp = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      }
    );
    const raw = await resp.text();
    let smsSid: string | undefined;
    try {
      const parsed = JSON.parse(raw) as { sid?: string };
      smsSid = parsed?.sid;
    } catch {
      // ignore — keep raw body for debugging
    }
    return {
      ok: resp.ok,
      status: resp.status,
      body: raw,
      sid: smsSid,
      reason: resp.ok ? undefined : `Twilio returned HTTP ${resp.status}.`
    };
  } catch (e: any) {
    return {
      ok: false,
      reason: `Twilio fetch failed: ${String(e?.message ?? e)}`
    };
  }
}
