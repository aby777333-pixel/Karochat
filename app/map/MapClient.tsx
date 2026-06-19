"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type MapPin = {
  profile_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  latitude: number;
  longitude: number;
  precision_m: number | null;
  visibility: "close_friends" | "friends" | "public";
  updated_at: string;
  is_me: boolean;
};

export type MyPin = {
  visibility: "ghost" | "close_friends" | "friends" | "public";
  precision_m: number | null;
  expires_at: string | null;
};

type Visibility = "ghost" | "close_friends" | "friends" | "public";

const VIS_OPTIONS: { key: Exclude<Visibility, "ghost">; label: string; emoji: string }[] = [
  { key: "close_friends", label: "Close friends", emoji: "💚" },
  { key: "friends", label: "Friends", emoji: "👥" },
  { key: "public", label: "Everyone", emoji: "🌐" }
];
const PRECISION_OPTIONS: { m: number; label: string }[] = [
  { m: 300, label: "Precise (~300m)" },
  { m: 1000, label: "Area (~1km)" },
  { m: 5000, label: "Rough (~5km)" }
];
const TTL_OPTIONS: { mins: number; label: string }[] = [
  { mins: 60, label: "1 hour" },
  { mins: 480, label: "8 hours" },
  { mins: 1440, label: "24 hours" }
];

// Load Leaflet from CDN once (the map needs external tiles regardless, so a
// CDN script keeps it out of the bundle and off the droplet's node_modules).
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if ((window as any).L) return Promise.resolve((window as any).L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    js.async = true;
    js.onload = () => resolve((window as any).L);
    js.onerror = () => reject(new Error("Could not load the map library."));
    document.head.appendChild(js);
  });
  return leafletPromise;
}

function esc(s: string | null | undefined) {
  return (s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );
}
function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function MapClient({
  currentUserId,
  initialPins,
  myPin
}: {
  currentUserId: string;
  initialPins: MapPin[];
  myPin: MyPin | null;
}) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const centeredRef = useRef(false);

  const [pins, setPins] = useState<MapPin[]>(initialPins);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sharing = (myPin?.visibility ?? "ghost") !== "ghost";
  const expiresAt = myPin?.expires_at ?? null;
  const stillLive = sharing && (!expiresAt || new Date(expiresAt).getTime() > Date.now());

  const [visibility, setVisibility] = useState<Exclude<Visibility, "ghost">>(
    myPin && myPin.visibility !== "ghost" ? myPin.visibility : "friends"
  );
  const [precision, setPrecision] = useState<number>(myPin?.precision_m ?? 1000);
  const [ttl, setTtl] = useState<number>(480);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refreshPins = useCallback(async () => {
    const { data } = await supabase.rpc("list_map_pins");
    setPins((data ?? []) as MapPin[]);
  }, [supabase]);

  // Init map.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapDivRef.current || mapRef.current) return;
        LRef.current = L;
        const map = L.map(mapDivRef.current, { zoomControl: true }).setView([20, 0], 2);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution: "&copy; OpenStreetMap"
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;
        setReady(true);
      })
      .catch((e) => setLoadError(e?.message ?? "Map failed to load."));
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Render pins whenever they change.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!ready || !L || !map || !layer) return;
    layer.clearLayers();

    const mine = pins.find((p) => p.is_me);
    for (const p of pins) {
      const name = p.display_name ?? p.username ?? "anon";
      const initial = esc(name.slice(0, 1).toUpperCase());
      const inner = p.avatar_url
        ? `<img src="${esc(p.avatar_url)}" alt=""/>`
        : `<span>${initial}</span>`;
      const icon = L.divIcon({
        className: "",
        html: `<div class="kc-pin ${p.is_me ? "kc-pin--me" : ""}">${inner}</div>`,
        iconSize: [38, 38],
        iconAnchor: [19, 19]
      });
      L.marker([p.latitude, p.longitude], { icon })
        .addTo(layer)
        .bindPopup(
          `<strong>${esc(name)}</strong>${p.is_me ? " (you)" : ""}<br/>` +
            `<span style="opacity:.7">updated ${ago(p.updated_at)}</span>`
        );
      // Fuzz circle so it's clear the point is approximate.
      if (p.precision_m) {
        L.circle([p.latitude, p.longitude], {
          radius: p.precision_m,
          color: p.is_me ? "#34d399" : "#60a5fa",
          weight: 1,
          opacity: 0.4,
          fillOpacity: 0.08
        }).addTo(layer);
      }
    }

    if (!centeredRef.current) {
      if (mine) {
        map.setView([mine.latitude, mine.longitude], 13);
        centeredRef.current = true;
      } else if (pins.length > 0) {
        map.fitBounds(pins.map((p) => [p.latitude, p.longitude]), { padding: [40, 40], maxZoom: 13 });
        centeredRef.current = true;
      }
    }
  }, [pins, ready]);

  // Periodic refresh while the page is open.
  useEffect(() => {
    const t = setInterval(() => void refreshPins(), 60000);
    return () => clearInterval(t);
  }, [refreshPins]);

  function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        reject(new Error("Location isn't available on this device."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 15000,
        maximumAge: 30000
      });
    });
  }

  async function share() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    try {
      const pos = await getPosition();
      const { error } = await supabase.rpc("update_map_pin", {
        p_lat: pos.coords.latitude,
        p_lng: pos.coords.longitude,
        p_visibility: visibility,
        p_precision_m: precision,
        p_ttl_minutes: ttl
      });
      if (error) throw error;
      centeredRef.current = false; // recenter on my fresh pin
      await refreshPins();
      setNote("You're on the map. It'll auto-hide when the timer runs out.");
    } catch (e: any) {
      setNote(
        e?.code === 1
          ? "Location permission was denied — allow it in your browser to share."
          : e?.message ?? "Couldn't update your location."
      );
    } finally {
      setBusy(false);
    }
  }

  async function ghost() {
    if (busy) return;
    setBusy(true);
    setNote(null);
    const { error } = await supabase.rpc("go_ghost");
    if (!error) {
      await refreshPins();
      setNote("You're a ghost again — your location is hidden and wiped.");
    } else {
      setNote(error.message);
    }
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <style>{`
        .kc-pin{height:38px;width:38px;border-radius:9999px;overflow:hidden;border:2px solid #60a5fa;
          background:#1e293b;display:grid;place-items:center;box-shadow:0 1px 6px rgba(0,0,0,.5)}
        .kc-pin--me{border-color:#34d399}
        .kc-pin img{height:100%;width:100%;object-fit:cover}
        .kc-pin span{color:#fff;font-size:14px;font-weight:600}
        .leaflet-container{background:#0b1120}
        .leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#1e293b;color:#e2e8f0}
      `}</style>

      {/* Map canvas */}
      <div className="overflow-hidden rounded-2xl border border-white/10">
        {loadError ? (
          <div className="grid h-[320px] place-items-center bg-ink-800 px-6 text-center text-sm text-white/50">
            {loadError}
          </div>
        ) : (
          <div ref={mapDivRef} className="h-[320px] w-full md:h-[420px]" />
        )}
      </div>

      {/* Status line */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className={stillLive ? "text-neon-mint" : "text-white/45"}>
          {stillLive
            ? `● Sharing with ${visibility.replace("_", " ")}`
            : "👻 Ghost mode — you're hidden"}
        </span>
        <button onClick={() => void refreshPins()} className="text-white/45 hover:text-white">
          ↻ Refresh
        </button>
      </div>

      {/* Sharing controls */}
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div>
          <p className="mb-1.5 text-xs font-medium text-white/60">Who can see me</p>
          <div className="grid grid-cols-3 gap-1.5">
            {VIS_OPTIONS.map((v) => (
              <button
                key={v.key}
                onClick={() => setVisibility(v.key)}
                className={`rounded-xl border px-2 py-2 text-xs transition ${
                  visibility === v.key
                    ? "border-neon-mint/60 bg-neon-mint/10 text-white"
                    : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                }`}
              >
                <span aria-hidden className="mr-1">{v.emoji}</span>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-xs font-medium text-white/60">Blur</p>
            <select
              value={precision}
              onChange={(e) => setPrecision(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-xs text-white outline-none focus:border-neon-mint/60"
            >
              {PRECISION_OPTIONS.map((p) => (
                <option key={p.m} value={p.m}>{p.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-medium text-white/60">For how long</p>
            <select
              value={ttl}
              onChange={(e) => setTtl(Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-xs text-white outline-none focus:border-neon-mint/60"
            >
              {TTL_OPTIONS.map((t) => (
                <option key={t.mins} value={t.mins}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        {note && <p className="rounded-md bg-white/5 px-2 py-1 text-[11px] text-white/70">{note}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => void share()}
            disabled={busy}
            className="flex-1 rounded-lg border border-neon-mint/50 bg-neon-mint/15 px-3 py-2 text-sm text-neon-mint hover:bg-neon-mint/25 disabled:opacity-50"
          >
            {busy ? "…" : stillLive ? "Update my spot" : "Share my location"}
          </button>
          {stillLive && (
            <button
              onClick={() => void ghost()}
              disabled={busy}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
            >
              👻 Go ghost
            </button>
          )}
        </div>
        <p className="text-[11px] text-white/35">
          Your exact GPS never leaves your device — we snap it to the blur you
          pick before saving. Turn it off anytime; Go ghost wipes the stored
          point.
        </p>
      </div>
    </div>
  );
}
