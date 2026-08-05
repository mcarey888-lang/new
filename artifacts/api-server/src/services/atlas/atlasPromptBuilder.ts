/**
 * Atlas Prompt Builder
 * ────────────────────
 * Constructs AI image generation prompts from:
 *   1. The brand's styleProfile (injected as a fixed style block)
 *   2. Scene variable selections (Scene, Task, Equipment, Crew, Lighting, Weather)
 *   3. Optionally, a "match previous" reference description
 *
 * No expedition / mountain / region logic. Fully brand-driven.
 */

import crypto from "node:crypto";

export interface AtlasPromptInput {
  brandName: string;
  styleProfile: Record<string, string[]>;   // e.g. { aesthetic: ["photorealistic", ...], restrictions: ["no watermarks"] }
  styleLock: Record<string, string>;        // e.g. { Lighting: "Golden hour", Mood: "High-energy" }
  sceneVars: Record<string, string>;        // e.g. { scene: "Office", task: "Sign Installation", lighting: "Golden Hour" }
  assetTypeName: string;
  matchReferenceDescription?: string | null;
}

export interface BuiltPrompt {
  prompt: string;
  hash: string;
}

// ── Universal technical style block ──────────────────────────────────────────
const TECHNICAL_STYLE = `
Photography style: Apple, Patagonia, Arc'teryx — premium commercial photography.
Camera: full-frame mirrorless, wide-angle 24-35mm, f/8, ISO 100.
Colour grading: natural, rich but not oversaturated. Clean, professional tones.
Quality: ultra-realistic, cinematic, sharp throughout, beautiful depth of field.
No text. No logos. No watermarks. No UI elements. No client branding.
Negative space: clean area in the top 20% of the frame for title overlay.
`.trim();

// ── Scene phrase builders ─────────────────────────────────────────────────────
function buildScenePhrase(vars: Record<string, string>): string {
  const parts: string[] = [];
  if (vars.scene)     parts.push(`Location: ${vars.scene}`);
  if (vars.task)      parts.push(`Task being performed: ${vars.task}`);
  if (vars.equipment) parts.push(`Access equipment: ${vars.equipment}`);
  if (vars.crewSize) {
    const n = vars.crewSize;
    parts.push(`Crew: ${n} professional installer${n === "1" ? "" : "s"}`);
  }
  if (vars.lighting)  parts.push(`Lighting: ${vars.lighting}`);
  if (vars.weather)   parts.push(`Weather / conditions: ${vars.weather}`);
  return parts.join(". ");
}

function buildStyleProfileBlock(profile: Record<string, string[]>): string {
  const lines: string[] = [];
  for (const [key, values] of Object.entries(profile)) {
    if (values.length > 0) {
      lines.push(`${key}: ${values.join(", ")}`);
    }
  }
  return lines.join("\n");
}

function buildStyleLockBlock(lock: Record<string, string>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(lock)) {
    if (value && value.trim()) {
      lines.push(`${key}: ${value.trim()}`);
    }
  }
  return lines.join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────
export function buildAtlasPrompt(input: AtlasPromptInput): BuiltPrompt {
  const { brandName, styleProfile, styleLock, sceneVars, assetTypeName, matchReferenceDescription } = input;

  const scenePhrase    = buildScenePhrase(sceneVars);
  const styleBlock     = buildStyleProfileBlock(styleProfile);
  const lockBlock      = buildStyleLockBlock(styleLock);

  const sections: string[] = [
    `Create an ultra-realistic commercial photograph for ${brandName}.`,
    "",
    scenePhrase ? `Scene: ${scenePhrase}.` : "",
    "",
    `Asset type: ${assetTypeName}.`,
    "",
    styleBlock ? `Brand aesthetic:\n${styleBlock}` : "",
    "",
    lockBlock ? `Brand visual DNA (must match exactly):\n${lockBlock}` : "",
    "",
    TECHNICAL_STYLE,
  ];

  if (matchReferenceDescription) {
    sections.push(
      "",
      `Visual consistency reference: match the lighting, colour grading, composition, perspective, and atmosphere of this previously approved image:\n${matchReferenceDescription}`,
    );
  }

  const prompt = sections
    .filter((l) => l !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Hash covers all inputs that would change the visual output
  const hashSource = [
    brandName,
    assetTypeName,
    JSON.stringify(styleProfile),
    JSON.stringify(styleLock),
    JSON.stringify(sceneVars),
    matchReferenceDescription ?? "",
  ].join("::");

  const hash = crypto.createHash("sha256").update(hashSource).digest("hex").slice(0, 16);

  return { prompt, hash };
}
