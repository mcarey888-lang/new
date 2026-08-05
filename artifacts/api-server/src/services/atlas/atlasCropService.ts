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
  // Decode once for reuse
  const img = sharp(masterBuffer);
  const meta = await img.metadata();
  const W = meta.width  ?? MASTER_W;
  const H = meta.height ?? MASTER_H;

  // ── Desktop Hero: 16:9 → 1920×1080 ───────────────────────────────────────
  // Resize width to 1920 first (upscale), then centre-crop to 1080h
  const desktopHero = await sharp(masterBuffer)
    .resize(1920, null, { fit: "outside", kernel: "lanczos3" })
    .extract({ left: 0, top: ct(Math.round(H * (1920 / W)), 1080), width: 1920, height: 1080 })
    .webp({ quality: 90 })
    .toBuffer();

  // ── Mobile Hero: 390×844 ─────────────────────────────────────────────────
  const mobileHero = await sharp(masterBuffer)
    .resize(390, null, { fit: "outside", kernel: "lanczos3" })
    .extract({ left: 0, top: ct(Math.round(H * (390 / W)), 844), width: 390, height: 844 })
    .webp({ quality: 88 })
    .toBuffer();

  // ── Section Banner: 1440×600 ──────────────────────────────────────────────
  const section = await sharp(masterBuffer)
    .resize(1440, null, { fit: "outside", kernel: "lanczos3" })
    .extract({ left: 0, top: ct(Math.round(H * (1440 / W)), 600), width: 1440, height: 600 })
    .webp({ quality: 88 })
    .toBuffer();

  // ── Card: 400×500 (4:5) ───────────────────────────────────────────────────
  const cardW = Math.min(W, Math.round(H * (4 / 5)));  // 819 from master
  const card = await sharp(masterBuffer)
    .extract({ left: cl(W, cardW), top: 0, width: cardW, height: H })
    .resize(400, 500, { fit: "cover", kernel: "lanczos3" })
    .webp({ quality: 88 })
    .toBuffer();

  // ── Square: 1080×1080 ─────────────────────────────────────────────────────
  const sqSide = Math.min(W, H);
  const square = await sharp(masterBuffer)
    .extract({ left: cl(W, sqSide), top: ct(H, sqSide), width: sqSide, height: sqSide })
    .resize(1080, 1080, { fit: "cover", kernel: "lanczos3" })
    .webp({ quality: 88 })
    .toBuffer();

  // ── Portrait: 1080×1350 (4:5 tall) ───────────────────────────────────────
  const portW = Math.min(W, Math.round(H * (1080 / 1350)));
  const portrait = await sharp(masterBuffer)
    .extract({ left: cl(W, portW), top: 0, width: portW, height: H })
    .resize(1080, 1350, { fit: "cover", kernel: "lanczos3" })
    .webp({ quality: 88 })
    .toBuffer();

  // ── Landscape: 1920×1080 (slightly lower focal point — more ground) ───────
  const landscape = await sharp(masterBuffer)
    .resize(1920, null, { fit: "outside", kernel: "lanczos3" })
    .extract({
      left: 0,
      top: Math.max(0, ct(Math.round(H * (1920 / W)), 1080) + 40), // shift down 40px
      width: 1920,
      height: 1080,
    })
    .webp({ quality: 90 })
    .toBuffer();

  // ── Social: 1080×1080 safe-zone (tighter centre crop) ────────────────────
  const safeW = Math.min(W, Math.round(H * 0.8));  // 80% of height as width
  const social = await sharp(masterBuffer)
    .extract({ left: cl(W, safeW), top: ct(H, safeW), width: safeW, height: safeW })
    .resize(1080, 1080, { fit: "cover", kernel: "lanczos3" })
    .webp({ quality: 88 })
    .toBuffer();

  // ── Master: re-encode as WebP ─────────────────────────────────────────────
  const master = await webp(masterBuffer, 92);

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
