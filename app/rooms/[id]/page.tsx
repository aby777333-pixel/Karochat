import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";
import { StatusPicker } from "@/components/StatusPicker";
import { NotificationsButton } from "@/components/NotificationsButton";
import { CatchMeUpButton } from "./CatchMeUpButton";
import { CallButton } from "./CallButton";
import { NewRoomButton } from "@/components/NewRoomButton";
import { AdRails } from "@/components/AdRails";
import { RoomChat } from "./RoomChat";
import { CopyCode } from "./CopyCode";
import { LeaveRoomButton } from "./LeaveRoomButton";
import { MemberList } from "./MemberList";
import { InviteButton } from "./InviteButton";

export const dynamic = "force-dynamic";

type PresenceState = "online" | "away" | "busy" | "invisible" | "offline";

export default async function RoomPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { invite?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Wide query first (needs migration 0004). If anything's missing on the DB
  // side, fall back to the narrower 0003-only query so we can render a clean
  // error instead of an infinite redirect loop.
  let migrationNeeded = false;
  let profile: any = null;
  {
    const wide = await supabase
      .from("profiles")
      .select(
        "id, username, display_name, terms_accepted_at, presence_state, status_text, status_emoji"
      )
      .eq("id", user.id)
      .maybeSingle();
    if (wide.error) {
      migrationNeeded = true;
      const narrow = await supabase
        .from("profiles")
        .select("id, username, display_name, terms_accepted_at")
        .eq("id", user.id)
        .maybeSingle();
      profile = narrow.data ?? null;
    } else {
      profile = wide.data ?? null;
    }
  }

  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  const roomResp = await supabase
    .from("rooms")
    .select("id, name, description, is_public, invite_code, owner_id, is_dm")
    .eq("id", params.id)
    .maybeSingle();
  const room = roomResp.data as
    | {
        id: string;
        name: string;
        description: string | null;
        is_public: boolean;
        invite_code: string | null;
        owner_id: string | null;
        is_dm: boolean | null;
      }
    | null;
  if (!room) {
    console.error("[rooms/[id]] room not visible to user", {
      paramsId: params.id,
      userId: user.id,
      pgError: roomResp.error?.message ?? null,
      pgCode: roomResp.error?.code ?? null
    });
    redirect(`/rooms?missing=${encodeURIComponent(params.id)}`);
  }

  const { data: membership } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    if (room.is_public) {
      await supabase.rpc("join_public_room", { p_room_id: room.id });
    } else if (
      searchParams?.invite &&
      room.invite_code &&
      searchParams.invite === room.invite_code
    ) {
      await supabase.rpc("join_room_by_invite", { p_code: room.invite_code });
    } else {
      redirect("/rooms?join=required");
    }
  }

  const [msgsResp, membersResp] = await Promise.all([
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
  if (msgsResp.error || membersResp.error) migrationNeeded = true;
  const initialMessages = msgsResp.data ?? [];
  const initialMembers = membersResp.data ?? [];

  if (migrationNeeded) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-xl flex-col items-center justify-center px-5 py-6 text-center">
        <Logo className="h-10 w-10" />
        <Wordmark className="mt-3 text-2xl" />
        <div className="surface-glass mt-6 w-full p-6">
          <h1 className="font-display text-xl font-semibold">
            One more migration to run
          </h1>
          <p className="mt-2 text-sm text-white/70">
            The database is missing schema added in migration 0004
            (presence states, reactions, member view, etc.). Rooms
            can&apos;t load until you apply it.
          </p>
          <ol className="mt-4 space-y-2 text-left text-sm text-white/80">
            <li>
              1. Open the{" "}
              <a
                href="https://supabase.com/dashboard/project/dxgduusbdvslusbushxi/sql/new"
                target="_blank"
                rel="noreferrer"
                className="text-neon-blue underline"
              >
                Supabase SQL editor
              </a>
              .
            </li>
            <li>
              2. Paste{" "}
              <code className="rounded bg-white/10 px-1 text-xs">
                supabase/migrations/0004_phase4_5_features.sql
              </code>
              .
            </li>
            <li>3. Run, then hard-refresh this page.</li>
          </ol>
          <Link
            href="/rooms"
            className="mt-5 inline-block rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
          >
            ← Back to rooms
          </Link>
        </div>
      </main>
    );
  }

  const isOwner = room.owner_id === user.id;
  const presenceState: PresenceState =
    ((profile as any).presence_state as PresenceState | undefined) ?? "online";

  // For 1:1 DMs, show the other participant's name/handle instead of the
  // generic "Direct Message" room name.
  const dmPartner = room.is_dm
    ? ((initialMembers as any[]) ?? []).find((m) => m.user_id !== profile.id) ?? null
    : null;
  const headerName = dmPartner
    ? dmPartner.display_name ?? dmPartner.username ?? "Direct Message"
    : room.name;
  const headerHandle = dmPartner ? `@${dmPartner.username ?? "anon"}` : null;

  return (
    <AdRails>
    <main className="mx-auto flex h-[100dvh] max-w-6xl flex-col px-1 py-4 md:py-6">
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
                {room.is_dm ? "💬" : room.is_public ? "#" : "🔒"} {headerName}
              </span>
              {headerHandle && (
                <span className="hidden truncate text-[11px] text-white/40 md:inline">
                  {headerHandle}
                </span>
              )}
            </div>
            {!room.is_dm && room.description && (
              <p className="truncate text-[11px] text-white/40">{room.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NewRoomButton from="room" />
          {!room.is_dm && (
            <InviteButton
              roomId={room.id}
              roomName={headerName}
              initialCode={room.invite_code ?? null}
              isOwner={isOwner}
            />
          )}
          <CallButton roomId={room.id} roomName={room.name} />
          <CatchMeUpButton roomId={room.id} />
          <NotificationsButton />
          <StatusPicker
            currentState={presenceState}
            currentText={(profile as any).status_text ?? null}
            currentEmoji={(profile as any).status_emoji ?? null}
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

      {!room.is_dm && !room.is_public && isOwner && room.invite_code && (
        <div className="surface-glass mt-3 flex items-center justify-between gap-3 px-4 py-2 text-xs">
          <span className="text-white/60">Invite code for this private room:</span>
          <CopyCode code={room.invite_code} />
        </div>
      )}

      <div className="mt-0 flex flex-1 gap-3 overflow-hidden">
        <div className="flex flex-1 flex-col">
          <RoomChat
            roomId={room.id}
            roomName={headerName}
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
          roomInviteCode={room.invite_code ?? null}
          initial={(initialMembers as any[]) ?? []}
        />
      </div>
    </main>
    </AdRails>
  );
}
