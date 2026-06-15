"use client";

// Karochat — Fun hub: quick browser games, icebreakers and daily inspiration.
// All client-side, no backend. Anchored sections (#games / #icebreakers / #inspire).

import { useMemo, useState } from "react";

export function FunHub() {
  return (
    <div className="space-y-5">
      <section className="surface-glass tint-purple p-5">
        <h1 className="font-display text-xl font-semibold">🎲 Fun &amp; Games</h1>
        <p className="mt-1 text-sm text-white/60">
          Quick games to pass the time, icebreakers to spark a chat, and a little
          daily inspiration. No score-keeping pressure — just fun.
        </p>
      </section>

      <section id="games" className="scroll-mt-20 space-y-4">
        <h2 className="px-1 font-display text-lg font-semibold">🎮 Games</h2>
        <TicTacToe />
        <RockPaperScissors />
        <ReactionGame />
      </section>

      <section id="icebreakers" className="scroll-mt-20">
        <Icebreakers />
      </section>

      <section id="inspire" className="scroll-mt-20">
        <Inspire />
      </section>
    </div>
  );
}

// ── Tic-Tac-Toe vs a simple AI ───────────────────────────────────────────────
const LINES: [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
];
type Cell = "X" | "O" | null;
function winner(b: Cell[]): Cell | "draw" | null {
  for (const [a, c, d] of LINES) {
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return b[a]!;
  }
  return b.every(Boolean) ? "draw" : null;
}
function aiMove(b: Cell[]): number {
  const empty = b.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  // win, then block, then center, then corner, then random.
  for (const mark of ["O", "X"] as const) {
    for (const i of empty) {
      const copy = b.slice();
      copy[i] = mark;
      if (winner(copy) === mark) return i;
    }
  }
  if (b[4] === null) return 4;
  const corners = [0, 2, 6, 8].filter((i) => b[i] === null);
  if (corners.length) return corners[Math.floor(Math.random() * corners.length)] ?? corners[0]!;
  return empty[Math.floor(Math.random() * empty.length)] ?? empty[0]!;
}

function TicTacToe() {
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const result = winner(board);

  function play(i: number) {
    if (board[i] || result) return;
    const next = board.slice();
    next[i] = "X";
    const w = winner(next);
    if (!w) {
      const m = aiMove(next);
      next[m] = "O";
    }
    setBoard(next);
  }
  function reset() {
    setBoard(Array(9).fill(null));
  }

  return (
    <div className="surface-glass p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-white">Tic-Tac-Toe</p>
        <button type="button" onClick={reset} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10">
          New game
        </button>
      </div>
      <div className="mx-auto grid w-44 grid-cols-3 gap-1.5">
        {board.map((c, i) => (
          <button
            key={i}
            type="button"
            onClick={() => play(i)}
            className="grid aspect-square place-items-center rounded-lg border border-white/10 bg-black/30 text-2xl font-bold text-white hover:bg-white/5"
          >
            <span className={c === "X" ? "text-neon-blue" : "text-neon-red"}>{c}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-center text-sm text-white/70">
        {result === "X" ? "🎉 You win!" : result === "O" ? "🤖 AI wins — try again!" : result === "draw" ? "🤝 Draw!" : "You’re X — your move."}
      </p>
    </div>
  );
}

// ── Rock-Paper-Scissors ──────────────────────────────────────────────────────
const RPS = [
  { k: "rock", e: "🪨" },
  { k: "paper", e: "📄" },
  { k: "scissors", e: "✂️" }
];
function RockPaperScissors() {
  const [you, setYou] = useState<string | null>(null);
  const [ai, setAi] = useState<string | null>(null);
  const [msg, setMsg] = useState("Pick one!");
  const [score, setScore] = useState({ w: 0, l: 0, d: 0 });

  function play(k: string) {
    const a = RPS[Math.floor(Math.random() * 3)]?.k ?? "rock";
    setYou(k);
    setAi(a);
    let r: "w" | "l" | "d";
    if (k === a) r = "d";
    else if ((k === "rock" && a === "scissors") || (k === "paper" && a === "rock") || (k === "scissors" && a === "paper")) r = "w";
    else r = "l";
    setMsg(r === "w" ? "You win! 🎉" : r === "l" ? "AI wins 🤖" : "Draw 🤝");
    setScore((s) => ({ ...s, [r]: s[r] + 1 }));
  }

  const emo = (k: string | null) => RPS.find((x) => x.k === k)?.e ?? "❔";

  return (
    <div className="surface-glass p-4">
      <p className="text-sm font-medium text-white">Rock · Paper · Scissors</p>
      <div className="mt-2 flex gap-2">
        {RPS.map((r) => (
          <button
            key={r.k}
            type="button"
            onClick={() => play(r.k)}
            className="grid h-12 flex-1 place-items-center rounded-xl border border-white/10 bg-black/30 text-2xl hover:bg-white/5"
          >
            {r.e}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-4 text-2xl">
        <span>{emo(you)}</span>
        <span className="text-sm text-white/45">vs</span>
        <span>{emo(ai)}</span>
      </div>
      <p className="mt-1 text-center text-sm text-white/80">{msg}</p>
      <p className="text-center text-[11px] text-white/40">
        Won {score.w} · Lost {score.l} · Draw {score.d}
      </p>
    </div>
  );
}

// ── Reaction time game ───────────────────────────────────────────────────────
function ReactionGame() {
  const [state, setState] = useState<"idle" | "waiting" | "go" | "done" | "tooSoon">("idle");
  const [ms, setMs] = useState<number | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [startAt, setStartAt] = useState(0);
  const [to, setTo] = useState<ReturnType<typeof setTimeout> | null>(null);

  function begin() {
    setState("waiting");
    setMs(null);
    const delay = 1200 + Math.floor(Math.random() * 2500);
    const t = setTimeout(() => {
      setStartAt(performance.now());
      setState("go");
    }, delay);
    setTo(t);
  }
  function click() {
    if (state === "waiting") {
      if (to) clearTimeout(to);
      setState("tooSoon");
      return;
    }
    if (state === "go") {
      const took = Math.round(performance.now() - startAt);
      setMs(took);
      setBest((b) => (b == null ? took : Math.min(b, took)));
      setState("done");
      return;
    }
    begin();
  }

  const label =
    state === "idle" ? "Tap to start" :
    state === "waiting" ? "Wait for green…" :
    state === "go" ? "TAP NOW!" :
    state === "tooSoon" ? "Too soon! Tap to retry" :
    `${ms} ms — tap to retry`;
  const bg =
    state === "go" ? "bg-neon-mint/25 border-neon-mint/50" :
    state === "waiting" ? "bg-neon-red/15 border-neon-red/40" :
    "bg-black/30 border-white/10";

  return (
    <div className="surface-glass p-4">
      <p className="text-sm font-medium text-white">Reaction time</p>
      <button
        type="button"
        onClick={click}
        className={"mt-2 grid h-24 w-full place-items-center rounded-xl border text-lg font-semibold text-white transition " + bg}
      >
        {label}
      </button>
      {best != null && <p className="mt-1 text-center text-[11px] text-neon-mint">Best: {best} ms ⚡</p>}
    </div>
  );
}

// ── Icebreakers ──────────────────────────────────────────────────────────────
const ICEBREAKERS = [
  "What’s a small thing that made you smile today?",
  "If you could teleport anywhere right now, where would you go?",
  "What song is stuck in your head lately?",
  "Tea or coffee — and how do you take it?",
  "What’s a skill you’d love to learn?",
  "Beach holiday or mountain getaway?",
  "What’s the best meal you’ve had this month?",
  "If you had an extra hour every day, how would you spend it?",
  "What’s a movie or show you could watch again and again?",
  "Cats, dogs, or something more exotic?",
  "What’s your go-to comfort food?",
  "Would you rather explore space or the deep ocean?",
  "What’s one thing on your bucket list?",
  "Early bird or night owl?",
  "What’s the kindest thing someone did for you recently?",
  "If your life had a theme song, what would it be?",
  "What language would you love to speak fluently?",
  "Sweet or savoury snacks?",
  "What’s a hobby you’ve picked up recently?",
  "If you could have dinner with anyone, who would it be?"
];
const QUOTES = [
  "“The best time to plant a tree was 20 years ago. The second best time is now.”",
  "“You are allowed to be both a masterpiece and a work in progress.”",
  "“Little by little, one travels far.”",
  "“What you do every day matters more than what you do once in a while.”",
  "“Be the reason someone believes in good people.”",
  "“Start where you are. Use what you have. Do what you can.”",
  "“Almost everything will work again if you unplug it for a few minutes — including you.”",
  "“Difficult roads often lead to beautiful destinations.”",
  "“You don’t have to be great to start, but you have to start to be great.”",
  "“A small step today is still a step forward.”",
  "“Be kind, for everyone you meet is fighting a battle you know nothing about.”",
  "“Your only limit is the amount of action you take.”",
  "“Rest if you must, but don’t you quit.”",
  "“The world is full of nice people. If you can’t find one, be one.”",
  "“Progress, not perfection.”"
];

function ShuffleCard({ title, emoji, items }: { title: string; emoji: string; items: string[] }) {
  const [i, setI] = useState(0);
  const order = useMemo(() => items.map((_, idx) => idx), [items]);
  function next() {
    setI((v) => (v + 1) % order.length);
  }
  const text = items[order[i] ?? 0] ?? "";
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }
  return (
    <div className="surface-glass p-4">
      <p className="text-sm font-medium text-white">{emoji} {title}</p>
      <div className="mt-3 min-h-[64px] rounded-xl border border-white/10 bg-black/20 px-4 py-4 text-center text-base text-white/90">
        {text}
      </div>
      <div className="mt-2 flex justify-center gap-2">
        <button type="button" onClick={next} className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-4 py-2 text-sm font-medium text-white hover:bg-neon-purple/30">
          🔀 Next
        </button>
        <button type="button" onClick={() => void copy()} className="rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white/80 hover:bg-white/10">
          Copy
        </button>
      </div>
    </div>
  );
}

function Icebreakers() {
  return <ShuffleCard title="Icebreakers" emoji="💬" items={ICEBREAKERS} />;
}
function Inspire() {
  return <ShuffleCard title="Daily inspiration" emoji="✨" items={QUOTES} />;
}
