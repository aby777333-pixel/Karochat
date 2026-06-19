import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AdRails } from "@/components/AdRails";
import { ChannelClient, type ChannelInfo, type ChannelMessage } from "./ChannelClient";

export const dynamic = "force-dynamic";

export default async function ChannelPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, terms_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  const { data: channels } = await supabase.rpc("list_broadcast_channels");
  const channel = ((channels ?? []) as ChannelInfo[]).find((c) => c.id === params.id);
  if (!channel) notFound();

  const { data: messages } = await supabase.rpc("list_channel_messages", {
    p_channel_id: params.id
  });

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/channels" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <Link
            href="/channels"
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Channels
          </Link>
        </header>

        <section className="surface-glass mt-5 p-4">
          <ChannelClient
            currentUserId={user.id}
            channel={channel}
            initialMessages={(messages ?? []) as ChannelMessage[]}
          />
        </section>
      </main>
    </AdRails>
  );
}
