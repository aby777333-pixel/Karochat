/* Karochat — generate icon + splash source images from the wide
 * brand logo.png at the project root.
 *
 * Output:
 *   resources/icon.png         (1024×1024, logo centred on ink-900)
 *   resources/icon-only.png    (1024×1024, transparent bg, foreground only)
 *   resources/icon-background.png (1024×1024, solid ink-900)
 *   resources/splash.png       (2732×2732, logo centred on ink-900)
 *   resources/splash-dark.png  (same as splash.png — we ship one theme)
 *
 * After this script: run `npm run assets` to fan these out to all the
 * platform-specific sizes Android + iOS need.
 */

import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const projectRoot = path.resolve(root, "..");
const logoSrc = path.join(projectRoot, "logo.png");
const resourcesDir = path.join(root, "resources");

const BG = { r: 11, g: 12, b: 15, alpha: 1 }; // #0b0c0f
const TARGET_ICON = 1024;
const TARGET_SPLASH = 2732;

async function ensureDir(dir) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

async function logoOnDarkBg(size, foregroundFraction) {
  // Scale the logo so it fits in `foregroundFraction` of the canvas
  // (e.g. 0.55 = logo width is 55% of the canvas). Sharp's resize fits
  // inside that bounding box preserving the wide aspect ratio. Then we
  // composite onto a solid dark square.
  const innerWidth = Math.round(size * foregroundFraction);

  const fg = await sharp(logoSrc)
    .resize({ width: innerWidth, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });

  const bg = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG
    }
  }).png();

  const left = Math.round((size - fg.info.width) / 2);
  const top = Math.round((size - fg.info.height) / 2);

  return bg
    .composite([{ input: fg.data, left, top }])
    .png()
    .toBuffer();
}

async function logoTransparent(size, foregroundFraction) {
  // Same as above but transparent background — used for adaptive icon
  // foreground on Android (Capacitor pairs this with icon-background).
  const innerWidth = Math.round(size * foregroundFraction);
  const fg = await sharp(logoSrc)
    .resize({ width: innerWidth, fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer({ resolveWithObject: true });

  const transparent = sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).png();

  const left = Math.round((size - fg.info.width) / 2);
  const top = Math.round((size - fg.info.height) / 2);

  return transparent
    .composite([{ input: fg.data, left, top }])
    .png()
    .toBuffer();
}

async function solidColour(size) {
  return sharp({
    create: { width: size, height: size, channels: 4, background: BG }
  })
    .png()
    .toBuffer();
}

async function main() {
  if (!existsSync(logoSrc)) {
    console.error(`✗ logo.png not found at ${logoSrc}`);
    process.exit(1);
  }
  await ensureDir(resourcesDir);

  // Icon: logo ~55% of the canvas, no padding cropped — Android adaptive
  // icons crop ~33% from each edge for foreground, so we keep the
  // foreground tight in the centre.
  const icon = await logoOnDarkBg(TARGET_ICON, 0.55);
  await sharp(icon).toFile(path.join(resourcesDir, "icon.png"));

  const iconOnly = await logoTransparent(TARGET_ICON, 0.55);
  await sharp(iconOnly).toFile(path.join(resourcesDir, "icon-only.png"));

  const iconBackground = await solidColour(TARGET_ICON);
  await sharp(iconBackground).toFile(
    path.join(resourcesDir, "icon-background.png")
  );

  // Splash: more breathing room (~38% of canvas) — splash screens read
  // best when the logo is smaller and the background dominates.
  const splash = await logoOnDarkBg(TARGET_SPLASH, 0.38);
  await sharp(splash).toFile(path.join(resourcesDir, "splash.png"));
  await sharp(splash).toFile(path.join(resourcesDir, "splash-dark.png"));

  console.log("✔ resources/ generated:");
  console.log("    icon.png            1024×1024 (logo on ink-900)");
  console.log("    icon-only.png       1024×1024 (foreground only)");
  console.log("    icon-background.png 1024×1024 (ink-900 solid)");
  console.log("    splash.png          2732×2732 (logo on ink-900)");
  console.log("    splash-dark.png     2732×2732 (same — single theme)");
  console.log("\nNext: `npm run assets` to fan out to platform sizes.");
}

main().catch((err) => {
  console.error("✗ asset generation failed:", err);
  process.exit(1);
});
