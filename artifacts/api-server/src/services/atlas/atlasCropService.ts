/**
 * Atlas Crop Service
 * ───────────────────
 * Takes a raw 1536×1024 master image buffer and produces eight WebP crops:
 *
 *   desktopHero   16:9   → 1920 × 1080  (upscale then centre-crop)
 *   mobileHero    ~9:19  →  390 ×  844  (portrait, centre-crop)
 *   section       12:5   → 1440 ×  600  (wide banner, centre-crop)
 *   card           4:5   →  400 ×  500  (portrait card)
 *   square         1:1   → 1080 × 1080  (centre-crop)
 *   portrait       4:5   → 1080 × 1350  (Instagram portrait)
 *   landscape     16:9   → 1920 × 1080  (same ratio, slightly lower focal pt)
 *   social         1:1   → 1080 × 1080  (safe-zone crop — tighter centre)
 *
 * Uses sharp (already a dependency of @workspace/api-server).
 * All outputs are WebP for optimal web delivery.
 */

import sharp from "sharp";

export interface AtlasImageCrops {
  master:      Buffer;
  desktopHero: Buffer;   // 1920×1080
  mobileHero:  Buffer;   // 390×844
  section:     Buffer;   // 1440×600
  card:        Buffer;   // 400×500
  square:      Buffer;   // 1080×1080
  portrait:    Buffer;   // 1080×1350
  landscape:   Buffer;   // 1920×1080
  social:      Buffer;   // 1080×1080 (safe zone)
}

export type AtlasCropName = keyof AtlasImageCrops;

export const ATLAS_CROP_NAMES: AtlasCropName[] = [
  "master",
  "desktopHero",
  "mobileHero",
  "section",
  "card",
  "square",
  "portrait",
  "landscape",
  "social",
];

// Master from OpenAI gpt-image-1 at "1536x1024"
const MASTER_W = 1536;
const MASTER_H = 1024;

function cl(srcW: number, cropW: number) { return Math.max(0, Math.floor((srcW - cropW) / 2)); }
function ct(srcH: number, cropH: number) { return Math.max(0, Math.floor((srcH - cropH) / 2)); }

async function webp(buf: Buffer, quality = 88): Promise<Buffer> {
  return sharp(buf).webp({ quality }).toBuffer();
}

export async function cropAtlasMasterImage(masterBuffer: Buffer): Promise<AtlasImageCrops> {
  // All crops use sharp's native fit:"cover" + gravity:"centre" so they work
  // correctly regardless of the input image dimensions (the AI doesn't always
  // return the expected 1536×1024 — manual resize+extract math can produce
  // out-of-bounds coordinates and throw "bad extract area" errors).

  const cover = (w: number, h: number, quality = 88) =>
    sharp(masterBuffer)
      .resize(w, h, { fit: "cover", position: "centre", kernel: "lanczos3" })
      .webp({ quality })
      .toBuffer();

  // ── All crops ─────────────────────────────────────────────────────────────
  const [desktopHero, mobileHero, section, card, square, portrait, landscape, social, master] =
    await Promise.all([
      cover(1920, 1080, 90), // Desktop Hero 16:9
      cover(390,   844, 88), // Mobile Hero  ~9:19
      cover(1440,  600, 88), // Section Banner 12:5
      cover(400,   500, 88), // Card 4:5
      cover(1080, 1080, 88), // Square 1:1
      cover(1080, 1350, 88), // Portrait 4:5 tall
      cover(1920, 1080, 90), // Landscape 16:9
      cover(1080, 1080, 88), // Social 1:1
      webp(masterBuffer, 92), // Master re-encoded
    ]);

  return {
    master,
    desktopHero,
    mobileHero,
    section,
    card,
    square,
    portrait,
    landscape,
    social,
  };
}
