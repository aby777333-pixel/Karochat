"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Visibility = "public" | "listed" | "unlisted" | "secret";

const VIS_OPTIONS: { value: Visibility; label: string; icon: string; description: string }[] = [
  { value: "public",   label: "Public",   icon: "🌍", description: "In the lobby. Anyone can join." },
  { value: "listed",   label: "Listed",   icon: "🔒", description: "In the lobby with a lock — people request to join." },
  { value: "unlisted", label: "Unlisted", icon: "🔗", description: "Hidden from the lobby. Joinable with the code." },
  { value: "secret",   label: "Secret",   icon: "🕶️", description: "Hidden everywhere. Joinable only via in-app invite." }
];

export function InviteButton({
  roomId,
  roomName,
  initialCode,
  isOwner,
  initialVisibility
}: {
  roomId: string;
  roomName: string;
  initialCode: string | null;
  isOwner: boolean;
  initialVisibility?: Visibility;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<string | null>(initialCode);
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility ?? "public");
  const [visBusy, setVisBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedKind, setCopiedKind] = useState<"link" | "code" | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  async function changeVisibility(next: Visibility) {
    if (next === visibility) return;
    setVisBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("set_room_visibility", {
      p_room_id: roomId,
      p_visibility: next
    });
    setVisBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setVisibility((data as Visibility) ?? next);
    if ((next === "unlisted" || next === "secret") && !code) {
      // The RPC will have minted a code — refresh to pick it up.
      const { data: row } = await supabase
        .from("rooms")
        .select("invite_code")
        .eq("id", roomId)
        .maybeSingle();
      if (row?.invite_code) setCode(row.invite_code as string);
    }
    router.refresh();
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const roomLink = `${origin}/rooms/${roomId}${code ? `?invite=${encodeURIComponent(code)}` : ""}`;

  async function copy(text: string, kind: "link" | "code") {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKind(kind);
      setTimeout(() => setCopiedKind(null), 1500);
    } catch {
      setError("Clipboard blocked. Long-press to copy.");
    }
  }

  async function regenerate() {
    setBusy(true);
    setError(null);
    const { data, error: rpcErr } = await supabase.rpc("regenerate_invite_code", {
      p_room_id: roomId
    });
    setBusy(false);
    if (rpcErr || !data) {
      setError(rpcErr?.message ?? "Could not generate a new code.");
      return;
    }
    setCode(data as string);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Invite people"
        aria-label="Invite people"
        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <line x1="19" y1="8" x2="19" y2="14" />
          <line x1="22" y1="11" x2="16" y2="11" />
        </svg>
        <span>Invite</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="surface-glass w-[min(420px,92vw)] p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  id="invite-title"
                  className="font-display text-base font-semibold"
                >
                  Invite to {roomName}
                </p>
                <p className="mt-0.5 text-xs text-white/55">
                  Share this link. Anyone who opens it will be able to join.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/60 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">
                  Invite link
                </p>
                <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                  <span className="flex-1 truncate text-xs text-white/80" title={roomLink}>
                    {roomLink}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copy(roomLink, "link")}
                    className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-widest text-white/70 hover:bg-white/10"
                  >
                    {copiedKind === "link" ? "copied" : "copy"}
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">
                  Invite code
                </p>
                {code ? (
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-base tracking-widest">
                    <span className="flex-1 select-all">{code}</span>
                    <button
                      type="button"
                      onClick={() => void copy(code, "code")}
                      className="shrink-0 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase tracking-widest text-white/70 hover:bg-white/10"
                    >
                      {copiedKind === "code" ? "copied" : "copy"}
                    </button>
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-white/10 bg-black/20 px-3 py-2 text-xs text-white/50">
                    No code yet. {isOwner
                      ? "Generate one below to share a short code instead of the link."
                      : "Ask the room owner to generate one."}
                  </p>
                )}
              </div>

              {isOwner && (
                <div>
                  <p className="mb-1 text-[10px] uppercase tracking-widest text-white/40">
                    Visibility
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {VIS_OPTIONS.map((opt) => {
                      const active = visibility === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => void changeVisibility(opt.value)}
                          disabled={visBusy}
                          title={opt.description}
                          className={`flex flex-col items-start gap-0.5 rounded-lg border px-2 py-1.5 text-left transition disabled:opacity-50 ${
                            active
                              ? "border-neon-blue/60 bg-neon-blue/10"
                              : "border-white/10 bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <span className="text-xs font-medium text-white">
                            {opt.icon} {opt.label}
                          </span>
                          <span className="text-[10px] leading-tight text-white/50">
                            {opt.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[10px] text-white/30">
                    Rooms default to Public. Switch to Unlisted/Secret any time —
                    a code is minted automatically.
                  </p>
                </div>
              )}

              {isOwner && (
                <button
                  type="button"
                  onClick={() => void regenerate()}
                  disabled={busy}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10 disabled:opacity-50"
                >
                  {busy
                    ? "Generating…"
                    : code
                    ? "Generate new code"
                    : "Generate code"}
                </button>
              )}

              {error && (
                <p className="rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">
                  {error}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
