"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { UserRoomsBrowser } from "./UserRoomsBrowser";

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

type CountRow = {
  category_slug: string;
  subcategory_slug: string;
  room_count: number;
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
 * Yahoo-Chat-reborn catalog tree.
 *
 * Top level: 20 categories. Click a category → expand subcategories.
 * Click a subcategory → lazy-load rooms via browse_catalog.
 * Click a room → join (public) and navigate.
 *
 * Counts come from a cheap catalog_counts() roll-up so the initial render
 * doesn't fetch any rooms.
 */
export function CategoryBrowser({
  categories,
  subcategories,
  hideUserTab = false,
  title,
  totalsHint
}: {
  categories: Category[];
  subcategories: Subcategory[];
  /**
   * When true, suppresses the "User rooms" tab. Used inside /students,
   * where user-created student rooms are surfaced separately by
   * StudentRoomsBrowser, so the embedded user-rooms list would be
   * redundant + confusing.
   */
  hideUserTab?: boolean;
  /** Override the section heading (default: "Browse rooms"). */
  title?: string;
  /** Override the "N categories · M rooms" footer hint text shape. */
  totalsHint?: (catCount: number, total: number) => string;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();

  const [tab, setTab] = useState<"official" | "user">("official");
  const [counts, setCounts] = useState<CountRow[]>([]);
  const [openCats, setOpenCats] = useState<Set<string>>(new Set());
  const [openSubs, setOpenSubs] = useState<Set<string>>(new Set());
  const [roomCache, setRoomCache] = useState<
    Record<string, CatalogRow[] | "loading">
  >({});
  const [filter, setFilter] = useState("");
  const [joining, setJoining] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error: rpcErr } = await supabase.rpc("catalog_counts");
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setCounts((data ?? []) as CountRow[]);
    })();
  }, [supabase]);

  // category-level totals
  const catTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of counts) {
      map.set(c.category_slug, (map.get(c.category_slug) ?? 0) + c.room_count);
    }
    return map;
  }, [counts]);

  // (cat, sub) → count
  const subCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of counts) {
      map.set(`${c.category_slug}/${c.subcategory_slug}`, c.room_count);
    }
    return map;
  }, [counts]);

  // subcategories indexed by category
  const subsByCategory = useMemo(() => {
    const map = new Map<string, Subcategory[]>();
    for (const s of subcategories) {
      const list = map.get(s.category_slug) ?? [];
      list.push(s);
      map.set(s.category_slug, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [subcategories]);

  function toggleCat(slug: string) {
    setOpenCats((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  async function toggleSub(catSlug: string, subSlug: string) {
    const key = `${catSlug}/${subSlug}`;
    const isOpen = openSubs.has(key);
    setOpenSubs((prev) => {
      const next = new Set(prev);
      if (isOpen) next.delete(key);
      else next.add(key);
      return next;
    });
    if (!isOpen && !roomCache[key]) {
      setRoomCache((prev) => ({ ...prev, [key]: "loading" }));
      const { data, error: rpcErr } = await supabase.rpc("browse_catalog", {
        p_category_slug: catSlug,
        p_subcategory_slug: subSlug,
        p_limit: 200
      });
      if (rpcErr) {
        setError(rpcErr.message);
        setRoomCache((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        return;
      }
      setRoomCache((prev) => ({ ...prev, [key]: (data ?? []) as CatalogRow[] }));
    }
  }

  async function enter(room: CatalogRow) {
    if (joining) return;
    setJoining(room.id);
    setError(null);
    // Wave 19.5 — public and listed rooms auto-join. Unlisted and secret
    // need an invite code from a member.
    if (room.visibility === "public" || room.visibility === "listed") {
      const { error: rpcErr } = await supabase.rpc("join_public_room", {
        p_room_id: room.id
      });
      if (rpcErr && !rpcErr.message.includes("already")) {
        setError(rpcErr.message);
        setJoining(null);
        return;
      }
      router.push(`/rooms/${room.id}`);
      router.refresh();
      return;
    }
    setJoining(null);
    setError(
      `"${room.name}" is a private room — you need an invite code from a member to join.`
    );
  }

  // Search expansion: if filter is non-empty, auto-expand any subcategory
  // whose loaded rooms match. Initial-render UX: empty filter → user drives
  // expansion themselves.
  const filterLower = filter.trim().toLowerCase();
  function matches(text: string | null | undefined) {
    if (!filterLower) return true;
    return (text ?? "").toLowerCase().includes(filterLower);
  }

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.position - b.position),
    [categories]
  );

  const totalOfficial = Array.from(catTotals.values()).reduce((a, b) => a + b, 0);

  return (
    <section className="surface-glass tint-purple p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">
          {title ?? "Browse rooms"}
        </h2>
        {tab === "official" && (
          <span className="text-xs text-white/40">
            {totalsHint
              ? totalsHint(sortedCategories.length, totalOfficial)
              : `${sortedCategories.length} categories · ${totalOfficial} rooms`}
          </span>
        )}
      </div>

      {/* Yahoo!-style two-tab switcher: Karochat (official) vs User rooms.
          Suppressed when the parent already surfaces user rooms elsewhere. */}
      {!hideUserTab && (
        <div className="mb-3 -mx-1 flex gap-1 border-b border-white/10 px-1">
          <TabButton
            active={tab === "official"}
            onClick={() => setTab("official")}
            label="Karochat rooms"
            hint="The official catalog tree"
          />
          <TabButton
            active={tab === "user"}
            onClick={() => setTab("user")}
            label="User rooms"
            hint="Rooms created by people"
          />
        </div>
      )}

      {/* USER ROOMS TAB — render the existing UserRoomsBrowser inline.
          We hide its own outer surface by keeping a wrapper that resets the
          tint, so the inner card looks at home inside the tabs. */}
      {tab === "user" && (
        <div className="-m-5 mt-0 [&>section]:!border-0 [&>section]:!bg-transparent [&>section]:!bg-none [&>section]:!shadow-none">
          <UserRoomsBrowser />
        </div>
      )}

      {/* OFFICIAL CATALOG TAB — the existing XML-style tree */}
      {tab === "official" && (
        <>
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 focus-within:border-neon-purple/60">
            <span aria-hidden className="text-white/40">🔎</span>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter loaded rooms by name or topic…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
            />
            {filter && (
              <button
                type="button"
                onClick={() => setFilter("")}
                aria-label="Clear"
                className="text-xs text-white/40 hover:text-white/70"
              >
                ✕
              </button>
            )}
          </div>

          {error && (
            <p className="mb-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
              {error}
            </p>
          )}

          <ul className="font-mono text-sm">
        {sortedCategories.map((cat) => {
          const total = catTotals.get(cat.slug) ?? 0;
          const open = openCats.has(cat.slug);
          const subs = subsByCategory.get(cat.slug) ?? [];
          return (
            <li key={cat.slug} className="border-b border-white/5 last:border-b-0">
              <button
                type="button"
                onClick={() => toggleCat(cat.slug)}
                aria-expanded={open}
                className="flex w-full items-center gap-2 py-2 text-left transition hover:bg-white/[0.03]"
              >
                <span
                  aria-hidden
                  className="inline-block w-3 text-white/40"
                  style={{ fontFamily: "monospace" }}
                >
                  {open ? "▾" : "▸"}
                </span>
                <span className="text-base">{cat.icon ?? "·"}</span>
                <span className="font-sans font-medium text-white">{cat.label}</span>
                <span className="font-mono text-[11px] text-white/40">
                  · {total} rooms
                </span>
              </button>
              {open && (
                <ul className="ml-5 border-l border-white/5 pl-3">
                  {subs.length === 0 ? (
                    <li className="py-1 font-sans text-[11px] italic text-white/40">
                      (empty — be the first to create a room here)
                    </li>
                  ) : (
                    subs.map((sub) => {
                      const key = `${cat.slug}/${sub.slug}`;
                      const subTotal = subCount.get(key) ?? 0;
                      // Wave 19 — keep empty subcategories visible so the
                      // user can find them and create a room inside.
                      const subOpen = openSubs.has(key);
                      const rooms = roomCache[key];
                      return (
                        <li
                          key={sub.slug}
                          className="border-b border-white/5 last:border-b-0"
                        >
                          <button
                            type="button"
                            onClick={() => void toggleSub(cat.slug, sub.slug)}
                            aria-expanded={subOpen}
                            className="flex w-full items-center gap-2 py-1.5 text-left transition hover:bg-white/[0.03]"
                          >
                            <span
                              aria-hidden
                              className="inline-block w-3 text-white/40"
                            >
                              {subOpen ? "▾" : "▸"}
                            </span>
                            <span className="font-sans text-sm text-white/85">
                              {sub.label}
                            </span>
                            <span className="font-mono text-[11px] text-white/40">
                              · {subTotal}
                            </span>
                          </button>
                          {subOpen && (
                            <ul className="ml-5 border-l border-white/5 pl-3">
                              {rooms === undefined || rooms === "loading" ? (
                                <li className="py-1 font-sans text-[11px] italic text-white/40">
                                  Loading rooms…
                                </li>
                              ) : (
                                rooms
                                  .filter(
                                    (r) =>
                                      matches(r.name) ||
                                      matches(r.topic)
                                  )
                                  .map((room) => (
                                    <TreeRoomRow
                                      key={room.id}
                                      room={room}
                                      joining={joining === room.id}
                                      onEnter={() => enter(room)}
                                    />
                                  ))
                              )}
                              {rooms !== undefined &&
                                rooms !== "loading" &&
                                rooms.filter(
                                  (r) => matches(r.name) || matches(r.topic)
                                ).length === 0 &&
                                !filterLower && (
                                  <li className="py-1 font-sans text-[11px] italic text-white/40">
                                    No rooms yet — be the first.
                                  </li>
                                )}
                              {rooms !== undefined &&
                                rooms !== "loading" &&
                                rooms.filter(
                                  (r) => matches(r.name) || matches(r.topic)
                                ).length === 0 &&
                                filterLower && (
                                  <li className="py-1 font-sans text-[11px] italic text-white/40">
                                    No rooms here match &ldquo;{filter}&rdquo;.
                                  </li>
                                )}
                              <li>
                                <CreateHereLink
                                  catSlug={cat.slug}
                                  catLabel={cat.label}
                                  subSlug={sub.slug}
                                  subLabel={sub.label}
                                />
                              </li>
                            </ul>
                          )}
                        </li>
                      );
                    })
                  )}
                  {/* Always offer a category-level CTA so the user can
                     drop a room straight into the category without
                     picking a subcategory. */}
                  <li className="border-t border-white/5">
                    <CreateHereLink
                      catSlug={cat.slug}
                      catLabel={cat.label}
                      subSlug={null}
                      subLabel={null}
                      tone="category"
                    />
                  </li>
                </ul>
              )}
            </li>
          );
        })}
          </ul>

          <p className="mt-4 text-[10px] text-white/30">
            ◦ Empty rooms are scaffolding — they populate when people join.
          </p>
        </>
      )}
    </section>
  );
}

function TabButton({
  active,
  label,
  hint,
  onClick
}: {
  active: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={clsx(
        "-mb-px rounded-t-md border-b-2 px-3 py-1.5 text-sm transition",
        active
          ? "border-neon-purple text-white"
          : "border-transparent text-white/55 hover:text-white"
      )}
    >
      {label}
    </button>
  );
}

/**
 * "+ Create here" link — Wave 19. Routes to /rooms?create=1&category=...
 * with the chosen category/subcategory so the create card pre-files the
 * room into the right slot in the catalog.
 */
function CreateHereLink({
  catSlug,
  catLabel,
  subSlug,
  subLabel,
  tone = "subcategory"
}: {
  catSlug: string;
  catLabel: string;
  subSlug: string | null;
  subLabel: string | null;
  tone?: "category" | "subcategory";
}) {
  const params = new URLSearchParams({
    create: "1",
    category: catSlug,
    catlabel: catLabel
  });
  if (subSlug) params.set("sub", subSlug);
  if (subLabel) params.set("sublabel", subLabel);
  const label = tone === "category"
    ? `+ Create your own room in ${catLabel}`
    : `+ Create your own room in ${subLabel}`;
  return (
    <a
      href={`/rooms?${params.toString()}#create-room-name`}
      className={clsx(
        "block py-1.5 font-sans text-xs transition",
        tone === "category"
          ? "px-1 text-neon-mint hover:text-white"
          : "text-neon-mint/85 hover:text-neon-mint"
      )}
      title="Open the create-room form pre-filled with this category"
    >
      {label}
      <span className="ml-1 text-white/30">→</span>
    </a>
  );
}

function TreeRoomRow({
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
        "group flex items-center justify-between gap-2 py-1",
        empty && "opacity-60"
      )}
    >
      <button
        type="button"
        onClick={onEnter}
        disabled={joining}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        title={room.topic ?? room.name}
      >
        <span
          aria-hidden
          className="inline-block w-3 text-white/30 group-hover:text-white/55"
        >
          └
        </span>
        <span className="truncate font-mono text-[13px] text-white/85 group-hover:text-white">
          {room.name}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-white/45">
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
            ✓
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
      </button>
      <button
        type="button"
        onClick={onEnter}
        disabled={joining}
        className={clsx(
          "shrink-0 rounded-md border px-2 py-0.5 text-[11px] transition",
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
