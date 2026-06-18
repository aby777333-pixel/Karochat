// Karochat — instant-auth edge function (Wave 22).
//
// Creates or repairs a full-access email account using the SERVICE ROLE so NO
// confirmation email is sent (avoids Supabase email rate limits) while keeping
// email-keyed continuity. Enforces one-account-per-phone. Deployed with
// verify_jwt = false (it's the public sign-up endpoint; it validates input and
// uses admin APIs itself). The client then signs in with the same derived
// password.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "method" }, 200);

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const phone = String(body?.phone ?? "").trim();
    const password = String(body?.password ?? "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ ok: false, code: "bad_email" }, 200);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 0) Blacklist — refuse blacklisted IPs (safety-notice enforcement).
    const ip =
      (req.headers.get("x-forwarded-for") || "").split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";
    if (ip) {
      const bl = await admin.rpc("is_ip_blacklisted", { p_ip: ip });
      if (!bl.error && bl.data === true) {
        return json({ ok: false, code: "blocked" }, 200);
      }
    }

    // 0.5) Admin accounts: instant access ENABLED at the owner's explicit
    // request (no email OTP). ⚠️ Security note: the deterministic password is
    // derived from the email, so this makes the admin account accessible to
    // anyone who knows the email. Harden with an out-of-band admin passphrase
    // before any wider launch.

    // Non-admin: validate phone + password for the instant path.
    if (phone.replace(/\D/g, "").length < 6) {
      return json({ ok: false, code: "bad_phone" }, 200);
    }
    if (password.length < 8) {
      return json({ ok: false, code: "bad_password" }, 200);
    }

    // 1) Phone uniqueness — reject reusing a phone tied to another email.
    const avail = await admin.rpc("check_contact_availability", {
      p_email: email,
      p_phone: phone
    });
    if (!avail.error && avail.data && avail.data.phone_conflict) {
      return json(
        { ok: false, code: "phone_conflict", masked: avail.data.masked_email ?? null },
        200
      );
    }

    // 2) Find or create the auth user (confirmed, no email sent).
    const found = await admin.rpc("admin_user_id_by_email", { p_email: email });
    if (found.error) return json({ ok: false, code: "server", detail: found.error.message }, 200);
    let userId: string | null = (found.data as string) ?? null;

    if (userId) {
      const up = await admin.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true
      });
      if (up.error) return json({ ok: false, code: "server", detail: up.error.message }, 200);
    } else {
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });
      if (created.error) return json({ ok: false, code: "server", detail: created.error.message }, 200);
      userId = created.data.user?.id ?? null;
    }
    if (!userId) return json({ ok: false, code: "server", detail: "no user id" }, 200);

    // 3) Upsert profile + contact (also enforces phone uniqueness).
    const prof = await admin.rpc("admin_upsert_contact", {
      p_user: userId,
      p_email: email,
      p_phone: phone
    });
    if (prof.error) {
      const conflict = /phone_conflict|already registered/i.test(prof.error.message);
      return json(
        { ok: false, code: conflict ? "phone_conflict" : "server", detail: prof.error.message },
        200
      );
    }

    return json({ ok: true }, 200);
  } catch (e) {
    return json({ ok: false, code: "server", detail: String((e as any)?.message ?? e) }, 200);
  }
});
