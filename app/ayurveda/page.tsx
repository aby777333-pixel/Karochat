import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { HealthDisclaimer } from "@/components/HealthDisclaimer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ayurveda · Karochat",
  description:
    "General Ayurvedic tips and information for common ailments — for information only, not medical advice."
};

type Ailment = { name: string; tips: string[] };
type Group = { title: string; emoji: string; items: Ailment[] };

const GROUPS: Group[] = [
  {
    title: "Doshas — the basics",
    emoji: "☯️",
    items: [
      {
        name: "Vata · Pitta · Kapha",
        tips: [
          "Ayurveda sees health as a balance of three doshas: Vata (air/space — movement), Pitta (fire/water — metabolism), Kapha (earth/water — structure).",
          "Vata imbalance: dryness, gas, anxiety, insomnia → favour warm, moist, grounding foods and routine.",
          "Pitta imbalance: heat, acidity, irritability, inflammation → favour cooling, calming foods; avoid excess spice & heat.",
          "Kapha imbalance: heaviness, congestion, sluggishness, weight gain → favour light, warm, spiced foods and movement.",
          "When unsure of your constitution, a registered Ayurvedic practitioner can assess it properly."
        ]
      }
    ]
  },
  {
    title: "Digestion",
    emoji: "🔥",
    items: [
      {
        name: "Acidity & heartburn",
        tips: [
          "Sip cool (not iced) water; coconut water and soaked raisins can soothe.",
          "Cooling foods: fennel (saunf) after meals, cumin-coriander-fennel (CCF) tea.",
          "Avoid very spicy, fried, fermented and late-night meals.",
          "Don't lie down right after eating; eat your largest meal at midday."
        ]
      },
      {
        name: "Bloating & gas",
        tips: [
          "Warm ginger tea or a pinch of hing (asafoetida) in cooked food aids digestion.",
          "Carom seeds (ajwain) with warm water; chew fennel after meals.",
          "Eat freshly cooked, warm food; avoid cold/raw foods when prone to gas.",
          "A short walk after meals helps."
        ]
      },
      {
        name: "Constipation",
        tips: [
          "Triphala in warm water at night is traditionally used for regularity.",
          "Warm water on waking, soaked figs/raisins/prunes, and adequate fibre.",
          "A teaspoon of ghee in warm milk at night (if dairy suits you).",
          "Stay hydrated and keep a regular routine."
        ]
      },
      {
        name: "Low appetite / weak digestion (Agni)",
        tips: [
          "A slice of fresh ginger with a little rock salt and lime before meals kindles appetite.",
          "Light, warm, easily digestible meals (khichdi) to rebuild digestion.",
          "Avoid snacking between meals; let the previous meal digest."
        ]
      }
    ]
  },
  {
    title: "Cold, cough & respiratory",
    emoji: "🌬️",
    items: [
      {
        name: "Cough & cold",
        tips: [
          "Warm water with honey, ginger and tulsi (holy basil); steam inhalation.",
          "Turmeric (haldi) in warm milk at night.",
          "Kadha: boil tulsi, ginger, black pepper, cinnamon, cloves; sip warm.",
          "Rest, stay warm, and avoid cold/iced foods."
        ]
      },
      {
        name: "Sore throat",
        tips: [
          "Warm salt-water gargle; honey + ginger; liquorice (mulethi) tea.",
          "Sip warm fluids through the day; avoid cold drinks."
        ]
      },
      {
        name: "Sinus & congestion",
        tips: [
          "Steam inhalation (plain or with a drop of eucalyptus).",
          "Warm spiced teas; avoid heavy, cold, dairy-rich foods during congestion."
        ]
      }
    ]
  },
  {
    title: "Mind, sleep & stress",
    emoji: "🧘",
    items: [
      {
        name: "Stress & anxiety",
        tips: [
          "Ashwagandha and Brahmi are traditional calming herbs (check with a practitioner).",
          "Daily routine (dinacharya), slow breathing (pranayama), and meditation.",
          "Warm sesame-oil self-massage (abhyanga) calms Vata.",
          "Reduce caffeine; favour warm, grounding meals."
        ]
      },
      {
        name: "Insomnia / poor sleep",
        tips: [
          "Warm milk with a pinch of nutmeg or cardamom before bed (if dairy suits you).",
          "Massage the soles of the feet with warm sesame oil at night.",
          "Fixed sleep schedule; no screens close to bedtime.",
          "Brahmi or chamomile tea in the evening."
        ]
      },
      {
        name: "Headache",
        tips: [
          "Stay hydrated; a cool sandalwood or peppermint paste on the forehead for Pitta-type heat headaches.",
          "Ginger tea for sluggish/congestion headaches.",
          "Regular meals and sleep; manage screen strain. Seek care for severe or sudden headaches."
        ]
      }
    ]
  },
  {
    title: "Joints, muscles & bones",
    emoji: "🦴",
    items: [
      {
        name: "Joint pain & stiffness",
        tips: [
          "Warm oil (sesame/mahanarayan) massage on the joint; gentle movement.",
          "Anti-inflammatory spices: turmeric, ginger; avoid cold, damp conditions.",
          "Light exercise and stretching keep joints mobile.",
          "Persistent or swollen joints need a doctor's assessment."
        ]
      },
      {
        name: "Back & muscle ache",
        tips: [
          "Warm compress and gentle oil massage.",
          "Yoga/stretching for the spine; maintain posture.",
          "Adequate rest and hydration."
        ]
      }
    ]
  },
  {
    title: "Skin & hair",
    emoji: "🌿",
    items: [
      {
        name: "Acne & oily skin (Pitta)",
        tips: [
          "Cooling, anti-bacterial: neem and turmeric face packs; aloe vera gel.",
          "Avoid excess oily, spicy, fried foods; stay hydrated.",
          "Gentle cleansing; don't over-scrub."
        ]
      },
      {
        name: "Dry skin (Vata)",
        tips: [
          "Daily oil massage (sesame/almond) before bathing.",
          "Warm, moist, healthy-fat foods; avoid very hot, drying showers."
        ]
      },
      {
        name: "Hair fall & dandruff",
        tips: [
          "Scalp massage with coconut/bhringraj/amla oil.",
          "Amla (Indian gooseberry) in diet supports hair.",
          "Manage stress and ensure protein/iron in the diet; rule out deficiencies with a doctor."
        ]
      }
    ]
  },
  {
    title: "Immunity, energy & metabolism",
    emoji: "💪",
    items: [
      {
        name: "Low immunity",
        tips: [
          "Chyawanprash (a traditional herbal jam) and tulsi/ginger teas.",
          "Turmeric, amla (vitamin C), and adequate sleep.",
          "Daily routine, sunlight, and moderate exercise."
        ]
      },
      {
        name: "Fatigue & low energy",
        tips: [
          "Warm, nourishing, easily digestible meals; avoid skipping meals.",
          "Ashwagandha is a traditional rejuvenative (rasayana) — check with a practitioner.",
          "Hydration, sleep hygiene, and gentle daily movement.",
          "Persistent fatigue should be checked by a doctor."
        ]
      },
      {
        name: "Weight & metabolism (Kapha)",
        tips: [
          "Favour light, warm, spiced foods; reduce heavy, sweet, cold, oily foods.",
          "Warm water with lemon & honey in the morning; ginger tea.",
          "Daily brisk exercise; eat your main meal at midday.",
          "Trikatu (ginger, black & long pepper) traditionally supports metabolism — check first."
        ]
      }
    ]
  },
  {
    title: "Women's health",
    emoji: "🌸",
    items: [
      {
        name: "Menstrual cramps",
        tips: [
          "Warm compress on the lower abdomen; ginger or ajwain tea.",
          "Rest, warmth, and gentle stretching during the cycle.",
          "Severe or worsening pain warrants a gynaecologist's review."
        ]
      },
      {
        name: "PCOS / cycle balance (supportive)",
        tips: [
          "Warm, regular meals; reduce refined sugar and ultra-processed foods.",
          "Cinnamon, fenugreek (methi) and spearmint tea are traditionally used.",
          "Regular exercise and stress management. Work with a doctor for diagnosis and care."
        ]
      }
    ]
  },
  {
    title: "Gentle cleansing (detox)",
    emoji: "💧",
    items: [
      {
        name: "Everyday detox habits",
        tips: [
          "Warm water on waking; sip warm water through the day.",
          "Light, freshly cooked meals (khichdi days) give digestion a rest.",
          "CCF tea (cumin-coriander-fennel) and adequate sleep.",
          "Deep cleansing (Panchakarma) should only be done under a qualified practitioner."
        ]
      }
    ]
  },
  {
    title: "Skin conditions",
    emoji: "🩹",
    items: [
      {
        name: "Eczema (atopic dermatitis)",
        tips: [
          "Cooling, anti-inflammatory: neem, turmeric and aloe vera applied externally.",
          "Coconut oil to soothe and moisturise dry, itchy patches.",
          "Reduce very spicy, sour and fermented foods (Pitta aggravators); manage stress.",
          "Use gentle, fragrance-free cleansers; keep skin well moisturised. See a dermatologist for severe flares."
        ]
      },
      {
        name: "Psoriasis",
        tips: [
          "Blood-purifying herbs traditionally used: neem, manjistha, turmeric (with a practitioner).",
          "Gentle oiling (coconut/sesame) for scaling; lukewarm baths, avoid harsh soaps.",
          "Reduce stress, alcohol and red meat; favour cooling, fresh foods.",
          "Moderate sunlight can help — coordinate with your dermatologist."
        ]
      },
      {
        name: "Tanning & pigmentation",
        tips: [
          "Cooling packs: sandalwood, aloe vera, rose water; besan (gram flour) + turmeric + curd.",
          "Fresh aloe or cucumber on the skin; hydrate well.",
          "Use sun protection; tan fades with gentle, consistent care."
        ]
      },
      {
        name: "Dry & cracked skin",
        tips: [
          "Daily oil massage (sesame/almond) before bathing; ghee on very dry lips and heels.",
          "Warm, moist, healthy-fat foods; avoid very hot showers and harsh soap.",
          "Stay hydrated; humidify dry rooms."
        ]
      },
      {
        name: "Premature greying (support)",
        tips: [
          "Amla, bhringraj and curry leaves are traditionally used for hair.",
          "Scalp oiling with amla/coconut oil; reduce stress.",
          "Ensure protein, iron and B12 — check for deficiencies with a doctor."
        ]
      },
      {
        name: "Dark circles",
        tips: [
          "Cool compress; cucumber or potato slices; a little almond oil gently around the eyes.",
          "Prioritise sleep and hydration; manage screen strain.",
          "Persistent dark circles can signal anaemia — get checked."
        ]
      }
    ]
  },
  {
    title: "Eyes, nails & oral care",
    emoji: "👁️",
    items: [
      {
        name: "Eye strain & dryness",
        tips: [
          "Follow the 20-20-20 rule; splash the eyes with cool water.",
          "Vitamin-A foods (carrots, greens) and ghee support eye health.",
          "Reduce glare; blink often. See an eye doctor for persistent dryness or pain."
        ]
      },
      {
        name: "Brittle nails",
        tips: [
          "Massage nails with warm coconut or almond oil.",
          "Ensure protein, biotin, iron and zinc in the diet.",
          "Avoid harsh chemicals; keep nails clean and dry."
        ]
      },
      {
        name: "Oral care & gums",
        tips: [
          "Oil pulling (sesame/coconut) and tongue scraping each morning.",
          "Clove or neem for gums; a salt-water rinse for soreness.",
          "See a dentist for bleeding gums or lasting pain."
        ]
      },
      {
        name: "Mouth ulcers",
        tips: [
          "Rinse with cool water; dab honey or coconut on the ulcer.",
          "Reduce spicy and sour foods; favour cooling foods and hydrate.",
          "Recurrent ulcers should be reviewed by a doctor."
        ]
      },
      {
        name: "Bad breath",
        tips: [
          "Tongue scraping and oil pulling; chew fennel, cardamom or clove.",
          "Hydrate and address digestion — often the real root."
        ]
      }
    ]
  },
  {
    title: "Gut — diarrhea, dysentery & more",
    emoji: "🚰",
    items: [
      {
        name: "Diarrhea (loose motions)",
        tips: [
          "Rehydrate: ORS, coconut water, rice water (kanji), buttermilk with roasted cumin.",
          "Light foods: soft rice, moong dal khichdi, banana, pomegranate.",
          "Avoid heavy, oily, raw and dairy-rich foods until settled.",
          "See a doctor urgently if there is blood, high fever, or signs of dehydration — especially in children and the elderly."
        ]
      },
      {
        name: "Dysentery",
        tips: [
          "Pomegranate, bael (wood apple) and buttermilk are traditional.",
          "Hydrate aggressively; keep the diet light and bland.",
          "Blood or mucus in stool, fever or weakness needs prompt medical care."
        ]
      },
      {
        name: "Piles (haemorrhoids) — support",
        tips: [
          "High-fibre diet and plenty of water; avoid straining and excess chillies.",
          "Triphala helps keep stools soft; warm sitz baths ease discomfort.",
          "Bleeding or severe pain — see a doctor."
        ]
      }
    ]
  },
  {
    title: "Inflammation & organ detox",
    emoji: "🫁",
    items: [
      {
        name: "Chronic inflammation",
        tips: [
          "Turmeric (with black pepper), ginger and garlic; cut fried, sugary and ultra-processed foods.",
          "Favour fresh vegetables, whole grains and healthy fats; prioritise sleep and movement.",
          "Persistent inflammation needs medical evaluation."
        ]
      },
      {
        name: "Liver support & detox",
        tips: [
          "Bitter greens, beetroot, amla; warm lemon water in the morning.",
          "Traditional herbs: bhumi amla, kutki, kalmegh, turmeric (with a practitioner).",
          "Reduce alcohol and very oily/fried foods; stay hydrated.",
          "Get liver function tested if you have symptoms."
        ]
      },
      {
        name: "Lung & respiratory cleanse",
        tips: [
          "Steam inhalation; tulsi, ginger, liquorice (mulethi), turmeric.",
          "Pranayama (breathing exercises) builds lung capacity.",
          "Avoid smoke and pollution; warm fluids. Honey with a little black pepper traditionally clears mucus."
        ]
      },
      {
        name: "Kidney & urinary support",
        tips: [
          "Stay well hydrated; coriander-seed water and coconut water.",
          "Reduce excess salt; gokshura and punarnava are traditional (with a practitioner).",
          "Barley water for urinary comfort; see a doctor for infections or stones."
        ]
      },
      {
        name: "Blood purification",
        tips: [
          "Neem, manjistha and turmeric are traditionally 'blood-purifying' (with a practitioner).",
          "Bitter greens, amla (vitamin C) and plenty of water.",
          "Supports clearer skin; pair with good digestion."
        ]
      }
    ]
  },
  {
    title: "Heart & circulation",
    emoji: "❤️",
    items: [
      {
        name: "Heart wellness",
        tips: [
          "Arjuna bark is a classic Ayurvedic heart tonic (only with a doctor).",
          "Garlic, turmeric, flaxseed and oats; reduce salt, fried foods and trans-fats.",
          "Daily exercise, stress management and good sleep.",
          "Know your blood pressure and cholesterol; follow your cardiologist's advice."
        ]
      },
      {
        name: "Cholesterol support",
        tips: [
          "Oats, flaxseed, garlic and amla; reduce fried and processed foods.",
          "Guggul is traditionally used (with a practitioner).",
          "Regular exercise makes the biggest difference."
        ]
      },
      {
        name: "Blood pressure support",
        tips: [
          "Reduce salt; potassium-rich foods (banana, greens, coconut water).",
          "Stress reduction, pranayama and adequate sleep.",
          "Take prescribed medication and monitor — never stop without your doctor."
        ]
      },
      {
        name: "Circulation & varicose veins",
        tips: [
          "Leg elevation, regular movement and gentle oil massage toward the heart.",
          "Avoid long periods of standing or sitting; stay active.",
          "Severe vein problems need medical review."
        ]
      }
    ]
  },
  {
    title: "Everyday practices (Dinacharya)",
    emoji: "🌅",
    items: [
      {
        name: "Morning routine",
        tips: [
          "Wake early; warm water; empty the bowels; scrape the tongue.",
          "A little yoga/movement and breathing to start the day.",
          "Eat a warm, settling breakfast."
        ]
      },
      {
        name: "Tongue scraping & oil pulling",
        tips: [
          "Scrape the tongue each morning to clear 'ama' (coating).",
          "Swish sesame or coconut oil for 5-10 minutes for oral & gum health, then spit and rinse."
        ]
      },
      {
        name: "Self-massage (Abhyanga)",
        tips: [
          "Warm-oil massage before a bath calms the nervous system and nourishes skin.",
          "Sesame oil suits Vata; coconut oil suits Pitta."
        ]
      },
      {
        name: "Seasonal routine (Ritucharya)",
        tips: [
          "Eat and live with the season — warming foods in winter, cooling in summer.",
          "Adjust your routine to the climate to stay balanced."
        ]
      },
      {
        name: "Hydration & meal timing",
        tips: [
          "Sip warm water through the day; eat your largest meal at midday when digestion is strongest.",
          "Avoid heavy late dinners; leave a gap before sleep."
        ]
      }
    ]
  }
];

export default async function AyurvedaPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/ayurveda");

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col px-4 py-6 sm:py-8">
      <header className="flex items-center justify-between gap-2">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Logo className="h-9 w-9" />
          <Wordmark className="text-lg" />
        </Link>
        <Link
          href="/rooms"
          className="shrink-0 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10 hover:text-white"
        >
          ← Rooms
        </Link>
      </header>

      <section className="surface-glass tint-mint mt-6 p-5 sm:p-6">
        <p className="text-[10px] uppercase tracking-widest text-neon-mint/70">
          🌿 Ayurveda
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">
          Ayurvedic tips for everyday ailments
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Time-honoured, general Ayurvedic guidance for common complaints — herbs,
          foods and lifestyle. Tap a topic to expand.
        </p>
      </section>

      <div className="mt-4">
        <HealthDisclaimer />
      </div>

      <div className="mt-4 space-y-5 pb-10">
        {GROUPS.map((g) => (
          <section key={g.title} className="surface-glass p-4 sm:p-5">
            <h2 className="mb-2 flex items-center gap-2 font-display text-lg font-semibold text-white">
              <span aria-hidden>{g.emoji}</span> {g.title}
            </h2>
            <div className="space-y-2">
              {g.items.map((it) => (
                <details
                  key={it.name}
                  className="group rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-white">
                    <span className="min-w-0 break-words">{it.name}</span>
                    <span
                      aria-hidden
                      className="shrink-0 text-white/40 transition group-open:rotate-180"
                    >
                      ▾
                    </span>
                  </summary>
                  <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-white/70">
                    {it.tips.map((tip, i) => (
                      <li key={i}>{tip}</li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </section>
        ))}

        <p className="px-1 text-center text-[11px] leading-relaxed text-white/40">
          Ayurveda is a traditional system of wellbeing, not a replacement for
          modern medical care. Please consult a qualified doctor before acting on
          anything here, and pair it with regular exercise.
        </p>
      </div>
    </main>
  );
}
