// Karochat — admin client-list export (CSV).
//
// Returns the full member/guest list as a UTF-8 CSV (with BOM) that opens
// directly in Excel and imports cleanly into Google Sheets. Admin-only: the
// underlying admin_export_clients() RPC raises unless the caller is an admin,
// and we also require a session here.

import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Row = {
  username: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  account_type: string | null;
  presence: string | null;
  last_seen: string | null;
  joined: string | null;
};

function csv(value: unknown): string {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data, error } = await supabase.rpc("admin_export_clients");
  if (error) {
    // RPC raises "not authorized" for non-admins.
    return new Response(error.message, { status: 403 });
  }

  const rows = (data ?? []) as Row[];
  const header = [
    "Username",
    "Display name",
    "Email",
    "Phone",
    "Account type",
    "Presence",
    "Last seen",
    "Joined"
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.username,
        r.display_name,
        r.email,
        r.phone,
        r.account_type,
        r.presence,
        r.last_seen,
        r.joined
      ]
        .map(csv)
        .join(",")
    );
  }
  // ﻿ BOM → Excel detects UTF-8; \r\n line endings for Windows Excel.
  const body = "﻿" + lines.join("\r\n");

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="karochat-clients-${stamp}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
