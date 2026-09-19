import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  canonicalActivities,
  canonicalActivityLinks,
} from "@workspace/db/schema";
import {
  projectCanonicalActivityHistory,
  type CanonicalHistoryFilter,
} from "../services/canonicalActivityProjections";
import type { CanonicalActivityLinkInput } from "../services/canonicalActivityContracts";

const router: IRouter = Router();
const filterSchema = z.enum([
  "all",
  "training",
  "expeditions",
  "mountains_free_hike",
]);

export function canonicalHistoryProjectionEnabled(): boolean {
  return (
    (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development")
    && process.env.CANONICAL_HISTORY_PROJECTION_ENABLED === "true"
  );
}

export function serializeCanonicalHistoryResponse(
  status: "active" | "shadowed",
  items: readonly ReturnType<typeof projectCanonicalActivityHistory>[number][],
) {
  return {
    status,
    reason: status === "shadowed" ? "legacy_equivalence_not_proven" as const : null,
    items: items.map((item) => ({
      id: item.id,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      primaryContext: item.primaryContext,
      activityKind: item.activityKind,
      occurredAt: item.occurredAt.toISOString(),
      startedAt: item.startedAt?.toISOString() ?? null,
      endedAt: item.endedAt?.toISOString() ?? null,
      durationSeconds: item.durationSeconds,
      distanceKm: item.distanceKm,
      recordedAscentM: item.recordedAscentM,
      validatedAscentM: item.validatedAscentM,
      descentM: item.descentM,
      lifecycle: item.lifecycle,
      evidenceState: item.evidenceState,
      visibility: item.visibility,
      matchedContexts: item.matchedContexts,
      links: item.links,
    })),
  };
}

export type CanonicalActivityRow = typeof canonicalActivities.$inferSelect;
export type CanonicalActivityLinkRow = typeof canonicalActivityLinks.$inferSelect;

export type CanonicalHistoryRouteDependencies = {
  readActivities: (ownerUserId: string) => Promise<readonly CanonicalActivityRow[]>;
  readLinks: (
    ownerUserId: string,
    activityIds: readonly string[],
  ) => Promise<readonly CanonicalActivityLinkRow[]>;
};

const defaultDependencies: CanonicalHistoryRouteDependencies = {
  readActivities: async (ownerUserId) => db
    .select()
    .from(canonicalActivities)
    .where(eq(canonicalActivities.ownerUserId, ownerUserId)),
  readLinks: async (ownerUserId, activityIds) => {
    if (activityIds.length === 0) return [];
    return db
      .select()
      .from(canonicalActivityLinks)
      .where(and(
        eq(canonicalActivityLinks.ownerUserId, ownerUserId),
        inArray(canonicalActivityLinks.activityId, activityIds),
      ));
  },
};

export function createCanonicalHistoryHandler(
  dependencies: CanonicalHistoryRouteDependencies = defaultDependencies,
): RequestHandler {
  return async (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Authentication required" });
    const parsedFilter = filterSchema.safeParse(req.query.filter ?? "all");
    if (!parsedFilter.success) {
      return res.status(400).json({ error: "Invalid history filter" });
    }

    if (!canonicalHistoryProjectionEnabled()) {
      return res.json(serializeCanonicalHistoryResponse("shadowed", []));
    }

    try {
      const activities = await dependencies.readActivities(userId);
      const activityIds = activities.map((activity) => activity.id);
      const links = await dependencies.readLinks(userId, activityIds);
      const linksByActivity = new Map<string, CanonicalActivityLinkRow[]>();
      for (const link of links) {
        const current = linksByActivity.get(link.activityId) ?? [];
        current.push(link);
        linksByActivity.set(link.activityId, current);
      }
      const projection = projectCanonicalActivityHistory(
        activities.map((activity) => ({
          ...activity,
          links: (linksByActivity.get(activity.id) ?? []).map((link) => ({
            linkType: link.linkType as CanonicalActivityLinkInput["linkType"],
            targetId: link.targetId,
            metadata: link.metadata as Record<string, unknown>,
          })),
        })),
        { ownerUserId: userId, filter: parsedFilter.data as CanonicalHistoryFilter },
      );
      return res.json(serializeCanonicalHistoryResponse("active", projection));
    } catch (error) {
      req.log.error({ error, userId }, "canonical history projection failed");
      return res.status(503).json({
        status: "unavailable",
        reason: "canonical_dependency_unavailable",
        items: [],
      });
    }
  };
}

router.get("/canonical-history", createCanonicalHistoryHandler());

export default router;