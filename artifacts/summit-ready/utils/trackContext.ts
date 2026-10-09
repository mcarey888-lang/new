import type { NearbyHill, PlanSession, TrainingWeek } from "@/context/AppContext";
import type { PendingHikeSelection } from "./pendingHikeSelection";
import type { ShellMode } from "./stateReliability";
import {
  buildExpeditionStageLaunchContext,
  buildFreeHikeLaunchContext,
  buildTrainingSessionLaunchContext,
} from "./trackingLaunchContext";

/**
 * What a recording is going to count towards.
 *
 * Three kinds, and the difference matters after the walk rather than during
 * it: a free hike counts towards nothing in particular, a training session
 * closes one session in the plan, and an expedition stage credits ascent to a
 * specific mountain. Picking it afterwards is guesswork, so it is picked
 * before Start and carried through everything in between.
 */
export type TrackContext =
  | { kind: "free" }
  | {
      kind: "training";
      sessionKey: string;
      label: string;
      targetElevationM: number | null;
      weekNumber: number;
      sessionIndex: number;
    }
  | {
      kind: "expedition";
      expeditionId: string;
      stage: NearbyHill;
    };

export const FREE_HIKE: TrackContext = { kind: "free" };

/** Which shell a context belongs to. Free hikes belong to both. */
export function shellFor(context: TrackContext): ShellMode | "any" {
  if (context.kind === "training") return "training";
  if (context.kind === "expedition") return "expedition";
  return "any";
}

/**
 * Whether a context may be used in the shell the person is actually in.
 *
 * Training and Expeditions keep separate progress, and a recording credited
 * to the wrong one cannot be moved afterwards. A stale selection surviving a
 * mode switch is the obvious way that happens, so it is dropped rather than
 * carried.
 */
export function isUsableIn(context: TrackContext, shellMode: ShellMode): boolean {
  const owner = shellFor(context);
  return owner === "any" || owner === shellMode;
}

/**
 * The expedition's next unfinished stage, if it has one.
 *
 * `completedRoutes` holds names, which is what the rest of the app compares
 * against; this keeps that rule rather than inventing a second one.
 */
export function nextExpeditionStage(
  stages: NearbyHill[] | undefined,
  completedRoutes: string[] | undefined,
): NearbyHill | null {
  if (!stages?.length) return null;
  const done = new Set((completedRoutes ?? []).map(name => name.toLowerCase()));
  return stages.find(stage => !done.has(stage.name.toLowerCase())) ?? null;
}

export interface ResolveInput {
  shellMode: ShellMode;
  /** A selection carried back from search, the route planner, or a previous
   *  visit. Ignored when it belongs to the other shell. */
  stored?: PendingHikeSelection | null;
  /** An explicit target, when Track was opened from Training or an
   *  expedition rather than from the tab bar. */
  requested?: TrackContext | null;
}

/**
 * What the Track screen should start on.
 *
 * Opening Track from the tab bar gives a free hike, ready to start — not the
 * next training session. Somebody who opens Track directly is usually about
 * to walk, and making them dismiss a session they did not choose is the kind
 * of friction that gets an app closed. Training and expedition contexts
 * arrive because a screen asked for them by name.
 */
export function resolveTrackContext(input: ResolveInput): TrackContext {
  const { shellMode, stored, requested } = input;

  /* An explicit ask wins, as long as it belongs here. */
  if (requested && isUsableIn(requested, shellMode)) return requested;

  const restored = stored ? contextFromStored(stored) : null;
  if (restored && isUsableIn(restored, shellMode)) return restored;

  return FREE_HIKE;
}

/** Rebuild a context from what was persisted across a detour. */
export function contextFromStored(stored: PendingHikeSelection): TrackContext | null {
  if (stored.trackingMode === "expedition-route" && stored.expeditionId) {
    const snapshot = (stored.stageSnapshot ?? {}) as Partial<NearbyHill>;
    return {
      kind: "expedition",
      expeditionId: stored.expeditionId,
      stage: {
        ...(snapshot as NearbyHill),
        name: stored.routeName,
        routeIdentityKey: stored.routeIdentityKey ?? snapshot.routeIdentityKey,
        summitIdentityKey: stored.summitIdentityKey ?? snapshot.summitIdentityKey,
        objectiveType: stored.objectiveType === "manual_summit" ? "manual_summit" : undefined,
      },
    };
  }
  if (stored.trackingMode === "training-session" && stored.stageSnapshot) {
    const snap = stored.stageSnapshot as Record<string, unknown>;
    const sessionKey = typeof snap["sessionKey"] === "string" ? snap["sessionKey"] : "";
    if (!sessionKey) return null;
    return {
      kind: "training",
      sessionKey,
      label: stored.routeName,
      targetElevationM: typeof snap["targetElevationM"] === "number" ? snap["targetElevationM"] : null,
      weekNumber: typeof snap["weekNumber"] === "number" ? snap["weekNumber"] : 0,
      sessionIndex: typeof snap["sessionIndex"] === "number" ? snap["sessionIndex"] : 0,
    };
  }
  if (stored.trackingMode === "freehike") return FREE_HIKE;
  return null;
}

/** Persist a context so a detour through search or the planner does not lose it. */
export function storedFromContext(
  context: TrackContext,
  userId: string,
): PendingHikeSelection {
  const base = { userId, savedAt: Date.now() };
  if (context.kind === "expedition") {
    return {
      ...base,
      routeName: context.stage.name,
      trackingMode: "expedition-route",
      expeditionId: context.expeditionId,
      routeIdentityKey: context.stage.routeIdentityKey,
      summitIdentityKey: context.stage.summitIdentityKey,
      objectiveType: context.stage.objectiveType,
      stageSnapshot: context.stage as unknown as Record<string, unknown>,
    };
  }
  if (context.kind === "training") {
    return {
      ...base,
      routeName: context.label,
      trackingMode: "training-session",
      expeditionId: null,
      stageSnapshot: {
        sessionKey: context.sessionKey,
        targetElevationM: context.targetElevationM,
        weekNumber: context.weekNumber,
        sessionIndex: context.sessionIndex,
      },
    };
  }
  return { ...base, routeName: "Free hike", trackingMode: "freehike", expeditionId: null };
}

/** Build a training context from a session in the plan. */
export function trainingContextFor(
  session: PlanSession,
  weekNumber: number,
  sessionIndex: number,
): TrackContext {
  return {
    kind: "training",
    sessionKey: session.id ?? `${weekNumber}-${sessionIndex}`,
    label: session.label,
    targetElevationM: session.targetElevation || null,
    weekNumber,
    sessionIndex,
  };
}

/** The first unfinished session in a week, or null when the week is done. */
export function nextTrainingSession(
  week: TrainingWeek | null | undefined,
  completed: Record<string, boolean>,
): { session: PlanSession; index: number } | null {
  if (!week?.sessions?.length) return null;
  const index = week.sessions.findIndex(
    (session, i) => !completed[session.id ?? `${week.weekNumber}-${i}`],
  );
  if (index === -1) return null;
  return { session: week.sessions[index]!, index };
}

/**
 * The params the recorder expects.
 *
 * Delegated to the existing builders rather than re-spelled, so the recorder
 * keeps receiving exactly what it already handles.
 */
export function launchParamsFor(
  context: TrackContext,
  shellMode: ShellMode,
  activeExpeditionId?: string | null,
): Record<string, string> {
  if (context.kind === "expedition") {
    return { ...buildExpeditionStageLaunchContext(context.stage, context.expeditionId, undefined) };
  }
  if (context.kind === "training") {
    return {
      ...buildTrainingSessionLaunchContext(
        {
          id: context.sessionKey,
          label: context.label,
          targetElevation: context.targetElevationM ?? 0,
        } as PlanSession,
        context.sessionIndex,
        context.weekNumber,
      ),
    };
  }
  return { ...buildFreeHikeLaunchContext(shellMode, activeExpeditionId) } as Record<string, string>;
}

/** What the bottom sheet calls this recording. */
export function contextLabel(context: TrackContext): string {
  switch (context.kind) {
    case "free": return "Free hike";
    case "training": return context.label;
    case "expedition": return context.stage.name;
  }
}

/** The line under it, or null when there is nothing true to add. */
export function contextDetail(context: TrackContext): string | null {
  if (context.kind === "training") {
    return context.targetElevationM
      ? `Training session · ${context.targetElevationM} m target`
      : "Training session";
  }
  if (context.kind === "expedition") {
    const stage = context.stage;
    const bits: string[] = ["Expedition stage"];
    if (stage.totalElevation) bits.push(`${Math.round(stage.totalElevation)} m`);
    else if (stage.elevation) bits.push(`${Math.round(stage.elevation)} m`);
    return bits.join(" · ");
  }
  return "Counts towards your elevation, not a plan";
}
