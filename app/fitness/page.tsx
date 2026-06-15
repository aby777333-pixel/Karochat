import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";
import { AdRails } from "@/components/AdRails";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Fitness · Karochat",
  description: "Simple no-equipment workouts, stretches and healthy-movement tips for everyone."
};

type Block = { title: string; emoji: string; items: string[] };
const BLOCKS: Block[] = [
  {
    title: "Warm up first (5 min)",
    emoji: "🔥",
    items: [
      "March or jog on the spot — 60 seconds.",
      "Arm circles forwards & backwards — 30 seconds.",
      "Hip circles and gentle torso twists — 30 seconds.",
      "10 slow bodyweight squats and 10 shoulder rolls.",
      "Goal: warm muscles, raise the heart rate gently, loosen joints."
    ]
  },
  {
    title: "No-equipment full-body (15–20 min)",
    emoji: "💪",
    items: [
      "Do each for 40 seconds, rest 20 seconds. Repeat the circuit 2–3 times.",
      "Squats — feet shoulder-width, sit back, knees over toes.",
      "Push-ups — on knees or against a wall if needed.",
      "Glute bridges — lie down, lift hips, squeeze.",
      "Plank — straight line head to heels, brace your core.",
      "Lunges — alternate legs, knee just above the floor.",
      "Jumping jacks or fast marching — for the cardio burst.",
      "Listen to your body — form over speed, always."
    ]
  },
  {
    title: "Daily movement that counts",
    emoji: "🚶",
    items: [
      "Aim for ~7,000–10,000 steps, or 30 minutes of brisk walking.",
      "Take the stairs; park further away; walk during calls.",
      "Stand up and move for 2–3 minutes every hour you sit.",
      "Adults: aim for ~150 minutes of moderate activity per week (WHO).",
      "Anything is better than nothing — start where you are."
    ]
  },
  {
    title: "Stretch & cool down (5 min)",
    emoji: "🧘",
    items: [
      "Hold each stretch 20–30 seconds, breathe slowly, never bounce.",
      "Hamstrings — reach toward your toes, soft knees.",
      "Quads — stand, pull one heel to your glute.",
      "Chest & shoulders — clasp hands behind your back and lift.",
      "Neck — gently tilt ear to shoulder each side.",
      "Child’s pose & a slow forward fold to finish."
    ]
  },
  {
    title: "Desk & posture fixes",
    emoji: "🪑",
    items: [
      "Screen at eye level; shoulders relaxed, back supported.",
      "Every 30–60 min: stand, roll shoulders, look far away (20-20-20 for eyes).",
      "Strengthen your back: rows, glute bridges, wall angels.",
      "Stretch hip flexors and chest to counter sitting."
    ]
  },
  {
    title: "Habits that make it stick",
    emoji: "🌱",
    items: [
      "Schedule it like an appointment — same time helps.",
      "Start tiny: 10 minutes a day beats an hour once a week.",
      "Drink water; prioritise sleep; eat enough protein & veg.",
      "Track it in the Organizer (Tasks/Schedule) and celebrate small wins.",
      "Rest days matter — muscles grow when you recover."
    ]
  }
];

export default async function FitnessPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/");
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, terms_accepted_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.username) redirect("/onboarding");
  if (!profile.terms_accepted_at) redirect("/terms");

  return (
    <AdRails>
      <main className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-1 py-5 md:py-7">
        <header className="surface-glass flex items-center justify-between gap-3 px-4 py-3">
          <Link href="/rooms" className="flex items-center gap-2">
            <Logo className="h-6 w-6" />
            <Wordmark className="text-lg" />
          </Link>
          <nav className="flex shrink-0 items-center gap-1.5 text-xs md:gap-2">
            <Link href="/rooms" className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-white/80 hover:bg-white/10 hover:text-white">
              ← <span className="hidden md:inline">Rooms</span>
            </Link>
            <SignOutButton />
          </nav>
        </header>

        <div className="mt-5 space-y-4">
          <section className="surface-glass tint-purple p-5">
            <h1 className="font-display text-xl font-semibold">🏋️ Fitness</h1>
            <p className="mt-1 text-sm text-white/60">
              Simple, no-equipment workouts, stretches and healthy-movement tips you
              can do anywhere — no gym needed.
            </p>
          </section>

          {BLOCKS.map((b) => (
            <section key={b.title} className="surface-glass p-4">
              <h2 className="font-display text-base font-semibold text-white">{b.emoji} {b.title}</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-white/75 marker:text-white/40">
                {b.items.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </section>
          ))}

          <p className="px-1 text-[10px] leading-relaxed text-white/35">
            General fitness information for healthy adults, not medical or personal
            training advice. Stop if you feel pain, dizziness or chest discomfort, and
            check with a doctor before starting a new programme — especially if you’re
            pregnant, injured, or have a health condition.
          </p>
        </div>
      </main>
    </AdRails>
  );
}
