/**
 * Karochat — Catalog Porter (Wave 16)
 *
 * Reads seeds/rooms-catalog.ts (~24,500 rooms across 20 categories) and
 * inserts every category/subcategory/room into the LIVE schema:
 *   - room_categories     (slug PK)
 *   - room_subcategories  ((category_slug, slug) PK)
 *   - rooms               (with category_slug, subcategory_slug text)
 *
 * Idempotent — upserts on conflict, safe to re-run.
 *
 * Required env vars:
 *   SUPABASE_URL              (e.g. https://xxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   npm run port:catalog            # full run (~24K rooms, takes a few mins)
 *   npm run port:catalog --dry-run  # build & log counts only
 *   npm run port:catalog --limit=500  # cap rooms for testing
 */

import { createClient } from "@supabase/supabase-js";
import { buildFullCatalog } from "../seeds/rooms-catalog";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars."
  );
  process.exit(1);
}

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG
  ? Math.max(1, parseInt(LIMIT_ARG.split("=")[1] ?? "0", 10))
  : Infinity;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const CHUNK = 200;

function log(s: string) {
  console.log(`[port] ${s}`);
}

async function main() {
  const t0 = Date.now();
  const { categories, subcategories, rooms } = buildFullCatalog();
  const roomsToPort = Number.isFinite(LIMIT) ? rooms.slice(0, LIMIT) : rooms;

  log(`Catalog built — ${categories.length} categories, ${subcategories.length} subcats, ${rooms.length} rooms total.`);
  log(`Will port: ${roomsToPort.length} rooms (limit=${LIMIT === Infinity ? "∞" : LIMIT}).`);
  if (DRY_RUN) {
    log("Dry run — nothing written.");
    return;
  }

  // 1. Categories.
  log(`Upserting ${categories.length} categories…`);
  for (const cat of categories) {
    const { error } = await supabase
      .from("room_categories")
      .upsert(
        {
          slug: cat.slug,
          label: cat.name,
          description: cat.description,
          icon: cat.emoji,
          position: cat.sort_order
        },
        { onConflict: "slug" }
      );
    if (error) throw new Error(`category ${cat.slug}: ${error.message}`);
  }

  // 2. Subcategories.
  log(`Upserting ${subcategories.length} subcategories in chunks of ${CHUNK}…`);
  for (let i = 0; i < subcategories.length; i += CHUNK) {
    const chunk = subcategories.slice(i, i + CHUNK).map((s) => ({
      category_slug: s.category_slug,
      slug: s.slug,
      label: s.name,
      description: s.description ?? null,
      position: s.sort_order ?? 1000
    }));
    const { error } = await supabase
      .from("room_subcategories")
      .upsert(chunk, { onConflict: "category_slug,slug" });
    if (error) {
      throw new Error(`subcats ${i}-${i + chunk.length}: ${error.message}`);
    }
    log(
      `  subcats ${Math.min(i + chunk.length, subcategories.length)} / ${subcategories.length}`
    );
  }

  // 3. Rooms — use the ensure_official_room RPC so we don't have to chase
  //    the rooms-table column shape from this script.
  log(`Upserting ${roomsToPort.length} rooms via ensure_official_room…`);
  let done = 0;
  let failed = 0;
  for (const r of roomsToPort) {
    const adult = r.flags.includes("adult");
    const visibility = adult ? "listed" : "public";
    const { error } = await supabase.rpc("ensure_official_room", {
      p_category_slug: r.category_slug,
      p_subcategory_slug: r.subcategory_slug,
      p_name: r.name,
      p_topic: r.topic,
      p_visibility: visibility,
      p_voice_enabled: r.flags.includes("voice_enabled"),
      p_cam_enabled: r.flags.includes("cam_enabled"),
      p_verified_only:
        r.flags.includes("verified_only") ||
        r.flags.includes("verified_students_only") ||
        r.flags.includes("verified_professors_only") ||
        r.flags.includes("verified_professionals_only"),
      p_verified_kind: r.flags.includes("verified_students_only")
        ? "students"
        : r.flags.includes("verified_professors_only")
        ? "professors"
        : r.flags.includes("verified_professionals_only")
        ? "professionals"
        : null,
      p_capacity: r.capacity ?? 50
    });
    if (error) {
      failed++;
      if (failed < 20) {
        console.warn(
          `  ✗ ${r.category_slug}/${r.subcategory_slug}/${r.name}: ${error.message}`
        );
      }
    }
    done++;
    if (done % 500 === 0) {
      log(`  rooms ${done} / ${roomsToPort.length} (failed=${failed})`);
    }
  }

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  log(`Done in ${secs}s. ${done - failed} succeeded, ${failed} failed.`);
}

main().catch((err) => {
  console.error("[port] FAILED:", err);
  process.exit(1);
});
