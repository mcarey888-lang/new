import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  canonicalActivities,
  canonicalActivityLinks,
} from "@workspace/db/schema";
import {
  type CanonicalActivityLinkInput,
  validateCanonicalLinkTarget,
} from "./canonicalActivityContracts";

type DbClient = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db;

export interface CanonicalActivityLinkRequest {
  ownerUserId: string;
  activityId: string;
  links?: CanonicalActivityLinkInput[];
}

export interface CanonicalActivityLinkPlan {
  activityId: string;
  ownerUserId: string;
  links: CanonicalActivityLinkInput[];
}

export interface CanonicalActivityLinkWriteResult {
  activityId: string;
  ownerUserId: string;
  requested: number;
  inserted: number;
  links: CanonicalActivityLinkInput[];
}

export class CanonicalActivityLinkError extends Error {
  readonly code:
    | "invalid_link"
    | "owner_mismatch"
    | "real_summit_claim";

  constructor(
    code: CanonicalActivityLinkError["code"],
    message: string,
  ) {
    super(message);
    this.name = "CanonicalActivityLinkError";
    this.code = code;
  }
}

const SIMULATION_LINK_TYPES = new Set([
  "expedition",
  "expedition_stage",
]);

const REAL_SUMMIT_METADATA_KEYS = new Set([
  "realSummit",
  "realSummitCompletion",
  "realSummitEvidence",
  "summitCompletion",
  "summitCrown",
]);

function assertNoRealSummitClaim(link: CanonicalActivityLinkInput): void {
  if (!SIMULATION_LINK_TYPES.has(link.linkType)) return;

  const metadata = link.metadata ?? {};
  for (const key of REAL_SUMMIT_METADATA_KEYS) {
    if (metadata[key] === true) {
      throw new CanonicalActivityLinkError(
        "real_summit_claim",
        "Expedition links cannot imply real summit completion",
      );
    }
  }
}

function stableLinkKey(link: CanonicalActivityLinkInput): string {
  return `${link.linkType}\u001f${link.targetId}`;
}

/**
 * Pure planning boundary used by adapters and tests before a database write.
 * A repeated request for the same activity/link/target is intentionally one
 * planned link, matching the database unique index.
 */
export function planCanonicalActivityLinks(
  request: CanonicalActivityLinkRequest,
): CanonicalActivityLinkPlan {
  if (!request.ownerUserId.trim() || !request.activityId.trim()) {
    throw new CanonicalActivityLinkError(
      "invalid_link",
      "Canonical activity owner and ID are required",
    );
  }

  const seen = new Set<string>();
  const links: CanonicalActivityLinkInput[] = [];
  for (const requestedLink of request.links ?? []) {
    try {
      const link = validateCanonicalLinkTarget(requestedLink);
      assertNoRealSummitClaim(link);
      const key = stableLinkKey(link);
      if (!seen.has(key)) {
        seen.add(key);
        links.push(link);
      }
    } catch (error) {
      if (error instanceof CanonicalActivityLinkError) throw error;
      throw new CanonicalActivityLinkError(
        "invalid_link",
        error instanceof Error ? error.message : "Invalid canonical activity link",
      );
    }
  }

  return {
    activityId: request.activityId,
    ownerUserId: request.ownerUserId,
    links,
  };
}

/**
 * Checks ownership without exposing whether an activity exists for another
 * owner. Callers receive the same owner-mismatch error in both cases.
 */
export function assertCanonicalActivityOwner(
  activity: { id: string; ownerUserId: string } | undefined,
  ownerUserId: string,
  activityId: string,
): asserts activity is { id: string; ownerUserId: string } {
  if (!activity || activity.id !== activityId || activity.ownerUserId !== ownerUserId) {
    throw new CanonicalActivityLinkError(
      "owner_mismatch",
      "Canonical activity is not available to this owner",
    );
  }
}

export async function addCanonicalActivityLinksWithClient(
  client: DbClient,
  request: CanonicalActivityLinkRequest,
): Promise<CanonicalActivityLinkWriteResult> {
  const plan = planCanonicalActivityLinks(request);
  const [activity] = await client
    .select({
      id: canonicalActivities.id,
      ownerUserId: canonicalActivities.ownerUserId,
    })
    .from(canonicalActivities)
    .where(and(
      eq(canonicalActivities.id, plan.activityId),
      eq(canonicalActivities.ownerUserId, plan.ownerUserId),
    ))
    .limit(1);

  assertCanonicalActivityOwner(activity, plan.ownerUserId, plan.activityId);

  if (plan.links.length === 0) {
    return {
      activityId: plan.activityId,
      ownerUserId: plan.ownerUserId,
      requested: 0,
      inserted: 0,
      links: [],
    };
  }

  const inserted = await client
    .insert(canonicalActivityLinks)
    .values(plan.links.map((link) => ({
      activityId: plan.activityId,
      ownerUserId: plan.ownerUserId,
      linkType: link.linkType,
      targetId: link.targetId,
      metadata: link.metadata ?? {},
    })))
    .onConflictDoNothing()
    .returning({
      linkType: canonicalActivityLinks.linkType,
      targetId: canonicalActivityLinks.targetId,
    });

  return {
    activityId: plan.activityId,
    ownerUserId: plan.ownerUserId,
    requested: plan.links.length,
    inserted: inserted.length,
    links: plan.links,
  };
}

export async function addCanonicalActivityLinks(
  request: CanonicalActivityLinkRequest,
): Promise<CanonicalActivityLinkWriteResult> {
  return db.transaction((tx) => addCanonicalActivityLinksWithClient(tx, request));
}