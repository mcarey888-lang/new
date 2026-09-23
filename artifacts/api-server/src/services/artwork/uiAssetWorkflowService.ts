/**
 * UI asset candidate workflow. This deliberately uses the review-manifest
 * object-storage architecture: catalogue metadata is input, while all
 * mutable candidates, families and history live in one private manifest.
 * No database rows or production artwork are involved.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { cropMasterImage } from "./cropService.js";
import { defaultImageProvider, type ImageProvider } from "./imageProvider.js";
import {
  acquireReviewBatchGenerationLock,
  downloadReviewObject,
  readReviewBatchManifest,
  uploadReviewCandidate,
  writeReviewBatchManifest,
} from "./artworkStorage.js";

export const UI_ASSET_BATCH_ID = "ui-asset-family-workflow";
export const FAMILY_IDS = ["SIGNATURE_SYMBOLS", "RANKS", "ACHIEVEMENTS", "EDITORIAL"] as const;
export type FamilyId = typeof FAMILY_IDS[number];
export const CANDIDATE_COUNTS = [1, 2, 4] as const;
const MAX_REFERENCES = 3;
type AssetRecord = { asset_key: string; display_name: string; category: string; generation_required: boolean; generation_prompt: string | null; negative_prompt: string | null; aspect_ratio: string | null; transparent_background: boolean | null; generation_model: string | null };
export type UiAssetCandidate = {
  candidateId: string; assetKey: string; familyId: FamilyId; version: number;
  prompt: string; negativePrompt: string; model: string; referenceAssets: string[];
  status: "DRAFT" | "SELECTED" | "REJECTED" | "APPROVED_ASSET" | "APPROVED_FAMILY_REFERENCE";
  generatedAt: string; paths: Record<string, string> | { masterPath: string; heroPath: string; cardPath: string; thumbnailPath: string; objectPaths: Record<string, string> }; sourceCandidateId?: string;
};
export type UiAssetHistory = {
  id: string; timestamp: string; assetKey: string; familyId: FamilyId; prompt: string;
  negativePrompt: string; model: string; referenceAssets: string[]; candidateCount: number;
  resultCandidateIds: string[]; selectedCandidateId?: string; outcome: string;
  referenceCandidateIds?: string[]; referenceDescriptors?: ReferenceDescriptor[]; provider?: string; error?: string; approvalState?: string;
  referenceCandidates?: { candidateId: string; version: number }[];
};
export type UiAssetFamily = {
  familyId: FamilyId; displayName: string; familyArtDirection: string;
  masterReferenceAsset?: string;
  masterReference?: { candidateId: string; assetKey: string; version: number };
  additionalReferenceAssets: string[];
  additionalReferences?: { candidateId: string; assetKey: string; version: number }[];
  generationNotes: string; status: "DRAFT" | "LOCKED" | "UNLOCKED";
};
export type UiAssetManifest = {
  version: 1; updatedAt: string; families: UiAssetFamily[];
  candidates: UiAssetCandidate[]; history: UiAssetHistory[];
};

const familyFor = (record: AssetRecord): FamilyId | null =>
  record.category === "SUMMITREADY_SYMBOL" ? "SIGNATURE_SYMBOLS"
    : record.category === "RANK_ARTWORK" ? "RANKS"
      : record.category === "ACHIEVEMENT_ARTWORK" ? "ACHIEVEMENTS"
        : record.category === "EDITORIAL_IMAGE" ? "EDITORIAL" : null;
const FAMILY_NAMES: Record<FamilyId, string> = {
  SIGNATURE_SYMBOLS: "Signature Symbols", RANKS: "Ranks",
  ACHIEVEMENTS: "Achievements", EDITORIAL: "Editorial",
};
const FAMILY_DIRECTION: Record<FamilyId, string> = {
  SIGNATURE_SYMBOLS: "Shared line weight, geometry, corner treatment, negative space and silhouette language; preserve semantic distinction.",
  RANKS: "One premium alpine emblem system with increasing prestige and technical character; never fantasy, military or esports.",
  ACHIEVEMENTS: "One collectible badge construction with consistent outer geometry, material, lighting, density and icon language.",
  EDITORIAL: "SummitReady cinematic outdoor photography direction with varied compositions and intentional UI negative space.",
};

async function catalogue(): Promise<AssetRecord[]> {
  const workspaceRoot =
    path.basename(process.cwd()) === "api-server"
      ? path.resolve(process.cwd(), "../..")
      : process.cwd();
  const file = path.resolve(
    workspaceRoot,
    "docs/summitready-master-asset-inventory.json",
  );
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as { records: AssetRecord[] };
  return raw.records;
}
function initialManifest(): UiAssetManifest {
  return { version: 1, updatedAt: new Date(0).toISOString(), families: FAMILY_IDS.map((familyId) => ({
    familyId, displayName: FAMILY_NAMES[familyId], familyArtDirection: FAMILY_DIRECTION[familyId],
    additionalReferenceAssets: [], generationNotes: "", status: "DRAFT",
  })), candidates: [], history: [] };
}
async function readManifest(): Promise<{ value: UiAssetManifest; generation: number }> {
  const record = await readReviewBatchManifest<UiAssetManifest>(UI_ASSET_BATCH_ID);
  if (!record) return { value: initialManifest(), generation: 0 };
  // Compatibility for the original asset-key-only family reference shape.
  for (const family of record.value.families) {
    if (!family.masterReference && family.masterReferenceAsset) {
      const candidate = record.value.candidates.find((item) =>
        item.assetKey === family.masterReferenceAsset &&
        item.status === "APPROVED_FAMILY_REFERENCE");
      if (candidate) family.masterReference = { candidateId: candidate.candidateId, assetKey: candidate.assetKey, version: candidate.version };
    }
  }
  return { value: record.value, generation: record.generation };
}
async function writeManifest(manifest: UiAssetManifest, generation: number) {
  manifest.updatedAt = new Date().toISOString();
  return writeReviewBatchManifest(UI_ASSET_BATCH_ID, manifest, generation);
}
function requireCount(value: unknown): 1 | 2 | 4 {
  if (!CANDIDATE_COUNTS.includes(value as 1 | 2 | 4)) throw new Error("candidateCount must be 1, 2, or 4");
  return value as 1 | 2 | 4;
}
export function validateUiAssetCandidateCount(value: unknown): 1 | 2 | 4 {
  return requireCount(value);
}
export function validateUiAssetModel(value: unknown): "gpt-image-1" {
  if (value !== undefined && value !== "gpt-image-1") throw new Error("Only gpt-image-1 is supported");
  return "gpt-image-1";
}
export async function getUiAssetManifest() { return (await readManifest()).value; }
export async function validateUiAssetCandidate(candidateId: string, version: number, crop: string) {
  if (!["master", "hero", "card", "thumbnail"].includes(crop) || !Number.isInteger(version) || version < 1) {
    throw new Error("Invalid UI asset candidate request");
  }
  const manifest = await getUiAssetManifest();
  const candidate = manifest.candidates.find((item) => item.candidateId === candidateId && item.version === version);
  if (!candidate) throw new Error("UI asset candidate not found");
  return candidate;
}
export async function resolveUiAsset(assetKey: string) {
  const record = (await catalogue()).find((item) => item.asset_key === assetKey);
  if (!record) throw new Error(`Unknown UI asset: ${assetKey}`);
  const familyId = familyFor(record);
  if (!familyId || !record.generation_required || !record.generation_prompt) throw new Error("Asset is not eligible for draft generation");
  return { record, familyId };
}
export function resolveUiAssetPrompt(record: AssetRecord, family: UiAssetFamily, override?: string) {
  return `SummitReady global style: premium, restrained, credible outdoor visual language.\n${FAMILY_DIRECTION[family.familyId]}\n${family.generationNotes}\n${override?.trim() || record.generation_prompt}\nNegative prompt: ${record.negative_prompt || ""}`.trim();
}
function generationSize(aspectRatio: string | null): "1024x1024" | "1536x1024" | "1024x1536" {
  if (aspectRatio && /^([2-9]):1/.test(aspectRatio)) return "1536x1024";
  if (aspectRatio?.includes("portrait") || aspectRatio?.includes("9:16") || aspectRatio?.includes("4:5")) return "1024x1536";
  if (aspectRatio?.includes("landscape") || aspectRatio?.includes("16:9") || aspectRatio?.includes("3:2")) return "1536x1024";
  return "1024x1024";
}
function refsFor(manifest: UiAssetManifest, family: UiAssetFamily, requested: string[] = []) {
  return [...new Set([...(family.masterReference?.assetKey ? [family.masterReference.assetKey] : family.masterReferenceAsset ? [family.masterReferenceAsset] : []), ...family.additionalReferenceAssets, ...requested])].slice(0, MAX_REFERENCES);
}
export function resolveReferenceSelection(manifest: UiAssetManifest, family: UiAssetFamily, requested: string[] = []) {
  return refsFor(manifest, family, requested);
}
export function resolveReferenceMetadata(
  manifest: UiAssetManifest,
  family: UiAssetFamily,
  input: { referenceCandidates?: { candidateId: string; version: number }[]; refineCandidateId?: string; referenceAssets?: string[] } = {},
) {
  const descriptors = referenceDescriptors(manifest, family, input.referenceAssets ?? [], input.refineCandidateId, input.referenceCandidates ?? []);
  return { descriptors, inheritedMasterCount: family.masterReference ? 1 : 0, maxReferences: MAX_REFERENCES };
}
export function isCandidateReferenceEligible(candidate: Pick<UiAssetCandidate, "status">) {
  return candidate.status === "DRAFT" || candidate.status === "SELECTED" ||
    candidate.status === "APPROVED_ASSET" || candidate.status === "APPROVED_FAMILY_REFERENCE";
}
type ReferenceDescriptor = { candidateId: string; assetKey: string; version: number; objectPath: string };
function referenceDescriptors(manifest: UiAssetManifest, family: UiAssetFamily, requested: string[], refineCandidateId?: string, exactRequested: { candidateId: string; version: number }[] = []): ReferenceDescriptor[] {
  const result: ReferenceDescriptor[] = [];
  const add = (candidate: UiAssetCandidate | undefined, requireApproved = false) => {
    if (!candidate || candidate.familyId !== family.familyId || !isCandidateReferenceEligible(candidate) ||
      (requireApproved && !["APPROVED_ASSET", "APPROVED_FAMILY_REFERENCE"].includes(candidate.status))) return;
    const objectPath = (candidate.paths as { objectPaths?: Record<string, string> }).objectPaths?.master;
    if (!objectPath || result.some((item) => item.candidateId === candidate.candidateId && item.version === candidate.version)) return;
    result.push({ candidateId: candidate.candidateId, assetKey: candidate.assetKey, version: candidate.version, objectPath });
  };
  if (family.masterReference) add(manifest.candidates.find((item) =>
    item.candidateId === family.masterReference?.candidateId && item.version === family.masterReference.version), true);
  // Curator selections are required inputs and therefore precede optional
  // configured family additions. Refinement is also required and always wins.
  if (refineCandidateId) add(manifest.candidates.find((item) => item.candidateId === refineCandidateId), false);
  for (const descriptor of exactRequested) {
    add(manifest.candidates.find((item) => item.candidateId === descriptor.candidateId && item.version === descriptor.version), true);
  }
  for (const key of requested) {
    const matches = manifest.candidates.filter((item) => item.assetKey === key && item.familyId === family.familyId &&
      ["APPROVED_ASSET", "APPROVED_FAMILY_REFERENCE"].includes(item.status));
    if (matches.length > 1) throw new Error(`Reference ${key} is ambiguous; provide candidateId and version`);
    const candidate = matches[0];
    add(candidate, true);
  }
  if (result.length > MAX_REFERENCES) {
    const availableCuratorSlots = Math.max(0, MAX_REFERENCES -
      (family.masterReference ? 1 : 0) - (refineCandidateId ? 1 : 0));
    throw new Error(`Too many required curator references: ${result.length} exceeds MAX_REFERENCES=${MAX_REFERENCES}; available curator slots: ${availableCuratorSlots}`);
  }
  // Legacy configured string refs and the new immutable configured descriptors
  // are optional fill only.
  for (const descriptor of family.additionalReferences ?? []) {
    if (result.length >= MAX_REFERENCES) break;
    add(manifest.candidates.find((item) => item.candidateId === descriptor.candidateId && item.version === descriptor.version), true);
  }
  for (const key of family.additionalReferenceAssets ?? []) {
    if (result.length >= MAX_REFERENCES) break;
    const matches = manifest.candidates.filter((item) => item.assetKey === key && item.familyId === family.familyId &&
      ["APPROVED_ASSET", "APPROVED_FAMILY_REFERENCE"].includes(item.status));
    if (matches.length === 1) add(matches[0], true);
  }
  return result;
}
async function referenceBuffers(manifest: UiAssetManifest, family: UiAssetFamily, requested: string[], refineCandidateId?: string, exactRequested: { candidateId: string; version: number }[] = []) {
  const descriptors = referenceDescriptors(manifest, family, requested, refineCandidateId, exactRequested);
  return Promise.all(descriptors.map(async (descriptor) => {
    const downloaded = await downloadReviewObject(descriptor.objectPath);
    return { buffer: downloaded.buffer, mimeType: downloaded.mimeType, name: `${descriptor.candidateId}-${descriptor.version}` };
  }));
}
export async function createUiAssetCandidates(input: {
  assetKey?: string; candidateCount?: unknown; prompt?: string; referenceAssets?: string[];
  confirmed?: boolean; overrideFamilyWarning?: boolean; refineCandidateId?: string;
  familyId?: FamilyId; mode?: "family-master"; model?: string;
  referenceCandidates?: { candidateId: string; version: number }[];
}, provider: ImageProvider = defaultImageProvider) {
  if (input.confirmed !== true) throw new Error("Generation requires explicit confirmation");
  const count = requireCount(input.candidateCount ?? 4);
  validateUiAssetModel(input.model);
  const isFamilyMaster = input.mode === "family-master";
  if (isFamilyMaster && (!input.familyId || !FAMILY_IDS.includes(input.familyId))) throw new Error("familyId is required for family-master generation");
  const resolved = isFamilyMaster ? null : await resolveUiAsset(input.assetKey || "");
  const familyId = input.familyId ?? resolved?.familyId;
  if (!familyId) throw new Error("Family is required");
  if (!isFamilyMaster && input.familyId && input.familyId !== resolved?.familyId) {
    throw new Error("Catalogue asset family is derived and cannot be overridden");
  }
  const record = resolved?.record ?? {
    asset_key: `FAMILY-MASTER-${familyId}`, display_name: `${familyId} family master`,
    category: "FAMILY_MASTER", generation_required: true,
    generation_prompt: `Create the approved visual master reference for the ${FAMILY_NAMES[familyId]} family.`,
    negative_prompt: "text, logos, unrelated visual systems", aspect_ratio: "1:1",
    transparent_background: true, generation_model: "gpt-image-1",
  };
  const lock = await acquireReviewBatchGenerationLock(UI_ASSET_BATCH_ID);
  try {
    const current = await readManifest(); const manifest = current.value;
    let manifestGeneration = current.generation;
    const family = manifest.families.find((item) => item.familyId === familyId)!;
    if (!isFamilyMaster && (familyId === "RANKS" || familyId === "ACHIEVEMENTS") && !family.masterReferenceAsset && !input.overrideFamilyWarning) {
      throw new Error("Create or approve a family reference first for the most consistent results; set overrideFamilyWarning to proceed");
    }
    const refinementReference = input.refineCandidateId
      ? manifest.candidates.find((candidate) => candidate.candidateId === input.refineCandidateId)?.assetKey
      : undefined;
    if (input.refineCandidateId && !refinementReference) throw new Error("Unknown refinement candidate");
    if (input.refineCandidateId) {
      const refinement = manifest.candidates.find((candidate) => candidate.candidateId === input.refineCandidateId);
      if (!refinement || refinement.assetKey !== record.asset_key || refinement.familyId !== familyId ||
        !isCandidateReferenceEligible(refinement)) throw new Error("Refinement must use an eligible candidate from the same asset and family");
    }
    const refs = refsFor(manifest, family, input.referenceAssets);
    for (const descriptor of input.referenceCandidates ?? []) {
      const exact = manifest.candidates.find((candidate) => candidate.candidateId === descriptor.candidateId && candidate.version === descriptor.version);
      if (!exact || exact.familyId !== familyId || !["APPROVED_ASSET", "APPROVED_FAMILY_REFERENCE"].includes(exact.status)) {
        throw new Error("Each referenceCandidates descriptor must identify an approved same-family candidate and exact version");
      }
    }
    const descriptors = referenceDescriptors(manifest, family, [], input.refineCandidateId, input.referenceCandidates ?? []);
    const referenceCandidateIds = descriptors.map((descriptor) => descriptor.candidateId);
    const prompt = resolveUiAssetPrompt(record, family, input.prompt);
    const history: UiAssetHistory = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), assetKey: record.asset_key, familyId, prompt, negativePrompt: record.negative_prompt || "", model: "gpt-image-1", referenceAssets: refs, referenceCandidateIds, referenceDescriptors: descriptors, candidateCount: count, resultCandidateIds: [], outcome: "GENERATING" };
    await lock.assertOwned(); manifest.history.push(history); manifestGeneration = await writeManifest(manifest, manifestGeneration);
    const made: UiAssetCandidate[] = [];
    try {
      for (let index = 0; index < count; index++) {
        await lock.assertOwned();
        const preserveAlpha = familyId !== "EDITORIAL";
        const generated = await provider.generate(prompt, { referenceImages: await referenceBuffers(manifest, family, [], input.refineCandidateId, input.referenceCandidates ?? []), size: generationSize(record.aspect_ratio), transparent: preserveAlpha });
        const assetKey = record.asset_key;
        const version = Math.max(0, ...manifest.candidates.filter((c) => c.assetKey === assetKey).map((c) => c.version)) + 1;
        await lock.assertOwned();
        const stored = await uploadReviewCandidate(UI_ASSET_BATCH_ID, assetKey, version, await cropMasterImage(generated.buffer, { preserveAlpha }), { format: preserveAlpha ? "png" : "jpeg", runId: crypto.randomUUID() });
        const candidate: UiAssetCandidate = { candidateId: `${assetKey}-${version}-${crypto.randomUUID()}`, assetKey, familyId, version, prompt, negativePrompt: record.negative_prompt || "", model: "gpt-image-1", referenceAssets: refs, status: "DRAFT", generatedAt: new Date().toISOString(), paths: stored, sourceCandidateId: input.refineCandidateId };
        made.push(candidate); manifest.candidates.push(candidate); history.resultCandidateIds.push(candidate.candidateId); history.provider = generated.provider;
      }
      history.outcome = "DRAFT_CANDIDATES"; await lock.assertOwned(); manifestGeneration = await writeManifest(manifest, manifestGeneration); await lock.assertOwned(); return made;
    } catch (error) {
      history.outcome = made.length > 0 ? "PARTIAL_FAILURE" : "FAILED";
      history.error = `${error instanceof Error ? error.message : String(error)} (stored ${made.length} of ${count})`;
      await lock.assertOwned(); await writeManifest(manifest, manifestGeneration);
      throw new Error(`${error instanceof Error ? error.message : String(error)} (stored ${made.length} of ${count})`);
    }
  } finally { await lock.release(); }
}
export async function transitionUiAsset(candidateId: string, action: "select" | "reject" | "approve-as-asset" | "approve-as-family-reference", reason?: string) {
  const lock = await acquireReviewBatchGenerationLock(UI_ASSET_BATCH_ID);
  try {
  const current = await readManifest(); const manifest = current.value; const candidate = manifest.candidates.find((item) => item.candidateId === candidateId);
  if (!candidate) throw new Error("Unknown UI asset candidate");
  if (action === "reject" && !reason?.trim()) throw new Error("Rejecting a candidate requires a reason");
  const allowed: Record<UiAssetCandidate["status"], string[]> = {
    DRAFT: ["select", "reject"], SELECTED: ["approve-as-asset", "approve-as-family-reference", "reject"],
    REJECTED: [], APPROVED_ASSET: [], APPROVED_FAMILY_REFERENCE: [],
  };
  if (!allowed[candidate.status].includes(action)) throw new Error(`Cannot ${action} candidate in ${candidate.status} state`);
  if (action === "approve-as-family-reference" &&
    !candidate.assetKey.startsWith("FAMILY-MASTER-") &&
    candidate.assetKey !== "SR-SYM-ELEVATION-BANK-001") {
    throw new Error("Only a family master can become a family reference");
  }
  const family = manifest.families.find((item) => item.familyId === candidate.familyId)!;
  if (action === "approve-as-family-reference" && family.status === "LOCKED") throw new Error("Unlock the family before replacing its reference");
  candidate.status = action === "select" ? "SELECTED" : action === "reject" ? "REJECTED" : action === "approve-as-asset" ? "APPROVED_ASSET" : "APPROVED_FAMILY_REFERENCE";
  if (action === "approve-as-family-reference") {
    family.masterReferenceAsset = candidate.assetKey;
    family.masterReference = { candidateId: candidate.candidateId, assetKey: candidate.assetKey, version: candidate.version };
    family.status = "UNLOCKED";
  }
  manifest.history.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), assetKey: candidate.assetKey, familyId: candidate.familyId, prompt: candidate.prompt, negativePrompt: candidate.negativePrompt, model: candidate.model, referenceAssets: candidate.referenceAssets, candidateCount: 1, resultCandidateIds: [candidateId], selectedCandidateId: action === "select" ? candidateId : undefined, outcome: action.toUpperCase(), approvalState: candidate.status });
  await lock.assertOwned();
  await writeManifest(manifest, current.generation); return candidate;
  } finally { await lock.release(); }
}
export async function setUiAssetFamilyLock(familyId: FamilyId, locked: boolean, confirmed: boolean) {
  if (!confirmed) throw new Error("Family lock changes require explicit confirmation");
  const lock = await acquireReviewBatchGenerationLock(UI_ASSET_BATCH_ID);
  try {
  const current = await readManifest(); const family = current.value.families.find((item) => item.familyId === familyId);
  if (!family) throw new Error("Unknown asset family");
  if (locked && (!family.masterReference || !current.value.candidates.some((candidate) =>
    candidate.candidateId === family.masterReference?.candidateId && candidate.version === family.masterReference.version && candidate.status === "APPROVED_FAMILY_REFERENCE"))) {
    throw new Error("Cannot lock a family without an approved family master reference");
  }
  family.status = locked ? "LOCKED" : "UNLOCKED";
  current.value.history.push({ id: crypto.randomUUID(), timestamp: new Date().toISOString(), assetKey: family.masterReference?.assetKey || `FAMILY-${familyId}`, familyId, prompt: "", negativePrompt: "", model: "gpt-image-1", referenceAssets: [], candidateCount: 0, resultCandidateIds: [], outcome: locked ? "FAMILY_LOCK" : "FAMILY_UNLOCK" });
  await lock.assertOwned(); await writeManifest(current.value, current.generation); return family;
  } finally { await lock.release(); }
}
export { MAX_REFERENCES };