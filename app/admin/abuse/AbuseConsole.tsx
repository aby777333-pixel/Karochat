"use client";

// Karochat — admin abuse console (Wave 22).
// Review flagged events (with IP), blacklist / un-blacklist IPs, and export
// the log (CSV/JSON) for hand-off to authorities.

import { useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type AbuseEvent = {
  id: string;
  user_id: string | null;
  ip: string | null;
  user_agent: string | null;
  category: string;
  snippet: string | null;
  room_id: string | null;
  created_at: string;
};

type BlacklistRow = { ip: string; reason: string | null; created_at: string };

export function AbuseConsole({
  events,
  initialBlacklist
}: {
  events: AbuseEvent[];
  initialBlacklist: BlacklistRow[];
}) {
  const [blacklist, setBlacklist] = useState<BlacklistRow[]>(initialBlacklist);
  const [busy, setBusy] = useState<string | null>(null);
  const [manualIp, setManualIp] = useState("");
  const [error, setError] = useState<string | null>(null);

  const blocked = useMemo(() => new Set(blacklist.map((b) => b.ip)), [blacklist]);

  async function blacklistIp(ip: string, reason: string) {
    if (!ip) return;
    setBusy(ip);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: e } = await supabase
      .from("ip_blacklist")
      .upsert({ ip, reason }, { onConflict: "ip" });
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    setBlacklist((prev) =>
      prev.some((b) => b.ip === ip)
        ? prev
        : [{ ip, reason, created_at: new Date().toISOString() }, ...prev]
    );
  }

  async function removeIp(ip: string) {
    setBusy(ip);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    const { error: e } = await supabase.from("ip_blacklist").delete().eq("ip", ip);
    setBusy(null);
    if (e) {
      setError(e.message);
      return;
    }
    setBlacklist((prev) => prev.filter((b) => b.ip !== ip));
  }

  function download(name: string, mime: string, content: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function exportJson() {
    download("karochat-abuse-events.json", "application/json", JSON.stringify(events, null, 2));
  }

  function exportCsv() {
    const cols = ["created_at", "category", "ip", "user_id", "room_id", "snippet", "user_agent"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = [cols.join(",")].concat(
      events.map((e) => cols.map((c) => esc((e as any)[c])).join(","))
    );
    download("karochat-abuse-events.csv", "text/csv", rows.join("\n"));
  }

  return (
    <div className="mt-5 space-y-6">
      {error && (
        <div className="surface-glass tint-red p-3 text-sm text-neon-red">{error}</div>
      )}

      {/* Blacklist manager */}
      <section className="surface-glass p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">IP blacklist</h2>
          <span className="text-xs text-white/40">{blacklist.length} blocked</span>
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const ip = manualIp.trim();
            if (ip) {
              void blacklistIp(ip, "manual");
              setManualIp("");
            }
          }}
        >
          <input
            value={manualIp}
            onChange={(e) => setManualIp(e.target.value)}
            placeholder="Add an IP to block…"
            className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-neon-red/60"
          />
          <button
            type="submit"
            className="rounded-lg bg-neon-red/90 px-3 py-2 text-sm font-medium text-white hover:bg-neon-red"
          >
            Block
          </button>
        </form>
        {blacklist.length > 0 && (
          <ul className="mt-3 divide-y divide-white/5">
            {blacklist.map((b) => (
              <li key={b.ip} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-mono text-white">{b.ip}</span>
                  {b.reason && <span className="ml-2 text-white/45">{b.reason}</span>}
                </span>
                <button
                  type="button"
                  disabled={busy === b.ip}
                  onClick={() => void removeIp(b.ip)}
                  className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/65 hover:bg-white/10 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Events */}
      <section className="surface-glass p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold">Flagged events</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={exportJson}
              className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
            >
              Export JSON
            </button>
          </div>
        </div>

        {events.length === 0 ? (
          <p className="mt-4 text-sm text-white/50">🎉 No flagged events.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {events.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-white/10 bg-black/30 p-3 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/55">
                  <span
                    className={
                      "rounded-sm border px-1 uppercase tracking-widest " +
                      (e.category === "minors" || e.category === "terror"
                        ? "border-neon-red/40 bg-neon-red/10 text-neon-red"
                        : "border-white/15 bg-white/5 text-white/70")
                    }
                  >
                    {e.category}
                  </span>
                  <span>{new Date(e.created_at).toLocaleString()}</span>
                  {e.ip && (
                    <>
                      <span className="font-mono text-white/80">{e.ip}</span>
                      {blocked.has(e.ip) ? (
                        <span className="text-neon-red">blacklisted</span>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === e.ip}
                          onClick={() => void blacklistIp(e.ip!, `auto: ${e.category}`)}
                          className="rounded border border-neon-red/40 bg-neon-red/10 px-1.5 text-neon-red hover:bg-neon-red/20 disabled:opacity-50"
                        >
                          Blacklist IP
                        </button>
                      )}
                    </>
                  )}
                </div>
                {e.snippet && (
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-white/85">
                    {e.snippet}
                  </p>
                )}
                <p className="mt-1 text-[10px] text-white/35">
                  user: {e.user_id ?? "—"} · room: {e.room_id ?? "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
