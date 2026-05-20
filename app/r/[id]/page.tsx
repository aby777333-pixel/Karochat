import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";

export const dynamic = "force-dynamic";

type PublicRoom = {
  id: string;
  name: string;
  description: string | null;
  visibility: "public" | "listed" | "unlisted" | "secret";
  is_public: boolean;
  member_count: number;
  created_at: string;
};

async function loadRoom(id: string): Promise<PublicRoom | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_public_room", {
    p_room_id: id
  });
  if (error) {
    console.error("[/r/[id]] get_public_room error", error);
    return null;
  }
  const rows = (data as PublicRoom[]) ?? [];
  return rows[0] ?? null;
}

export async function generateMetadata({
  params
}: {
  params: { id: string };
}): Promise<Metadata> {
  const room = await loadRoom(params.id);
  if (!room) return { title: "Karochat" };
  return {
    title: `${room.name} · Karochat`,
    description:
      room.description ??
      "A room on Karochat — chat, make friends, share, care.",
    openGraph: {
      title: `${room.name} · Karochat`,
      description:
        room.description ??
        "A room on Karochat — chat, make friends, share, care.",
      type: "website"
    }
  };
}

export default async function RoomLandingPage({
  params
}: {
  params: { id: string };
}) {
  const room = await loadRoom(params.id);
  if (!room) notFound();

  const since = new Date(room.created_at);
  const sinceText = since.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-5 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/"
          className="text-xs text-white/50 hover:text-white"
        >
          karochat.co →
        </Link>
      </header>

      <section className="surface-glass tint-blue mt-8 p-8">
        <p className="text-[11px] uppercase tracking-widest text-white/40">
          {room.visibility === "public" ? "🌍 public room" : "🔒 listed room"}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-white">
          {room.name}
        </h1>
        {room.description && (
          <p className="mt-3 text-base leading-relaxed text-white/85">
            {room.description}
          </p>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <dt className="text-[10px] uppercase tracking-widest text-white/40">
              Members
            </dt>
            <dd className="mt-0.5 font-mono text-lg text-white">
              {room.member_count}
            </dd>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
            <dt className="text-[10px] uppercase tracking-widest text-white/40">
              Since
            </dt>
            <dd className="mt-0.5 font-mono text-lg text-white">{sinceText}</dd>
          </div>
        </dl>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/rooms/${room.id}`}
            className="flex-1 rounded-xl bg-neon-blue px-5 py-3 text-center text-sm font-medium text-ink-900 shadow-glow-blue transition hover:bg-neon-blue/90"
          >
            {room.visibility === "public" ? "Join the room →" : "Request to join →"}
          </Link>
          <Link
            href="/"
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            About Karochat
          </Link>
        </div>

        <p className="mt-5 text-[11px] text-white/40">
          Karochat is a Yahoo-Messenger-style chat reborn for 2026 — anonymous-friendly,
          queer-first, no follower counts, no infinite scroll, no slot-machine.
        </p>
      </section>

      <footer className="mt-8 text-center text-[11px] text-white/30">
        <p>Be kind. Be real. Live and let live.</p>
        <p className="mt-1">
          <a href="mailto:info@karochat.co" className="hover:text-white">
            info@karochat.co
          </a>
        </p>
      </footer>
    </main>
  );
}
