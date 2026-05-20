import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";
import { AdRails } from "@/components/AdRails";
import { RoomsClient, JoinPublic } from "./RoomsClient";

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
    .select("id, username, display_name, terms_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

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
        .select("id, name, description, visibility, owner_id, is_dm")
        .in("id", memberIds)
    : { data: [] as Array<Omit<RoomRow, "member_count">> };

  const dmRoomsRaw = (yourRoomsRaw ?? []).filter((r) => r.is_dm === true);
  const nonDmRoomsRaw = (yourRoomsRaw ?? []).filter((r) => r.is_dm !== true);

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

  const { data: discoverRaw } = await supabase
    .from("rooms_browse")
    .select("id, name, description, visibility, owner_id, member_count")
    .order("member_count", { ascending: false })
    .limit(40);

  const memberSet = new Set(memberIds);
  const discover = ((discoverRaw ?? []) as RoomRow[]).filter((r) => !memberSet.has(r.id));

  const missingId = searchParams?.missing;
  const joinNotice = searchParams?.join;

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/rooms" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs md:block">
              <p className="text-white">{profile.display_name}</p>
              <p className="text-white/40">@{profile.username}</p>
            </div>
            <SignOutButton />
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

        <div className="mt-5 grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            {dms.length > 0 && (
              <section className="surface-glass p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="font-display text-lg font-semibold">Direct messages</h2>
                  <span className="text-xs text-white/40">{dms.length}</span>
                </div>
                <DMList dms={dms} />
              </section>
            )}

            <section className="surface-glass p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold">Your rooms</h2>
                <span className="text-xs text-white/40">{yourRoomsWithCounts.length}</span>
              </div>
              <RoomList rooms={yourRoomsWithCounts} variant="member" />
            </section>

            <section className="surface-glass p-5">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="font-display text-lg font-semibold">Discover rooms</h2>
                <span className="text-xs text-white/40">{discover.length}</span>
              </div>
              <RoomList rooms={discover} variant="discover" />
            </section>
          </div>

          <aside className="space-y-5">
            <RoomsClient />
          </aside>
        </div>

        <footer className="mt-8 space-y-1 text-center text-[11px] text-white/30">
          <p>Be kind. Be real. Live and let live.</p>
          <p>
            Questions? Reports?{" "}
            <a href="mailto:info@karochat.co" className="hover:text-white">
              info@karochat.co
            </a>
          </p>
        </footer>
      </main>
    </AdRails>
  );
}

function RoomList({
  rooms,
  variant
}: {
  rooms: RoomRow[];
  variant: "member" | "discover";
}) {
  if (rooms.length === 0) {
    return (
      <p className="text-sm text-white/40">
        {variant === "member"
          ? "You haven't joined any rooms yet."
          : "No rooms to discover yet. Be the first to make one!"}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-white/5">
      {rooms.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-medium">
              <span className="text-xs">{VIS_GLYPH[r.visibility] ?? "🌍"}</span>
              <span className="truncate">{r.name}</span>
              <span className="text-xs text-white/40">
                · {r.member_count} member{r.member_count === 1 ? "" : "s"}
              </span>
            </p>
            {r.description && (
              <p className="truncate text-xs text-white/50">{r.description}</p>
            )}
          </div>
          {variant === "member" ? (
            <Link
              href={`/rooms/${r.id}`}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Enter →
            </Link>
          ) : (
            <JoinPublic
              roomId={r.id}
              visibility={r.visibility === "listed" ? "listed" : "public"}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function DMList({ dms }: { dms: DMRow[] }) {
  return (
    <ul className="divide-y divide-white/5">
      {dms.map((d) => {
        const name = d.partner_display_name ?? d.partner_username ?? "Unknown";
        const handle = d.partner_username ?? "anon";
        const presenceColor =
          d.partner_presence === "online"
            ? "bg-neon-mint"
            : d.partner_presence === "busy"
            ? "bg-neon-red"
            : d.partner_presence === "away"
            ? "bg-neon-amber"
            : "bg-white/30";
        return (
          <li key={d.id} className="flex items-center justify-between gap-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${presenceColor}`} aria-hidden />
              <p className="truncate font-medium text-white">{name}</p>
              <span className="truncate text-xs text-white/40">@{handle}</span>
            </div>
            <Link
              href={`/rooms/${d.id}`}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Open →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
