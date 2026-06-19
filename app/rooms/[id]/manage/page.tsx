import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { AdRails } from "@/components/AdRails";
import { GroupManageClient, type ManageRoom, type JoinRequest, type GroupMember } from "./GroupManageClient";

export const dynamic = "force-dynamic";

export default async function ManageGroupPage({ params }: { params: { id: string } }) {
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

  const { data: room } = await supabase
    .from("rooms")
    .select("id, name, description, avatar_url, banner_url, join_policy, rules_markdown, owner_id, is_dm, is_saved, is_vault")
    .eq("id", params.id)
    .maybeSingle();
  if (!room || room.is_dm || room.is_saved || room.is_vault) redirect(`/rooms/${params.id}`);

  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", params.id)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = (membership as any)?.role ?? null;
  const canManage = ["owner", "admin", "moderator"].includes(role);
  if (!canManage) redirect(`/rooms/${params.id}`);
  const isOwner = room.owner_id === user.id;

  const [{ data: requests }, { data: members }] = await Promise.all([
    supabase.rpc("list_join_requests", { p_room_id: params.id }),
    supabase
      .from("room_members_view")
      .select("user_id, role, username, display_name")
      .eq("room_id", params.id)
  ]);

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href={`/rooms/${params.id}`} className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <Link
            href={`/rooms/${params.id}`}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
          >
            ← Group
          </Link>
        </header>

        <section className="surface-glass mt-5 p-5">
          <h1 className="font-display text-xl font-semibold">
            <span aria-hidden className="mr-1.5">⚙️</span>Manage group
          </h1>
          <p className="mt-1 text-sm text-white/55">{room.name}</p>
          <div className="mt-4">
            <GroupManageClient
              currentUserId={user.id}
              isOwner={isOwner}
              room={room as ManageRoom}
              initialRequests={(requests ?? []) as JoinRequest[]}
              members={((members ?? []) as GroupMember[]).filter((m) => m.user_id !== user.id)}
            />
          </div>
        </section>
      </main>
    </AdRails>
  );
}
