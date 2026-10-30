import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SummitGoal } from "../context/AppContext";

export function trainingSetupDraftKey(userId: string) {
  if (!userId) throw new Error("Sign in to save your fitness profile.");
  return `training_setup_draft_${userId}`;
}

export function parseTrainingSetupDraft(raw: string | null): SummitGoal | null {
  if (!raw) return null;
  const data = JSON.parse(raw);
  const goal = data?.goal;
  if (data?.version !== 1 || !goal || typeof goal.mountainName !== "string" ||
      !goal.mountainName.trim() || typeof goal.summitDate !== "string" ||
      !Number.isFinite(Date.parse(goal.summitDate)) ||
      ![goal.distance, goal.elevationGain, goal.highestAltitude, goal.trainingDaysPerWeek, goal.hillDaysPerWeek].every(Number.isFinite) ||
      goal.distance <= 0 || goal.elevationGain <= 0 || !Array.isArray(goal.equipment) ||
      typeof goal.location !== "string") {
    throw new Error("Your saved training setup could not be loaded. Please update your fitness profile.");
  }
  return goal as SummitGoal;
}

/** Profile/objective only: never generates a plan, readiness or training credit. */
export async function saveTrainingSetupDraft(userId: string, goal: SummitGoal) {
  const raw = JSON.stringify({ version: 1, goal });
  parseTrainingSetupDraft(raw);
  await AsyncStorage.setItem(trainingSetupDraftKey(userId), raw);
}

export async function loadTrainingSetupDraft(userId: string) {
  return parseTrainingSetupDraft(await AsyncStorage.getItem(trainingSetupDraftKey(userId)));
}

export async function clearTrainingSetupDraft(userId: string, expected: SummitGoal) {
  const current = await loadTrainingSetupDraft(userId);
  if (JSON.stringify(current) === JSON.stringify(expected)) {
    await AsyncStorage.removeItem(trainingSetupDraftKey(userId));
  }
}

/** The existing paid setters still enforce membership themselves. Keeping this
 * transition separate also makes failed storage cleanup safe to retry. */
export async function promoteTrainingSetupDraft(input: {
  userId: string; goal: SummitGoal; canTrain: boolean;
  activeGoal: SummitGoal | null; hasPlan: boolean;
  activated: { current: string | null };
  createPlan: (goal: SummitGoal) => Promise<void>;
  changePlan: (goal: SummitGoal) => Promise<void>;
}) {
  const { userId, goal, activated } = input;
  if (!input.canTrain) throw new Error("Pro is required to prepare a training programme.");
  if (new Date(goal.summitDate).getTime() <= Date.now()) {
    throw new Error("Your target date has passed. Update your mountain goal before building your programme.");
  }
  const signature = `${userId}:${JSON.stringify(goal)}`;
  const alreadyCurrent = input.hasPlan && JSON.stringify(input.activeGoal) === JSON.stringify(goal);
  if (activated.current !== signature && !alreadyCurrent) {
    await (input.activeGoal && input.hasPlan ? input.changePlan : input.createPlan)(goal);
    activated.current = signature;
  }
  await clearTrainingSetupDraft(userId, goal);
  return loadTrainingSetupDraft(userId);
}
