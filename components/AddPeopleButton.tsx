"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * AddPeopleButton — Wave 19.14.
 *
 * Two shapes:
 *   • Group room (is_dm = false): "+ Add person" → username search →
 *     add_member_to_room RPC. Anyone in the room can do this.
 *   • 1:1 DM (is_dm = true, not vault): "+ Add more people" → confirm
 *     dialog → promote_dm_to_group RPC → returns a new invite code
 *     so the user can share. Both DM parties can do this.
 *
 * Vault and Saved rooms hide the button — vaults are 1:1 by design
 * and Saved is personal.
 */
type SearchHit = {
  id: string;
  username: string | null;
  display_name: string | null;
};

export function AddPeopleButton({
  roomId,
  isDm,
  isVault,
  isSaved
}: {
  roomId: string;
  isDm: boolean;
  isVault: boolean;
  isSaved: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Group-mode state
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  // DM-promote state
  const [promoting, setPromoting] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [newCode, setNewCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
      setError(null);
      setAdded(null);
      setPromoting(false);
      setGroupName("");
      setNewCode(null);
      setCopied(false);
    }
  }, [open]);

  // Debounced search (group mode only)
  useEffect(() => {
    if (!open || isDm) return;
    if (!query.trim()) {
      setHits([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const supabase = createSupabaseBrowserClient();
      const { data, error: rpcErr } = await supabase.rpc("search_users", {
        p_query: query.trim()
      });
      setSearching(false);
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      setHits((data as SearchHit[]) ?? []);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open, isDm]);

  if (isVault || isSaved) return null;

  async function addUser(userId: string, name: string) {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: rpcErr } = await supabase.rpc("add_member_to_room", {
      p_room_id: roomId,
      p_user_id: userId
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setAdded(name);
    setHits((prev) => prev.filter((h) => h.id !== userId));
    router.refresh();
  }

  async function promoteDm() {
    setBusy(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { data, error: rpcErr } = await supabase.rpc("promote_dm_to_group", {
      p_room_id: roomId,
      p_new_name: groupName.trim() || null
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setNewCode(String(data ?? ""));
    setPromoting(false);
    router.refresh();
  }

  async function copyCode() {
    if (!newCode) return;
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      await navigator.clipboard.writeText(
        `${base}/rooms/${roomId}?invite=${encodeURIComponent(newCode)}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  const label = isDm ? "👥 Add people" : "+ Add person";
  const title = isDm
    ? "Add more people (converts this DM to a group)"
    : "Add a person to this room";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={title}
        aria-label={title}
        className="flex shrink-0 items-center gap-1 rounded-lg border border-neon-mint/40 bg-neon-mint/10 px-2.5 py-1 text-[11px] text-neon-mint transition hover:bg-neon-mint/20"
      >
        <span>{label}</span>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="surface-glass tint-mint my-auto w-[min(480px,94vw)] p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-base font-semibold text-white">
                {isDm ? "Add more people" : "Add a person"}
              </p>
              <button
                type="button"
                onClick={() => !busy && setOpen(false)}
                aria-label="Close"
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white/70 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* GROUP path */}
            {!isDm && (
              <>
                <p className="mt-1 text-xs text-white/55">
                  Search by username or display name. Anyone you pick joins
                  this room immediately.
                </p>
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="@username or name"
                  className="mt-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
                />
                {searching && (
                  <p className="mt-2 text-[11px] text-white/40">Searching…</p>
                )}
                {!searching && query && hits.length === 0 && (
                  <p className="mt-2 text-[11px] text-white/40">
                    No one matched &ldquo;{query}&rdquo;.
                  </p>
                )}
                {hits.length > 0 && (
                  <ul className="mt-2 max-h-72 space-y-0.5 overflow-y-auto">
                    {hits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void addUser(
                              h.id,
                              h.display_name ?? h.username ?? "someone"
                            )
                          }
                          className="flex w-full items-center justify-between gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-left text-xs hover:bg-white/10 disabled:opacity-50"
                        >
                          <span className="min-w-0 flex-1 truncate">
                            <span className="text-white">
                              {h.display_name ?? h.username ?? "someone"}
                            </span>
                            <span className="ml-2 text-white/45">
                              @{h.username}
                            </span>
                          </span>
                          <span className="shrink-0 text-[11px] text-neon-mint">
                            {busy ? "…" : "+ Add"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {added && (
                  <p className="mt-2 rounded-md bg-neon-mint/15 px-2 py-1 text-[12px] text-neon-mint">
                    Added {added}.
                  </p>
                )}
              </>
            )}

            {/* DM path */}
            {isDm && !newCode && (
              <>
                {!promoting ? (
                  <>
                    <p className="mt-2 text-sm leading-relaxed text-white/85">
                      Right now this is a 1:1 DM. To add a third person, we
                      need to convert it to a small group room — your chat
                      history stays, but anyone with the new invite link can
                      join.
                    </p>
                    <p className="mt-2 text-[12px] text-white/55">
                      Both of you keep your messages. New name is optional;
                      defaults to the current room name.
                    </p>
                    <label className="mt-3 block text-[11px] uppercase tracking-widest text-white/55">
                      Group name (optional)
                    </label>
                    <input
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value.slice(0, 60))}
                      placeholder="e.g. Trip planning"
                      className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
                    />
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => !busy && setOpen(false)}
                        disabled={busy}
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromoting(true)}
                        disabled={busy}
                        className="flex-1 rounded-lg bg-neon-mint px-3 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-50"
                      >
                        Continue
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-sm leading-relaxed text-white/85">
                      Converting{" "}
                      {groupName.trim() && (
                        <>
                          to <span className="text-neon-mint">{groupName.trim()}</span>{" "}
                        </>
                      )}
                      — confirm to switch this DM into a group room and mint a
                      share link.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => !busy && setPromoting(false)}
                        disabled={busy}
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => void promoteDm()}
                        disabled={busy}
                        className="flex-1 rounded-lg bg-neon-mint px-3 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-50"
                      >
                        {busy ? "Converting…" : "Convert & invite"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}

            {isDm && newCode && (
              <>
                <p className="mt-2 text-sm text-white/85">
                  Done. Share this link to add anyone you like:
                </p>
                <div
                  className={clsx(
                    "mt-3 flex items-center gap-2 rounded-xl border border-neon-mint/40 bg-black/30 px-3 py-2.5",
                    "font-mono text-sm tracking-wide text-white"
                  )}
                >
                  <span className="flex-1 select-all truncate">
                    {typeof window !== "undefined" ? window.location.origin : ""}
                    /rooms/{roomId}?invite={newCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyCode()}
                    className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-widest text-white/80 hover:bg-white/10"
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                </div>
                <p className="mt-2 text-[11px] text-white/45">
                  Anyone with this link joins the new group room.
                </p>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90"
                  >
                    Done
                  </button>
                </div>
              </>
            )}

            {error && (
              <p className="mt-3 rounded-md bg-neon-red/15 px-2 py-1 text-[12px] text-neon-red">
                {error}
              </p>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
