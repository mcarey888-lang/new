/**
 * What may be stored as a planned route.
 *
 * Kept apart from the route handler because the handler imports the database,
 * and the database module demands DATABASE_URL the moment it loads. Rules that
 * can only be tested with a database provisioned are rules that mostly do not
 * get tested — and these are the ones deciding what reaches a column.
 */

/** Guards against a single route filling a column. A snapped day's walk runs
 *  to a few thousand coordinates; past this something has gone wrong. */
export const MAX_GEOMETRY_POINTS = 20000;
export const MAX_ANCHORS = 2000;
export const MAX_NAME = 120;

export interface WirePoint { lat: number; lng: number }

export function validPoint(v: unknown): v is WirePoint {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o["lat"] === "number" && Number.isFinite(o["lat"]) &&
    typeof o["lng"] === "number" && Number.isFinite(o["lng"]) &&
    o["lat"] >= -90 && o["lat"] <= 90 && o["lng"] >= -180 && o["lng"] <= 180
  );
}

export type SaveValidation =
  | { ok: true; name: string }
  | { ok: false; reason: string };

/**
 * Whether a save request is one we will store.
 *
 * Reasons are specific because "too many points" and "bad coordinate" need
 * different fixes from whoever is calling, and one generic error makes both
 * into guesswork.
 */
export function validateSave(body: unknown): SaveValidation {
  const b = (body ?? {}) as Record<string, unknown>;

  const rawName = typeof b["name"] === "string" ? b["name"].trim() : "";
  if (!rawName) return { ok: false, reason: "a route needs a name" };
  if (rawName.length > MAX_NAME) return { ok: false, reason: "name too long" };

  const anchors = b["anchors"];
  const geometry = b["geometry"];
  if (!Array.isArray(anchors) || anchors.length < 2) {
    return { ok: false, reason: "a route needs at least two points" };
  }
  if (anchors.length > MAX_ANCHORS) return { ok: false, reason: "too many points" };
  if (!Array.isArray(geometry) || geometry.length < 2) {
    return { ok: false, reason: "a route needs a line" };
  }
  if (geometry.length > MAX_GEOMETRY_POINTS) return { ok: false, reason: "route too large" };

  /* Every coordinate checked, not a sample. One bad point stored is a route
     that draws itself across the Atlantic when it is next opened. */
  for (const a of anchors) if (!validPoint(a)) return { ok: false, reason: "bad coordinate" };
  for (const g of geometry) if (!validPoint(g)) return { ok: false, reason: "bad coordinate" };

  if (typeof b["lengthM"] !== "number" || !Number.isFinite(b["lengthM"]) || b["lengthM"] < 0) {
    return { ok: false, reason: "bad length" };
  }
  return { ok: true, name: rawName };
}

/**
 * A number, or null. Never a number coerced from nothing.
 *
 * Ascent is why this exists: a route whose heights could not be read has
 * unknown ascent, and storing that as 0 would tell someone their mountain day
 * is flat — a confident wrong answer rather than an honest absence.
 */
export function optionalInt(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}
