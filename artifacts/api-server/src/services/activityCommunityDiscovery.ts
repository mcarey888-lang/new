import { sql } from "drizzle-orm";
import { z } from "zod";

/** Both recorder-prefixed and catalogue IDs identify the same mountain. */
export const communityMountainId = z.string().trim().min(1).max(256)
  .transform(value => value.replace(/^sde:mountain:/i, "").toLowerCase())
  .pipe(z.string().min(1).regex(/^[a-z0-9][a-z0-9:._-]*$/));

export const activityDiscoveryQuery = z.object({
  q: z.string().trim().max(120).default(""),
  mountainId: communityMountainId.optional(),
  page: z.coerce.number().int().min(0).max(1000).default(0),
  saved: z.enum(["1"]).optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  radiusKm: z.coerce.number().min(1).max(100).default(25),
});

export function communityDiscoveryFilters(query: z.infer<typeof activityDiscoveryQuery>) {
  // A user's search is literal text, not an unrestricted LIKE expression.
  const pattern = `%${query.q.replace(/[\\%_]/g, "\\$&")}%`;
  const mountain = query.mountainId
    ? sql`AND lower(regexp_replace(coalesce(b.snapshot->>'canonicalMountainId',''), '^sde:mountain:', '', 'i')) = ${query.mountainId}`
    : sql``;
  return sql`AND b.deleted_at IS NULL AND b.snapshot->>'name' ILIKE ${pattern} ${mountain}`;
}
