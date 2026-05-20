import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const COOKIE_NAME = "karochat_invite";

/**
 * Personal invite landing route. Two paths:
 * 1. Visitor is already signed in → call record_inviter(slug); send them to /rooms.
 * 2. Visitor is anon → stash the slug in a cookie and send them to the landing
 *    page so they can sign in. On next /rooms load, we'll consume the cookie.
 */
export default async function InvitePage({
  params
}: {
  params: { slug: string };
}) {
  const slug = (params.slug ?? "").toLowerCase().trim();
  if (!slug) redirect("/");

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    await supabase.rpc("record_inviter", { p_slug: slug });
    redirect("/rooms");
  }

  // Stash the slug so the next authenticated request can attribute it.
  // 30-day expiry, lax + path=/ so it fires across all subsequent navigations.
  cookies().set({
    name: COOKIE_NAME,
    value: slug,
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });

  redirect(`/?invite=${encodeURIComponent(slug)}`);
}
