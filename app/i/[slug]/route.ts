// Karochat — personal invite landing (/i/[slug]).
//
// Was a Server Component page, but it set the attribution cookie with
// cookies().set(), which Next.js 14 only allows in Server Actions and
// Route Handlers — every LOGGED-OUT invitee got a 500 ("Something
// broke"). Signed-in visitors redirected before the cookie line, which
// is why the sender never saw it. Now a Route Handler with identical
// behavior:
//   1. Signed-in visitor → record_inviter(slug) → /rooms.
//   2. Anon visitor → stash slug in the karochat_invite cookie (the
//      next authenticated /rooms render consumes it) → landing page.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "karochat_invite";

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const url = new URL(req.url);
  const slug = (params.slug ?? "").toLowerCase().trim();
  if (!slug) return NextResponse.redirect(new URL("/", url.origin));

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    try {
      await supabase.rpc("record_inviter", { p_slug: slug });
    } catch {
      // attribution is best-effort — never block the invitee
    }
    return NextResponse.redirect(new URL("/rooms", url.origin));
  }

  const res = NextResponse.redirect(
    new URL(`/?invite=${encodeURIComponent(slug)}`, url.origin)
  );
  res.cookies.set(COOKIE_NAME, slug, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return res;
}
