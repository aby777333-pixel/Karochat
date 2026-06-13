"use client";

// Karochat — Follow / Subscribe button + follower count.
//
// Drop onto any profile. Fetches follow_stats on mount, hides the toggle for
// your own profile (shows just the count), and optimistically flips on click.
// Reuses follow_user / unfollow_user / follow_stats (migration 0080).

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function FollowButton({ targetId }: { targetId: string }) {
  const [isSelf, setIsSelf] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const [{ data: auth }, { data: stats }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc("follow_stats", { p_user: targetId })
      ]);
      if (!alive) return;
      setIsSelf(auth.user?.id === targetId);
      const row = Array.isArray(stats) ? stats[0] : stats;
      if (row) {
        setFollowers(row.followers ?? 0);
        setFollowing(!!row.is_following);
      }
    })();
    return () => {
      alive = false;
    };
  }, [targetId]);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const next = !following;
    // Optimistic.
    setFollowing(next);
    setFollowers((c) => (c == null ? c : Math.max(0, c + (next ? 1 : -1))));
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.rpc(next ? "follow_user" : "unfollow_user", {
      p_target: targetId
    });
    if (error) {
      // Roll back on failure.
      setFollowing(!next);
      setFollowers((c) => (c == null ? c : Math.max(0, c + (next ? -1 : 1))));
    }
    setBusy(false);
  }

  if (isSelf) {
    return (
      <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
        {followers ?? 0} follower{followers === 1 ? "" : "s"}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-pressed={following}
      className={
        "rounded-xl px-4 py-2 text-sm font-medium transition disabled:opacity-60 " +
        (following
          ? "border border-white/15 bg-white/10 text-white/85 hover:bg-white/15"
          : "border border-neon-purple/50 bg-neon-purple/20 text-white hover:bg-neon-purple/30")
      }
      title={following ? "Unfollow" : "Follow / subscribe"}
    >
      {following ? "✓ Following" : "+ Follow"}
      {followers != null && (
        <span className="ml-1.5 text-white/50">· {followers}</span>
      )}
    </button>
  );
}
