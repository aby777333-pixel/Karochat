"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type Category = {
  slug: string;
  label: string;
  description: string | null;
  icon: string | null;
  position: number;
  is_adult: boolean;
};

export type Subcategory = {
  category_slug: string;
  slug: string;
  label: string;
  position: number;
};

type CatalogRow = {
  id: string;
  name: string;
  topic: string | null;
  category_slug: string;
  subcategory_slug: string;
  visibility: "public" | "listed" | "unlisted" | "secret";
  voice_enabled: boolean;
  cam_enabled: boolean;
  verified_only: boolean;
  verified_kind: string | null;
  is_adult: boolean;
  capacity: number;
  scale_index: number;
  member_count: number;
};

/**
 * Yahoo-Chat-style catalog tree. Categories on the left (chips), the
 * selected category's subcategories listed top → official rooms below.
 * Live member counts come from the browse_catalog RPC.
 */
export function CategoryBrowser({
  categories,
  subcategories
}: {
  categories: Category[];
  subcategories: Subcategory[];
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string | null>(
    categories[0]?.slug ?? null
  );
  const [rooms, setRooms] = useState<CatalogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCategory) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data, error: rpcErr } = await supabase.rpc("browse_catalog", {
        p_category_slug: activeCategory,
        p_subcategory_slug: null,
        p_limit: 300
      });
      if (cancelled) return;
      setLoading(false);
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setRooms((data ?? []) as CatalogRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, activeCategory]);

  // Group rooms by subcategory for display.
  const subsForCategory = useMemo(
    () =>
      subcategories
        .filter((s) => s.category_slug === activeCategory)
        .sort((a, b) => a.position - b.position),
    [subcategories, activeCategory]
  );
  const grouped = useMemo(() => {
    const map = new Map<string, CatalogRow[]>();
    for (const r of rooms) {
      const list = map.get(r.subcategory_slug) ?? [];
      list.push(r);
      map.set(r.subcategory_slug, list);
    }
    return map;
  }, [rooms]);

  async function enter(room: CatalogRow) {
    if (joining) return;
    setJoining(room.id);
    setError(null);
    if (room.visibility === "public") {
      // Auto-join then navigate (existing room page also auto-joins, but
      // doing it here keeps the URL clean).
      const { error: rpcErr } = await supabase.rpc("join_public_room", {
        p_room_id: room.id
      });
      if (rpcErr && !rpcErr.message.includes("already")) {
        setError(rpcErr.message);
        setJoining(null);
        return;
      }
    }
    router.push(`/rooms/${room.id}`);
    router.refresh();
  }

  return (
    <section className="surface-glass tint-purple p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-display text-lg font-semibold">Karochat rooms</h2>
        <span className="text-xs text-white/40">
          Browse · {categories.length} categories
        </span>
      </div>

      {/* Category chips */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3">
        {categories.map((c) => {
          const active = c.slug === activeCategory;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => setActiveCategory(c.slug)}
              className={clsx(
                "shrink-0 rounded-full border px-3 py-1.5 text-xs transition",
                active
                  ? "border-neon-purple/60 bg-neon-purple/15 text-white"
                  : "border-white/10 bg-white/5 text-white/75 hover:bg-white/10"
              )}
              title={c.description ?? c.label}
            >
              <span aria-hidden className="mr-1">{c.icon ?? "·"}</span>
              {c.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mb-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
          {error}
        </p>
      )}

      {/* Subcategory → rooms */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-xs text-white/40">Loading rooms…</p>
        ) : subsForCategory.length === 0 ? (
          <p className="text-xs text-white/40">No subcategories here yet.</p>
        ) : (
          subsForCategory.map((sub) => {
            const list = grouped.get(sub.slug) ?? [];
            if (list.length === 0) return null;
            return (
              <SubcategoryBlock
                key={sub.slug}
                sub={sub}
                rooms={list}
                joining={joining}
                onEnter={enter}
              />
            );
          })
        )}
      </div>

      <p className="mt-4 text-[10px] text-white/30">
        ◦ Empty rooms are scaffolding — they populate when people join.
        ◦ <Link href="/rooms?create=1" className="underline hover:text-white">Create a room</Link> if you don&apos;t see your scene yet.
      </p>
    </section>
  );
}

function SubcategoryBlock({
  sub,
  rooms,
  joining,
  onEnter
}: {
  sub: Subcategory;
  rooms: CatalogRow[];
  joining: string | null;
  onEnter: (room: CatalogRow) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((s) => !s)}
        className="mb-1 flex w-full items-baseline justify-between rounded-md px-1 py-0.5 text-left hover:bg-white/5"
        aria-expanded={expanded}
      >
        <span className="text-[10px] uppercase tracking-widest text-white/45">
          {sub.label} · {rooms.length}
        </span>
        <span className="text-[10px] text-white/30">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <ul className="divide-y divide-white/5">
          {rooms.map((r) => (
            <RoomRow
              key={r.id}
              room={r}
              joining={joining === r.id}
              onEnter={() => onEnter(r)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function RoomRow({
  room,
  joining,
  onEnter
}: {
  room: CatalogRow;
  joining: boolean;
  onEnter: () => void;
}) {
  const empty = room.member_count === 0;
  return (
    <li
      className={clsx(
        "flex items-center justify-between gap-3 py-2",
        empty && "opacity-60"
      )}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-sm">
          <span className="truncate text-white">{room.name}</span>
          <span className="font-mono text-[10px] text-white/45">
            ({room.member_count})
          </span>
          {room.voice_enabled && (
            <span
              className="rounded-sm bg-neon-blue/15 px-1 text-[9px] text-neon-blue"
              title="Voice enabled"
            >
              🎙️v
            </span>
          )}
          {room.cam_enabled && (
            <span
              className="rounded-sm bg-neon-amber/15 px-1 text-[9px] text-neon-amber"
              title="Cam enabled"
            >
              📹w
            </span>
          )}
          {room.verified_only && (
            <span
              className="rounded-sm bg-neon-purple/15 px-1 text-[9px] uppercase tracking-widest text-neon-purple"
              title={`Verified ${room.verified_kind ?? ""} only`}
            >
              ✓ {room.verified_kind ?? "verified"}
            </span>
          )}
          {room.is_adult && (
            <span
              className="rounded-sm bg-neon-red/15 px-1 text-[9px] uppercase tracking-widest text-neon-red"
              title="Adult — 18+"
            >
              18+
            </span>
          )}
          {room.visibility === "listed" && (
            <span
              className="rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/55"
              title="Listed — request to join"
            >
              🔒
            </span>
          )}
        </p>
        {room.topic && (
          <p className="truncate text-[11px] text-white/50">{room.topic}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onEnter}
        disabled={joining}
        className={clsx(
          "shrink-0 rounded-lg border px-3 py-1.5 text-xs transition",
          empty
            ? "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
            : "border-neon-blue/30 bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20"
        )}
      >
        {joining ? "…" : empty ? "Be first →" : "Enter →"}
      </button>
    </li>
  );
}
