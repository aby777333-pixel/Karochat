import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";
import { StatusPicker } from "@/components/StatusPicker";
import { RoomChat } from "./RoomChat";
import { CopyCode } from "./CopyCode";
import { LeaveRoomButton } from "./LeaveRoomButton";
import { MemberList } from "./MemberList";

export const dynamic = "force-dynamic";

type PresenceState = "online" | "away" | "busy" | "invisible" | "offline";

export default async function RoomPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, terms_accepted_at, presence_state, status_text, status_emoji"
    )
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  const { data: room } = await supabase
    .from("rooms")
    .select("id, name, description, is_public, invite_code, owner_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!room) notFound();

  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    if (room.is_public) {
      await supabase.rpc("join_public_room", { p_room_id: room.id });
    } else {
      redirect("/rooms?join=required");
    }
  }

  const [{ data: initialMessages }, { data: initialMembers }] = await Promise.all([
    supabase
      .from("messages_with_sender")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(150),
    supabase
      .from("room_members_view")
      .select("*")
      .eq("room_id", room.id)
  ]);

  const isOwner = room.owner_id === user.id;
  const presenceState: PresenceState =
    (profile.presence_state as PresenceState | undefined) ?? "online";

  return (
    <main className="mx-auto flex h-[100dvh] max-w-6xl flex-col px-4 py-4 md:py-6">
      <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/rooms"
            className="shrink-0 text-white/50 hover:text-white"
            aria-label="Back to rooms"
          >
            ←
          </Link>
          <Logo className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Wordmark className="text-base" />
              <span className="hidden text-white/40 md:inline">·</span>
              <span className="truncate font-mono text-xs uppercase tracking-widest text-white/60">
                {room.is_public ? "#" : "🔒"} {room.name}
              </span>
            </div>
            {room.description && (
              <p className="truncate text-[11px] text-white/40">{room.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusPicker
            currentState={presenceState}
            currentText={profile.status_text}
            currentEmoji={profile.status_emoji}
            displayName={profile.display_name}
          />
          <LeaveRoomButton
            roomId={room.id}
            roomName={room.name}
            currentUserId={profile.id}
          />
          <SignOutButton />
        </div>
      </header>

      {!room.is_public && isOwner && room.invite_code && (
        <div className="surface-glass mt-3 flex items-center justify-between gap-3 px-4 py-2 text-xs">
          <span className="text-white/60">Invite code for this private room:</span>
          <CopyCode code={room.invite_code} />
        </div>
      )}

      <div className="mt-0 flex flex-1 gap-3 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <RoomChat
            roomId={room.id}
            currentUserId={profile.id}
            currentUsername={profile.username}
            currentDisplayName={profile.display_name}
            currentPresence={presenceState}
            initialMessages={(initialMessages as any[]) ?? []}
          />
        </div>
        <MemberList
          roomId={room.id}
          currentUserId={profile.id}
          initial={(initialMembers as any[]) ?? []}
        />
      </div>
    </main>
  );
}
