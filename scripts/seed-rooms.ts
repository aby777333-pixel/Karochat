/**
 * Karochat — Seed Runner
 * ----------------------
 * Drop into: scripts/seed-rooms.ts
 * Run via:   npm run seed:rooms
 *
 * Pushes the catalog from seeds/rooms-catalog.ts into Supabase.
 * Idempotent: re-runs upsert and skip silently if rooms already exist.
 *
 * Required env vars:
 *   - SUPABASE_URL              (e.g. https://xxx.supabase.co)
 *   - SUPABASE_SERVICE_ROLE_KEY (server-side only, never expose client-side)
 *
 * Expected schema (matches v1 architecture):
 *   categories      (slug PK, name, emoji, description, sort_order)
 *   subcategories   (id PK, category_slug FK, slug, name, description, sort_order, region, language)
 *                   UNIQUE (category_slug, slug)
 *   rooms           (id PK, category_slug FK, subcategory_id FK, name, topic, flags[], capacity,
 *                    tags[], language, region, pinned_message, scale_index, is_official,
 *                    owner_profile_id, visibility, created_at, updated_at)
 *                   UNIQUE (subcategory_id, name, scale_index)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { buildFullCatalog, CATEGORIES, SeedRoom, SeedSubcategory } from '../seeds/rooms-catalog';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const CHUNK_SIZE = 500;

function log(msg: string) { console.log(`[seed] ${msg}`); }
function vlog(msg: string) { if (VERBOSE) console.log(`[seed:verbose] ${msg}`); }

async function seedCategories() {
  log(`Seeding ${CATEGORIES.length} categories...`);
  if (DRY_RUN) { log('  (dry-run, skipped)'); return; }
  const { error } = await supabase
    .from('categories')
    .upsert(CATEGORIES, { onConflict: 'slug' });
  if (error) throw error;
  log(`  ✓ ${CATEGORIES.length} categories upserted`);
}

async function seedSubcategories(subcategories: SeedSubcategory[]) {
  log(`Seeding ${subcategories.length} subcategories...`);
  if (DRY_RUN) { log('  (dry-run, skipped)'); return; }
  for (let i = 0; i < subcategories.length; i += CHUNK_SIZE) {
    const chunk = subcategories.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('subcategories')
      .upsert(chunk, { onConflict: 'category_slug,slug' });
    if (error) {
      console.error(`Error at chunk ${i}-${i + chunk.length}:`, error);
      throw error;
    }
    vlog(`  chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(subcategories.length / CHUNK_SIZE)} (${i + chunk.length}/${subcategories.length})`);
  }
  log(`  ✓ ${subcategories.length} subcategories upserted`);
}

async function seedRooms(rooms: SeedRoom[]) {
  log(`Seeding ${rooms.length} rooms...`);
  if (DRY_RUN) { log('  (dry-run, skipped)'); return; }

  // Need to resolve subcategory_slug → subcategory_id
  const { data: subs, error: subErr } = await supabase
    .from('subcategories')
    .select('id, category_slug, slug');
  if (subErr) throw subErr;
  const subIdMap = new Map<string, string>();
  for (const s of (subs || []) as Array<{ id: string; category_slug: string; slug: string }>) {
    subIdMap.set(`${s.category_slug}::${s.slug}`, s.id);
  }

  let inserted = 0;
  let skipped = 0;
  for (let i = 0; i < rooms.length; i += CHUNK_SIZE) {
    const chunk = rooms.slice(i, i + CHUNK_SIZE).map(r => {
      const subId = subIdMap.get(`${r.category_slug}::${r.subcategory_slug}`);
      if (!subId) {
        skipped++;
        return null;
      }
      return {
        category_slug: r.category_slug,
        subcategory_id: subId,
        name: r.name,
        topic: r.topic,
        flags: r.flags,
        capacity: r.capacity,
        tags: r.tags,
        language: r.language ?? null,
        region: r.region ?? null,
        pinned_message: r.pinned_message ?? null,
        scale_index: 1,
        is_official: true,
        owner_profile_id: null,
        visibility: 'public',
      };
    }).filter((r): r is NonNullable<typeof r> => r !== null);

    if (chunk.length === 0) continue;

    const { error } = await supabase
      .from('rooms')
      .upsert(chunk, { onConflict: 'subcategory_id,name,scale_index' });
    if (error) {
      console.error(`Error at chunk ${i}-${i + chunk.length}:`, error);
      throw error;
    }
    inserted += chunk.length;
    vlog(`  chunk ${i / CHUNK_SIZE + 1}/${Math.ceil(rooms.length / CHUNK_SIZE)} (${inserted}/${rooms.length})`);
  }
  log(`  ✓ ${inserted} rooms upserted, ${skipped} skipped (missing subcategory)`);
}

async function main() {
  const startedAt = Date.now();
  log(DRY_RUN ? '═══ DRY RUN (no writes) ═══' : '═══ LIVE RUN ═══');

  const { categories, subcategories, rooms } = buildFullCatalog();
  log(`Catalog built:`);
  log(`  ${categories.length} categories`);
  log(`  ${subcategories.length} subcategories`);
  log(`  ${rooms.length} rooms`);

  await seedCategories();
  await seedSubcategories(subcategories);
  await seedRooms(rooms);

  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  log(`Done in ${seconds}s.`);
}

main().catch(err => {
  console.error('[seed] FAILED:', err);
  process.exit(1);
});
