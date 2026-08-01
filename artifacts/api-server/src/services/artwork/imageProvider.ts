/**
 * Image Provider Interface
 * ────────────────────────
 * Abstraction over image generation APIs.
 * Swap providers (OpenAI, Stability, Midjourney, etc.) without touching the
 * rest of the artwork pipeline.
 */

import { generateImageBuffer } from "@workspace/integrations-openai-ai-server";

// ── Interface ─────────────────────────────────────────────────────────────────

export interface GenerateResult {
  buffer: Buffer;
  provider: string;
  /** Estimated cost in USD (best effort; 0 if unknown) */
  cost: number;
}

export interface ImageProvider {
  generate(prompt: string): Promise<GenerateResult>;
  readonly name: string;
}

// ── OpenAI gpt-image-1 provider ───────────────────────────────────────────────
// Generates a 1536×1024 master image (landscape 3:2).
// Crops are produced by the CropService from this master.

export class OpenAIImageProvider implements ImageProvider {
  readonly name = "openai-gpt-image-1";

  async generate(prompt: string): Promise<GenerateResult> {
    // gpt-image-1 returns b64_json; generateImageBuffer decodes it.
    // Size: 1536×1024 (landscape master — best for wide outdoor scenes).
    const buffer = await generateImageBuffer(prompt, "1536x1024");

    // Cost estimation for gpt-image-1 at 1536×1024 quality (standard).
    // Replit AI proxy billing may differ; this is a reasonable estimate.
    const cost = 0.04;

    return { buffer, provider: this.name, cost };
  }
}

// ── Default provider singleton ────────────────────────────────────────────────
export const defaultImageProvider: ImageProvider = new OpenAIImageProvider();
