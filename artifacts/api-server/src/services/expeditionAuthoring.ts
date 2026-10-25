import { z } from "zod";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
export const stageInput = z.object({
  routeName: text(200),
  routeKey: optionalText(200),
  mountainId: z.string().uuid().optional(),
  region: optionalText(200),
  distanceKm: z.number().finite().positive().max(1000),
  ascentM: z.number().finite().min(0).max(20000),
  estimatedHours: z.number().finite().positive().max(240).optional(),
  difficulty: optionalText(80),
  dnaContribution: optionalText(1000),
  whySelected: optionalText(2000),
}).strict();
export const expeditionInput = z.object({
  challengeId: z.string().regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/, "Use 3–40 uppercase letters, numbers, hyphens or underscores"),
  challengeName: text(200),
  targetMountainName: text(200),
  targetRoute: optionalText(200),
  summary: optionalText(4000),
  regions: optionalText(500),
  difficulty: optionalText(80),
  recommendedDays: z.number().int().min(1).max(365).optional(),
  status: z.enum(["draft", "active", "hidden"]).default("draft"),
  reviewed: z.boolean().optional(),
  stages: z.array(stageInput).min(1).max(30),
  limitations: z.array(text(2000)).max(30).default([]),
}).strict();
export type ExpeditionInput = z.infer<typeof expeditionInput>;
export type CatalogueMountain = {
  id: string; name: string; country: string | null; region: string | null;
  latitude: number; longitude: number; elevationM: number | null; status: string;
};
export type PreviewEntry = {
  index: number; challengeId: string; challengeName: string;
  errors: string[]; warnings: string[]; expedition: ExpeditionInput | null;
};

export function expeditionTotals(stages: ExpeditionInput["stages"]) {
  return {
    totalDistanceKm: Math.round(stages.reduce((sum, s) => sum + s.distanceKm, 0) * 100) / 100,
    totalAscentM: Math.round(stages.reduce((sum, s) => sum + s.ascentM, 0)),
    estimatedHours: stages.every(s => s.estimatedHours !== undefined)
      ? Math.round(stages.reduce((sum, s) => sum + s.estimatedHours!, 0) * 100) / 100 : null,
  };
}

/** Pure validation, also re-run on commit; preview never grants write authority. */
export function previewExpeditions(raw: unknown, existingIds: Set<string>,
  mountains: Map<string, CatalogueMountain>, editingId?: string) {
  const envelope = z.object({ expeditions: z.array(z.unknown()).min(1).max(100) }).strict().safeParse(raw);
  if (!envelope.success) return { valid: false, entries: [] as PreviewEntry[],
    errors: ["Provide { \"expeditions\": [...] } with 1–100 expeditions."] };
  const ids = new Set<string>();
  const entries: PreviewEntry[] = envelope.data.expeditions.map((item, index) => {
    const parsed = expeditionInput.safeParse(item);
    const label = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const entry: PreviewEntry = { index, challengeId: String(label.challengeId ?? ""),
      challengeName: String(label.challengeName ?? ""), errors: [], warnings: [],
      expedition: parsed.success ? parsed.data : null };
    if (!parsed.success) {
      entry.errors = parsed.error.issues.map(issue => `${issue.path.join(".") || "expedition"}: ${issue.message}`);
      return entry;
    }
    const data = parsed.data;
    if (ids.has(data.challengeId)) entry.errors.push("Duplicate expedition ID in this file.");
    ids.add(data.challengeId);
    if (existingIds.has(data.challengeId) && data.challengeId !== editingId)
      entry.errors.push("This ID already exists. Bulk import never overwrites existing expeditions.");
    if (editingId && data.challengeId !== editingId) entry.errors.push("An existing expedition ID cannot be changed.");
    if (editingId && data.status === "active" && !data.reviewed)
      entry.errors.push("Confirm human review of route facts, access, hazards and limitations before making this available.");
    if (!editingId && data.status !== "draft")
      entry.warnings.push("Imported as a draft regardless of requested status. Review and make available separately.");
    if (!data.limitations.length) entry.warnings.push("Add safety limitations and what this preparation does not cover.");
    const routeKeys = new Set<string>();
    data.stages.forEach((stage, i) => {
      if (stage.routeKey) {
        if (routeKeys.has(stage.routeKey)) entry.errors.push(`Stage ${i + 1}: duplicate routeKey.`);
        routeKeys.add(stage.routeKey);
      }
      if (stage.mountainId && !mountains.has(stage.mountainId))
        entry.errors.push(`Stage ${i + 1}: mountainId was not found in the trusted summit catalogue.`);
      if (!stage.mountainId) entry.warnings.push(`Stage ${i + 1}: no catalogue mountain selected; link it in the editor.`);
      entry.warnings.push(`Stage ${i + 1}: walking distance and ascent are owner-curated, not verified by selecting a summit.`);
    });
    return entry;
  });
  const stageCount = entries.reduce((n, e) => n + (e.expedition?.stages.length ?? 0), 0);
  const errors = stageCount > 500 ? ["A batch may contain at most 500 stages. Split this file into smaller batches."] : [];
  return { valid: errors.length === 0 && entries.every(e => !e.errors.length), entries, errors };
}
