"use client";

// Karochat — Trivia Quiz. Free, fun, worldwide questions from the Open Trivia
// Database (opentdb.com — free, key-less, CORS). Pick a category & difficulty,
// answer 10 questions, get your score. Fails gracefully if the API is busy.

import { useState } from "react";

type Q = { question: string; correct: string; options: string[]; category: string };

const CATEGORIES: [string, string][] = [
  ["0", "Any category"],
  ["9", "General Knowledge"],
  ["17", "Science & Nature"],
  ["18", "Computers"],
  ["19", "Mathematics"],
  ["22", "Geography"],
  ["23", "History"],
  ["21", "Sports"],
  ["11", "Film"],
  ["12", "Music"],
  ["15", "Video Games"],
  ["27", "Animals"],
  ["31", "Anime & Manga"]
];
const DIFFS: [string, string][] = [["", "Any"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];

function decode(s: string): string {
  if (typeof document === "undefined") return s;
  const t = document.createElement("textarea");
  t.innerHTML = s;
  return t.value;
}
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

type Phase = "setup" | "loading" | "playing" | "done";

export function QuizClient() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [cat, setCat] = useState("0");
  const [diff, setDiff] = useState("");
  const [questions, setQuestions] = useState<Q[]>([]);
  const [idx, setIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    setPhase("loading");
    setErr(null);
    try {
      const params = new URLSearchParams({ amount: "10", type: "multiple" });
      if (cat !== "0") params.set("category", cat);
      if (diff) params.set("difficulty", diff);
      const r = await fetch(`https://opentdb.com/api.php?${params.toString()}`);
      const j = (await r.json()) as any;
      if (j?.response_code !== 0 || !Array.isArray(j.results) || !j.results.length) {
        throw new Error("Couldn't load questions — try again or pick another category.");
      }
      const qs: Q[] = j.results.map((row: any) => ({
        question: decode(String(row.question)),
        correct: decode(String(row.correct_answer)),
        category: decode(String(row.category ?? "")),
        options: shuffle([row.correct_answer, ...(row.incorrect_answers ?? [])].map((x: any) => decode(String(x))))
      }));
      setQuestions(qs);
      setIdx(0);
      setScore(0);
      setPicked(null);
      setPhase("playing");
    } catch (e: any) {
      setErr(e?.message ?? "Couldn't start the quiz.");
      setPhase("setup");
    }
  }

  function answer(opt: string) {
    if (picked) return;
    setPicked(opt);
    if (opt === questions[idx]?.correct) setScore((s) => s + 1);
  }
  function next() {
    if (idx + 1 >= questions.length) setPhase("done");
    else {
      setIdx((i) => i + 1);
      setPicked(null);
    }
  }

  const q = questions[idx];

  return (
    <div className="space-y-5">
      <section className="surface-glass tint-purple p-5">
        <h1 className="font-display text-xl font-semibold">🧠 Trivia Quiz</h1>
        <p className="mt-1 text-sm text-white/60">
          Test your knowledge with fresh questions from around the world. Pick a
          topic, answer 10, and beat your best score.
        </p>
      </section>

      {phase === "setup" && (
        <section className="surface-glass p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-sm text-white/70">
              Category
              <select value={cat} onChange={(e) => setCat(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60">
                {CATEGORIES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm text-white/70">
              Difficulty
              <select value={diff} onChange={(e) => setDiff(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60">
                {DIFFS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </label>
          </div>
          <button type="button" onClick={() => void start()} className="mt-3 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-5 py-2 text-sm font-medium text-white hover:bg-neon-purple/30">
            ▶ Start quiz
          </button>
          {err && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>}
        </section>
      )}

      {phase === "loading" && (
        <section className="surface-glass p-6 text-center text-sm text-white/50">
          <span className="mr-2 animate-pulseDot">●</span>Loading questions…
        </section>
      )}

      {phase === "playing" && q && (
        <section className="surface-glass p-4">
          <div className="mb-2 flex items-center justify-between text-[11px] text-white/45">
            <span>Question {idx + 1} / {questions.length}</span>
            <span>Score: {score}</span>
          </div>
          <p className="text-[11px] uppercase tracking-widest text-neon-purple">{q.category}</p>
          <p className="mt-1 text-base font-medium text-white">{q.question}</p>
          <ul className="mt-3 space-y-2">
            {q.options.map((opt) => {
              const isCorrect = opt === q.correct;
              const isPicked = opt === picked;
              const show = picked != null;
              const cls = !show
                ? "border-white/10 bg-black/20 hover:border-neon-purple/40 hover:bg-white/5"
                : isCorrect
                ? "border-neon-mint/50 bg-neon-mint/15 text-neon-mint"
                : isPicked
                ? "border-neon-red/50 bg-neon-red/15 text-neon-red"
                : "border-white/10 bg-black/10 opacity-60";
              return (
                <li key={opt}>
                  <button type="button" onClick={() => answer(opt)} disabled={show} className={"w-full rounded-xl border px-3 py-2.5 text-left text-sm text-white/90 transition " + cls}>
                    {opt} {show && isCorrect ? "✓" : show && isPicked ? "✕" : ""}
                  </button>
                </li>
              );
            })}
          </ul>
          {picked != null && (
            <button type="button" onClick={next} className="mt-3 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-5 py-2 text-sm font-medium text-white hover:bg-neon-purple/30">
              {idx + 1 >= questions.length ? "See results →" : "Next →"}
            </button>
          )}
        </section>
      )}

      {phase === "done" && (
        <section className="surface-glass p-6 text-center">
          <p className="font-display text-2xl font-semibold text-white">
            {score} / {questions.length}
          </p>
          <p className="mt-1 text-sm text-white/60">
            {score === questions.length ? "Perfect! 🏆" : score >= questions.length * 0.7 ? "Great job! 🎉" : score >= questions.length * 0.4 ? "Not bad! 👍" : "Keep practising! 🌱"}
          </p>
          <button type="button" onClick={() => setPhase("setup")} className="mt-4 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-5 py-2 text-sm font-medium text-white hover:bg-neon-purple/30">
            Play again
          </button>
        </section>
      )}

      <p className="px-1 text-[10px] text-white/35">Questions from the Open Trivia Database (opentdb.com), a free community project.</p>
    </div>
  );
}
