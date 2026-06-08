import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";
import { AccountMenu } from "@/components/AccountMenu";
import { AdRails } from "@/components/AdRails";
import { RoomsClient } from "./RoomsClient";
import { SavedRoomButton } from "./SavedRoomButton";
import { UserSearch } from "./UserSearch";
import { StoriesStrip, type StoryRow } from "./StoriesStrip";
import { DismissibleSection, RestoreHiddenSections } from "./DismissibleSection";
import { FriendsAndRequests } from "./FriendsList";
import { InviteFriendsCard } from "./InviteFriendsCard";
import { CategoryBrowser, type Category, type Subcategory } from "./CategoryBrowser";
// UserRoomsBrowser is now embedded as a tab inside CategoryBrowser.
import { OwnedRoomDeleteButton } from "./OwnedRoomDeleteButton";
import { LobbyLeaveButton } from "./LobbyLeaveButton";
import { MoodMatchedRooms } from "./MoodMatchedRooms";
import { ModuleDashboard } from "./ModuleDashboard";
import { WelcomeHero } from "./WelcomeHero";
import { DMListClient } from "./DMListClient";
import { GuestAccessCard } from "./GuestAccessCard";
// import { DailyPrompt } from "./DailyPrompt"; // hidden by request — keep file for re-enable

export const dynamic = "force-dynamic";

type RoomRow = {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "listed" | "unlisted" | "secret";
  owner_id: string | null;
  member_count: number;
  is_dm?: boolean | null;
};

type DMRow = {
  id: string;
  partner_username: string | null;
  partner_display_name: string | null;
  partner_presence: string | null;
};

const VIS_GLYPH: Record<RoomRow["visibility"], string> = {
  public: "🌍",
  listed: "🔒",
  unlisted: "🔗",
  secret: "🕶️"
};

export default async function RoomsPage({
  searchParams
}: {
  searchParams?: { missing?: string; join?: string; create?: string };
}) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, privacy_mode, terms_accepted_at, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  // v5 AA1 — if the user arrived via /i/<slug>, attribute the invite once.
  // Wrapped defensively because the lobby must never crash if the RPC blips.
  try {
    const inviteCookie = cookies().get("karochat_invite");
    if (inviteCookie?.value) {
      const resp = await supabase.rpc("record_inviter", {
        p_slug: inviteCookie.value
      });
      if (resp.error) {
        console.warn("[rooms lobby] record_inviter failed", resp.error.message);
      }
      cookies().set({ name: "karochat_invite", value: "", path: "/", maxAge: 0 });
    }
  } catch (e) {
    console.warn("[rooms lobby] invite cookie consume threw", e);
  }

  const { data: memberships } = await supabase
    .from("room_members")
    .select("room_id")
    .eq("user_id", user.id);
  const memberIds = (memberships ?? []).map((m) => m.room_id);

  // For "Your rooms" we look up by id directly in the `rooms` table because
  // unlisted/secret rooms are excluded from rooms_browse but the user IS
  // a member, so RLS lets them read.
  const { data: yourRoomsRaw } = memberIds.length
    ? await supabase
        .from("rooms")
        .select("id, name, description, visibility, owner_id, is_dm, is_saved")
        .in("id", memberIds)
    : { data: [] as Array<Omit<RoomRow, "member_count"> & { is_saved?: boolean | null }> };

  const dmRoomsRaw = (yourRoomsRaw ?? []).filter(
    (r: any) => r.is_dm === true && !r.is_saved
  );
  const nonDmRoomsRaw = (yourRoomsRaw ?? []).filter(
    (r: any) => r.is_dm !== true && !r.is_saved
  );

  // Hydrate member_count for non-DM rooms.
  const yourRoomsWithCounts: RoomRow[] = await Promise.all(
    nonDmRoomsRaw.map(async (r) => {
      const { count } = await supabase
        .from("room_members")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", r.id);
      return { ...r, member_count: count ?? 0 } as RoomRow;
    })
  );
  yourRoomsWithCounts.sort((a, b) => b.member_count - a.member_count);

  // Build DM list: for each DM room, find the OTHER participant.
  let dms: DMRow[] = [];
  if (dmRoomsRaw.length > 0) {
    const dmIds = dmRoomsRaw.map((r) => r.id);
    const { data: partners } = await supabase
      .from("room_members_view")
      .select("room_id, user_id, username, display_name, presence_state")
      .in("room_id", dmIds)
      .neq("user_id", user.id);
    const partnerByRoom = new Map<string, any>();
    for (const p of partners ?? []) partnerByRoom.set(p.room_id, p);
    dms = dmRoomsRaw.map((r) => {
      const p = partnerByRoom.get(r.id);
      return {
        id: r.id,
        partner_username: p?.username ?? null,
        partner_display_name: p?.display_name ?? null,
        partner_presence: p?.presence_state ?? null
      };
    });
    const presenceRank: Record<string, number> = {
      online: 0, busy: 1, away: 2, invisible: 3, offline: 4
    };
    dms.sort((a, b) => {
      const ap = presenceRank[a.partner_presence ?? "offline"] ?? 5;
      const bp = presenceRank[b.partner_presence ?? "offline"] ?? 5;
      if (ap !== bp) return ap - bp;
      return (a.partner_display_name ?? "").localeCompare(b.partner_display_name ?? "");
    });
  }

  // (The old "Discover rooms" grid has been replaced by the catalog tree —
  // every public/listed room shows up there, so this query is no longer
  // needed on the lobby render.)

  const missingId = searchParams?.missing;
  const joinNotice = searchParams?.join;

  // v6 catalog — categories + subcategories (rooms are loaded client-side
  // per-category via browse_catalog so the lobby stays light).
  const [categoriesResp, subcategoriesResp] = await Promise.all([
    supabase
      .from("room_categories")
      .select("slug,label,description,icon,position,is_adult")
      .order("position", { ascending: true }),
    supabase
      .from("room_subcategories")
      .select("category_slug,slug,label,position")
      .order("position", { ascending: true })
  ]);
  // Wave 20 — every student-related top-level category lives in its own
  // /students area (verified network on top, common lobbies + student-
  // created rooms underneath). Hide them from the main lobby catalog so
  // they aren't double-listed; the header has a "🎓 Students" portal
  // button. The live DB has five such categories: 'students',
  // 'students-subject', 'students-exam', 'students-cohort',
  // 'students-meta'. Using a startsWith match keeps any future
  // 'students-*' category routed through /students too.
  const isStudentCategory = (slug: string) =>
    slug === "students" || slug.startsWith("students-");
  const categories = ((categoriesResp.data ?? []) as Category[]).filter(
    (c) => !isStudentCategory(c.slug)
  );
  const subcategories = ((subcategoriesResp.data ?? []) as Subcategory[]).filter(
    (s) => !isStudentCategory(s.category_slug)
  );

  // Live (un-expired) stories for the top strip. RLS filters out expired.
  const { data: storiesRaw } = await supabase
    .from("stories_with_author")
    .select("*")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(30);
  const liveStories = (storiesRaw ?? []) as StoryRow[];

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex flex-row items-center justify-between gap-2 px-3 py-2 md:px-4 md:py-3">
          <Link href="/rooms" className="flex shrink-0 items-center gap-2">
            <Logo className="h-7 w-7" />
            <Wordmark className="text-lg" />
          </Link>
          <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end md:gap-3">
            {/* Module shortcuts — hidden on mobile (the colourful dashboard +
                bottom nav cover them there); kept on desktop where the header
                has room to breathe. */}
            <div className="hidden flex-wrap items-center gap-2 md:flex md:gap-3">
              <Link
                href="/rooms/00000000-0000-0000-0000-00000000aaaa"
                className="rounded-lg border border-neon-amber/40 bg-neon-amber/10 px-3 py-1.5 text-neon-amber hover:bg-neon-amber/20"
                title="Enter the Lobby — everybody hangs here"
              >
                🏠 Lobby
              </Link>
              <Link
                href="/books"
                className="rounded-lg border border-neon-blue/40 bg-neon-blue/10 px-3 py-1.5 text-neon-blue hover:bg-neon-blue/20"
                title="Books — global library (Phase 2)"
              >
                📚 Books
              </Link>
              <Link
                href="/sexed"
                className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-neon-mint hover:bg-neon-mint/20"
                title="Sex education — age-tiered, queer-affirming (Phase 3)"
              >
                💞 Sex ed
              </Link>
              <Link
                href="/read"
                className="rounded-lg border border-neon-purple/40 bg-neon-purple/10 px-3 py-1.5 text-neon-purple hover:bg-neon-purple/20"
                title="Read community-published stories, essays, journals"
              >
                📖 Read
              </Link>
              <Link
                href="/write"
                className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-neon-mint hover:bg-neon-mint/20"
                title="Your writing — drafts, published, new piece"
              >
                ✍ Write
              </Link>
              {/* 🎓 Students — module hidden for now; it's being spun out into a
                  separate application. Keep the link here for easy re-enable.
              <Link
                href="/students"
                className="rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-3 py-1.5 text-neon-mint hover:bg-neon-mint/20"
                title="Students Network — verified peer learning"
              >
                🎓 Students
              </Link>
              */}
              <Link
                href="/shorts"
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                🎬 Shorts
              </Link>
            </div>
            <AccountMenu
              username={profile.username as string}
              displayName={profile.display_name as string | null}
              avatarUrl={(profile as any).avatar_url ?? null}
              initialPrivacyMode={
                ((profile as any).privacy_mode as
                  | "open"
                  | "friends_only"
                  | "invisible"
                  | "decoy"
                  | "stealth") ?? "open"
              }
            />
          </div>
        </header>

        {missingId && (
          <div className="surface-glass mt-3 border border-neon-red/30 bg-neon-red/5 px-4 py-2 text-xs text-white/80">
            That room isn&apos;t available to you (it may be private, deleted, or you
            were removed). Pick another below.
          </div>
        )}
        {joinNotice === "required" && (
          <div className="surface-glass mt-3 border border-neon-amber/30 bg-neon-amber/5 px-4 py-2 text-xs text-white/80">
            That room is private. Enter the invite code in the panel on the right.
          </div>
        )}

        {/* Karo's daily prompt is hidden by request — keep the route +
            component so we can re-enable it later by uncommenting this. */}
        {/*
        <DismissibleSection id="daily-prompt">
          <div className="mt-3">
            <DailyPrompt />
          </div>
        </DismissibleSection>
        */}

        <DismissibleSection id="welcome" className="mt-3">
          <WelcomeHero />
        </DismissibleSection>

        <DismissibleSection id="stories" className="mt-3">
          <StoriesStrip
            initialStories={liveStories}
            currentUserId={user.id}
            isAdmin={!!(profile as any).is_admin}
          />
        </DismissibleSection>

        <div className="mt-5 grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            <GuestAccessCard />

            <DismissibleSection id="explore">
              <ModuleDashboard />
            </DismissibleSection>

            <DismissibleSection id="saved">
              <SavedRoomButton />
            </DismissibleSection>

            <DismissibleSection id="friends">
              <FriendsAndRequests currentUserId={user.id} />
            </DismissibleSection>

            {dms.length > 0 && (
              <DismissibleSection id="dms">
                <section className="surface-glass tint-purple p-5">
                  <div className="mb-3 flex items-baseline justify-between">
                    <h2 className="font-display text-lg font-semibold">Direct messages</h2>
                    <span className="text-xs text-white/40">{dms.length}</span>
                  </div>
                  <DMListClient dms={dms} currentUserId={user.id} />
                </section>
              </DismissibleSection>
            )}

            <DismissibleSection id="your-rooms">
              <section id="browse-rooms" className="surface-glass tint-blue scroll-mt-24 p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-display text-lg font-semibold">Your rooms</h2>
                  <span className="text-xs text-white/40">{yourRoomsWithCounts.length}</span>
                </div>
                <RoomList
                  rooms={yourRoomsWithCounts}
                  variant="member"
                  currentUserId={user.id}
                />
              </section>
            </DismissibleSection>

            <DismissibleSection id="mood-matched">
              <MoodMatchedRooms />
            </DismissibleSection>

            <DismissibleSection id="catalog">
              {categories.length > 0 && (
                <CategoryBrowser
                  categories={categories}
                  subcategories={subcategories}
                />
              )}
            </DismissibleSection>
          </div>

          <aside className="space-y-5">
            <DismissibleSection id="search">
              <UserSearch />
            </DismissibleSection>

            <DismissibleSection id="quick-actions">
              <section className="surface-glass tint-amber p-4 text-sm">
                <p className="text-[10px] uppercase tracking-widest text-white/40">
                  Spontaneous
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Link
                    href="/meet/now"
                    className="rounded-xl bg-neon-amber/15 px-3 py-2 text-center text-xs font-medium text-neon-amber hover:bg-neon-amber/25"
                    title="5-minute random one-on-one"
                  >
                    ⚡ Meet now
                  </Link>
                  <Link
                    href="/handshake"
                    className="rounded-xl bg-neon-mint/15 px-3 py-2 text-center text-xs font-medium text-neon-mint hover:bg-neon-mint/25"
                    title="Bump phones to become DM buddies"
                  >
                    🤝 Handshake
                  </Link>
                </div>
              </section>
            </DismissibleSection>

            <DismissibleSection id="invite-friends">
              <InviteFriendsCard />
            </DismissibleSection>
            <RoomsClient />
          </aside>
        </div>

        <div className="flex justify-center">
          <RestoreHiddenSections />
        </div>

        <footer className="mt-8 space-y-1 text-center text-[11px] text-white/30">
          <p>Be kind. Be real. Live and let live.</p>
          <p className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
            <Link href="/charter" className="hover:text-white">
              The People&apos;s Charter
            </Link>
            <span aria-hidden>·</span>
            <Link href="/legal/terms" className="hover:text-white">
              Terms
            </Link>
            <span aria-hidden>·</span>
            <a href="mailto:info@karochat.co" className="hover:text-white">
              info@karochat.co
            </a>
            <span aria-hidden>·</span>
            <a
              href="mailto:ads@karochat.co?subject=Advertise%20on%20Karochat"
              className="hover:text-white"
              title="Sponsor a room or place a creative in our rails"
            >
              📣 Advertise: ads@karochat.co
            </a>
          </p>
        </footer>
      </main>
    </AdRails>
  );
}

function RoomList({
  rooms,
  variant,
  currentUserId
}: {
  rooms: RoomRow[];
  variant: "member";
  currentUserId: string;
}) {
  if (rooms.length === 0) {
    return (
      <p className="text-sm text-white/40">
        You haven&apos;t joined any rooms yet — browse the catalog below to find your first.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-white/5">
      {rooms.map((r) => {
        const youOwn = r.owner_id === currentUserId;
        return (
          <li
            key={r.id}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate font-medium">
                <span className="text-xs">{VIS_GLYPH[r.visibility] ?? "🌍"}</span>
                <span className="truncate">{r.name}</span>
                <span className="text-xs text-white/40">
                  · {r.member_count} member{r.member_count === 1 ? "" : "s"}
                </span>
                {youOwn && (
                  <span className="rounded-sm bg-neon-purple/20 px-1 text-[9px] uppercase tracking-widest text-neon-purple">
                    owner
                  </span>
                )}
              </p>
              {r.description && (
                <p className="truncate text-xs text-white/50">{r.description}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {youOwn ? (
                <OwnedRoomDeleteButton roomId={r.id} roomName={r.name} />
              ) : (
                <LobbyLeaveButton roomId={r.id} roomName={r.name} />
              )}
              <Link
                href={`/rooms/${r.id}`}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Enter →
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

