import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";
import { RoomsClient, JoinPublic } from "./RoomsClient";

export const dynamic = "force-dynamic";

type RoomRow = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  owner_id: string | null;
  member_count: number;
};

export default async function RoomsPage({
  searchParams
}: {
  searchParams?: { missing?: string; join?: string };
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

  const { data: yourRooms } = memberIds.length
    ? await supabase
        .from("rooms_browse")
        .select("id, name, description, is_public, owner_id, member_count")
        .in("id", memberIds)
        .order("member_count", { ascending: false })
    : { data: [] as RoomRow[] };

  const { data: publicRooms } = await supabase
    .from("rooms_browse")
    .select("id, name, description, is_public, owner_id, member_count")
    .eq("is_public", true)
    .order("member_count", { ascending: false })
    .limit(30);

  const memberSet = new Set(memberIds);
  const discover = (publicRooms ?? []).filter((r) => !memberSet.has(r.id));

  const missingId = searchParams?.missing;
  const joinNotice = searchParams?.join;

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-6xl flex-col px-5 py-5 md:py-7">
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

      <div className="mt-5 grid flex-1 grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className="surface-glass p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold">Your rooms</h2>
              <span className="text-xs text-white/40">{yourRooms?.length ?? 0}</span>
            </div>
            <RoomList rooms={yourRooms ?? []} variant="member" />
          </section>

          <section className="surface-glass p-5">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-lg font-semibold">Discover public rooms</h2>
              <span className="text-xs text-white/40">{discover.length}</span>
            </div>
            <RoomList rooms={discover} variant="discover" />
          </section>
        </div>

        <aside className="space-y-5">
          <RoomsClient />
        </aside>
      </div>

      <footer className="mt-8 text-center text-[11px] text-white/30">
        Be kind. Be real. Live and let live.
      </footer>
    </main>
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
          : "No public rooms to discover. Be the first to make one!"}
      </p>
    );
  }
  return (
    <ul className="divide-y divide-white/5">
      {rooms.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <p className="flex items-center gap-2 truncate font-medium">
              {!r.is_public && <span className="text-xs">🔒</span>}
              <span className="truncate">{r.name}</span>
              <span className="text-xs text-white/40">· {r.member_count} member{r.member_count === 1 ? "" : "s"}</span>
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
            <JoinPublic roomId={r.id} />
          )}
        </li>
      ))}
    </ul>
  );
}

