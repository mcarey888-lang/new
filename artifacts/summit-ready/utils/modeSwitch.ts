/**
 * Shared mode-switching confirmation logic.
 * Used by both DashboardScreen (Home tab) and AccountScreen (Account tab) so the
 * confirmation copy and behaviour stay in sync.
 */

import { Alert, Platform } from "react-native";
import type { SummitGoal, TrainingWeek } from "@/context/AppContext";

export function confirmModeSwitch(
  newMode: "expedition" | "virtual",
  summitGoal: SummitGoal,
  trainingPlan: TrainingWeek[],
  setSummitGoal: (goal: SummitGoal) => Promise<void>,
): void {
  const hasPlan = trainingPlan.length > 0;
  const modeLabel = newMode === "virtual" ? "Virtual" : "Expedition";

  function doSwitch() {
    // Strip the opposite-mode cache fields so they don't mislead the new mode.
    // Virtual fields (targetMountain, simulationScore etc.) are cleared when
    // switching to Expedition so a fresh fetch happens on next Virtual load.
    const stripped: Partial<SummitGoal> =
      newMode === "expedition"
        ? { targetMountain: undefined, simulationScore: undefined, simulationScoreBreakdown: undefined, virtualHills: undefined }
        : {};
    void setSummitGoal({ ...summitGoal, ...stripped, mode: newMode });
  }

  if (!hasPlan) {
    doSwitch();
    return;
  }

  if (Platform.OS === "web") {
    if (
      window.confirm(
        `Switch to ${modeLabel} mode?\n\nSwitching modes will start a new plan. Your current progress will be saved to your activity history but this plan will end.`,
      )
    ) {
      doSwitch();
    }
    return;
  }

  Alert.alert(
    `Switch to ${modeLabel} mode?`,
    "Switching modes will start a new plan. Your current progress will be saved to your activity history but this plan will end.",
    [
      { text: "Cancel", style: "cancel" },
      { text: "Switch", style: "destructive", onPress: doSwitch },
    ],
  );
}
