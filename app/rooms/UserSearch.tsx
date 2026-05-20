"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PresenceDot } from "@/components/PresenceDot";

type Hit = {
  id: string;
  username: string | null;
  display_name: string | null;
  is_guest: boolean | null;
  presence_state: string | null;
};

export function UserSearch() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      setError(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setBusy(true);
      setError(null);
      const { data, error: rpcErr } = await supabase.rpc("search_users", { p_query: q });
      setBusy(false);
      if (rpcErr) {
        setError(rpcErr.message);
        setHits([]);
        return;
      }
      setHits((data ?? []) as Hit[]);
    }, 220);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, supabase]);

  async function openDM(target: Hit) {
    setOpening(target.id);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("get_or_create_dm", {
      p_target_user_id: target.id
    });
    setOpening(null);
    if (rpcErr || !data) {
      setError(rpcErr?.message ?? "Could not start a DM.");
      return;
    }
    router.push(`/rooms/${data}`);
    router.refresh();
  }

  return (
    <section className="surface-glass p-5">
      <h3 className="font-display text-base font-semibold">Find a person</h3>
      <p className="mt-1 text-xs text-white/60">
        Search by @handle or display name. Tap a result to start a private chat.
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 focus-within:border-neon-blue/60">
        <span aria-hidden className="text-white/40">🔎</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="@username…"
          autoComplete="off"
          spellCheck={false}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-white/30"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear"
            className="text-xs text-white/40 hover:text-white/70"
          >
            ✕
          </button>
        )}
      </div>
      {error && (
        <p className="mt-2 text-xs text-neon-red">{error}</p>
      )}
      {query.trim() && (
        <div className="mt-3">
          {busy ? (
            <p className="text-xs text-white/40">Searching…</p>
          ) : hits.length === 0 ? (
            <p className="text-xs text-white/40">No one matches that yet.</p>
          ) : (
            <ul className="divide-y divide-white/5">
              {hits.map((h) => {
                const name = h.display_name ?? h.username ?? "Unknown";
                const handle = h.username ?? "anon";
                const isOpening = opening === h.id;
                return (
                  <li key={h.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <PresenceDot state={h.presence_state ?? "offline"} pulse />
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          <span className="text-white">{name}</span>
                          {h.is_guest && (
                            <span className="ml-1 rounded-sm bg-white/10 px-1 text-[9px] uppercase tracking-widest text-white/50">
                              guest
                            </span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-white/40">@{handle}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void openDM(h)}
                      disabled={isOpening}
                      className={clsx(
                        "rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white",
                        isOpening && "opacity-50"
                      )}
                    >
                      {isOpening ? "Opening…" : "Message →"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
