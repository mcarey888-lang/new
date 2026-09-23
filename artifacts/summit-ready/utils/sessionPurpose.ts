/**
 * Why a training session matters for the user's actual mountain.
 *
 * Reads the Training Plan's own session and the user's summit goal. It writes
 * no targets, changes no session logic and invents nothing: if the plan has no
 * description, or there is no summit goal, it returns what it genuinely has and
 * the UI omits the rest.
 */
export type SessionType = "cardio" | "hill" | "bigDay";

export interface SessionPurposeInput {
  type: SessionType;
  /** The plan's own description for this session, if it has one. */
  description?: string | null;
  targetElevation?: number | null;
  mountainName?: string | null;
}

export interface SessionPurpose {
  /** What this kind of session builds. Fixed copy per type, not generated. */
  builds: string;
  /** The plan's own description, when it has one. */
  detail: string | null;
  /** How it connects to the objective — only when a goal exists. */
  relationship: string | null;
}

const BUILDS: Record<SessionType, string> = {
  cardio: "Aerobic base — the engine behind every long mountain day.",
  hill:   "Sustained climbing — the specific strength a mountain asks for.",
  bigDay: "Time on feet — rehearsing the length of the real day.",
};

export function sessionPurpose(input: SessionPurposeInput): SessionPurpose {
  const mountain = input.mountainName?.trim() || null;
  const detail = input.description?.trim() || null;
  const elev = typeof input.targetElevation === "number"
    && Number.isFinite(input.targetElevation) && input.targetElevation > 0
      ? Math.round(input.targetElevation) : null;

  let relationship: string | null = null;
  if (mountain) {
    relationship = elev !== null
      ? `${elev} m of climbing, banked toward ${mountain}.`
      : `Part of your preparation for ${mountain}.`;
  }
  return { builds: BUILDS[input.type] ?? BUILDS.cardio, detail, relationship };
}
