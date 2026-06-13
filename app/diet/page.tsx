import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo, Wordmark } from "@/components/Brand";
import { HealthDisclaimer } from "@/components/HealthDisclaimer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Diet & Recipes · Karochat",
  description:
    "Goal-based diets and organic recipes — detox, weight loss and more. For information only, not medical advice."
};

type Recipe = { name: string; ingredients: string; steps: string };
type Goal = {
  title: string;
  emoji: string;
  principles: string[];
  recipes: Recipe[];
};

const GOALS: Goal[] = [
  {
    title: "Detox & cleanse",
    emoji: "💧",
    principles: [
      "Start the day with warm water + lemon; stay well hydrated.",
      "Favour fresh, seasonal, organic vegetables and fruit; go easy on processed food, sugar and alcohol.",
      "Light, freshly cooked meals; include fibre and fermented foods for the gut.",
      "Detox is mostly about resting digestion — keep it gentle, not extreme."
    ],
    recipes: [
      {
        name: "Green detox smoothie",
        ingredients:
          "1 cup spinach, ½ cucumber, ½ green apple, juice of ½ lemon, small piece ginger, 1 cup water",
        steps: "Blend everything until smooth. Drink fresh, ideally in the morning."
      },
      {
        name: "Healing khichdi",
        ingredients:
          "½ cup rice, ½ cup moong dal, turmeric, cumin, ginger, mixed organic vegetables, rock salt",
        steps:
          "Sauté cumin & ginger in a little ghee, add washed rice+dal, turmeric, veg and 4 cups water. Simmer to a soft porridge."
      }
    ]
  },
  {
    title: "Weight loss",
    emoji: "⚖️",
    principles: [
      "Whole foods, plenty of vegetables, lean protein and fibre; control portions.",
      "Cut refined sugar, fried and ultra-processed foods; don't drink your calories.",
      "Eat your largest meal earlier; avoid heavy late-night dinners.",
      "Pair with daily movement — diet alone is only half the picture."
    ],
    recipes: [
      {
        name: "Veg & lentil soup",
        ingredients:
          "1 cup mixed organic vegetables, ¼ cup red lentils, garlic, onion, herbs, black pepper",
        steps:
          "Sauté garlic & onion, add veg, lentils and 3 cups water. Simmer until soft, season and blend if you like."
      },
      {
        name: "Sprout & cucumber salad",
        ingredients:
          "1 cup sprouted moong, ½ cucumber, tomato, onion, lemon, coriander, pinch of salt & pepper",
        steps: "Toss everything together. Light, high-protein and filling."
      }
    ]
  },
  {
    title: "Weight gain & muscle",
    emoji: "🏋️",
    principles: [
      "Calorie surplus from wholesome foods: nuts, seeds, dairy, legumes, whole grains, healthy oils.",
      "Protein with every meal; eat frequently if appetite is low.",
      "Pair with strength training so gains are muscle, not just fat."
    ],
    recipes: [
      {
        name: "Banana-nut-date shake",
        ingredients:
          "1 banana, 2 dates, 6 soaked almonds, 1 tbsp peanut butter, 1 cup milk (or plant milk)",
        steps: "Blend until creamy. A calorie- and protein-dense snack."
      },
      {
        name: "Paneer / tofu stir-fry",
        ingredients: "150 g paneer or tofu, mixed veg, olive oil, garlic, spices",
        steps: "Stir-fry garlic & veg, add paneer/tofu, season and serve with whole-grain rice or roti."
      }
    ]
  },
  {
    title: "Immunity boost",
    emoji: "🛡️",
    principles: [
      "Colourful vegetables and fruit (vitamin C), garlic, ginger, turmeric.",
      "Fermented foods, nuts and seeds (zinc), and adequate protein.",
      "Sleep and sunlight matter as much as food."
    ],
    recipes: [
      {
        name: "Turmeric immunity latte",
        ingredients: "1 cup milk, ½ tsp turmeric, pinch black pepper, ginger, honey",
        steps: "Warm the milk with spices (don't boil hard), strain, add honey when just warm."
      },
      {
        name: "Citrus-ginger tonic",
        ingredients: "Juice of 1 orange + ½ lemon, grated ginger, warm water",
        steps: "Mix and sip warm. Vitamin-C rich morning lift."
      }
    ]
  },
  {
    title: "Gut health",
    emoji: "🦠",
    principles: [
      "Fibre (vegetables, fruit, whole grains) feeds good bacteria.",
      "Fermented foods: yoghurt/curd, idli/dosa batter, kanji, pickles (in moderation).",
      "Stay hydrated; chew well; reduce ultra-processed foods."
    ],
    recipes: [
      {
        name: "Probiotic curd bowl",
        ingredients: "1 cup fresh curd/yoghurt, cucumber, roasted cumin, mint, pinch of salt",
        steps: "Mix and chill. Gentle, gut-friendly and cooling."
      },
      {
        name: "Overnight soaked oats",
        ingredients: "½ cup oats, 1 cup milk/curd, chia seeds, fruit, nuts",
        steps: "Soak overnight in the fridge; top with fruit & nuts in the morning."
      }
    ]
  },
  {
    title: "Diabetes-friendly (supportive)",
    emoji: "🩸",
    principles: [
      "Low glycaemic, high-fibre foods; whole grains over refined; control portions.",
      "Pair carbs with protein/fat; avoid sugary drinks and sweets.",
      "Cinnamon, fenugreek and bitter gourd are traditionally used — diet supports, it doesn't replace, your doctor's plan."
    ],
    recipes: [
      {
        name: "Methi (fenugreek) thepla",
        ingredients: "Whole-wheat flour, chopped fenugreek leaves, turmeric, spices, little oil",
        steps: "Knead, roll thin and cook on a tawa with minimal oil. Fibre-rich flatbread."
      },
      {
        name: "Veg besan chilla",
        ingredients: "Gram (besan) flour, grated veg, spices, water",
        steps: "Make a batter, pour thin on a hot pan, cook both sides. High-protein, low-GI."
      }
    ]
  },
  {
    title: "Heart-healthy",
    emoji: "❤️",
    principles: [
      "Healthy fats (olive oil, nuts, seeds, fatty fish); limit salt, trans-fats and fried food.",
      "Plenty of vegetables, fruit, whole grains and legumes.",
      "Oats and flaxseed support healthy cholesterol."
    ],
    recipes: [
      {
        name: "Oats & flax porridge",
        ingredients: "½ cup oats, 1 tbsp ground flaxseed, milk/water, fruit",
        steps: "Cook oats with flax, top with fresh fruit and a few nuts."
      },
      {
        name: "Steamed fish & greens",
        ingredients: "Fish fillet, lemon, herbs, steamed seasonal greens, olive oil drizzle",
        steps: "Steam or bake the fish with lemon & herbs; serve with greens."
      }
    ]
  },
  {
    title: "Skin glow",
    emoji: "✨",
    principles: [
      "Hydrate well; colourful antioxidant-rich produce; healthy fats (nuts, seeds, avocado).",
      "Vitamin C (citrus, amla) and water-rich foods; reduce sugar and fried food."
    ],
    recipes: [
      {
        name: "Amla-honey shot",
        ingredients: "1 tbsp amla juice, warm water, a little honey",
        steps: "Mix and drink in the morning. Vitamin-C rich."
      },
      {
        name: "Beetroot-carrot juice",
        ingredients: "1 beetroot, 2 carrots, ½ apple, ginger",
        steps: "Juice or blend and strain. Antioxidant boost."
      }
    ]
  },
  {
    title: "Energy & stamina",
    emoji: "⚡",
    principles: [
      "Complex carbs + protein for steady energy; don't skip breakfast.",
      "Hydrate; include iron-rich foods (greens, legumes); limit sugar crashes.",
      "Dates, nuts and seeds make great natural pre-workout snacks."
    ],
    recipes: [
      {
        name: "Energy bites",
        ingredients: "Dates, mixed nuts, seeds, a little cocoa",
        steps: "Blend, roll into balls, refrigerate. Grab-and-go fuel."
      },
      {
        name: "Veg poha",
        ingredients: "Flattened rice (poha), peanuts, peas, turmeric, curry leaves, lemon",
        steps: "Temper spices & peanuts, add rinsed poha and veg, toss with lemon."
      }
    ]
  },
  {
    title: "Anti-inflammatory",
    emoji: "🌿",
    principles: [
      "Turmeric, ginger, garlic, leafy greens, berries, olive oil, omega-3s.",
      "Reduce sugar, refined carbs, fried and ultra-processed foods."
    ],
    recipes: [
      {
        name: "Golden vegetable soup",
        ingredients: "Mixed veg, turmeric, ginger, garlic, black pepper, herbs",
        steps: "Simmer veg with spices until soft; blend for a warming, soothing soup."
      }
    ]
  },
  {
    title: "Hydration & seasonal",
    emoji: "🥥",
    principles: [
      "Water through the day; coconut water and buttermilk in heat.",
      "Eat water-rich seasonal produce (cucumber, melon, citrus).",
      "Warm fluids in cold/congested seasons, cooling foods in summer."
    ],
    recipes: [
      {
        name: "Spiced buttermilk (chaas)",
        ingredients: "1 cup curd, 2 cups water, roasted cumin, ginger, coriander, salt",
        steps: "Blend, strain and serve chilled. Cooling and gut-friendly."
      }
    ]
  }
];

export default async function DietPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/?redirect=/diet");

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

      <section className="surface-glass tint-amber mt-6 p-5 sm:p-6">
        <p className="text-[10px] uppercase tracking-widest text-neon-amber/70">
          🥗 Diet & Recipes
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-white sm:text-3xl">
          Diets & organic recipes by goal
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/70">
          Simple, organic-leaning recipes and eating principles for detox, weight
          loss, immunity, gut health and more. Tap a goal to expand.
        </p>
      </section>

      <div className="mt-4">
        <HealthDisclaimer />
      </div>

      <div className="mt-4 space-y-3 pb-10">
        {GOALS.map((g) => (
          <details
            key={g.title}
            className="group surface-glass p-4 sm:p-5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
              <span className="flex items-center gap-2 font-display text-lg font-semibold text-white">
                <span aria-hidden>{g.emoji}</span> {g.title}
              </span>
              <span
                aria-hidden
                className="shrink-0 text-white/40 transition group-open:rotate-180"
              >
                ▾
              </span>
            </summary>

            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-widest text-white/40">
                Principles
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed text-white/70">
                {g.principles.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>

            <div className="mt-3 space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-white/40">
                Organic recipes
              </p>
              {g.recipes.map((r) => (
                <div
                  key={r.name}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
                >
                  <p className="text-sm font-medium text-neon-mint">{r.name}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/75">
                    <span className="text-white/45">Ingredients: </span>
                    {r.ingredients}
                  </p>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/75">
                    <span className="text-white/45">Method: </span>
                    {r.steps}
                  </p>
                </div>
              ))}
            </div>
          </details>
        ))}

        <p className="px-1 text-center text-[11px] leading-relaxed text-white/40">
          General nutrition information only — individual needs vary. Consult a
          doctor or registered dietitian before starting any diet or detox,
          especially with a health condition, and combine it with regular
          exercise.
        </p>
      </div>
    </main>
  );
}
