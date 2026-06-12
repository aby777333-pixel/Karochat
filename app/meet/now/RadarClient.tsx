"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useBrowserNotificationsPermission } from "@/lib/useBrowserNotifications";
import { usePushSubscribe } from "@/lib/usePushSubscribe";
import { playChime, playRing } from "@/lib/sounds";

/**
 * Meet-now Radar / Scanner.
 *
 * Press scan → share location → you go live on the radar with a short
 * "what I'm looking for" note, and we surface everyone else who's currently
 * on the radar within your chosen mile-radius (worldwide). Each nearby person
 * also gets a ping so they know someone close is looking. From the list you
 * can wave, message, or start a voice/video call — calls + audio/video clips
 * all happen in the 1:1 DM the scanner opens for you.
 *
 * Privacy: you only appear after you press scan (opt-in); presence auto-expires
 * after 60 minutes; "Go offline" clears it instantly; exact coordinates never
 * leave the server — others only ever see a rounded distance.
 */

type RadarResult = {
  profile_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  presence_state: string | null;
  last_seen: string | null;
  looking_for: string | null;
  vibe: string | null;
  distance_miles: number | null;
};

type RadarPing = {
  id: string;
  from_profile: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  kind: "scan" | "wave" | "call";
  message: string | null;
  room_id: string | null;
  created_at: string;
  read_at: string | null;
};

const RADIUS_OPTIONS = [1, 5, 10, 25, 50];

const VIBE_CHIPS = [
  "☕ Coffee",
  "🍻 Drinks",
  "🍔 Food",
  "🚶 Walk",
  "💬 Just chat",
  "🎮 Games",
  "🎵 Live music",
  "💼 Network",
  "🧗 Activity",
  "🌃 Out tonight"
];

function getPosition(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Geolocation isn't supported on this device."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Location is blocked for this site. Tap the lock/tune icon next to the address bar → Permissions → allow Location, then scan again. (On iPhone also check Settings → Privacy → Location Services → your browser.)"
              : err.code === err.TIMEOUT
              ? "Timed out getting your location. Try again."
              : "Couldn't get your location."
          )
        ),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  });
}

function initials(name: string | null, username: string | null) {
  const s = (name ?? username ?? "?").trim();
  return s ? s.slice(0, 2).toUpperCase() : "?";
}

function presenceColor(state: string | null) {
  switch (state) {
    case "online":
      return "bg-neon-mint";
    case "busy":
      return "bg-neon-red";
    case "away":
      return "bg-neon-amber";
    default:
      return "bg-white/30";
  }
}

// Stable 0..359 angle from an id so a person sits in the same spot each scan.
function angleFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function RadarClient({ currentUserId }: { currentUserId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const { perm, request, supported } = useBrowserNotificationsPermission();
  const { subscribe } = usePushSubscribe();

  const [live, setLive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lookingFor, setLookingFor] = useState("");
  const [vibe, setVibe] = useState<string>("");
  const [radius, setRadius] = useState(10);
  const [results, setResults] = useState<RadarResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pings, setPings] = useState<RadarPing[]>([]);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanRef = useRef<() => void>(() => {});
  const notifiedRef = useRef<Set<string>>(new Set());

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  }, []);

  // Register a Web Push subscription so wave/call pings reach this person even
  // when the tab is closed. Runs once if permission is already granted.
  useEffect(() => {
    if (perm === "granted") void subscribe();
  }, [perm, subscribe]);

  const enableNotifications = useCallback(async () => {
    const p = await request();
    if (p === "granted") await subscribe();
  }, [request, subscribe]);

  // ---- Pings (incoming) -----------------------------------------------------
  const fireNotification = useCallback(
    (p: RadarPing) => {
      if (!supported || perm !== "granted") return;
      const name = p.display_name ?? p.username ?? "Someone nearby";
      const title =
        p.kind === "wave"
          ? `👋 ${name} waved at you`
          : p.kind === "call"
          ? `📞 ${name} wants to call`
          : "📡 Someone nearby is looking";
      const body =
        p.kind === "call"
          ? "Tap to join the call."
          : p.message
          ? p.message
          : p.kind === "scan"
          ? "Open Meet now to see who's around."
          : "";
      try {
        const n = new Notification(title, {
          body,
          icon: "/icon.svg",
          badge: "/icon.svg",
          tag: `radar-${p.id}`
        });
        n.onclick = () => {
          window.focus();
          if (p.room_id) window.location.href = `/rooms/${p.room_id}`;
          n.close();
        };
        setTimeout(() => n.close(), 9000);
      } catch {
        /* some browsers throw outside a gesture; ignore */
      }
      if (p.kind === "call") playRing();
      else playChime();
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(p.kind === "call" ? [120, 60, 120, 60, 120] : [80, 40, 80]);
      }
    },
    [perm, supported]
  );

  const loadPings = useCallback(
    async (notifyNew: boolean) => {
      const { data, error: e } = await supabase.rpc("radar_my_pings");
      if (e || !data) return;
      const list = data as RadarPing[];
      setPings(list);
      if (notifyNew) {
        for (const p of list) {
          if (!p.read_at && !notifiedRef.current.has(p.id)) {
            notifiedRef.current.add(p.id);
            fireNotification(p);
          }
        }
      } else {
        // seed the "already seen" set so we don't re-notify history on mount
        for (const p of list) notifiedRef.current.add(p.id);
      }
    },
    [supabase, fireNotification]
  );

  useEffect(() => {
    void loadPings(false);
    const channel = supabase
      .channel(`radar-pings-${currentUserId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "radar_pings",
          filter: `to_profile=eq.${currentUserId}`
        },
        () => {
          void loadPings(true);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId, loadPings]);

  // ---- Scan -----------------------------------------------------------------
  const runScan = useCallback(
    async (opts?: { quiet?: boolean }) => {
      if (!opts?.quiet) {
        setScanning(true);
        setError(null);
      }
      try {
        const pos = await getPosition();
        const { data, error: e } = await supabase.rpc("radar_scan", {
          p_lat: pos.lat,
          p_lng: pos.lng,
          p_radius_miles: radius,
          p_looking_for: lookingFor.trim() || null,
          p_vibe: vibe || null
        });
        if (e) throw new Error(e.message);
        setResults((data ?? []) as RadarResult[]);
        setLive(true);
      } catch (err: any) {
        if (!opts?.quiet) setError(err?.message ?? "Scan failed.");
      } finally {
        if (!opts?.quiet) setScanning(false);
      }
    },
    [supabase, radius, lookingFor, vibe]
  );

  // keep the latest scan closure available to the auto-refresh interval
  useEffect(() => {
    scanRef.current = () => void runScan({ quiet: true });
  }, [runScan]);

  // auto-refresh every 25s while live (also keeps presence from expiring)
  useEffect(() => {
    if (!live) return;
    intervalRef.current = setInterval(() => scanRef.current(), 25000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [live]);

  const goOffline = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    await supabase.rpc("radar_go_offline");
    setLive(false);
    setResults(null);
    flash("You're off the radar.");
  }, [supabase, flash]);

  // ---- Per-person actions ---------------------------------------------------
  const wave = useCallback(
    async (id: string, name: string) => {
      setBusyId(id);
      const { error: e } = await supabase.rpc("radar_wave", { p_to: id });
      setBusyId(null);
      flash(e ? e.message : `👋 Waved at ${name}.`);
    },
    [supabase, flash]
  );

  const message = useCallback(
    async (id: string) => {
      setBusyId(id);
      const { data, error: e } = await supabase.rpc("get_or_create_dm", {
        p_target_user_id: id
      });
      setBusyId(null);
      if (e || !data) {
        flash(e?.message ?? "Couldn't open chat.");
        return;
      }
      router.push(`/rooms/${data}`);
    },
    [supabase, router, flash]
  );

  const call = useCallback(
    async (id: string) => {
      setBusyId(id);
      const { data, error: e } = await supabase.rpc("radar_request_call", {
        p_to: id
      });
      setBusyId(null);
      if (e || !data) {
        flash(e?.message ?? "Couldn't start the call.");
        return;
      }
      router.push(`/rooms/${data}`);
    },
    [supabase, router, flash]
  );

  const markPingsRead = useCallback(async () => {
    await supabase.rpc("radar_mark_pings_read");
    setPings((prev) => prev.map((p) => ({ ...p, read_at: p.read_at ?? new Date().toISOString() })));
  }, [supabase]);

  // cleanup interval on unmount (presence stays live until it auto-expires)
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const unreadPings = pings.filter((p) => !p.read_at).length;
  const maxDist = Math.max(radius, ...(results ?? []).map((r) => r.distance_miles ?? 0), 1);

  return (
    <div className="mt-5 space-y-5">
      {/* Incoming pings */}
      {pings.length > 0 && (
        <section className="surface-glass tint-mint p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-display text-base font-semibold">
              📨 Pings near you
              {unreadPings > 0 && (
                <span className="rounded-full bg-neon-mint/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-neon-mint">
                  {unreadPings} new
                </span>
              )}
            </h2>
            {unreadPings > 0 && (
              <button
                type="button"
                onClick={() => void markPingsRead()}
                className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10"
              >
                Mark read
              </button>
            )}
          </div>
          <ul className="space-y-2">
            {pings.slice(0, 12).map((p) => {
              const name = p.display_name ?? p.username ?? "Someone";
              const glyph = p.kind === "wave" ? "👋" : p.kind === "call" ? "📞" : "📡";
              const text =
                p.kind === "call"
                  ? "wants to call you"
                  : p.kind === "wave"
                  ? "waved at you"
                  : "is looking nearby";
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                    p.read_at ? "border-white/5 bg-white/[0.02]" : "border-neon-mint/30 bg-neon-mint/5"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span aria-hidden className="mr-1">{glyph}</span>
                      <span className="font-medium text-white">{name}</span>{" "}
                      <span className="text-white/55">{text}</span>
                    </p>
                    {p.message && (
                      <p className="truncate text-[11px] text-white/50">“{p.message}”</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {p.room_id ? (
                      <button
                        type="button"
                        onClick={() => router.push(`/rooms/${p.room_id}`)}
                        className="rounded-lg border border-neon-blue/30 bg-neon-blue/10 px-3 py-1.5 text-xs text-neon-blue hover:bg-neon-blue/20"
                      >
                        Join →
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void message(p.from_profile)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                      >
                        Reply →
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Scanner control */}
      <section className="surface-glass tint-purple p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-neon-purple/70">
              📡 Radar
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-white">
              Scan for people around you
            </h2>
            <p className="mt-1 text-sm text-white/65">
              Anywhere in the world. Find anyone else on the radar within your
              range, and let them know you&apos;re looking.
            </p>
          </div>
          {live && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-neon-mint/40 bg-neon-mint/10 px-2.5 py-1 text-[11px] text-neon-mint">
              <span className="inline-block h-1.5 w-1.5 animate-pulseDot rounded-full bg-neon-mint" />
              Live
            </span>
          )}
        </div>

        {/* Radar visual */}
        <div className="mt-5 grid place-items-center">
          <div className="relative h-56 w-56">
            <div className="absolute inset-0 rounded-full border border-neon-purple/20" />
            <div className="absolute inset-[14%] rounded-full border border-neon-purple/20" />
            <div className="absolute inset-[32%] rounded-full border border-neon-purple/20" />
            <div className="absolute inset-[48%] rounded-full border border-neon-purple/20" />
            {scanning && (
              <div className="absolute inset-0 animate-spin rounded-full [animation-duration:2.4s]">
                <div className="absolute left-1/2 top-0 h-1/2 w-px origin-bottom -translate-x-1/2 bg-gradient-to-t from-neon-mint/70 to-transparent" />
              </div>
            )}
            {/* me */}
            <div className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-neon-blue text-[10px] font-bold text-ink-900 shadow-glow-blue">
              You
            </div>
            {/* others */}
            {(results ?? []).map((r) => {
              const ang = (angleFor(r.profile_id) * Math.PI) / 180;
              const frac = Math.min((r.distance_miles ?? 0) / maxDist, 1);
              const px = 50 + Math.cos(ang) * frac * 46;
              const py = 50 + Math.sin(ang) * frac * 46;
              return (
                <div
                  key={r.profile_id}
                  title={`${r.display_name ?? r.username ?? "Someone"} · ${r.distance_miles ?? "?"} mi`}
                  className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-neon-mint shadow-[0_0_8px_rgba(80,250,200,0.8)]"
                  style={{ left: `${px}%`, top: `${py}%` }}
                />
              );
            })}
          </div>
        </div>

        {/* What you're looking for */}
        <div className="mt-5 space-y-3">
          <input
            value={lookingFor}
            onChange={(e) => setLookingFor(e.target.value)}
            maxLength={200}
            placeholder="What are you looking for? e.g. coffee + good conversation"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-neon-purple/60"
          />
          <div className="flex flex-wrap gap-1.5">
            {VIBE_CHIPS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVibe((cur) => (cur === v ? "" : v))}
                className={`rounded-full border px-2.5 py-1 text-xs transition ${
                  vibe === v
                    ? "border-neon-purple/60 bg-neon-purple/15 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {v}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] uppercase tracking-widest text-white/40">
              Range
            </span>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRadius(r)}
                className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                  radius === r
                    ? "border-neon-blue/60 bg-neon-blue/15 text-neon-blue"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                {r} mi
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void runScan()}
            disabled={scanning}
            className="rounded-2xl bg-neon-purple px-6 py-3 text-base font-semibold text-white shadow-glow-purple transition hover:bg-neon-purple/90 disabled:opacity-60"
          >
            {scanning ? "Scanning…" : live ? "🔄 Rescan" : "📡 Scan around me"}
          </button>
          {live && (
            <button
              type="button"
              onClick={() => void goOffline()}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75 hover:bg-white/10"
            >
              Go offline
            </button>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-md bg-neon-red/10 px-2 py-1.5 text-xs text-neon-red">
            {error}
          </p>
        )}

        {supported && perm === "default" && (
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="mt-3 block w-full rounded-lg border border-neon-amber/30 bg-neon-amber/5 px-3 py-2 text-left text-xs text-neon-amber hover:bg-neon-amber/10"
          >
            🔔 Turn on notifications so you hear when someone pings you nearby —
            even with the app closed.
          </button>
        )}

        <p className="mt-3 text-[11px] leading-relaxed text-white/35">
          You only appear after you scan. Your exact location is never shared —
          others see distance only. You drop off the radar after 60 minutes, or
          instantly when you tap “Go offline.”
        </p>
      </section>

      {/* Results */}
      {results !== null && (
        <section className="surface-glass tint-blue p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-display text-base font-semibold">
              People within {radius} mi
            </h2>
            <span className="text-xs text-white/40">
              {results.length} {results.length === 1 ? "person" : "people"}
            </span>
          </div>

          {results.length === 0 ? (
            <p className="text-sm text-white/55">
              Nobody else is on the radar near you right now. You&apos;re live —
              when someone scans nearby, you&apos;ll get a ping. Try a wider
              range, or check back soon.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {results.map((r) => {
                const name = r.display_name ?? r.username ?? "Someone";
                const busy = busyId === r.profile_id;
                return (
                  <li key={r.profile_id} className="flex items-center gap-3 py-3">
                    <div className="relative shrink-0">
                      {r.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.avatar_url}
                          alt=""
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="grid h-10 w-10 place-items-center rounded-full bg-neon-purple/20 text-xs font-semibold text-white">
                          {initials(r.display_name, r.username)}
                        </div>
                      )}
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-ink-900 ${presenceColor(
                          r.presence_state
                        )}`}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-white">
                        {name}
                        <span className="font-mono text-[11px] font-normal text-neon-mint">
                          {r.distance_miles ?? "?"} mi
                        </span>
                        {r.vibe && (
                          <span className="rounded-sm bg-white/5 px-1 text-[10px] text-white/70">
                            {r.vibe}
                          </span>
                        )}
                      </p>
                      {r.looking_for && (
                        <p className="truncate text-[12px] text-white/55">
                          “{r.looking_for}”
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void wave(r.profile_id, name)}
                        title="Wave"
                        aria-label={`Wave at ${name}`}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-sm hover:bg-white/10 disabled:opacity-50"
                      >
                        👋
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void message(r.profile_id)}
                        title="Message"
                        aria-label={`Message ${name}`}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-white/10 bg-white/5 text-sm hover:bg-white/10 disabled:opacity-50"
                      >
                        💬
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void call(r.profile_id)}
                        title="Call (voice / video)"
                        aria-label={`Call ${name}`}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-neon-blue/40 bg-neon-blue/10 text-sm text-neon-blue hover:bg-neon-blue/20 disabled:opacity-50"
                      >
                        📞
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-white/30">
            Wave to say hi, message to chat, or call for voice/video. In a chat
            you can also send audio and video clips.
          </p>
        </section>
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-white/10 bg-ink-800/95 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
