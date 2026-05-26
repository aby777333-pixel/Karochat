// Karochat — /api/books/external (v9 Phase 2.1)
//
// Returns Project Gutenberg + OpenLibrary references for a (title,
// author) pair. Called server-side from the /books/[id] page; safe to
// call without auth (it only reads public catalogs), but we still gate
// on auth to avoid being a free upstream-proxy.

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { lookupExternalReferences } from "@/lib/books/external";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { title?: string; author?: string | null } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }
  const title = (body.title ?? "").trim();
  const author = (body.author ?? "")?.trim() || null;
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  try {
    const refs = await lookupExternalReferences(title, author);
    return NextResponse.json(refs);
  } catch (err: any) {
    console.error("[books/external] failed", err);
    return NextResponse.json(
      { error: err?.message ?? "lookup-failed" },
      { status: 502 }
    );
  }
}
