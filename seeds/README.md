# Karochat seeds

The live, applied seed lives in **`supabase/migrations/0015_catalog_schema.sql`**
and **`supabase/migrations/0016_catalog_seed.sql`** — those are what's running
in production right now (~300 curated official rooms across 20 categories).

`seeds/rooms-catalog.ts` is the **future-scope catalog** (~24,595 rooms across
120 countries) that was authored separately. It's *not* yet wired into the
build — its `SeedSubcategory` / `SeedRoom` shape uses `subcategory_id` UUIDs
where the live schema uses composite `(category_slug, subcategory_slug)` keys.
Porting it across is a follow-up session.

The TypeScript files in `scripts/` are similarly future-scope — they expect
the alternative schema described in this file's parent README.

Both folders are excluded from `tsconfig.json`'s `include` so they don't
break the Next.js typecheck.
