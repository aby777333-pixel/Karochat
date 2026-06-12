// Karochat — "Lines & sparks" library.
//
// Pre-written conversation starters, compliments, pick-up lines, date
// asks, smooth replies, kind let-downs, and (18+ only) flirty advances.
// Every pack is consent-forward by design: nothing here pressures,
// nothing escalates past a "no", and the adult pack stays suggestive-
// but-classy. The LinesPicker inserts the text into the composer so
// people can edit before sending — nothing auto-sends.

export type LinePack = {
  key: string;
  label: string;
  emoji: string;
  adult: boolean;
  hint: string;
  lines: string[];
};

export const LINE_PACKS: LinePack[] = [
  {
    key: "icebreakers",
    label: "Ice breakers",
    emoji: "🧊",
    adult: false,
    hint: "Openers that actually get replies.",
    lines: [
      "Okay, important question first: chai or coffee? This decides everything.",
      "You have one song stuck in your head right now. I need to know what it is.",
      "Describe your day in exactly three emojis. I'll guess the story.",
      "What's the most underrated thing about the city you're in?",
      "If we were in the same room right now, what would we be eating?",
      "Quick — recommend me something. A song, a show, a snack. Anything you love.",
      "What's something tiny that made you smile today?",
      "Two truths and a lie. You first. I'm very good at this. (I'm not.)",
      "What's a skill you have that never comes up in conversation?",
      "Honest scale of 1-10: how's your week actually going?",
      "You get one free flight tomorrow, anywhere. Where are you landing?",
      "What were you like at 12 years old? I feel like that explains everyone."
    ]
  },
  {
    key: "compliments",
    label: "Compliments",
    emoji: "🌷",
    adult: false,
    hint: "Genuine, specific, never sticky.",
    lines: [
      "You have a really easy way of making conversations feel comfortable.",
      "The way you phrased that was genuinely funny. Like, screenshot-funny.",
      "You ask better questions than most people I've talked to here.",
      "I like how you actually listen — it's rarer than it should be.",
      "Your energy on here is so warm. The room is better when you're in it.",
      "You explained that better than the article I read about it.",
      "You've got great taste — that's twice now you've recommended something good.",
      "Talking to you is the least boring part of my day, easily.",
      "You're so quick — I have to bring my A-game in this chat.",
      "Whatever this vibe is that you have, please never lose it."
    ]
  },
  {
    key: "pickup",
    label: "Pick-up lines",
    emoji: "😏",
    adult: false,
    hint: "Cheesy on purpose. Deliver with confidence.",
    lines: [
      "Are you a parking ticket? Because you've got FINE written all over you.",
      "I was going to say something smooth, but you smiled and I forgot it.",
      "On a scale of 1 to America, how free are you this weekend?",
      "Are you Wi-Fi? Because I'm feeling a connection.",
      "Do you believe in love at first chat, or should I message you again?",
      "I'd say God bless you, but it looks like he already did.",
      "Are you made of copper and tellurium? Because you're Cu-Te.",
      "Excuse me, I think you dropped something: my jaw.",
      "If being cute was a crime, you'd be serving a life sentence.",
      "Aapke liye toh main apna last slice of pizza bhi de doon. That's huge.",
      "I'm not a photographer, but I can definitely picture us talking more.",
      "Kya aap Google ho? Kyunki jo dhoond raha tha, mil gaya."
    ]
  },
  {
    key: "date_asks",
    label: "Ask them out",
    emoji: "🗓",
    adult: false,
    hint: "Clear, low-pressure, easy to say no to.",
    lines: [
      "I really enjoy talking to you. Want to do a voice call sometime this week?",
      "Completely fine if not — but would you want to get chai/coffee sometime?",
      "I'm seeing [movie] this weekend. Want to come? Zero pressure either way.",
      "Can I take you to the best street food spot in my city? I have opinions.",
      "Let's play a game: you pick the place, I pick the time. Deal?",
      "Would you be up for a video call? I'd love to put a voice to all this wit.",
      "I keep wanting to tell you things during the day. Maybe we should just meet?",
      "No agenda, just honesty: I'd really like to see you in person sometime.",
      "If I planned something small and fun for Saturday, would you come?"
    ]
  },
  {
    key: "replies",
    label: "Smooth replies",
    emoji: "💬",
    adult: false,
    hint: "For when they say something and you blank.",
    lines: [
      "Okay that's the best thing anyone's said to me all day.",
      "I was NOT ready for that answer. Respect.",
      "Hold on, I need a second. That was smooth.",
      "You can't just say things like that without warning me first.",
      "Noted, filed, and remembered forever.",
      "This is exactly why you're my favourite person on here.",
      "I'm choosing to believe you made that up just to impress me. It worked.",
      "Careful — keep talking like that and I'll actually start liking you.",
      "You get one (1) free pass for that terrible joke because you're cute.",
      "Say less. I'm already convinced."
    ]
  },
  {
    key: "kind_pass",
    label: "Let them down kindly",
    emoji: "🕊",
    adult: false,
    hint: "Honest, gentle, no ghosting needed.",
    lines: [
      "I think you're genuinely lovely, but I'm not feeling a romantic spark. Friends, though? Absolutely.",
      "Thank you for being brave enough to say that. I don't feel the same way, but I really respect you for asking.",
      "I'm not in a place for anything romantic right now — it's about me, not you.",
      "You deserve someone who's all-in, and that's not me. I wanted to be honest instead of distant.",
      "I love talking to you, but I want to be upfront: I see this as friendship.",
      "I'm flattered, truly. My answer is no, but it comes with a lot of warmth.",
      "Can we keep this exactly what it is? Because what it is, is really nice."
    ]
  },
  {
    key: "deep_qs",
    label: "Deep questions",
    emoji: "🌌",
    adult: false,
    hint: "For when small talk runs out and you don't want to stop.",
    lines: [
      "What's something you've changed your mind about in the last year?",
      "When do you feel most like yourself?",
      "What's a memory you'd relive exactly as it happened?",
      "What do you want more of in your life right now?",
      "Who in your life are you most grateful for, and do they know?",
      "What's something you're proud of that you never get to talk about?",
      "If your younger self met you now, what would surprise them most?",
      "What does a perfect ordinary day look like for you? Not vacation — ordinary.",
      "What's the kindest thing a stranger ever did for you?",
      "What's one thing you wish people asked you about?"
    ]
  },
  {
    key: "flirty_18",
    label: "Flirty (18+)",
    emoji: "🔥",
    adult: true,
    hint: "Suggestive, classy, always easy to decline. Consent is the whole game.",
    lines: [
      "I keep rereading your messages and smiling like an idiot. Just so you know the effect you have.",
      "You're dangerously good at this. I came here to chat and now I'm distracted all day.",
      "Tell me to behave and I will. But you'd have to actually mean it.",
      "It should be illegal to be this attractive AND this funny. Pick a lane.",
      "I had a dream about you. I'll tell you the PG version… unless you ask nicely.",
      "Talking to you at midnight is becoming my favourite bad habit.",
      "You + me + a long drive + a playlist we argue about. Tell me that's not a perfect evening.",
      "I'd flirt harder, but I want to hear you say you want me to first.",
      "Fair warning: I'm very good at long, slow conversations. The kind that go somewhere.",
      "Every time you type '…' I lose my mind a little. What are you not saying?",
      "Is it warm in this chat or is it just you?",
      "Come closer. Metaphorically. For now."
    ]
  },
  {
    key: "consent_18",
    label: "Checking in (18+)",
    emoji: "🤝",
    adult: true,
    hint: "How adults actually make a move: by asking.",
    lines: [
      "I'm enjoying where this is going. Are you comfortable if we keep flirting?",
      "Before I say what I'm thinking — are we flirting right now? I'd like to be.",
      "I find you really attractive. Tell me if that's welcome, and tell me if it's not.",
      "We can keep this playful or keep it friendly — your call, no wrong answer.",
      "I'd love to take this conversation somewhere more romantic. How do you feel about that?",
      "If I'm reading this wrong, say the word and I'll dial it back — zero hard feelings.",
      "What's your comfort zone here? I'd rather ask than assume.",
      "You set the pace. I'm just very happy to be in the conversation."
    ]
  }
];

// Canned fallbacks for the AI "spark" generator when OpenAI is not
// configured — one per vibe so the feature still works offline.
export const AI_FALLBACK: Record<string, string> = {
  sweet:
    "I saved your message for later because it made me smile mid-day. That's your superpower, apparently.",
  funny:
    "I was going to play it cool for at least three more days, but you had to go and be interesting.",
  bold: "Here's the truth: you're the conversation I look forward to. What are we doing about that?",
  poetic:
    "Somewhere between your first message and this one, my day got noticeably lighter.",
  spicy:
    "You have my full attention — which is dangerous, because I'm very thorough with things I like."
};
