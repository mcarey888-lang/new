/**
 * Image Provider Interface
 * ────────────────────────
 * Abstraction over image generation APIs.
 * Swap providers (OpenAI, Stability, Midjourney, etc.) without touching the
 * rest of the artwork pipeline.
 */

import { editImages, generateImageBuffer } from "@workspace/integrations-openai-ai-server";

// ── Interface ─────────────────────────────────────────────────────────────────

export interface GenerateResult {
  buffer: Buffer;
  provider: string;
  /** Estimated cost in USD (best effort; 0 if unknown) */
  cost: number;
}

export interface ImageProvider {
  generate(prompt: string, options?: { referenceImages?: Array<Buffer | { buffer: Buffer; mimeType: string; name?: string }>; size?: "1024x1024" | "1536x1024" | "1024x1536"; transparent?: boolean }): Promise<GenerateResult>;
  readonly name: string;
}

// ── OpenAI gpt-image-1 provider ───────────────────────────────────────────────
// Generates a 1536×1024 master image (landscape 3:2).
// Crops are produced by the CropService from this master.

export class OpenAIImageProvider implements ImageProvider {
  readonly name = "openai-gpt-image-1";

  async generate(prompt: string, options?: { referenceImages?: Array<Buffer | { buffer: Buffer; mimeType: string; name?: string }>; size?: "1024x1024" | "1536x1024" | "1024x1536"; transparent?: boolean }): Promise<GenerateResult> {
    // gpt-image-1 returns b64_json; generateImageBuffer decodes it.
    // Size: 1536×1024 (landscape master — best for wide outdoor scenes).
    const references = options?.referenceImages?.slice(0, 3) ?? [];
    // gpt-image-1 image edits accept actual image bytes; IDs are never sent as
    // a substitute. With no references retain the legacy generation path.
    const buffer = references.length > 0
      ? await editImages(references.map((ref) => !Buffer.isBuffer(ref) ? ref.buffer : ref), prompt, undefined, {
          size: options?.size, transparent: options?.transparent,
          mimeTypes: references.map((ref) => !Buffer.isBuffer(ref) ? ref.mimeType : "image/png"),
        })
      : await generateImageBuffer(prompt, options?.size ?? "1536x1024", {
        transparent: options?.transparent,
        outputFormat: options?.transparent ? "png" : "jpeg",
      });
    if (buffer.length === 0) throw new Error("Image provider returned an empty image");

    // Cost estimation for gpt-image-1 at 1536×1024 quality (standard).
    // Replit AI proxy billing may differ; this is a reasonable estimate.
    const cost = 0.04;

    return { buffer, provider: this.name, cost };
  }
}

// ── Default provider singleton ────────────────────────────────────────────────
export const defaultImageProvider: ImageProvider = new OpenAIImageProvider();
