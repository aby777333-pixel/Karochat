import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";
import { StatusPicker } from "@/components/StatusPicker";
import { NotificationsButton } from "@/components/NotificationsButton";
import { CatchMeUpButton } from "./CatchMeUpButton";
import { CallButton } from "./CallButton";
import { WhiteboardButton } from "./WhiteboardButton";
import { TeachingKitButton } from "./TeachingKitButton";
import { NewRoomButton } from "@/components/NewRoomButton";
import { AdRails } from "@/components/AdRails";
import { RoomChat } from "./RoomChat";
import { RoomExtras } from "./RoomExtras";
import { RoomTopActions } from "./RoomTopActions";
import { CopyCode } from "./CopyCode";
import { LeaveRoomButton } from "./LeaveRoomButton";
import { MemberList } from "./MemberList";
import { InviteButton } from "./InviteButton";
import { RoomRulesPanel } from "./RoomRulesPanel";
import { RoomThemePicker } from "@/components/RoomThemePicker";
import { AddPeopleButton } from "@/components/AddPeopleButton";
import { GroupJoinGate } from "./GroupJoinGate";

export const dynamic = "force-dynamic";

type PresenceState = "online" | "away" | "busy" | "invisible" | "offline";

export default async function RoomPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { invite?: string; call?: string };
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
        "id, username, display_name, terms_accepted_at, is_guest, presence_state, status_text, status_emoji, mood, mood_expires_at, traveling_in_city, traveling_until, bio_drop, auto_translate_to"
      )
      .eq("id", user.id)
      .maybeSingle();
    if (wide.error) {
      migrationNeeded = true;
      const narrow = await supabase
        .from("profiles")
        .select("id, username, display_name, terms_accepted_at, is_guest")
        .eq("id", user.id)
        .maybeSingle();
      profile = narrow.data ?? null;
    } else {
      profile = wide.data ?? null;
    }
  }

  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  // Guests get the Lobby only. Full access (any room/DM) needs email + phone.
  const LOBBY_ID = "00000000-0000-0000-0000-00000000aaaa";
  if (profile.is_guest && params.id !== LOBBY_ID) {
    redirect("/rooms?upgrade=1");
  }

  const roomResp = await supabase
    .from("rooms")
    .select("id, name, description, is_public, invite_code, owner_id, is_dm, is_saved, is_vault, rules_markdown, visibility, parent_room_id, recording_started_at, theme, join_policy, avatar_url, vanish_mode")
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
        is_saved: boolean | null;
        is_vault: boolean | null;
        rules_markdown: string | null;
        visibility: "public" | "listed" | "unlisted" | "secret";
        parent_room_id: string | null;
        recording_started_at: string | null;
        theme: string | null;
        join_policy: "open" | "request" | null;
        avatar_url: string | null;
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
    .select("role, rules_acknowledged_at")
    .eq("room_id", room.id)
    .eq("user_id", user.id)
    .maybeSingle();

  // Request-to-join groups: a non-member (who isn't the owner) sees a request
  // screen instead of auto-joining. Open rooms (the default) skip this entirely.
  if (
    !membership &&
    room.join_policy === "request" &&
    room.owner_id !== user.id &&
    (room.is_public || room.visibility === "listed")
  ) {
    const { data: myReq } = await supabase
      .from("room_join_requests")
      .select("status")
      .eq("room_id", room.id)
      .eq("requester_id", user.id)
      .maybeSingle();
    return (
      <GroupJoinGate
        roomId={room.id}
        name={room.name}
        description={room.description}
        avatarUrl={room.avatar_url}
        status={((myReq?.status as string | null) ?? null) as "pending" | "rejected" | null}
      />
    );
  }

  if (!membership) {
    // Wave 19.5 — Karochat is free: any non-private user room auto-joins.
    // 'public' and 'listed' both flow through join_public_room (relaxed in
    // migration 0029). 'unlisted' and 'secret' still need an invite code.
    if (room.is_public || room.visibility === "listed") {
      const joinResp = await supabase.rpc("join_public_room", {
        p_room_id: room.id
      });
      if (joinResp.error) {
        console.warn("[rooms/[id]] join_public_room failed", {
          roomId: room.id,
          userId: user.id,
          message: joinResp.error.message,
          code: joinResp.error.code
        });
      }
    } else if (
      searchParams?.invite &&
      room.invite_code &&
      searchParams.invite === room.invite_code
    ) {
      const inviteResp = await supabase.rpc("join_room_by_invite", {
        p_code: room.invite_code
      });
      if (inviteResp.error) {
        console.warn("[rooms/[id]] join_room_by_invite failed", {
          roomId: room.id,
          userId: user.id,
          message: inviteResp.error.message,
          code: inviteResp.error.code
        });
        redirect(`/rooms?join=required`);
      }
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
  const canManage =
    !!membership && ["owner", "admin", "moderator"].includes((membership as any).role);
  const presenceState: PresenceState =
    ((profile as any).presence_state as PresenceState | undefined) ?? "online";

  // For 1:1 DMs, show the other participant's name/handle instead of the
  // generic "Direct Message" room name.
  const dmPartner = room.is_dm
    ? ((initialMembers as any[]) ?? []).find((m) => m.user_id !== profile.id) ?? null
    : null;
  const vaultPeerId = (room.is_vault && dmPartner?.user_id) || null;
  const headerName = dmPartner
    ? dmPartner.display_name ?? dmPartner.username ?? "Direct Message"
    : room.name;
  const headerHandle = dmPartner ? `@${dmPartner.username ?? "anon"}` : null;

  return (
    <AdRails>
    <main className="mx-auto flex h-[100dvh] max-w-6xl flex-col overflow-x-hidden px-1 py-4 md:py-6">
      <header className="surface-glass flex flex-row items-center justify-between gap-2 px-4 py-3 sm:gap-3">
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
              <Wordmark className="hidden text-base md:inline" />
              <span className="hidden text-white/40 md:inline">·</span>
              <span className="truncate font-mono text-xs uppercase tracking-widest text-white/60">
                {room.is_saved
                  ? "💾"
                  : room.is_dm
                  ? "💬"
                  : room.is_public
                  ? "#"
                  : "🔒"}{" "}
                {headerName}
              </span>
              {headerHandle && (
                <span className="hidden truncate text-[11px] text-white/40 md:inline">
                  {headerHandle}
                </span>
              )}
            </div>
            {!room.is_dm && room.description && (
              <p className="hidden truncate text-[11px] text-white/40 md:block">
                {room.description}
              </p>
            )}
          </div>
        </div>
        <RoomTopActions>
          <Link
            href="/shorts"
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
            title="Shorts"
            aria-label="Shorts"
          >
            🎬
          </Link>
          <Link
            href={dmPartner ? `/snaps?to=${dmPartner.user_id}` : "/snaps"}
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
            title="Send a snap"
            aria-label="Snaps"
          >
            📸
          </Link>
          <Link
            href="/lenses"
            className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
            title="AR lenses camera"
            aria-label="Lenses"
          >
            🤳
          </Link>
          <NewRoomButton from="room" />
          {!room.is_saved && !room.is_vault && (
            <AddPeopleButton
              roomId={room.id}
              isDm={!!room.is_dm}
              isVault={!!room.is_vault}
              isSaved={!!room.is_saved}
            />
          )}
          {!room.is_dm && !room.is_saved && (
            <InviteButton
              roomId={room.id}
              roomName={headerName}
              initialCode={room.invite_code ?? null}
              initialVisibility={room.visibility}
              isOwner={isOwner}
            />
          )}
          {!room.is_dm && !room.is_saved && isOwner && (
            <RoomThemePicker
              roomId={room.id}
              initialTheme={room.theme ?? null}
              isOwner={isOwner}
            />
          )}
          {!room.is_dm && !room.is_saved && !room.is_vault && canManage && (
            <Link
              href={`/rooms/${room.id}/manage`}
              className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
              title="Manage group"
              aria-label="Manage group"
            >
              ⚙️
            </Link>
          )}
          {!room.is_dm && !room.is_saved && (
            <RoomRulesPanel
              roomId={room.id}
              roomName={headerName}
              isOwner={isOwner}
              initialRules={room.rules_markdown ?? null}
              initiallyAcknowledged={
                !!(membership as any)?.rules_acknowledged_at
              }
            />
          )}
          <CallButton roomId={room.id} roomName={room.name} />
          <WhiteboardButton roomId={room.id} currentUserId={profile.id} />
          <TeachingKitButton roomId={room.id} currentUserId={profile.id} />
          <CatchMeUpButton roomId={room.id} />
          <NotificationsButton />
          <StatusPicker
            currentState={presenceState}
            currentText={(profile as any).status_text ?? null}
            currentEmoji={(profile as any).status_emoji ?? null}
            currentMood={(profile as any).mood ?? null}
            currentMoodExpiresAt={(profile as any).mood_expires_at ?? null}
            currentTravelCity={(profile as any).traveling_in_city ?? null}
            currentTravelUntil={(profile as any).traveling_until ?? null}
            currentBioDrop={(profile as any).bio_drop ?? null}
            currentAutoTranslate={(profile as any).auto_translate_to ?? null}
            displayName={profile.display_name}
          />
          <LeaveRoomButton
            roomId={room.id}
            roomName={room.name}
            currentUserId={profile.id}
            isOwner={isOwner}
          />
          <SignOutButton />
        </RoomTopActions>
      </header>

      {!room.is_dm && !room.is_saved && !room.is_public && isOwner && room.invite_code && (
        <div className="surface-glass mt-3 flex items-center justify-between gap-3 px-4 py-2 text-xs">
          <span className="text-white/60">Invite code for this private room:</span>
          <CopyCode code={room.invite_code} />
        </div>
      )}

      <div className="mt-0 flex flex-1 gap-3 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <RoomChat
            roomId={room.id}
            roomName={headerName}
            roomInviteCode={room.invite_code ?? null}
            currentUserId={profile.id}
            currentUsername={profile.username}
            currentDisplayName={profile.display_name}
            currentPresence={presenceState}
            currentAutoTranslate={(profile as any).auto_translate_to ?? null}
            isVault={!!room.is_vault}
            vaultPeerId={vaultPeerId}
            parentRoomId={room.parent_room_id}
            recordingStartedAt={room.recording_started_at}
            roomTheme={room.theme ?? null}
            initialCall={
              searchParams?.call === "audio" || searchParams?.call === "video"
                ? searchParams.call
                : null
            }
            isOwner={isOwner}
            isDm={!!room.is_dm}
            isSaved={!!room.is_saved}
            initialVanishMode={!!(room as any).vanish_mode}
            initialMessages={(initialMessages as any[]) ?? []}
          />
          <RoomExtras
            roomId={room.id}
            currentUserId={profile.id}
            isDm={!!room.is_dm}
            members={(initialMembers as any[]) ?? []}
          />
        </div>
        <MemberList
          roomId={room.id}
          currentUserId={profile.id}
          roomInviteCode={room.invite_code ?? null}
          isOwner={isOwner}
          initial={(initialMembers as any[]) ?? []}
        />
      </div>
    </main>
    </AdRails>
  );
}
