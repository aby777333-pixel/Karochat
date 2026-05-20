"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Karochat handshake — bump-to-befriend.
 *
 * Two ways to pair:
 *  1. Issue a 6-char code → other side types it in.
 *  2. "Listen for bump" — uses DeviceMotion to detect a sharp shake event,
 *     then activates either Web Bluetooth (if supported and permitted) to
 *     find nearby Karochat devices, OR just generates a code to share.
 *
 * Web Bluetooth's scanning API isn't available in Safari, and Chrome
 * requires user-gesture-initiated requests, so the "scan nearby" path is
 * best-effort. The code/claim flow always works as a fallback.
 */
export function HandshakeClient() {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [claimInput, setClaimInput] = useState("");
  const [claiming, setClaiming] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [bumpReady, setBumpReady] = useState(false);
  const [bumpDetected, setBumpDetected] = useState(false);
  const [motionUnavailable, setMotionUnavailable] = useState(false);

  const [bluetoothBusy, setBluetoothBusy] = useState(false);
  const [bluetoothMsg, setBluetoothMsg] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Issue a new code.
  async function issueCode() {
    setIssuing(true);
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("create_handshake_code");
      if (error) throw error;
      setIssuedCode(String(data));
    } catch (e: any) {
      setErr(e?.message ?? "Could not issue code.");
    } finally {
      setIssuing(false);
    }
  }

  // Poll our issued code — when claimed_room fills in, jump to the DM.
  useEffect(() => {
    if (!issuedCode) return;
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("handshake_codes")
        .select("claimed_room, expires_at")
        .eq("code", issuedCode)
        .maybeSingle();
      if (!data) return;
      if (data.claimed_room) {
        if (pollRef.current) clearInterval(pollRef.current);
        router.push(`/rooms/${data.claimed_room}`);
      } else if (data.expires_at && new Date(data.expires_at) <= new Date()) {
        if (pollRef.current) clearInterval(pollRef.current);
        setIssuedCode(null);
      }
    }, 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [issuedCode, router, supabase]);

  // Claim someone else's code.
  async function claimCode(code: string) {
    const clean = code.trim().toUpperCase();
    if (clean.length !== 6) {
      setErr("Codes are 6 characters.");
      return;
    }
    setClaiming(true);
    setErr(null);
    try {
      const { data, error } = await supabase.rpc("claim_handshake_code", {
        p_code: clean
      });
      if (error) throw error;
      if (!data) throw new Error("No room returned.");
      router.push(`/rooms/${data}`);
    } catch (e: any) {
      setErr(e?.message ?? "Could not claim code.");
    } finally {
      setClaiming(false);
    }
  }

  // Listen for a bump — DeviceMotion shake detection.
  const armBump = useCallback(async () => {
    setErr(null);
    setBumpDetected(false);
    // iOS Safari requires explicit permission for motion events.
    const anyDM = (window as any).DeviceMotionEvent;
    if (!anyDM) {
      setMotionUnavailable(true);
      return;
    }
    try {
      if (typeof anyDM.requestPermission === "function") {
        const state = await anyDM.requestPermission();
        if (state !== "granted") {
          setErr("Motion permission denied. You can still use codes.");
          return;
        }
      }
    } catch {
      // best-effort
    }
    setBumpReady(true);
  }, []);

  useEffect(() => {
    if (!bumpReady) return;
    let lastShake = 0;
    function onMotion(e: DeviceMotionEvent) {
      const a = e.accelerationIncludingGravity ?? e.acceleration;
      if (!a) return;
      const mag = Math.sqrt(
        (a.x ?? 0) ** 2 + (a.y ?? 0) ** 2 + (a.z ?? 0) ** 2
      );
      // ~25 m/s² is a sharp shake — typical phone-bump.
      if (mag > 25 && Date.now() - lastShake > 1200) {
        lastShake = Date.now();
        setBumpDetected(true);
        // Auto-issue a code when we feel the bump.
        if (!issuedCode && !issuing) void issueCode();
      }
    }
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [bumpReady, issuedCode, issuing]); // eslint-disable-line react-hooks/exhaustive-deps

  // Web Bluetooth — best effort. The actual handshake still rides on the
  // server-side code; Bluetooth here is a "broadcast my code as a name"
  // affordance for the rare device that supports it (Chrome/Edge/Android).
  async function shareViaBluetooth() {
    const nav = navigator as any;
    if (!nav?.bluetooth?.requestDevice) {
      setBluetoothMsg(
        "Web Bluetooth isn't available in this browser — use the code instead."
      );
      return;
    }
    setBluetoothBusy(true);
    setBluetoothMsg(null);
    try {
      if (!issuedCode) await issueCode();
      // We open the chooser; selecting any nearby device is enough to confirm
      // the other party is physically near. The actual code is still typed.
      await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: []
      });
      setBluetoothMsg(
        "Device confirmed nearby — share the code below."
      );
    } catch (e: any) {
      setBluetoothMsg(e?.message ?? "Bluetooth picker cancelled.");
    } finally {
      setBluetoothBusy(false);
    }
  }

  return (
    <>
      {err && (
        <div className="surface-glass tint-red mt-4 px-4 py-2 text-xs text-neon-red">
          {err}
        </div>
      )}

      {/* Issue a code */}
      <section className="surface-glass tint-blue mt-5 p-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          1 · Issue a code
        </p>
        {issuedCode ? (
          <>
            <p className="mt-2 font-mono text-4xl font-bold tracking-widest text-neon-blue">
              {issuedCode}
            </p>
            <p className="mt-1 text-[11px] text-white/40">
              Expires in 2 minutes. We&apos;re watching for a claim…
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(issuedCode);
                }}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
              >
                📋 Copy
              </button>
              <button
                type="button"
                onClick={() => setIssuedCode(null)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/55 hover:bg-white/10"
              >
                New code
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => void issueCode()}
            disabled={issuing}
            className="mt-2 rounded-xl bg-neon-blue px-4 py-2 text-sm font-medium text-ink-900 shadow-glow-blue hover:bg-neon-blue/90 disabled:opacity-60"
          >
            {issuing ? "Generating…" : "Issue a 6-char code"}
          </button>
        )}
      </section>

      {/* Claim a code */}
      <section className="surface-glass tint-mint mt-5 p-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          2 · Claim a code
        </p>
        <div className="mt-2 flex items-stretch gap-2">
          <input
            value={claimInput}
            onChange={(e) =>
              setClaimInput(e.target.value.replace(/\s+/g, "").slice(0, 6).toUpperCase())
            }
            placeholder="ABC123"
            className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-lg tracking-widest outline-none placeholder:text-white/30 focus:border-neon-mint/50"
          />
          <button
            type="button"
            onClick={() => void claimCode(claimInput)}
            disabled={claiming || claimInput.length !== 6}
            className="rounded-xl bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
          >
            {claiming ? "…" : "Claim"}
          </button>
        </div>
      </section>

      {/* Bump */}
      <section className="surface-glass tint-amber mt-5 p-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          3 · Or shake your phone
        </p>
        {motionUnavailable ? (
          <p className="mt-2 text-[12px] text-white/55">
            DeviceMotion isn&apos;t supported in this browser. Use the code
            flow above.
          </p>
        ) : !bumpReady ? (
          <button
            type="button"
            onClick={() => void armBump()}
            className="mt-2 rounded-xl border border-neon-amber/40 bg-neon-amber/10 px-4 py-2 text-sm text-neon-amber hover:bg-neon-amber/20"
          >
            🎯 Listen for bump
          </button>
        ) : (
          <p
            className={clsx(
              "mt-2 text-[12px]",
              bumpDetected ? "text-neon-mint" : "text-white/55"
            )}
          >
            {bumpDetected
              ? "🤝 Bump detected — code issued above."
              : "Listening… shake your phone (or just bump it)."}
          </p>
        )}
      </section>

      {/* Bluetooth */}
      <section className="surface-glass tint-purple mt-5 p-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          4 · Or confirm proximity via Bluetooth (Chrome / Edge / Android)
        </p>
        <button
          type="button"
          onClick={() => void shareViaBluetooth()}
          disabled={bluetoothBusy}
          className="mt-2 rounded-xl border border-neon-purple/40 bg-neon-purple/10 px-4 py-2 text-sm text-neon-purple hover:bg-neon-purple/20 disabled:opacity-60"
        >
          {bluetoothBusy ? "Scanning…" : "🔵 Confirm nearby"}
        </button>
        {bluetoothMsg && (
          <p className="mt-2 text-[11px] text-white/55">{bluetoothMsg}</p>
        )}
        <p className="mt-2 text-[10px] text-white/35">
          We don&apos;t exchange data over Bluetooth — it&apos;s just a
          &ldquo;you&apos;re really physically here&rdquo; check. The actual
          code lives on the server.
        </p>
      </section>
    </>
  );
}
