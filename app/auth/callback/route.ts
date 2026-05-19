import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/rooms";

  if (code) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username, terms_accepted_at")
          .eq("id", user.id)
          .maybeSingle();
        let dest = next;
        if (!profile?.username) dest = "/onboarding";
        else if (!profile.terms_accepted_at) dest = "/terms";
        return NextResponse.redirect(new URL(dest, url.origin));
      }
    }
  }

  return NextResponse.redirect(new URL("/?auth=error", url.origin));
}
