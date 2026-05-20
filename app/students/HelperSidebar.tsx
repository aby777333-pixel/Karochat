"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Inbound beacons sidebar — a persistent helper-side panel.
 * Subscribes to beacon_routes; when the router writes a row for us, we show
 * the beacon and offer Help / Pass / Snooze.
 */
export function HelperSidebar({ currentUserId }: { currentUserId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [rows, setRows] = useState<Array<{ route: any; beacon: any }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      const { data: routes } = await supabase
        .from("beacon_routes")
        .select("*")
        .eq("helper_profile_id", currentUserId)
        .eq("acknowledged", "seen")
        .order("routed_at", { ascending: false })
        .limit(5);
      if (!routes || routes.length === 0) {
        if (!cancelled) setRows([]);
        return;
      }
      const ids = routes.map((r) => r.beacon_id);
      const { data: beacons } = await supabase
        .from("help_beacons")
        .select("*")
        .in("id", ids)
        .eq("status", "routing");
      if (cancelled) return;
      const byId = new Map((beacons ?? []).map((b: any) => [b.id, b]));
      const paired = routes
        .map((r) => ({ route: r, beacon: byId.get(r.beacon_id) }))
        .filter((p) => !!p.beacon);
      setRows(paired);
    }
    void refresh();
    const channel = supabase
      .channel("helper-routes")
      .on("postgres_changes",
          { event: "*", schema: "public", table: "beacon_routes",
            filter: `helper_profile_id=eq.${currentUserId}` },
          () => { void refresh(); })
      .on("postgres_changes",
          { event: "UPDATE", schema: "public", table: "help_beacons" },
          () => { void refresh(); })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [supabase, currentUserId]);

  async function accept(beaconId: string) {
    const { data, error } = await supabase.rpc("accept_beacon", {
      p_beacon_id: beaconId
    });
    if (error) {
      console.warn(error);
      return;
    }
    if (data) router.push(`/students/session/${data}`);
  }

  async function pass(beaconId: string) {
    await supabase
      .from("beacon_routes")
      .update({ acknowledged: "passed", responded_at: new Date().toISOString() })
      .eq("beacon_id", beaconId)
      .eq("helper_profile_id", currentUserId);
    setRows((prev) => prev.filter((p) => p.beacon.id !== beaconId));
  }

  async function pauseAll(hours: number) {
    const until = new Date(Date.now() + hours * 3600_000).toISOString();
    await supabase
      .from("profiles")
      .update({ beacons_dnd_until: until })
      .eq("id", currentUserId);
  }

  return (
    <section className={clsx(
      "surface-glass p-4",
      rows.length > 0 && "border-neon-mint/30"
    )}>
      <p className="text-[10px] uppercase tracking-widest text-white/40">
        Inbound beacons ({rows.length})
      </p>
      {rows.length === 0 ? (
        <p className="mt-2 text-[11px] text-white/45">
          No beacons routed to you right now. Karo only pings you for
          questions in your subjects.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {rows.map(({ route, beacon }) => (
            <li
              key={beacon.id}
              className="rounded-xl border border-neon-mint/30 bg-neon-mint/5 p-2.5"
            >
              <p className="text-[10px] uppercase tracking-widest text-neon-mint">
                🆘 {beacon.subject?.replace(/-/g, " ")} · P{route.phase}
              </p>
              <p className="mt-0.5 line-clamp-3 text-[12px] text-white/85">
                {beacon.karo_rewritten_question ?? beacon.question_text}
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void accept(beacon.id)}
                  className="rounded-md bg-neon-mint px-2 py-1 text-[11px] font-medium text-ink-900 hover:bg-neon-mint/90"
                >
                  🤝 Help
                </button>
                <button
                  type="button"
                  onClick={() => void pass(beacon.id)}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/65 hover:bg-white/10"
                >
                  Pass
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => void pauseAll(1)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55 hover:bg-white/10"
        >
          🌒 pause 1h
        </button>
        <button
          type="button"
          onClick={() => void pauseAll(4)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55 hover:bg-white/10"
        >
          pause 4h
        </button>
        <button
          type="button"
          onClick={() => void pauseAll(24)}
          className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/55 hover:bg-white/10"
        >
          pause 24h
        </button>
      </div>
    </section>
  );
}
