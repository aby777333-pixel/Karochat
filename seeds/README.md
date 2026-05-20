# Karochat seeds

Two layers of catalog content live here:

1. **`supabase/migrations/0015_catalog_schema.sql`** + **`0016_catalog_seed.sql`**
   + **`0017_catalog_global_expansion.sql`** — the live schema + ~300 curated
   official rooms that ship via standard migrations.

2. **`seeds/rooms-catalog.ts`** — the **full** catalog (~24,595 rooms across
   120 countries / 1116 subcategories / 20 categories). As of Wave 16 it ports
   into the same live schema (`room_categories(slug)` + `room_subcategories
   (category_slug, slug)` + `rooms.category_slug` / `rooms.subcategory_slug`).

## Running the full port

```
# One-time, requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
npm run port:catalog            # full port (~24K rooms, takes a few minutes)
npm run port:catalog:dry        # print counts only, no writes
```

A pre-generated SQL dump of every `ensure_official_room(...)` call lives at
`supabase/migrations/0022_catalog_full.sql` (≈4 MB). The 20 root categories
have already been applied via MCP; the subcategories and rooms run when you
execute `npm run port:catalog` against production.

To regenerate the SQL dump after editing `rooms-catalog.ts`:

```
npx tsx scripts/dump-catalog-sql.ts > supabase/migrations/0022_catalog_full.sql
```

## Tsconfig note

Both `seeds/` and `scripts/` are excluded from `tsconfig.json`'s `include`
so they don't slow down the Next.js typecheck. They run via `tsx` directly.
