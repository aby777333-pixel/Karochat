// Karochat — /api/books/explain (v9 Phase 2.1)
//
// Karo "explain a passage" for the book reader. Takes the book title +
// author for context, a snippet of text the reader pasted (or
// selected), and an optional target language. Returns a tight,
// non-condescending explanation + a one-line gist.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { aiText, getOpenAI } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PERSONA = `You are Karo, Karochat's reading companion. The user is
reading a book and pasted a passage they want explained. You explain
the passage in plain language without being patronising. Born 2026.

Rules:
- Keep responses tight: 60-180 words. No headings unless absolutely
  necessary. Plain prose. Markdown bold/italic OK; lists only when
  they genuinely help.
- Lead with a one-sentence "gist". Then 1-3 short paragraphs unpacking
  it — context, vocabulary, references, ambiguity, why it matters.
- If the passage uses an unfamiliar word, name it and define it.
- If the passage cites a person/place/event, identify it briefly with
  honest uncertainty when the reference is contested.
- If the passage is famous, you can mention that — but don't lecture.
- If asked to translate as well, give the translation after a
  separator line ("---").
- Never invent biographical details about the book's author. If you
  don't know, say so in one line.`;

type Body = {
  passage?: string;
  book_title?: string;
  book_author?: string | null;
  target_language?: string | null;
};

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const passage = (body.passage ?? "").trim();
  const bookTitle = (body.book_title ?? "").trim() || null;
  const bookAuthor = (body.book_author ?? "")?.trim() || null;
  const targetLang = (body.target_language ?? "")?.trim() || null;

  if (!passage) {
    return NextResponse.json({ error: "passage required" }, { status: 400 });
  }
  if (passage.length > 4000) {
    return NextResponse.json({ error: "passage too long (4000 char max)" }, { status: 413 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  if (!getOpenAI()) {
    return NextResponse.json(
      { error: "ai-not-configured" },
      { status: 503 }
    );
  }

  const context = [
    bookTitle ? `Book title: ${bookTitle}.` : null,
    bookAuthor ? `Author: ${bookAuthor}.` : null,
    targetLang ? `After your explanation, include a translation into ${targetLang} after a "---" separator.` : null,
    `Passage:\n"""\n${passage}\n"""`
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const reply = (await aiText(PERSONA, context)).trim();
    if (!reply) {
      return NextResponse.json({ error: "empty-reply" }, { status: 502 });
    }
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("[books/explain] failed", err);
    return NextResponse.json(
      { error: err?.message ?? "openai-failed" },
      { status: 502 }
    );
  }
}
