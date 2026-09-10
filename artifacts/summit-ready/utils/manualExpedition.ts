export type ManualDnaRoute = {
  gainM: number;
  distanceKm: number;
  averageGradientPercent?: number | null;
  technicalSuitability?: number | null;
};

export type ManualDna = {
  gainM: number;
  distanceKm: number;
  averageGradientPercent: number | null;
  gainMatch: number;
  distanceMatch: number;
  gradientSimilarity: number;
  technicalSuitability: number;
  overall: number;
  remainingGainM: number;
  remainingDistanceKm: number;
  range: "below" | "within" | "within_widened" | "above";
};
export function normalizeManualTechnicalTarget(value?: string | null, fallback = "walking"): string {
  const text = (value ?? "").toLowerCase();
  if (text.includes("alpine") || text.includes("technical")) return "technical";
  if (text.includes("scramble") || text.includes("hard") || text.includes("exposed")) return "scrambling";
  if (text.includes("moderate")) return "moderate";
  return fallback;
}
export const CUSTOM_EXPEDITION_LABELS = {
  equivalent: "YOUR EQUIVALENT SUMMITS",
  matchScore: "SUMMIT MATCH SCORE",
} as const;

export type ManualSetupState = {
  targetMountain: string;
  targetRouteIdentityKey?: string | null;
  days?: number | null;
  routeSelectionRequired?: boolean;
};
export function canShowManualChoices(state: ManualSetupState): boolean {
  return state.targetMountain.trim().length >= 2
    && (!state.routeSelectionRequired || !!state.targetRouteIdentityKey)
    && state.days != null && state.days >= 1;
}
export function choiceRequest(mode: "automatic" | "manual", state: ManualSetupState) {
  return {
    mode,
    resolveOnly: false,
    targetRouteIdentityKey: state.targetRouteIdentityKey,
    daysOverride: state.days,
  };
}
export type ManualSelection = { keys: string[]; assignments: Record<string, number> };
export function removeSelection(selection: ManualSelection, key: string): ManualSelection {
  const assignments = { ...selection.assignments };
  delete assignments[key];
  return { keys: selection.keys.filter(item => item !== key), assignments };
}
export function reorderSelection(selection: ManualSelection, index: number, direction: -1 | 1): ManualSelection {
  const next = index + direction;
  if (index < 0 || next < 0 || next >= selection.keys.length) return selection;
  const keys = [...selection.keys];
  [keys[index], keys[next]] = [keys[next], keys[index]];
  return { ...selection, keys };
}
export function requiresExtraDay(assignments: Record<string, number>, selectedKeys: string[], days: number): boolean {
  return selectedKeys.some((key, index) => (assignments[key] ?? index + 1) > days);
}
export function suggestionTransition(currentScore: number, projectedScore: number, confirmed: boolean) {
  return { preview: !confirmed, added: confirmed && projectedScore > currentScore };
}
export type ManualSaveSnapshot = {
  selectedRouteIdentityKeys: string[];
  dayAssignments: Record<string, number>;
  dna: ManualDna;
  routes: Array<{ routeIdentityKey: string; summitIdentityKey: string; dataSource?: string; confidence?: string }>;
};
export function hydrateManualSnapshot(snapshot?: ManualSaveSnapshot | null): ManualSelection {
  if (!snapshot) return { keys: [], assignments: {} };
  const keys = snapshot.selectedRouteIdentityKeys;
  return {
    keys: [...keys],
    assignments: Object.fromEntries(keys.filter(key => snapshot.dayAssignments[key] != null)
      .map(key => [key, snapshot.dayAssignments[key]])),
  };
}
export function buildManualSaveSnapshot(snapshot: ManualSaveSnapshot): ManualSaveSnapshot {
  const selected = new Set(snapshot.selectedRouteIdentityKeys);
  return {
    ...snapshot,
    selectedRouteIdentityKeys: [...snapshot.selectedRouteIdentityKeys],
    dayAssignments: Object.fromEntries(Object.entries(snapshot.dayAssignments).filter(([key]) => selected.has(key))),
    routes: snapshot.routes.filter(route => selected.has(route.routeIdentityKey)),
  };
}

export type SelectionControllerState = {
  keys: string[];
  assignments: Record<string, number>;
  routes: Record<string, ManualDnaRoute & { summitIdentityKey: string }>;
  target: { gainM: number; distanceKm: number; averageGradientPercent?: number | null };
};
export function applySelectionChange(
  state: SelectionControllerState,
  action: { type: "add" | "remove" | "replace" | "reorder"; key: string; replacementKey?: string; direction?: -1 | 1 },
) {
  let keys = [...state.keys];
  let assignments = { ...state.assignments };
  if (action.type === "add" && !keys.includes(action.key)) keys.push(action.key);
  if (action.type === "remove") ({ keys, assignments } = removeSelection({ keys, assignments }, action.key));
  if (action.type === "replace" && action.replacementKey) {
    const index = keys.indexOf(action.key);
    if (index >= 0) { keys[index] = action.replacementKey; assignments[action.replacementKey] = assignments[action.key]; delete assignments[action.key]; }
  }
  if (action.type === "reorder") ({ keys } = reorderSelection({ keys, assignments }, keys.indexOf(action.key), action.direction ?? 1));
  const dna = calculateManualDna(keys.map(key => state.routes[key]).filter(Boolean), state.target);
  return { ...state, keys, assignments, dna };
}
export function assignObjectiveDay(
  state: { assignments: Record<string, number>; selectedKeys: string[]; days: number },
  key: string, requestedDay: number, evidence?: { trustedCombinedRoute?: boolean; trailheadCompatible?: boolean },
) {
  const occupied = state.selectedKeys.some(other => other !== key && (state.assignments[other] ?? 0) === requestedDay);
  if (occupied && !evidence?.trustedCombinedRoute && !evidence?.trailheadCompatible) {
    return { ...state, accepted: false, reason: "Separate objectives require separate days without trusted route compatibility.", requiresConfirmation: false };
  }
  return { ...state, assignments: { ...state.assignments, [key]: requestedDay }, accepted: true, requiresConfirmation: requestedDay > state.days };
}
export async function confirmSuggestionFlow(
  state: SelectionControllerState, suggestion: { key: string; route: SelectionControllerState["routes"][string] },
  confirmFn: () => Promise<boolean> | boolean,
) {
  const confirmed = await confirmFn();
  return confirmed ? applySelectionChange(state, { type: "add", key: suggestion.key }) : { ...applySelectionChange(state, { type: "reorder", key: "", direction: 1 }), keys: state.keys, assignments: state.assignments, dna: calculateManualDna(state.keys.map(key => state.routes[key]), state.target) };
}
export async function confirmExtraDayFlow(
  requestedDay: number, plannedDays: number, confirmFn: () => Promise<boolean> | boolean,
) {
  return requestedDay <= plannedDays || await confirmFn();
}
export async function dispatchCreationChoice(
  input: ManualSetupState & { location: string; radius: number },
  fetchFn: (payload: ReturnType<typeof choiceRequest>) => Promise<unknown>,
  mode: "automatic" | "manual",
) {
  if (!canShowManualChoices(input)) return false;
  await fetchFn(choiceRequest(mode, input));
  return true;
}

const symmetric = (actual: number, target: number) =>
  actual > 0 && target > 0 ? Math.round(Math.min(actual / target, target / actual) * 100) : 0;

export function calculateManualDna(routes: ManualDnaRoute[], target: {
  gainM: number; distanceKm: number; averageGradientPercent?: number | null;
}): ManualDna {
  const gainM = routes.reduce((sum, route) => sum + route.gainM, 0);
  const distanceKm = routes.reduce((sum, route) => sum + route.distanceKm, 0);
  const weightedGradient = routes.reduce((sum, route) => sum + (route.averageGradientPercent ?? 0) * route.distanceKm, 0);
  const averageGradientPercent = distanceKm > 0 ? Math.round(weightedGradient / distanceKm * 100) / 100 : null;
  const gradientSimilarity = averageGradientPercent != null && target.averageGradientPercent
    ? symmetric(averageGradientPercent, target.averageGradientPercent) : 0;
  const technical = routes.filter(route => route.technicalSuitability != null);
  const technicalSuitability = technical.length
    ? Math.round(technical.reduce((sum, route) => sum + route.technicalSuitability!, 0) / technical.length) : 0;
  const gainMatch = symmetric(gainM, target.gainM);
  const distanceMatch = symmetric(distanceKm, target.distanceKm);
  const gainRatio = target.gainM > 0 ? gainM / target.gainM : 0;
  const distanceRatio = target.distanceKm > 0 ? distanceKm / target.distanceKm : 0;
  const normal = Math.abs(gainRatio - 1) <= .15 && Math.abs(distanceRatio - 1) <= .20;
  const widened = Math.abs(gainRatio - 1) <= .30 && Math.abs(distanceRatio - 1) <= .35;
  return {
    gainM, distanceKm, averageGradientPercent, gainMatch, distanceMatch,
    gradientSimilarity, technicalSuitability,
    overall: Math.round((gainMatch + distanceMatch) / 2),
    remainingGainM: target.gainM - gainM, remainingDistanceKm: target.distanceKm - distanceKm,
    range: normal ? "within" : widened ? "within_widened" : gainRatio < 1 || distanceRatio < 1 ? "below" : "above",
  };
}