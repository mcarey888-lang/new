import type { ImageSourcePropType } from "react-native";
import type { GymExercise } from "@/components/ExercisePickerModal";

type ExerciseSession = {
  type?: string | null;
  label?: string | null;
  description?: string | null;
  gymExercise?: GymExercise | null;
};

/** Prefer the exercise a user selected; infer from older plan text only when absent. */
export function exerciseForSession(session: ExerciseSession | null | undefined): GymExercise | null {
  if (!session || session.type !== "cardio") return null;
  // Older sessions can retain a different gymExercise after their title was changed.
  // Never put another machine's artwork on a clearly labelled treadmill session.
  if ((session.label ?? "").toLowerCase().includes("incline treadmill")) return "treadmill";
  if (session.gymExercise) return session.gymExercise;
  const text = `${session.label ?? ""} ${session.description ?? ""}`.toLowerCase();
  if (text.includes("treadmill")) return "treadmill";
  if (text.includes("stepper") || text.includes("stairmaster") || text.includes("step machine")) return "stepper";
  if (text.includes("box step")) return "box-steps";
  if (text.includes("weighted stair")) return "weighted-stairs";
  if (text.includes("elliptical")) return "elliptical";
  // Untyped stair-repeat sessions are outdoor hill work, not a selected gym exercise.
  if (text.includes("stair repeat") || text.includes("flights")) return null;
  if (text.includes("outdoor") || text.includes("walk") || text.includes("run") || text.includes("hike")) return "outdoor";
  return null;
}

/** A true right-50% crop of each library image, with its large left-side title removed. */
const CARD_ARTWORK: Record<GymExercise, ImageSourcePropType> = {
  treadmill: require("@/assets/images/exercise-treadmill-right-half.png"),
  stepper: require("@/assets/images/exercise-stepper-right-half.png"),
  "box-steps": require("@/assets/images/exercise-box-steps-right-half.png"),
  "weighted-stairs": require("@/assets/images/exercise-weighted-stairs-right-half.png"),
  elliptical: require("@/assets/images/exercise-elliptical-right-half.png"),
  outdoor: require("@/assets/images/exercise-outdoor-right-half.png"),
};

/** The same exercise-specific crop used by the plan cards, sized by the caller. */
export function exerciseThumbnailArtwork(exercise: GymExercise): ImageSourcePropType {
  return CARD_ARTWORK[exercise];
}

export function exerciseCardArtwork(session: ExerciseSession | null | undefined): ImageSourcePropType | null {
  const exercise = exerciseForSession(session);
  return exercise ? CARD_ARTWORK[exercise] : null;
}