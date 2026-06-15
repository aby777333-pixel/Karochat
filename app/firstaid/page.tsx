import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { SignOutButton } from "@/components/SignOutButton";
import { AdRails } from "@/components/AdRails";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "First Aid · Karochat",
  description: "Quick, calm first-aid steps for common emergencies. General info — call your local emergency number first."
};

type Topic = { title: string; emoji: string; steps: string[] };
const TOPICS: Topic[] = [
  {
    title: "CPR (adult, not breathing)",
    emoji: "❤️",
    steps: [
      "Call emergency services (or have someone call) and get an AED if available.",
      "Lay them on their back on a firm surface. Kneel beside them.",
      "Place the heel of one hand in the centre of the chest, the other hand on top, fingers interlocked.",
      "Push HARD and FAST: about 5–6 cm deep, 100–120 pushes per minute (to the beat of “Stayin’ Alive”).",
      "If trained, give 2 rescue breaths after every 30 compressions; otherwise do hands-only CPR continuously.",
      "Don’t stop until help arrives, an AED is ready, or the person starts breathing."
    ]
  },
  {
    title: "Choking (adult/child)",
    emoji: "🫁",
    steps: [
      "Ask “Are you choking?” If they can cough or speak, encourage coughing — don’t interfere.",
      "If they can’t breathe/cough: give 5 firm back blows between the shoulder blades with the heel of your hand.",
      "Then 5 abdominal thrusts (Heimlich): stand behind, fist above the navel, grasp with the other hand, pull sharply inward and upward.",
      "Alternate 5 back blows and 5 thrusts until the object clears.",
      "If they become unresponsive, start CPR and call emergency services.",
      "For babies under 1: use 5 back blows then 5 chest thrusts (two fingers) — no abdominal thrusts."
    ]
  },
  {
    title: "Severe bleeding",
    emoji: "🩸",
    steps: [
      "Call for help. Wear gloves if you can.",
      "Apply firm, direct pressure on the wound with a clean cloth or dressing.",
      "Keep pressing — don’t peek. Add more cloth on top if it soaks through; don’t remove the first layer.",
      "If possible, raise the injured part above heart level.",
      "If bleeding is life-threatening and on a limb and won’t stop, a tourniquet above the wound can be used by trained people.",
      "Keep them warm and still until help arrives."
    ]
  },
  {
    title: "Burns",
    emoji: "🔥",
    steps: [
      "Stop the burning: move away from the source; remove hot/soaked clothing & jewellery (not if stuck to skin).",
      "Cool the burn under cool (not ice-cold) running water for 20 minutes.",
      "Cover loosely with cling film or a clean, non-fluffy cloth.",
      "Don’t apply butter, toothpaste, ice or creams; don’t burst blisters.",
      "Seek medical help for large, deep, or face/hand/genital burns, or any burn on a child.",
      "For chemical burns, rinse with lots of water and remove contaminated clothing."
    ]
  },
  {
    title: "Suspected fracture / sprain",
    emoji: "🦴",
    steps: [
      "Keep the injured part still — don’t try to straighten it.",
      "Support it in the position found, using padding or a sling/splint if trained.",
      "Apply a cold pack wrapped in cloth to reduce swelling (RICE: Rest, Ice, Compression, Elevation).",
      "Don’t give food or drink in case surgery is needed.",
      "Get medical help; call emergency services for open fractures, spine/neck/head injury, or severe deformity."
    ]
  },
  {
    title: "Someone unconscious but breathing",
    emoji: "😵",
    steps: [
      "Check response (shout, gently shake shoulders) and breathing.",
      "If breathing normally, place them in the recovery position: on their side, head tilted back, top knee bent.",
      "Call emergency services.",
      "Monitor breathing continuously; if it stops, start CPR.",
      "Don’t leave them alone; loosen tight clothing."
    ]
  },
  {
    title: "Heart attack signs",
    emoji: "💔",
    steps: [
      "Signs: chest pain/pressure, pain spreading to arm/jaw/back, shortness of breath, sweating, nausea.",
      "Call emergency services immediately — don’t wait.",
      "Help them sit, stay calm and rest; loosen tight clothing.",
      "If they’re not allergic and it’s available, a normal-dose aspirin to chew can help (only if conscious & able to swallow).",
      "If they become unresponsive and stop breathing, start CPR."
    ]
  },
  {
    title: "Stroke — act F.A.S.T.",
    emoji: "🧠",
    steps: [
      "Face: ask them to smile — does one side droop?",
      "Arms: can they raise both arms and keep them up?",
      "Speech: is it slurred or strange?",
      "Time: if any of these — call emergency services immediately and note the time symptoms started.",
      "Keep them comfortable; don’t give food or drink."
    ]
  },
  {
    title: "Seizure",
    emoji: "⚡",
    steps: [
      "Stay calm and time the seizure. Clear away hard or sharp objects.",
      "Cushion their head; don’t restrain them and DON’T put anything in their mouth.",
      "After convulsions stop, gently roll them into the recovery position.",
      "Stay until they’re fully aware. Reassure them.",
      "Call emergency services if it lasts over 5 minutes, repeats, it’s their first, or they’re injured/pregnant/diabetic."
    ]
  },
  {
    title: "Heat stroke / heat exhaustion",
    emoji: "🥵",
    steps: [
      "Move them to a cool, shaded place and lie them down.",
      "Loosen clothing; cool the skin with water, wet cloths and fanning.",
      "If conscious, sip cool water or an electrolyte drink.",
      "Heat stroke (hot dry skin, confusion, no sweating, collapse) is a 999/911 emergency — call immediately and cool aggressively."
    ]
  }
];

export default async function FirstAidPage() {
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
            <h1 className="font-display text-xl font-semibold">🚑 First Aid</h1>
            <p className="mt-1 text-sm text-white/60">
              Calm, simple steps for common emergencies — handy for everyone, anywhere.
            </p>
            <div className="mt-3 rounded-xl border border-neon-red/40 bg-neon-red/10 px-3 py-2 text-sm text-white/80">
              <span className="font-semibold text-neon-red">Call for help first.</span> In a
              real emergency, call your local emergency number now (e.g. 112, 911, 999, 000,
              112/108). This guide is general information, not a substitute for trained help.
            </div>
          </section>

          {TOPICS.map((t) => (
            <section key={t.title} className="surface-glass p-4">
              <h2 className="font-display text-base font-semibold text-white">
                {t.emoji} {t.title}
              </h2>
              <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-white/75 marker:text-white/40">
                {t.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </section>
          ))}

          <p className="px-1 text-[10px] leading-relaxed text-white/35">
            General first-aid information for educational purposes only — it is not medical
            advice and cannot replace professional training or emergency services. When in
            doubt, call your local emergency number. Consider a certified first-aid course.
          </p>
        </div>
      </main>
    </AdRails>
  );
}
