"use client";

// Karochat — Personal Organizer. Your own AI assistant + productivity suite:
//   • Assistant — AI chat (voice in & spoken replies), recipes, planning, drafts.
//   • Tasks     — to-do list with due dates & priority.
//   • Schedule  — events / reminders / meetings / forward planning (with times).
//   • Notes     — quick notes.
//   • Alarm & Timer — client-side alarm + countdown/sleep timer (beeps + notifies).
//   • Files & Scan — private file vault for later download + a camera scanner.
//
// Tasks/Schedule/Notes persist in organizer_items (owner-only RLS, migration
// 0097). Files reuse the existing private shared_files store. The assistant uses
// the standalone /api/ai/assistant route. Everything degrades gracefully.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ContentDisclaimer } from "@/components/ContentDisclaimer";

type Kind = "task" | "event" | "note";
type Item = {
  id: string;
  kind: Kind;
  title: string;
  body: string | null;
  due_at: string | null;
  done: boolean;
  priority: "low" | "normal" | "high" | null;
  created_at: string;
};
type Tab = "assistant" | "tasks" | "schedule" | "notes" | "alarm" | "files";

const TABS: [Tab, string][] = [
  ["assistant", "🤖 Assistant"],
  ["tasks", "✅ Tasks"],
  ["schedule", "📅 Schedule"],
  ["notes", "📝 Notes"],
  ["alarm", "⏰ Alarm & Timer"],
  ["files", "📁 Files & Scan"]
];

function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}
function fmtSize(b: number | null): string {
  if (!b || b <= 0) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

// Short Web-Audio beep used by alarm/timer.
function beep(times = 3) {
  try {
    const AC: typeof AudioContext =
      window.AudioContext ?? (window as any).webkitAudioContext;
    const ctx = new AC();
    let t = ctx.currentTime;
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.4, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      o.start(t);
      o.stop(t + 0.4);
      t += 0.5;
    }
    setTimeout(() => void ctx.close().catch(() => {}), (times + 1) * 600);
  } catch {
    // ignore
  }
}
function notify(title: string, bodyText: string) {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body: bodyText });
    }
  } catch {
    // ignore
  }
}

export function OrganizerHub({ userId, userName }: { userId: string; userName: string }) {
  const [tab, setTab] = useState<Tab>("assistant");
  return (
    <div className="space-y-5">
      <section className="surface-glass tint-purple p-5">
        <h1 className="font-display text-xl font-semibold">🗂️ Personal Organizer</h1>
        <p className="mt-1 text-sm text-white/60">
          Your own AI assistant &amp; secretary — plan, schedule, remind, organise,
          cook, draft, store files and more. Everything here is private to you.
        </p>
      </section>

      <div className="surface-glass p-2">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition " +
                (tab === key
                  ? "bg-neon-purple/25 text-white"
                  : "text-white/55 hover:bg-white/5 hover:text-white")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "assistant" && <AssistantTab userName={userName} />}
      {tab === "tasks" && <TasksTab userId={userId} />}
      {tab === "schedule" && <ScheduleTab userId={userId} />}
      {tab === "notes" && <NotesTab userId={userId} />}
      {tab === "alarm" && <AlarmTimerTab />}
      {tab === "files" && <FilesScanTab userId={userId} />}

      <ContentDisclaimer scope="assistant" />
    </div>
  );
}

// ── Assistant ────────────────────────────────────────────────────────────────
type ChatMsg = { role: "user" | "assistant"; content: string };
const QUICK = [
  "Plan my day",
  "Give me a quick dinner recipe",
  "Draft a polite message to reschedule a meeting",
  "Make me a 5-item shopping list for breakfast",
  "Summarise this: "
];

function AssistantTab({ userName }: { userName: string }) {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content: `Hi ${userName}! I'm your personal assistant. Ask me to plan, remind, draft, cook, calculate or organise — anything. Tip: save reminders & to-dos in the Tasks and Schedule tabs.`
    }
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const speakOut = useCallback((text: string) => {
    try {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      window.speechSynthesis.speak(u);
    } catch {
      // ignore
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || sending) return;
      setErr(null);
      const next = [...messages, { role: "user" as const, content: prompt }];
      setMessages(next);
      setInput("");
      setSending(true);
      try {
        const res = await fetch("/api/ai/assistant", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: next.slice(-16) })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(
            data?.error === "ai-not-configured"
              ? "The assistant isn't available right now."
              : data?.error ?? "Something went wrong."
          );
        }
        const reply = (data.reply ?? "").trim() || "(no reply)";
        setMessages((m) => [...m, { role: "assistant", content: reply }]);
        if (speak) speakOut(reply);
      } catch (e: any) {
        setErr(e?.message ?? "Couldn't reach the assistant.");
      } finally {
        setSending(false);
      }
    },
    [messages, sending, speak, speakOut]
  );

  function toggleMic() {
    const SR: any =
      (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) ||
      null;
    if (!SR) {
      setErr("Voice input isn't supported in this browser.");
      return;
    }
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {
        // ignore
      }
      setListening(false);
      return;
    }
    try {
      const r = new SR();
      r.lang = "en-US";
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (ev: any) => {
        const t = ev?.results?.[0]?.[0]?.transcript ?? "";
        if (t) setInput((prev) => (prev ? prev + " " : "") + t);
      };
      r.onend = () => setListening(false);
      r.onerror = () => setListening(false);
      recRef.current = r;
      r.start();
      setListening(true);
    } catch {
      setListening(false);
      setErr("Couldn't start the microphone.");
    }
  }

  return (
    <section className="surface-glass p-4">
      <div
        ref={scrollRef}
        className="max-h-[52vh] min-h-[200px] space-y-2 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3"
      >
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm " +
                (m.role === "user"
                  ? "bg-neon-purple/25 text-white"
                  : "border border-white/10 bg-white/5 text-white/90")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && <p className="text-xs text-white/45">Karo is thinking…</p>}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => (q.endsWith(": ") ? setInput(q) : void send(q))}
            className="rounded-lg border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] text-white/75 hover:bg-white/5"
          >
            {q.trim()}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-end gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={2}
          placeholder="Ask your assistant anything…"
          className="min-w-0 flex-1 resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
        />
        <button
          type="button"
          onClick={toggleMic}
          title="Voice input"
          className={
            "shrink-0 rounded-xl border px-3 py-2 text-sm transition " +
            (listening
              ? "border-neon-red/50 bg-neon-red/15 text-neon-red"
              : "border-white/15 bg-white/5 text-white/80 hover:bg-white/10")
          }
        >
          {listening ? "●" : "🎤"}
        </button>
        <button
          type="button"
          onClick={() => void send(input)}
          disabled={sending || !input.trim()}
          className="shrink-0 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-neon-purple/30 disabled:opacity-50"
        >
          Send
        </button>
      </div>
      <label className="mt-2 flex items-center gap-1.5 text-[11px] text-white/55">
        <input type="checkbox" checked={speak} onChange={(e) => setSpeak(e.target.checked)} className="accent-neon-purple" />
        🔊 Speak replies aloud
      </label>
      {err && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>}
    </section>
  );
}

// ── Items helper hook (tasks / events / notes) ───────────────────────────────
function useItems(userId: string, kind: Kind) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const order = kind === "event" ? "due_at" : "created_at";
    const { data, error: e } = await supabase
      .from("organizer_items")
      .select("id, kind, title, body, due_at, done, priority, created_at")
      .eq("owner_id", userId)
      .eq("kind", kind)
      .order(order, { ascending: kind === "event", nullsFirst: false })
      .limit(200);
    if (e) setError(e.message);
    else setItems((data ?? []) as Item[]);
    setLoading(false);
  }, [supabase, userId, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(
    async (row: Partial<Item>) => {
      const { error: e } = await supabase.from("organizer_items").insert({
        owner_id: userId,
        kind,
        title: row.title,
        body: row.body ?? null,
        due_at: row.due_at ?? null,
        priority: row.priority ?? null
      });
      if (e) {
        setError(e.message);
        return false;
      }
      await load();
      return true;
    },
    [supabase, userId, kind, load]
  );

  const update = useCallback(
    async (id: string, patch: Partial<Item>) => {
      await supabase.from("organizer_items").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
      await load();
    },
    [supabase, load]
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("organizer_items").delete().eq("id", id);
      await load();
    },
    [supabase, load]
  );

  return { items, loading, error, add, update, remove };
}

// ── Tasks ────────────────────────────────────────────────────────────────────
function TasksTab({ userId }: { userId: string }) {
  const { items, loading, add, update, remove } = useItems(userId, "task");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high">("normal");

  async function onAdd() {
    if (!title.trim()) return;
    const ok = await add({
      title: title.trim(),
      due_at: due ? new Date(due).toISOString() : null,
      priority
    });
    if (ok) {
      setTitle("");
      setDue("");
      setPriority("normal");
    }
  }

  const sorted = useMemo(
    () => [...items].sort((a, b) => Number(a.done) - Number(b.done)),
    [items]
  );

  return (
    <section className="surface-glass p-4">
      <p className="text-sm font-medium text-white">Add a task</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void onAdd()}
          placeholder="What needs doing?"
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
        />
        <div className="flex gap-2">
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as "low" | "normal" | "high")}
            className="rounded-xl border border-white/10 bg-black/40 px-2 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void onAdd()}
        disabled={!title.trim()}
        className="mt-2 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white hover:bg-neon-purple/30 disabled:opacity-50"
      >
        ➕ Add task
      </button>

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="text-sm text-white/45">Loading…</li>
        ) : sorted.length === 0 ? (
          <li className="py-4 text-center text-sm text-white/45">No tasks yet.</li>
        ) : (
          sorted.map((t) => (
            <li
              key={t.id}
              className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => void update(t.id, { done: !t.done })}
                className="mt-1 accent-neon-mint"
              />
              <div className="min-w-0 flex-1">
                <p className={"text-sm " + (t.done ? "text-white/40 line-through" : "text-white/90")}>
                  {t.title}
                </p>
                <p className="text-[11px] text-white/40">
                  {[
                    t.priority && t.priority !== "normal" ? `${t.priority} priority` : "",
                    t.due_at ? `due ${fmtWhen(t.due_at)}` : ""
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(t.id)}
                className="shrink-0 text-white/30 hover:text-neon-red"
                aria-label="Delete"
              >
                ✕
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

// ── Schedule (events / reminders / meetings) ─────────────────────────────────
function ScheduleTab({ userId }: { userId: string }) {
  const { items, loading, add, remove } = useItems(userId, "event");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [body, setBody] = useState("");

  async function onAdd() {
    if (!title.trim() || !when) return;
    const ok = await add({ title: title.trim(), due_at: new Date(when).toISOString(), body: body.trim() || null });
    if (ok) {
      setTitle("");
      setWhen("");
      setBody("");
    }
  }

  const now = Date.now();
  return (
    <section className="surface-glass p-4">
      <p className="text-sm font-medium text-white">Schedule an event / reminder / meeting</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Dentist, Team call)"
          className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
        />
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60"
        />
      </div>
      <input
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Notes / location / link (optional)"
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
      />
      <button
        type="button"
        onClick={() => void onAdd()}
        disabled={!title.trim() || !when}
        className="mt-2 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white hover:bg-neon-purple/30 disabled:opacity-50"
      >
        ➕ Add to schedule
      </button>

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="text-sm text-white/45">Loading…</li>
        ) : items.length === 0 ? (
          <li className="py-4 text-center text-sm text-white/45">Nothing scheduled yet.</li>
        ) : (
          items.map((ev) => {
            const past = ev.due_at ? new Date(ev.due_at).getTime() < now : false;
            return (
              <li
                key={ev.id}
                className={
                  "flex items-start gap-2 rounded-xl border px-3 py-2 " +
                  (past ? "border-white/10 bg-black/10 opacity-60" : "border-white/10 bg-black/20")
                }
              >
                <span className="mt-0.5 text-lg">{past ? "✔️" : "📅"}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/90">{ev.title}</p>
                  <p className="text-[11px] text-neon-blue">{fmtWhen(ev.due_at)}</p>
                  {ev.body && <p className="text-[11px] text-white/50">{ev.body}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => void remove(ev.id)}
                  className="shrink-0 text-white/30 hover:text-neon-red"
                  aria-label="Delete"
                >
                  ✕
                </button>
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}

// ── Notes ────────────────────────────────────────────────────────────────────
function NotesTab({ userId }: { userId: string }) {
  const { items, loading, add, remove } = useItems(userId, "note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  async function onAdd() {
    if (!title.trim() && !body.trim()) return;
    const ok = await add({ title: title.trim() || "Note", body: body.trim() || null });
    if (ok) {
      setTitle("");
      setBody("");
    }
  }

  return (
    <section className="surface-glass p-4">
      <p className="text-sm font-medium text-white">Quick note</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        placeholder="Write it down…"
        className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-white/30 focus:border-neon-purple/60"
      />
      <button
        type="button"
        onClick={() => void onAdd()}
        className="mt-2 rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white hover:bg-neon-purple/30"
      >
        ➕ Save note
      </button>

      <ul className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {loading ? (
          <li className="text-sm text-white/45">Loading…</li>
        ) : items.length === 0 ? (
          <li className="py-4 text-center text-sm text-white/45">No notes yet.</li>
        ) : (
          items.map((n) => (
            <li key={n.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium text-white">{n.title}</p>
                <button
                  type="button"
                  onClick={() => void remove(n.id)}
                  className="shrink-0 text-white/30 hover:text-neon-red"
                  aria-label="Delete"
                >
                  ✕
                </button>
              </div>
              {n.body && <p className="mt-1 whitespace-pre-wrap text-[12px] text-white/65">{n.body}</p>}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

// ── Alarm & Timer (client-side) ──────────────────────────────────────────────
function AlarmTimerTab() {
  const [alarmTime, setAlarmTime] = useState("");
  const [alarmSet, setAlarmSet] = useState<string | null>(null);
  const [timerMin, setTimerMin] = useState(10);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [fired, setFired] = useState<string | null>(null);
  const alarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const endRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (alarmTimer.current) clearTimeout(alarmTimer.current);
    };
  }, []);

  async function ensureNotify() {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        await Notification.requestPermission();
      }
    } catch {
      // ignore
    }
  }

  async function setAlarm() {
    if (!alarmTime) return;
    await ensureNotify();
    const [h, m] = alarmTime.split(":").map(Number);
    const now = new Date();
    const target = new Date();
    target.setHours(h ?? 0, m ?? 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    const ms = target.getTime() - now.getTime();
    if (alarmTimer.current) clearTimeout(alarmTimer.current);
    alarmTimer.current = setTimeout(() => {
      beep(5);
      notify("⏰ Alarm", `It's ${alarmTime}`);
      setFired(`⏰ Alarm! ${alarmTime}`);
      setAlarmSet(null);
    }, ms);
    setAlarmSet(target.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" }));
    setFired(null);
  }
  function clearAlarm() {
    if (alarmTimer.current) clearTimeout(alarmTimer.current);
    alarmTimer.current = null;
    setAlarmSet(null);
  }

  // Countdown timer
  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      const left = (endRef.current ?? 0) - Date.now();
      if (left <= 0) {
        endRef.current = null;
        setRunning(false);
        setRemaining(null);
        beep(5);
        notify("⏳ Timer done", "Your timer finished.");
        setFired("⏳ Timer finished!");
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(iv);
  }, [running]);

  async function startTimer() {
    await ensureNotify();
    endRef.current = Date.now() + timerMin * 60_000;
    setRemaining(timerMin * 60_000);
    setRunning(true);
    setFired(null);
  }
  function stopTimer() {
    endRef.current = null;
    setRunning(false);
    setRemaining(null);
  }

  const remMin = remaining != null ? Math.floor(remaining / 60000) : 0;
  const remSec = remaining != null ? Math.floor((remaining % 60000) / 1000) : 0;

  return (
    <section className="surface-glass space-y-4 p-4">
      {fired && (
        <div className="rounded-xl border border-neon-mint/40 bg-neon-mint/10 px-3 py-2 text-sm text-neon-mint">
          {fired}{" "}
          <button type="button" onClick={() => setFired(null)} className="ml-2 text-white/60 hover:text-white">
            dismiss
          </button>
        </div>
      )}

      {/* Alarm */}
      <div>
        <p className="text-sm font-medium text-white">⏰ Alarm</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="time"
            value={alarmTime}
            onChange={(e) => setAlarmTime(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60"
          />
          {alarmSet ? (
            <button type="button" onClick={clearAlarm} className="rounded-xl border border-neon-red/40 bg-neon-red/15 px-3 py-2 text-sm text-neon-red">
              ■ Cancel ({alarmSet})
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void setAlarm()}
              disabled={!alarmTime}
              className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white hover:bg-neon-purple/30 disabled:opacity-50"
            >
              Set alarm
            </button>
          )}
        </div>
      </div>

      {/* Timer */}
      <div className="border-t border-white/10 pt-4">
        <p className="text-sm font-medium text-white">⏳ Countdown / sleep timer</p>
        {remaining == null ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={1440}
              value={timerMin}
              onChange={(e) => setTimerMin(Math.max(1, Number(e.target.value) || 1))}
              className="w-24 rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/85 outline-none focus:border-neon-purple/60"
            />
            <span className="text-sm text-white/55">minutes</span>
            <button
              type="button"
              onClick={() => void startTimer()}
              className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white hover:bg-neon-purple/30"
            >
              ▶ Start
            </button>
            <div className="flex gap-1.5">
              {[5, 10, 15, 30].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTimerMin(m)}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10"
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-3">
            <span className="font-display text-3xl font-bold tabular-nums text-white">
              {remMin}:{remSec < 10 ? "0" : ""}
              {remSec}
            </span>
            <button type="button" onClick={stopTimer} className="rounded-xl border border-neon-red/40 bg-neon-red/15 px-3 py-2 text-sm text-neon-red">
              ■ Stop
            </button>
          </div>
        )}
      </div>
      <p className="text-[10px] text-white/35">
        Alarms &amp; timers run in this browser tab — keep it open and your device
        awake. Allow notifications for an alert.
      </p>
    </section>
  );
}

// ── Files & Scan (private vault) ─────────────────────────────────────────────
type StoredFile = {
  id: string;
  title: string;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  file_mime: string | null;
  created_at: string;
};

function FilesScanTab({ userId }: { userId: string }) {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [files, setFiles] = useState<StoredFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: e } = await supabase
      .from("shared_files")
      .select("id, title, file_url, file_name, file_size, file_mime, created_at")
      .eq("owner_id", userId)
      .eq("is_public", false)
      .order("created_at", { ascending: false })
      .limit(100);
    if (e) setErr(e.message);
    else setFiles((data ?? []) as StoredFile[]);
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    void load();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [load]);

  async function saveBlob(blob: Blob, name: string, mime: string) {
    if (blob.size > 500 * 1024 * 1024) {
      setErr("File is over 500 MB.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const safe = name.replace(/[^\w.\-]+/g, "_").slice(-80) || "file";
      const path = `${userId}/${crypto.randomUUID()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("shared-files")
        .upload(path, blob, { contentType: mime || "application/octet-stream", upsert: false });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("shared-files").getPublicUrl(path);
      const { error: insErr } = await supabase.from("shared_files").insert({
        owner_id: userId,
        title: name,
        category: "Personal",
        file_url: pub.publicUrl,
        file_name: name,
        file_size: blob.size,
        file_mime: mime || null,
        is_public: false
      });
      if (insErr) throw insErr;
      await load();
    } catch (e: any) {
      setErr(e?.message ?? "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) await saveBlob(f, f.name, f.type);
  }

  async function startCam() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCamOn(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setErr("Couldn't open the camera. Allow camera access to scan.");
    }
  }
  function stopCam() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }
  async function capture() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 1280;
    canvas.height = v.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob((b) => r(b), "image/png", 0.95));
    if (blob) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      await saveBlob(blob, `scan-${stamp}.png`, "image/png");
    }
  }

  function download(f: StoredFile) {
    const sep = f.file_url.includes("?") ? "&" : "?";
    const a = document.createElement("a");
    a.href = `${f.file_url}${sep}download=${encodeURIComponent(f.file_name || f.title)}`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <section className="surface-glass p-4">
      <p className="text-sm font-medium text-white">📁 Private file vault</p>
      <p className="mt-0.5 text-[11px] text-white/50">
        Store files just for you, to download later. Or scan a document with your
        camera. Only you can see these.
      </p>

      <input ref={fileRef} type="file" className="hidden" onChange={onPick} />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-xl border border-neon-purple/50 bg-neon-purple/20 px-3 py-2 text-sm font-medium text-white hover:bg-neon-purple/30 disabled:opacity-50"
        >
          {busy ? "Working…" : "📎 Upload file"}
        </button>
        {!camOn ? (
          <button
            type="button"
            onClick={() => void startCam()}
            className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/85 hover:bg-white/10"
          >
            📷 Scan with camera
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void capture()}
              disabled={busy}
              className="rounded-xl border border-neon-mint/50 bg-neon-mint/15 px-3 py-2 text-sm font-medium text-neon-mint hover:bg-neon-mint/25 disabled:opacity-50"
            >
              ⬤ Capture
            </button>
            <button type="button" onClick={stopCam} className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white/80 hover:bg-white/10">
              ✕ Close camera
            </button>
          </>
        )}
      </div>

      {camOn && (
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black">
          <video ref={videoRef} muted playsInline className="mx-auto block max-h-[50vh] w-full" />
        </div>
      )}
      {err && <p className="mt-2 rounded-md bg-neon-red/10 px-2 py-1 text-xs text-neon-red">{err}</p>}

      <ul className="mt-4 space-y-2">
        {loading ? (
          <li className="text-sm text-white/45">Loading…</li>
        ) : files.length === 0 ? (
          <li className="py-4 text-center text-sm text-white/45">No files yet.</li>
        ) : (
          files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10">📄</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-white/90">{f.title}</p>
                <p className="text-[11px] text-white/40">{fmtSize(f.file_size)}</p>
              </div>
              <button
                type="button"
                onClick={() => download(f)}
                className="shrink-0 rounded-lg border border-neon-purple/40 bg-neon-purple/15 px-3 py-1.5 text-[12px] text-white hover:bg-neon-purple/25"
              >
                ⬇ Download
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
