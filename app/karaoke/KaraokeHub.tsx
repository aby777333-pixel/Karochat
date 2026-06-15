"use client";

// Karochat — Karaoke hub (the standalone "Karaoke" tab from the lobby).
//
// A SMULE-style landing for singing on Karochat. It reuses the existing,
// battle-tested pieces and adds no new backend:
//   • Solo — opens the full KaraokeStudio modal in solo mode (record, post to
//     Music / Shorts / Videos, download, lyrics, tuner, metronome).
//   • Duets & groups — one tap creates a public karaoke room (voice + cam,
//     tagged into the Duet Karaoke catalog) and drops you in; or join one of the
//     existing official karaoke / duet / sing-along rooms below. Inside a room
//     the studio syncs the backing track for everyone and voices travel over the
//     room's voice call (📞).
//   • Free tracks — country- & state-wise backing-track library (inside the
//     studio's Library tab).
//   • Invite — share an invite link with anyone (lobby audience, a friend, or an
//     external guest); inside a room you also get its private invite code.
//
// Everything degrades gracefully and nothing here touches existing flows.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { KaraokeStudio } from "@/components/KaraokeStudio";

type Tab = "sing" | "library";

type RoomRow = {
  id: string;
  name: string;
  topic: string | null;
  subcategory_slug: string;
  voice_enabled: boolean;
  cam_enabled: boolean;
  member_count: number;
};

// The karaoke-flavoured subcategories under the "Live & Karaoke music" category.
const KARAOKE_SUBS = ["info-karaoke", "info-duet", "info-singalong"] as const;

export function KaraokeHub({
  userId,
  userName
}: {
  userId: string;
  userName: string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  const [studioOpen, setStudioOpen] = useState(false);
  const [studioTab, setStudioTab] = useState<Tab>("sing");

  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load the existing official karaoke rooms (people can join these for duets).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingRooms(true);
      try {
        const lists = await Promise.all(
          KARAOKE_SUBS.map((sub) =>
            supabase.rpc("browse_catalog", {
              p_category_slug: "infotainment",
              p_subcategory_slug: sub,
              p_limit: 40
            })
          )
        );
        if (cancelled) return;
        const merged: RoomRow[] = [];
        for (const { data } of lists) {
          for (const r of (data ?? []) as RoomRow[]) merged.push(r);
        }
        // Busiest first, then by name; cap the visible list.
        merged.sort(
          (a, b) => b.member_count - a.member_count || a.name.localeCompare(b.name)
        );
        setRooms(merged.slice(0, 18));
      } catch {
        if (!cancelled) setError("Couldn't load karaoke rooms. You can still sing solo.");
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const openStudio = useCallback((tab: Tab) => {
    setStudioTab(tab);
    setStudioOpen(true);
  }, []);

  // One-tap: create a fresh public karaoke room (voice + cam) and go sing.
  async function startDuetRoom() {
    if (busy) return;
    setBusy("create");
    setError(null);
    try {
      const { data, error: rpcErr } = await supabase
        .rpc("create_room", {
          p_name: `🎤 ${userName}'s karaoke`,
          p_description:
            "Sing-together karaoke — open the voice call (📞) and the studio (🎤), then everyone sings over the same track.",
          p_visibility: "public"
        })
        .single<{ id: string; invite_code: string | null; visibility: string }>();
      if (rpcErr || !data) throw rpcErr ?? new Error("Could not create the room.");
      // Tag it into the Duet Karaoke catalog + enable voice/cam. Best-effort:
      // the room already works without this, so a failure here is non-fatal.
      await supabase
        .from("rooms")
        .update({
          category_slug: "infotainment",
          subcategory_slug: "info-duet",
          voice_enabled: true,
          cam_enabled: true
        })
        .eq("id", data.id);
      router.push(`/rooms/${data.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Could not start a duet room.");
      setBusy(null);
    }
  }

  // Join an existing official karaoke room and go.
  async function joinRoom(id: string) {
    if (busy) return;
    setBusy(id);
    setError(null);
    try {
      const { error: rpcErr } = await supabase.rpc("join_public_room", { p_room_id: id });
      if (rpcErr && !rpcErr.message.includes("already")) throw rpcErr;
      router.push(`/rooms/${id}`);
    } catch (e: any) {
      setError(e?.message ?? "Could not join that room.");
      setBusy(null);
    }
  }

  // Invite anyone — copy the karaoke link & offer the native share sheet.
  async function inviteAnyone() {
    const url =
      typeof window !== "undefined" ? `${window.location.origin}/karaoke` : "/karaoke";
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: "Sing on Karochat",
          text: "🎤 Come sing karaoke with me on Karochat!",
          url
        });
      }
    } catch {
      // user dismissed — fine
    }
  }

  return (
    <div className="space-y-5">
      {/* Hero / quick actions */}
      <section className="surface-glass tint-purple p-5">
        <h1 className="font-display text-xl font-semibold">🎤 Karaoke</h1>
        <p className="mt-1 text-sm text-white/60">
          Sing solo or in a duet, record audio &amp; video, and publish to the
          lobby, Videos &amp; Shorts. Backing tracks from around the world —
          country- &amp; state-wise — plus your own files and links.
        </p>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => openStudio("sing")}
            className="rounded-2xl border border-neon-purple/40 bg-neon-purple/15 px-4 py-4 text-left transition hover:bg-neon-purple/25"
          >
            <span className="block text-base font-semibold text-white">🎙️ Sing solo</span>
            <span className="text-[12px] text-white/60">
              Open the studio — record, auto-record, post &amp; download.
            </span>
          </button>
          <button
            type="button"
            onClick={() => void startDuetRoom()}
            disabled={busy === "create"}
            className="rounded-2xl border border-neon-mint/40 bg-neon-mint/15 px-4 py-4 text-left transition hover:bg-neon-mint/25 disabled:opacity-50"
          >
            <span className="block text-base font-semibold text-white">
              {busy === "create" ? "Starting…" : "👥 Start a duet / group room"}
            </span>
            <span className="text-[12px] text-white/60">
              Creates a live room — invite people and sing together in sync.
            </span>
          </button>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openStudio("library")}
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/85 transition hover:border-white/25 hover:bg-white/5"
          >
            🌍 Free tracks — country &amp; state-wise
          </button>
          <button
            type="button"
            onClick={() => void inviteAnyone()}
            className="rounded-xl border border-neon-blue/40 bg-neon-blue/10 px-3 py-2 text-xs text-neon-blue transition hover:bg-neon-blue/20"
          >
            {copied ? "✓ Invite link copied" : "🔗 Invite anyone"}
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
            {error}
          </p>
        )}
      </section>

      {/* Join an existing karaoke room (for duets & groups) */}
      <section className="surface-glass p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold">Sing together — join a room</h2>
          <span className="text-[11px] text-white/40">Karaoke · Duet · Sing-Along</span>
        </div>

        {loadingRooms ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">
            <span className="mr-2 animate-pulseDot">●</span>Loading karaoke rooms…
          </p>
        ) : rooms.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-white/50">
            No karaoke rooms yet — tap{" "}
            <span className="text-white/80">Start a duet / group room</span> above to
            open one.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {rooms.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => void joinRoom(r.id)}
                  disabled={!!busy}
                  className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-left transition hover:border-neon-purple/40 hover:bg-white/5 disabled:opacity-50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-white/90">{r.name}</span>
                    <span className="block truncate text-[11px] text-white/40">
                      {r.member_count} in room
                      {r.voice_enabled ? " · 🎙️ voice" : ""}
                      {r.cam_enabled ? " · 📹 cam" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-md border border-neon-purple/30 bg-neon-purple/10 px-2 py-0.5 text-[11px] text-neon-purple">
                    {busy === r.id ? "…" : "Join →"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-white/35">
          Inside a room, open the voice call (📞) so everyone hears each other, then
          the studio (🎤) to load a backing track in sync. Record your duet and post
          it to the lobby, Videos or Shorts — or download it.
        </p>
      </section>

      {/* Solo / library studio (modal). Solo mode = no roomId. */}
      <KaraokeStudio
        open={studioOpen}
        onClose={() => setStudioOpen(false)}
        roomName="Solo karaoke session"
        userId={userId}
        userName={userName}
        initialTab={studioTab}
      />
    </div>
  );
}
