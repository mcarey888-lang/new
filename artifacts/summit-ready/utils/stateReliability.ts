export type ShellMode = "training" | "expedition";

export function canonicalShellRoot(mode: ShellMode): "/(tabs)/dashboard" | "/(expedition)/base-camp" {
  return mode === "expedition" ? "/(expedition)/base-camp" : "/(tabs)/dashboard";
}

type SessionWithOptionalId = { id?: string; label?: string; type?: string };
type WeekWithSessions<T extends SessionWithOptionalId> = {
  weekNumber: number;
  sessions: T[];
};

function stableTextHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Adds IDs once; existing IDs are never replaced, so edits and reordering are safe. */
export function ensurePlanSessionIds<T extends SessionWithOptionalId>(
  plan: WeekWithSessions<T>[],
): Array<WeekWithSessions<T & { id: string }>> {
  return plan.map(week => ({
    ...week,
    sessions: week.sessions.map((session, index) => ({
      ...session,
      id: session.id ?? `ps_${week.weekNumber}_${index}_${stableTextHash(`${session.type ?? ""}|${session.label ?? ""}`)}`,
    })),
  }));
}

/** Converts all known legacy week-index maps to their stable session-ID keys. */
export function migratePlanKeyedRecord<T>(
  record: Record<string, T>,
  plan: WeekWithSessions<SessionWithOptionalId>[],
): Record<string, T> {
  const migrated = { ...record };
  for (const week of plan) {
    week.sessions.forEach((session, index) => {
      if (!session.id) return;
      const legacyKey = `${week.weekNumber}-${index}`;
      if (migrated[session.id] === undefined && migrated[legacyKey] !== undefined) {
        migrated[session.id] = migrated[legacyKey];
      }
      delete migrated[legacyKey];
    });
  }
  return migrated;
}

export function countCompletedPlanWeeks(
  plan: WeekWithSessions<SessionWithOptionalId>[],
  submitted: Record<string, boolean>,
): number {
  return plan.filter(week =>
    week.sessions.length > 0 &&
    week.sessions.every((session, index) =>
      submitted[session.id ?? `${week.weekNumber}-${index}`] === true
    )
  ).length;
}

export function selectShellGoal<T>(
  mode: ShellMode,
  trainingGoal: T | null,
  expeditionGoal: T | null,
): T | null {
  return mode === "expedition" ? expeditionGoal : trainingGoal;
}

export function requiredExpeditionStageNames(expedition: {
  virtualHills?: Array<{ name: string }>;
  expeditionPlan?: { days: Array<{ routes: Array<{ name: string }> }> } | null;
}): string[] {
  const names = expedition.virtualHills?.map(hill => hill.name)
    ?? expedition.expeditionPlan?.days?.flatMap(day => day.routes.map(route => route.name))
    ?? [];
  return [...new Set(names.filter(Boolean))];
}

export function isExpeditionComplete(expedition: {
  completedRoutes: string[];
  virtualHills?: Array<{ name: string }>;
  expeditionPlan?: { days: Array<{ routes: Array<{ name: string }> }> } | null;
}): boolean {
  const required = requiredExpeditionStageNames(expedition);
  const completed = new Set(expedition.completedRoutes);
  return required.length > 0 && required.every(name => completed.has(name));
}

export function addUniqueCompletedRoute(completedRoutes: string[], routeName: string): string[] {
  return [...new Set([...completedRoutes, routeName].filter(Boolean))];
}