"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Per-row delete trigger for the lobby's "Your rooms" list. Visible only
 * when the caller is the room owner.
 *
 * v2 (Wave 19.4) — uses a proper in-app modal instead of browser
 * confirm/prompt, which were brittle (suppressed in Brave / some
 * privacy modes, awkward on mobile PWAs, easy to mistype "DELETE" and
 * silently dismiss). The modal is portalled to document.body so it
 * isn't trapped inside any backdrop-filter stacking context.
 */
export function OwnedRoomDeleteButton({
  roomId,
  roomName
}: {
  roomId: string;
  roomName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setTyped("");
      setError(null);
      return;
    }
    // Focus the confirmation input shortly after the modal mounts.
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function doDelete() {
    if (typed !== "DELETE") {
      setError("Type DELETE exactly to confirm.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: rpcErr } = await supabase.rpc("delete_room", {
        p_room_id: roomId
      });
      if (rpcErr) {
        setError(rpcErr.message);
        return;
      }
      // Optimistic hide so the user sees something happen immediately, then
      // refresh so the server data reconciles.
      setRemoved(true);
      setOpen(false);
      router.refresh();
    });
  }

  if (removed) return null;

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        disabled={pending}
        aria-label={`Delete ${roomName}`}
        title="Delete this room (you own it)"
        className="shrink-0 rounded-lg border border-neon-red/30 bg-neon-red/10 px-2.5 py-1.5 text-xs text-neon-red transition hover:bg-neon-red/20 disabled:opacity-50"
      >
        {pending ? "…" : (
          <>
            <span aria-hidden>🗑</span>
            <span className="ml-1 hidden md:inline">Delete</span>
          </>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-room-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setOpen(false);
          }}
        >
          <div className="surface-glass tint-red my-auto w-[min(440px,94vw)] p-5">
            <p
              id="delete-room-title"
              className="font-display text-base font-semibold text-white"
            >
              Delete <span className="text-neon-red">{roomName}</span>?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              This wipes every message, removes all members, and can&apos;t be
              undone. The room is gone for everyone.
            </p>

            <label className="mt-4 block text-[11px] uppercase tracking-widest text-white/55">
              Type <span className="font-mono text-neon-red">DELETE</span> to
              confirm
            </label>
            <input
              ref={inputRef}
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && typed === "DELETE") {
                  e.preventDefault();
                  doDelete();
                }
              }}
              placeholder="DELETE"
              disabled={pending}
              className="mt-1 w-full rounded-xl border border-neon-red/30 bg-black/30 px-3 py-2 font-mono text-sm tracking-widest outline-none focus:border-neon-red/60 disabled:opacity-50"
            />

            {error && (
              <p className="mt-2 rounded-md bg-neon-red/15 px-2 py-1 text-[12px] text-neon-red">
                {error}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => !pending && setOpen(false)}
                disabled={pending}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doDelete}
                disabled={pending || typed !== "DELETE"}
                className="flex-1 rounded-lg bg-neon-red px-3 py-2 text-sm font-medium text-white hover:bg-neon-red/90 disabled:opacity-50"
              >
                {pending ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
