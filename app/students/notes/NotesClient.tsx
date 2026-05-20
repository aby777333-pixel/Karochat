"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Note = {
  id: string;
  title: string;
  subject: string | null;
  topic: string | null;
  syllabus: string | null;
  updated_at: string;
  capsule_token: string | null;
};

export function NotesClient({ initial }: { initial: Note[] }) {
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();
  const [notes, setNotes] = useState<Note[]>(initial);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");

  async function createNote() {
    if (!title.trim()) return;
    setCreating(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("student_notes")
      .insert({
        owner_profile_id: user.id,
        title: title.trim(),
        body_markdown: body || null,
        subject: subject || null
      })
      .select("id, title, subject, topic, syllabus, updated_at, capsule_token")
      .single();
    setCreating(false);
    if (error) return;
    if (data) {
      setNotes((prev) => [data as Note, ...prev]);
      setTitle("");
      setBody("");
      setSubject("");
    }
  }

  async function makeCapsule(id: string) {
    const { data } = await supabase.rpc("create_capsule", {
      p_note_id: id,
      p_days: 30
    });
    if (data) {
      const url = `${window.location.origin}/capsule/${data}`;
      try {
        await navigator.clipboard.writeText(url);
        alert(`Knowledge Capsule URL copied:\n\n${url}\n\nLasts 30 days.`);
      } catch {
        alert(`Knowledge Capsule URL:\n\n${url}\n\nLasts 30 days.`);
      }
      router.refresh();
    }
  }

  async function deleteNote(id: string) {
    if (!confirm("Delete this note?")) return;
    await supabase.from("student_notes").delete().eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <>
      <section className="surface-glass mt-5 p-5">
        <p className="text-[10px] uppercase tracking-widest text-white/40">
          New note
        </p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 200))}
          placeholder="Title"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value.slice(0, 60))}
          placeholder="Subject (optional)"
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Markdown body…"
          rows={4}
          className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-neon-mint/40"
        />
        <button
          type="button"
          onClick={() => void createNote()}
          disabled={!title.trim() || creating}
          className="mt-3 rounded-xl bg-neon-mint px-3 py-1.5 text-sm font-medium text-ink-900 hover:bg-neon-mint/90 disabled:opacity-60"
        >
          {creating ? "Saving…" : "+ Save note"}
        </button>
      </section>

      <section className="mt-5 space-y-2">
        {notes.length === 0 ? (
          <p className="text-center text-sm text-white/45">
            No notes yet. Save a beacon session whiteboard or write one above.
          </p>
        ) : (
          notes.map((n) => (
            <article key={n.id} className="surface-glass p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="truncate font-display text-base text-white">
                  {n.title}
                </h3>
                <span className="text-[10px] uppercase tracking-widest text-white/35">
                  {new Date(n.updated_at).toLocaleDateString()}
                </span>
              </div>
              <p className="text-[11px] text-white/45">
                {[n.subject, n.topic, n.syllabus].filter(Boolean).join(" · ") || "no subject"}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void makeCapsule(n.id)}
                  className="rounded-md border border-neon-blue/40 bg-neon-blue/10 px-2 py-1 text-[11px] text-neon-blue hover:bg-neon-blue/20"
                >
                  🔗 Share as capsule
                </button>
                <button
                  type="button"
                  onClick={() => void deleteNote(n.id)}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/55 hover:bg-white/10"
                >
                  🗑
                </button>
                {n.capsule_token && (
                  <a
                    href={`/capsule/${n.capsule_token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/55 hover:bg-white/10"
                  >
                    → Capsule
                  </a>
                )}
              </div>
            </article>
          ))
        )}
      </section>
    </>
  );
}
