/**
 * Karochat — Catalog SQL dumper.
 *
 * Reads seeds/rooms-catalog.ts and emits SQL that the existing
 * ensure_official_room RPC understands. Run via:
 *
 *   npx tsx scripts/dump-catalog-sql.ts > supabase/migrations/0022_catalog_full.sql
 *
 * Output is idempotent — re-running the migration just upserts.
 */

import { buildFullCatalog } from "../seeds/rooms-catalog";

function sqlEscape(s: string | null | undefined): string {
  if (s == null) return "null";
  return `'${s.replace(/'/g, "''")}'`;
}

function main() {
  const { categories, subcategories, rooms } = buildFullCatalog();
  const out: string[] = [];

  out.push(
    "-- Karochat — v12 Wave 16: full catalog port (~24K rooms across 20 categories)."
  );
  out.push("-- Generated via scripts/dump-catalog-sql.ts. Idempotent.");
  out.push("");

  // Categories.
  out.push("-- ─ Categories ─");
  for (const c of categories) {
    out.push(
      `insert into public.room_categories (slug, label, description, icon, position) values (` +
        `${sqlEscape(c.slug)}, ${sqlEscape(c.name)}, ${sqlEscape(c.description)}, ${sqlEscape(c.emoji)}, ${c.sort_order}` +
        `) on conflict (slug) do update set label = excluded.label, description = excluded.description, icon = excluded.icon, position = excluded.position;`
    );
  }
  out.push("");

  // Subcategories.
  out.push(`-- ─ Subcategories (${subcategories.length}) ─`);
  for (const s of subcategories) {
    out.push(
      `insert into public.room_subcategories (category_slug, slug, label, description, position) values (` +
        `${sqlEscape(s.category_slug)}, ${sqlEscape(s.slug)}, ${sqlEscape(s.name)}, ${sqlEscape(s.description ?? "")}, ${s.sort_order ?? 1000}` +
        `) on conflict (category_slug, slug) do update set label = excluded.label, description = excluded.description, position = excluded.position;`
    );
  }
  out.push("");

  // Rooms — via ensure_official_room.
  out.push(`-- ─ Rooms (${rooms.length}) ─`);
  for (const r of rooms) {
    const adult = r.flags.includes("adult");
    const visibility = adult ? "listed" : "public";
    const voiceEnabled = r.flags.includes("voice_enabled");
    const camEnabled = r.flags.includes("cam_enabled");
    const verifiedOnly =
      r.flags.includes("verified_only") ||
      r.flags.includes("verified_students_only") ||
      r.flags.includes("verified_professors_only") ||
      r.flags.includes("verified_professionals_only");
    const verifiedKind = r.flags.includes("verified_students_only")
      ? "students"
      : r.flags.includes("verified_professors_only")
      ? "professors"
      : r.flags.includes("verified_professionals_only")
      ? "professionals"
      : null;
    out.push(
      `select public.ensure_official_room(` +
        `${sqlEscape(r.category_slug)}, ${sqlEscape(r.subcategory_slug)}, ${sqlEscape(r.name)}, ${sqlEscape(r.topic)}, ` +
        `${sqlEscape(visibility)}, ${voiceEnabled}, ${camEnabled}, ${verifiedOnly}, ${sqlEscape(verifiedKind)}, ${r.capacity ?? 50}` +
        `);`
    );
  }

  process.stdout.write(out.join("\n") + "\n");
}

main();
