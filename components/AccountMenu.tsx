"use client";

// Karochat — AccountMenu (v9 Phase 1)
//
// Top-right account widget that surfaces the three new header switchers
// (persona / privacy / wallet) plus the existing sign-out. Replaces
// SignOutButton on pages that adopt the v9 IA shell.
//
// All three switchers call SECURITY DEFINER RPCs added in migration
// 0042: list_my_personas, create_persona, switch_active_persona,
// delete_persona, set_privacy_mode, get_my_wallet.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Persona = {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  active: boolean;
  created_at: string;
};

type PrivacyMode = "open" | "friends_only" | "invisible" | "decoy" | "stealth";

const PRIVACY_OPTIONS: {
  value: PrivacyMode;
  label: string;
  hint: string;
  icon: string;
}[] = [
  {
    value: "open",
    label: "Open",
    icon: "🌍",
    hint: "Your status, presence, rooms visible to friends. Default."
  },
  {
    value: "friends_only",
    label: "Friends only",
    icon: "👥",
    hint: "Only friends see anything; you appear offline to non-friends."
  },
  {
    value: "invisible",
    label: "Invisible",
    icon: "🕶️",
    hint: "Appear offline to everyone; you can still browse + DM."
  },
  {
    value: "stealth",
    label: "Stealth",
    icon: "🎭",
    hint: "Different handle / friend list, same account underneath."
  },
  {
    value: "decoy",
    label: "Decoy",
    icon: "🪞",
    hint: "Show a sanitized version of your profile (duress code)."
  }
];

type AccountMenuProps = {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  initialPrivacyMode?: PrivacyMode;
};

export function AccountMenu({
  username,
  displayName,
  avatarUrl,
  initialPrivacyMode = "open"
}: AccountMenuProps) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"main" | "personas" | "privacy">("main");
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [privacyMode, setPrivacyMode] = useState<PrivacyMode>(initialPrivacyMode);
  const [balance, setBalance] = useState<number | null>(null);
  const [isGuest, setIsGuest] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [signOutConfirming, setSignOutConfirming] = useState(false);

  // New-persona form state.
  const [newHandle, setNewHandle] = useState("");
  const [newDisplay, setNewDisplay] = useState("");

  const triggerRef = useRef<HTMLButtonElement>(null);

  // Load wallet + personas + guest flag the first time the menu opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const [{ data: walletRows }, { data: personaRows }, { data: { user } }] =
        await Promise.all([
          supabase.rpc("get_my_wallet"),
          supabase.rpc("list_my_personas"),
          supabase.auth.getUser()
        ]);
      if (cancelled) return;
      const w = Array.isArray(walletRows) ? walletRows[0] : walletRows;
      if (w && typeof w.balance_credits === "number") setBalance(w.balance_credits);
      if (Array.isArray(personaRows)) setPersonas(personaRows as Persona[]);
      if (user) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("is_guest, privacy_mode")
          .eq("id", user.id)
          .maybeSingle();
        if (!cancelled && prof) {
          setIsGuest(!!prof.is_guest);
          if (prof.privacy_mode) setPrivacyMode(prof.privacy_mode as PrivacyMode);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, supabase]);

  // Close on outside-click + Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function applyPrivacy(mode: PrivacyMode) {
    setBusy("privacy");
    setErr(null);
    try {
      const { error } = await supabase.rpc("set_privacy_mode", { p_mode: mode });
      if (error) throw error;
      setPrivacyMode(mode);
      setView("main");
    } catch (e: any) {
      setErr(e?.message ?? "Could not set privacy mode");
    } finally {
      setBusy(null);
    }
  }

  async function createPersona() {
    if (!newHandle.trim()) {
      setErr("Pick a handle (3+ chars, a-z 0-9 _ -)");
      return;
    }
    setBusy("create-persona");
    setErr(null);
    try {
      const { error } = await supabase.rpc("create_persona", {
        p_handle: newHandle.trim(),
        p_display_name: newDisplay.trim() || null
      });
      if (error) throw error;
      setNewHandle("");
      setNewDisplay("");
      const { data } = await supabase.rpc("list_my_personas");
      if (Array.isArray(data)) setPersonas(data as Persona[]);
    } catch (e: any) {
      setErr(e?.message ?? "Could not create persona");
    } finally {
      setBusy(null);
    }
  }

  async function switchTo(personaId: string | null) {
    setBusy("switch-persona");
    setErr(null);
    try {
      const { error } = await supabase.rpc("switch_active_persona", {
        p_persona_id: personaId
      });
      if (error) throw error;
      const { data } = await supabase.rpc("list_my_personas");
      if (Array.isArray(data)) setPersonas(data as Persona[]);
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      setErr(e?.message ?? "Could not switch persona");
    } finally {
      setBusy(null);
    }
  }

  async function removePersona(personaId: string) {
    setBusy("delete-persona");
    setErr(null);
    try {
      const { error } = await supabase.rpc("delete_persona", {
        p_persona_id: personaId
      });
      if (error) throw error;
      const { data } = await supabase.rpc("list_my_personas");
      if (Array.isArray(data)) setPersonas(data as Persona[]);
    } catch (e: any) {
      setErr(e?.message ?? "Could not delete persona");
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    if (isGuest) {
      setSignOutConfirming(true);
      return;
    }
    setBusy("signout");
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  async function guestPurgeSignOut() {
    setBusy("signout");
    setErr(null);
    const { error } = await supabase.rpc("purge_guest_account");
    if (error) {
      setErr(error.message);
      setBusy(null);
      return;
    }
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  const activePersona = personas.find((p) => p.active) ?? null;
  const activeBadge = activePersona ? `🎭 ${activePersona.handle}` : "main";
  const initials = (displayName ?? username ?? "?").slice(0, 1).toUpperCase();
  const privacyOption =
    PRIVACY_OPTIONS.find((o) => o.value === privacyMode) ?? PRIVACY_OPTIONS[0]!;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        title={`Account · ${activeBadge} · ${privacyOption.label}`}
        className={clsx(
          "flex shrink-0 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/80 transition hover:bg-white/10 hover:text-white",
          open && "bg-white/10 text-white"
        )}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neon-blue/30 text-sm font-semibold text-white">
            {initials}
          </span>
        )}
        <span className="hidden text-[10px] uppercase tracking-widest text-white/55 md:inline">
          {activePersona ? `🎭 ${activePersona.handle}` : `@${username}`}
        </span>
      </button>

      {open && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-start justify-end bg-black/40 p-3 sm:p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="surface-glass mt-14 w-[min(360px,92vw)] p-4 shadow-xl">
              {view === "main" && (
                <>
                  <div className="flex items-center gap-3">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-neon-blue/30 text-base font-semibold text-white">
                        {initials}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">
                        {displayName ?? username}
                      </p>
                      <p className="truncate text-[11px] text-white/55">
                        @{username}
                        {activePersona && (
                          <>
                            {" "}
                            <span className="ml-1 rounded-sm bg-neon-mint/15 px-1 text-[9px] uppercase tracking-widest text-neon-mint">
                              acting as {activePersona.handle}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    <button
                      type="button"
                      onClick={() => setView("personas")}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/85 hover:bg-white/10"
                    >
                      <span>🎭 Personas</span>
                      <span className="text-[10px] text-white/45">
                        {personas.length}/3 ·{" "}
                        {activePersona ? activePersona.handle : "main"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setView("privacy")}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/85 hover:bg-white/10"
                    >
                      <span>
                        {privacyOption.icon} Privacy · {privacyOption.label}
                      </span>
                      <span className="text-[10px] text-white/45">change</span>
                    </button>
                    <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85">
                      <span>💎 Wallet</span>
                      <span className="font-mono text-white">
                        {balance ?? "…"}{" "}
                        <span className="text-[10px] text-white/55">KRC</span>
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled
                      title="Wallet top-up via Stripe + UPI ships in Phase 11"
                      className="block w-full rounded-lg border border-white/10 bg-white/3 px-3 py-1.5 text-left text-[11px] text-white/35"
                    >
                      + Add credits — Phase 11
                    </button>
                  </div>

                  {err && (
                    <p className="mt-2 rounded-md bg-neon-red/15 px-2 py-1 text-[11px] text-neon-red">
                      {err}
                    </p>
                  )}

                  <div className="mt-3 border-t border-white/10 pt-3">
                    <button
                      type="button"
                      onClick={() => void signOut()}
                      disabled={!!busy}
                      className="flex w-full items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-60"
                    >
                      <span aria-hidden>⏏</span>
                      <span>
                        {busy === "signout"
                          ? "Signing out…"
                          : isGuest
                          ? "Sign out (deletes guest data)"
                          : "Sign out"}
                      </span>
                    </button>
                  </div>
                </>
              )}

              {view === "personas" && (
                <PersonasView
                  personas={personas}
                  busy={busy}
                  newHandle={newHandle}
                  setNewHandle={setNewHandle}
                  newDisplay={newDisplay}
                  setNewDisplay={setNewDisplay}
                  err={err}
                  onBack={() => {
                    setView("main");
                    setErr(null);
                  }}
                  onCreate={createPersona}
                  onSwitch={switchTo}
                  onDelete={removePersona}
                />
              )}

              {view === "privacy" && (
                <PrivacyView
                  current={privacyMode}
                  busy={busy}
                  err={err}
                  onBack={() => {
                    setView("main");
                    setErr(null);
                  }}
                  onPick={applyPrivacy}
                />
              )}
            </div>
          </div>,
          document.body
        )}

      {signOutConfirming && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
              if (e.target === e.currentTarget && !busy)
                setSignOutConfirming(false);
            }}
          >
            <div className="surface-glass tint-amber w-[min(460px,94vw)] p-5">
              <p className="font-display text-base font-semibold text-white">
                Sign out as guest?
              </p>
              <p className="mt-2 text-sm leading-relaxed text-white/80">
                Guest accounts don&apos;t persist. Signing out will{" "}
                <span className="text-neon-amber">
                  delete your messages, rooms you own, friendships, status, mood,
                  and every other preference
                </span>{" "}
                tied to this guest identity. There&apos;s no recovery.
              </p>
              {err && (
                <p className="mt-2 rounded-md bg-neon-red/15 px-2 py-1 text-[12px] text-neon-red">
                  {err}
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => !busy && setSignOutConfirming(false)}
                  disabled={!!busy}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void guestPurgeSignOut()}
                  disabled={!!busy}
                  className="flex-1 rounded-lg bg-neon-amber px-3 py-2 text-sm font-medium text-ink-900 hover:bg-neon-amber/90 disabled:opacity-50"
                >
                  {busy === "signout" ? "Wiping…" : "Delete & sign out"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

function PersonasView({
  personas,
  busy,
  newHandle,
  setNewHandle,
  newDisplay,
  setNewDisplay,
  err,
  onBack,
  onCreate,
  onSwitch,
  onDelete
}: {
  personas: Persona[];
  busy: string | null;
  newHandle: string;
  setNewHandle: (s: string) => void;
  newDisplay: string;
  setNewDisplay: (s: string) => void;
  err: string | null;
  onBack: () => void;
  onCreate: () => void;
  onSwitch: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const atCap = personas.length >= 3;
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="text-[10px] uppercase tracking-widest text-white/50 hover:text-white"
      >
        ← Back
      </button>
      <p className="mt-2 font-display text-base font-semibold text-white">
        Personas
      </p>
      <p className="mt-1 text-[11px] text-white/55">
        Up to 3 per account. Each persona has its own handle. Bans cascade
        across all personas — this isn&apos;t catfishing, it&apos;s
        compartmentalization.
      </p>

      <div className="mt-3 space-y-1.5">
        <button
          type="button"
          onClick={() => onSwitch(null)}
          disabled={!!busy}
          className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-white/85 hover:bg-white/10 disabled:opacity-60"
        >
          <span>Main profile</span>
          {personas.every((p) => !p.active) && (
            <span className="rounded-sm bg-neon-mint/20 px-1 text-[9px] uppercase tracking-widest text-neon-mint">
              active
            </span>
          )}
        </button>
        {personas.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/85"
          >
            <button
              type="button"
              onClick={() => onSwitch(p.id)}
              disabled={!!busy}
              className="min-w-0 flex-1 text-left hover:text-white disabled:opacity-60"
            >
              🎭 {p.handle}
              {p.display_name && p.display_name !== p.handle && (
                <span className="ml-1 text-[10px] text-white/45">
                  · {p.display_name}
                </span>
              )}
              {p.active && (
                <span className="ml-1 rounded-sm bg-neon-mint/20 px-1 text-[9px] uppercase tracking-widest text-neon-mint">
                  active
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => onDelete(p.id)}
              disabled={!!busy}
              aria-label="Delete persona"
              title="Delete this persona"
              className="rounded-md border border-neon-red/30 bg-neon-red/10 px-1.5 py-0.5 text-[10px] text-neon-red hover:bg-neon-red/20 disabled:opacity-60"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {!atCap && (
        <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-2">
          <p className="text-[10px] uppercase tracking-widest text-white/50">
            New persona
          </p>
          <input
            value={newHandle}
            onChange={(e) => setNewHandle(e.target.value.slice(0, 24))}
            placeholder="handle (a-z 0-9 _ -)"
            className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white outline-none placeholder:text-white/30 focus:border-neon-mint/40"
          />
          <input
            value={newDisplay}
            onChange={(e) => setNewDisplay(e.target.value.slice(0, 60))}
            placeholder="display name (optional)"
            className="mt-1 w-full rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-white outline-none placeholder:text-white/30 focus:border-neon-mint/40"
          />
          <button
            type="button"
            onClick={onCreate}
            disabled={!!busy || !newHandle.trim()}
            className="mt-2 w-full rounded-md bg-neon-mint px-2 py-1 text-xs font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
          >
            {busy === "create-persona" ? "Creating…" : "Create persona"}
          </button>
        </div>
      )}
      {atCap && (
        <p className="mt-3 rounded-md bg-white/5 px-2 py-1 text-[11px] text-white/55">
          You&apos;ve hit the 3-persona cap. Delete one to add another.
        </p>
      )}

      {err && (
        <p className="mt-2 rounded-md bg-neon-red/15 px-2 py-1 text-[11px] text-neon-red">
          {err}
        </p>
      )}
    </>
  );
}

function PrivacyView({
  current,
  busy,
  err,
  onBack,
  onPick
}: {
  current: PrivacyMode;
  busy: string | null;
  err: string | null;
  onBack: () => void;
  onPick: (mode: PrivacyMode) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="text-[10px] uppercase tracking-widest text-white/50 hover:text-white"
      >
        ← Back
      </button>
      <p className="mt-2 font-display text-base font-semibold text-white">
        Privacy mode
      </p>
      <p className="mt-1 text-[11px] text-white/55">
        Controls how others see your presence + activity. Switches take
        effect immediately.
      </p>

      <div className="mt-3 space-y-1.5">
        {PRIVACY_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(o.value)}
            disabled={!!busy}
            className={clsx(
              "block w-full rounded-lg border px-3 py-2 text-left text-xs transition",
              current === o.value
                ? "border-neon-mint/60 bg-neon-mint/10 text-white"
                : "border-white/10 bg-white/5 text-white/85 hover:bg-white/10",
              busy && "opacity-60"
            )}
          >
            <p className="font-medium">
              {o.icon} {o.label}
              {current === o.value && (
                <span className="ml-1 rounded-sm bg-neon-mint/20 px-1 text-[9px] uppercase tracking-widest text-neon-mint">
                  active
                </span>
              )}
            </p>
            <p className="mt-0.5 text-[10px] text-white/55">{o.hint}</p>
          </button>
        ))}
      </div>

      {err && (
        <p className="mt-2 rounded-md bg-neon-red/15 px-2 py-1 text-[11px] text-neon-red">
          {err}
        </p>
      )}
    </>
  );
}
