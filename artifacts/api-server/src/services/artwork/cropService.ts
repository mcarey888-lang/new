/**
 * Crop Service
 * ─────────────
 * Takes a raw 1536×1024 master image buffer and produces three crops:
 *
 *   hero      16:9  → 1536 × 864   (full width, centre-crop height)
 *   card       4:5  →  819 × 1024  (full height, centre-crop width)
 *   thumbnail  1:1  → 1024 × 1024  (centre-crop both)
 *
 * Uses sharp (already a dependency of @workspace/api-server).
 */

import sharp from "sharp";

export interface ImageCrops {
  master:    Buffer;
  hero:      Buffer;   // 16:9
  card:      Buffer;   // 4:5
  thumbnail: Buffer;   // 1:1
}

// Master dimensions from OpenAI gpt-image-1 at "1536x1024"
const MASTER_W = 1536;
const MASTER_H = 1024;

function centreLeft(srcW: number, cropW: number): number {
  return Math.floor((srcW - cropW) / 2);
}

function centreTop(srcH: number, cropH: number): number {
  return Math.floor((srcH - cropH) / 2);
}

export async function cropMasterImage(masterBuffer: Buffer, options: { preserveAlpha?: boolean } = {}): Promise<ImageCrops> {
  if (options.preserveAlpha) {
    const format = (input: { width: number; height: number }) => sharp(masterBuffer)
      .resize(input.width, input.height, { fit: "cover" })
      .png();
    const masterMeta = await sharp(masterBuffer).metadata();
    const width = masterMeta.width ?? MASTER_W;
    const height = masterMeta.height ?? MASTER_H;
    const master = await sharp(masterBuffer).png().toBuffer();
    const hero = await format({ width, height: Math.max(1, Math.round(width * 9 / 16)) }).toBuffer();
    const card = await format({ width: Math.max(1, Math.round(height * 4 / 5)), height }).toBuffer();
    const thumbnail = await format({ width: Math.min(width, height), height: Math.min(width, height) }).toBuffer();
    return { master, hero, card, thumbnail };
  }
  // ── Hero: 16:9 ────────────────────────────────────────────────────────────
  const heroH = Math.round((MASTER_W * 9) / 16);       // 864
  const heroTop = centreTop(MASTER_H, heroH);            // 80

  const hero = await sharp(masterBuffer)
    .extract({ left: 0, top: heroTop, width: MASTER_W, height: heroH })
    .jpeg({ quality: 92 })
    .toBuffer();

  // ── Card: 4:5 ─────────────────────────────────────────────────────────────
  const cardW = Math.round((MASTER_H * 4) / 5);         // 819
  const cardLeft = centreLeft(MASTER_W, cardW);           // 358

  const card = await sharp(masterBuffer)
    .extract({ left: cardLeft, top: 0, width: cardW, height: MASTER_H })
    .jpeg({ quality: 92 })
    .toBuffer();

  // ── Thumbnail: 1:1 ───────────────────────────────────────────────────────
  const thumbSide = MASTER_H;                            // 1024
  const thumbLeft = centreLeft(MASTER_W, thumbSide);     // 256

  const thumbnail = await sharp(masterBuffer)
    .extract({ left: thumbLeft, top: 0, width: thumbSide, height: thumbSide })
    .jpeg({ quality: 90 })
    .toBuffer();

  // Re-encode master as JPEG for consistent storage
  const master = await sharp(masterBuffer).jpeg({ quality: 95 }).toBuffer();

  return { master, hero, card, thumbnail };
}
