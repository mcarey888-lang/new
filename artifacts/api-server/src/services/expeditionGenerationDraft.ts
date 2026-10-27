import { randomUUID } from "node:crypto";
import { z } from "zod";

const hillSchema = z.object({
  name: z.string().min(1),
  routeName: z.string().optional(),
  routeIdentityKey: z.string().optional(),
  summitIdentityKey: z.string().optional(),
  region: z.string().optional(),
  elevation: z.number().finite().optional(),
  routeDistance: z.number().finite().optional(),
  duration: z.number().finite().optional(),
  grade: z.string().optional(),
  repeats: z.number().optional(),
  dataSource: z.string().optional(),
  routeDataStatus: z.string().optional(),
}).passthrough();
const resultSchema = z.object({
  targetProfile: z.object({ name: z.string().min(1), difficulty: z.string().optional() }).passthrough(),
  expedition: z.object({
    title: z.string().min(1), concept: z.string(),
    days: z.array(z.object({ routes: z.array(z.object({
      name: z.string(), routeIdentityKey: z.string().optional(), why: z.string().optional(),
    })) })),
  }).passthrough(),
  recommendedHills: z.array(hillSchema).min(1).max(30),
  provenance: z.object({
    warnings: z.array(z.string()).optional(),
    targetMountainSource: z.string().optional(),
    targetRouteSource: z.string().optional(),
    selectedTargetRouteName: z.string().nullable().optional(),
  }).passthrough().optional(),
});

/** Adapt the existing engine's selected routes; never manufacture geography or facts. */
export function expeditionGenerationDraft(raw: unknown) {
  const { targetProfile, expedition, recommendedHills, provenance } = resultSchema.parse(raw);
  const warnings = [
    "Generated suggestion only. Review route facts, access, hazards and source permissions before making it available.",
    "A summit catalogue link verifies identity, not a walking route or navigation track.",
    ...(provenance?.warnings ?? []),
  ];
  const plannedRoutes = expedition.days.flatMap(day => day.routes);
  const ordered = plannedRoutes.map(route => {
    const matches = recommendedHills.filter(hill => route.routeIdentityKey
      ? hill.routeIdentityKey === route.routeIdentityKey : hill.name === route.name);
    if (matches.length !== 1) throw new Error("The engine's stage identities do not match its selected routes. Nothing saved.");
    return { hill: matches[0]!, why: route.why };
  });
  if (ordered.length !== recommendedHills.length || new Set(ordered.map(x => x.hill)).size !== recommendedHills.length) {
    throw new Error("The engine's stage plan is incomplete or repeated. Nothing saved.");
  }
  const stages = ordered.map(({ hill, why }, index) => {
    const source = `Source: ${hill.dataSource ?? "not recorded"}; route facts: ${hill.routeDataStatus ?? "unverified"}.`;
    if (hill.routeDataStatus !== "verified") warnings.push(`Stage ${index + 1}: route figures are estimates, not verified route facts.`);
    const distanceKm = hill.routeDistance != null && hill.routeDistance > 0 && hill.routeDistance <= 1000
      ? hill.routeDistance : null;
    const ascentM = hill.elevation != null && hill.elevation >= 0 && hill.elevation <= 20000 ? hill.elevation : null;
    if (distanceKm == null || ascentM == null) warnings.push(`Stage ${index + 1}: missing distance or ascent. Supply sourced figures in the editor before saving.`);
    if ((hill.repeats ?? 1) !== 1) warnings.push(`Stage ${index + 1}: the engine suggested ${hill.repeats} repeats. This draft retains one full route, not multiplied figures; review the intended stages.`);
    const summit = /^sde:mountain:([0-9a-f-]{36})$/i.exec(hill.summitIdentityKey ?? "")?.[1];
    const mountainId = summit && z.string().uuid().safeParse(summit).success ? summit : undefined;
    if (!mountainId) warnings.push(`Stage ${index + 1}: no exact catalogue mountain ID supplied; link it in the editor.`);
    return {
      routeName: (hill.routeName || hill.name).slice(0, 200),
      ...(hill.routeIdentityKey && hill.routeIdentityKey.length <= 200 ? { routeKey: hill.routeIdentityKey } : {}),
      ...(mountainId ? { mountainId, catalogueMountain: { id: mountainId, name: hill.name } } : {}),
      region: hill.region?.slice(0, 200), distanceKm, ascentM,
      difficulty: hill.grade?.slice(0, 80),
      whySelected: `${why ?? ""} ${source}${hill.routeIdentityKey ? ` Route identity: ${hill.routeIdentityKey}.` : ""}`.trim().slice(0, 2000),
    };
  });
  const distinctWarnings = [...new Set(warnings)];
  const regions = [...new Set(stages.flatMap(stage => stage.region ? [stage.region] : []))].join(", ");
  return {
    draft: {
      challengeId: `EXP_${randomUUID().replaceAll("-", "").toUpperCase()}`,
      challengeName: expedition.title.slice(0, 200),
      targetMountainName: targetProfile.name.slice(0, 200),
      targetRoute: provenance?.selectedTargetRouteName?.slice(0, 200),
      summary: expedition.concept.slice(0, 4000), regions: regions.slice(0, 500),
      difficulty: targetProfile.difficulty?.slice(0, 80),
      recommendedDays: expedition.days.filter(day => day.routes.length > 0).length,
      status: "draft" as const, reviewed: false, updatedAt: "", stages,
      limitations: [
        ...distinctWarnings.slice(0, 29),
        `Target profile source: ${provenance?.targetMountainSource ?? "not recorded"}; target route source: ${provenance?.targetRouteSource ?? "not recorded"}.`,
      ].map(text => text.slice(0, 2000)),
    },
    warnings: distinctWarnings,
  };
}
