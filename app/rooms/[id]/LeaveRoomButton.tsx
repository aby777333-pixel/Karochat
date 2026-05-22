"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const LOBBY_ID = "00000000-0000-0000-0000-00000000aaaa";

/**
 * Header action for the current room. Two shapes:
 *  • Non-owner: 🚪 Leave room — removes their membership.
 *  • Owner:     🗑 Delete room — removes the room entirely (room_members
 *               and messages cascade via FK).
 *
 * v2 (Wave 19.4) — uses in-app modals instead of native confirm/prompt
 * for both flows. Native dialogs are unreliable on Brave / mobile PWAs
 * and any mistype on "DELETE" silently dropped the action.
 */
export function LeaveRoomButton({
  roomId,
  roomName,
  currentUserId,
  isOwner = false
}: {
  roomId: string;
  roomName: string;
  currentUserId: string;
  isOwner?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showDelete, setShowDelete] = useState(false);
  const [showLeave, setShowLeave] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showDelete && !showLeave) {
      setTyped("");
      setError(null);
      return;
    }
    if (showDelete) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape" && !pending) setShowDelete(false);
      }
      document.addEventListener("keydown", onKey);
      return () => {
        clearTimeout(t);
        document.removeEventListener("keydown", onKey);
      };
    }
    function onKeyLeave(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) setShowLeave(false);
    }
    document.addEventListener("keydown", onKeyLeave);
    return () => document.removeEventListener("keydown", onKeyLeave);
  }, [showDelete, showLeave, pending]);

  if (roomId === LOBBY_ID) return null;

  function doLeave() {
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: delErr } = await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", currentUserId);
      if (delErr) {
        setError(delErr.message);
        return;
      }
      setShowLeave(false);
      router.replace("/rooms");
      router.refresh();
    });
  }

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
      setShowDelete(false);
      router.replace("/rooms");
      router.refresh();
    });
  }

  return (
    <>
      {isOwner ? (
        <button
          onClick={() => setShowDelete(true)}
          disabled={pending}
          aria-label="Delete room"
          title={`Delete ${roomName} for everyone (permanent)`}
          className="flex shrink-0 items-center gap-1 rounded-lg border border-neon-red/40 bg-neon-red/10 px-2.5 py-1 text-[11px] text-neon-red transition hover:bg-neon-red/20 disabled:opacity-50"
        >
          <span aria-hidden>🗑</span>
          <span className="hidden md:inline">
            {pending ? "Deleting…" : "Delete room"}
          </span>
        </button>
      ) : (
        <button
          onClick={() => setShowLeave(true)}
          disabled={pending}
          aria-label="Leave room"
          title="Leave room"
          className="flex shrink-0 items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 transition hover:border-neon-red/40 hover:bg-neon-red/10 hover:text-white"
        >
          <span aria-hidden>🚪</span>
          <span className="hidden md:inline">
            {pending ? "Leaving…" : "Leave room"}
          </span>
        </button>
      )}

      {showDelete && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-title"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setShowDelete(false);
          }}
        >
          <div className="surface-glass tint-red my-auto w-[min(440px,94vw)] p-5">
            <p
              id="del-title"
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
                onClick={() => !pending && setShowDelete(false)}
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

      {showLeave && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={(e) => {
            if (e.target === e.currentTarget && !pending) setShowLeave(false);
          }}
        >
          <div className="surface-glass tint-amber my-auto w-[min(420px,94vw)] p-5">
            <p className="font-display text-base font-semibold text-white">
              Leave <span className="text-neon-amber">{roomName}</span>?
            </p>
            <p className="mt-2 text-sm text-white/80">
              You can rejoin any time it&apos;s public. Private rooms need an
              invite again.
            </p>
            {error && (
              <p className="mt-2 rounded-md bg-neon-red/15 px-2 py-1 text-[12px] text-neon-red">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => !pending && setShowLeave(false)}
                disabled={pending}
                className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doLeave}
                disabled={pending}
                className="flex-1 rounded-lg bg-neon-amber px-3 py-2 text-sm font-medium text-ink-900 hover:bg-neon-amber/90 disabled:opacity-50"
              >
                {pending ? "Leaving…" : "Leave"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
