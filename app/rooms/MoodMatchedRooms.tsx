import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MoodRow = {
  room_id: string;
  room_name: string;
  category_slug: string | null;
  member_count: number;
  shared_mood: string;
  example_user: string | null;
};

const MOOD_EMOJI: Record<string, string> = {
  chatty: "💬", quiet: "🤫", flirty: "😘", focused: "🎯",
  low: "🌧️", celebrating: "🎉", lonely: "🌒", horny: "🔥",
  processing: "🌀"
};

export async function MoodMatchedRooms() {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.rpc("find_mood_rooms", { p_limit: 20 });
  const rooms = (data ?? []) as MoodRow[];
  if (rooms.length === 0) return null;

  const sharedMood = rooms[0]?.shared_mood ?? "";
  const emoji = MOOD_EMOJI[sharedMood] ?? "·";

  return (
    <section className="surface-glass tint-purple p-5">
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">
            {emoji} People feeling {sharedMood} too
          </h2>
          <p className="text-[11px] text-white/45">
            Rooms where others share your current mood.
          </p>
        </div>
        <span className="text-xs text-white/40">{rooms.length}</span>
      </div>
      <ul className="space-y-1.5">
        {rooms.map((r) => (
          <li key={r.room_id}>
            <Link
              href={`/rooms/${r.room_id}`}
              className="block rounded-xl border border-white/10 bg-black/25 px-3 py-2 transition hover:border-neon-purple/40 hover:bg-neon-purple/5"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-sm text-white">{r.room_name}</span>
                <span className="shrink-0 font-mono text-[11px] text-white/45">
                  {r.member_count} 👤
                </span>
              </div>
              {r.example_user && (
                <p className="mt-0.5 text-[11px] text-white/45">
                  @{r.example_user} is in there now
                </p>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
