import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./OnboardingForm";
import { Logo, Wordmark } from "@/components/Brand";

export default async function OnboardingPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, terms_accepted_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.username) {
    if (!profile?.terms_accepted_at) redirect("/terms");
    redirect("/rooms");
  }

  const defaultName = user.email?.split("@")[0] ?? "";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col px-6 py-10">
      <div className="flex items-center gap-2">
        <Logo />
        <Wordmark />
      </div>
      <div className="surface-glass mt-12 p-7">
        <h1 className="font-display text-2xl font-semibold">Pick a username</h1>
        <p className="mt-1 text-sm text-white/60">
          This is how friends will find you. You can change it later.
        </p>
        <div className="mt-6">
          <OnboardingForm defaultUsername={defaultName} />
        </div>
      </div>
    </main>
  );
}
