"use client";

// Karochat — Sex ed Ask-Karo composer (v9 Phase 3).
//
// Posts to /api/sexed/ask. Renders helplines at the top of the answer
// if crisis keywords fired, then the Karo reply. The 13_15 tier hits
// a `blocked: true` path on the server and gets a curated nudge
// toward articles + a helpline list.

import { useState } from "react";
import Link from "next/link";
import { Markdown } from "@/components/Markdown";
import { CrisisHelplineCard } from "../_components/CrisisHelplineCard";

type Helpline = {
  id: string;
  country: string;
  kind: string;
  name: string;
  phone: string | null;
  sms: string | null;
  url: string | null;
  hours: string | null;
  languages: string[] | null;
  notes: string | null;
};

type AskResponse = {
  band: "13_15" | "16_17" | "18plus" | "unset";
  blocked?: boolean;
  reply: string;
  crisis?: { category: string; matched: string }[] | null;
  helplines?: Helpline[];
};

const TOPIC_OPTIONS = [
  ["", "Any topic"],
  ["puberty", "Puberty & bodies"],
  ["consent", "Consent"],
  ["identity", "Identity & orientation"],
  ["safety", "Safety & abuse"],
  ["readiness", "Ready or not"],
  ["contraception", "Contraception"],
  ["sti", "STIs"],
  ["pleasure", "Pleasure & anatomy"],
  ["technique", "Sex technique"],
  ["queer", "LGBTQ-specific"],
  ["kink", "Kink & BDSM"]
] as const;

export function AskFlow({
  band
}: {
  band: "13_15" | "16_17" | "18plus" | "unset";
}) {
  const [question, setQuestion] = useState("");
  const [topic, setTopic] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resp, setResp] = useState<AskResponse | null>(null);

  async function submit() {
    if (!question.trim()) {
      setErr("Type your question first.");
      return;
    }
    setBusy(true);
    setErr(null);
    setResp(null);
    try {
      const r = await fetch("/api/sexed/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.trim(),
          topic: topic || null,
          country: "IN"
        })
      });
      const j = await r.json();
      if (!r.ok) {
        setErr(j?.error ?? "Karo couldn't answer that — try again.");
        return;
      }
      setResp(j as AskResponse);
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setQuestion("");
    setTopic("");
    setResp(null);
    setErr(null);
  }

  return (
    <section className="min-w-0 space-y-4">
      {band === "13_15" && (
        <div className="surface-glass tint-amber p-4 text-[13px] leading-relaxed text-white/80">
          ⚠️ Karo Q&amp;A is only for ages 16 and up. The article
          library has answers written for your age — try{" "}
          <Link
            href="/sexed?topic=puberty"
            className="text-neon-blue underline-offset-2 hover:underline"
          >
            Puberty &amp; bodies
          </Link>
          ,{" "}
          <Link
            href="/sexed?topic=consent"
            className="text-neon-blue underline-offset-2 hover:underline"
          >
            Consent
          </Link>
          , or{" "}
          <Link
            href="/sexed?topic=identity"
            className="text-neon-blue underline-offset-2 hover:underline"
          >
            Identity &amp; orientation
          </Link>
          . If you&apos;re not safe, the helplines on the sidebar are free
          and 24/7.
        </div>
      )}

      <div className="surface-glass p-5">
        <p className="text-[10px] uppercase tracking-widest text-white/45">
          Your question
        </p>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, 1500))}
          rows={5}
          disabled={band === "13_15" || busy}
          placeholder="e.g. how do I tell a partner I haven't had sex before?"
          className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-mint/40 disabled:opacity-60"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/45">
          <span>{question.length} / 1500</span>
          <span>Anonymous — not linked to your account.</span>
        </div>

        <div className="mt-3">
          <label className="block text-[10px] uppercase tracking-widest text-white/45">
            Topic (optional — helps the answer)
          </label>
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={band === "13_15" || busy}
            className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-neon-mint/40 disabled:opacity-60"
          >
            {TOPIC_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {err && (
          <p className="mt-3 rounded-lg border border-neon-red/30 bg-neon-red/10 px-3 py-2 text-[12px] text-neon-red">
            {err}
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={band === "13_15" || busy || !question.trim()}
            className="rounded-xl bg-neon-mint px-4 py-2 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
          >
            {busy ? "Karo is answering…" : "Ask Karo →"}
          </button>
          {resp && (
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/75 hover:bg-white/10"
            >
              Ask another
            </button>
          )}
        </div>
      </div>

      {resp && (
        <>
          {resp.crisis && resp.helplines && resp.helplines.length > 0 && (
            <CrisisHelplineCard helplines={resp.helplines} />
          )}
          <article className="surface-glass tint-mint p-5">
            <p className="text-[10px] uppercase tracking-widest text-neon-mint/80">
              💞 Karo says
            </p>
            <div className="mt-2">
              <Markdown source={resp.reply} />
            </div>
            <p className="mt-4 border-t border-white/10 pt-3 text-[11px] text-white/45">
              {resp.blocked
                ? "Karo can't take open-ended questions from this age tier. Try the article library."
                : "Karo is an AI educator, not a doctor. For pain, infection, bleeding, pregnancy, or medication, see a clinician."}
            </p>
          </article>
        </>
      )}
    </section>
  );
}
