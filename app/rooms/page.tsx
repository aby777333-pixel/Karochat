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
        .select("id, name, description, visibility, owner_id")
        .in("id", memberIds)
    : { data: [] as Array<Omit<RoomRow, "member_count">> };

  // Hydrate member_count for "your rooms" with one extra query.
  const yourRoomsWithCounts: RoomRow[] = await Promise.all(
    (yourRoomsRaw ?? []).map(async (r) => {
      const { count } = await supabase
        .from("room_members")
        .select("user_id", { count: "exact", head: true })
        .eq("room_id", r.id);
      return { ...r, member_count: count ?? 0 } as RoomRow;
    })
  );
  yourRoomsWithCounts.sort((a, b) => b.member_count - a.member_count);

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
