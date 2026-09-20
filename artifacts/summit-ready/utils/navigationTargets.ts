export type PrimaryTab = "home" | "explore" | "track" | "expeditions" | "you";
export type ShellMode = "training" | "expedition";

export function primaryTabTarget(
  tab: PrimaryTab,
  shellMode: ShellMode,
  activeExpeditionId: string | null | undefined,
): string {
  switch (tab) {
    case "home":
      if (shellMode === "training") return "/(tabs)/dashboard";
      return activeExpeditionId ? "/(expedition)/base-camp" : "/(expedition)/mountains";
    case "explore":
      return "/(tabs)/explore";
    case "track":
      return shellMode === "training" ? "/(tabs)/trails" : "/(expedition)/track";
    case "expeditions":
      return "/(expedition)/mountains";
    case "you":
      return shellMode === "training" ? "/(tabs)/account" : "/(expedition)/profile";
  }
}