export type PrimaryTab = "home" | "explore" | "track" | "expeditions" | "you";
export type ShellMode = "training" | "expedition";

export function activePrimaryTabForSegments(segments: readonly string[]): PrimaryTab | null {
  const routeGroup = segments[0];
  const route = segments[segments.length - 1] ?? "";
  if (routeGroup === "(expedition)") {
    if (route === "base-camp") return "home";
    if (route === "track") return "track";
    if (route === "profile" || route === "account") return "you";
    if (["mountains", "route", "progress", "expedition-complete"].includes(route)) return "expeditions";
  }
  if (routeGroup === "(tabs)") {
    /* Training Plan is reached from Basecamp and belongs to that journey, so
       Basecamp stays lit while you are in it. It was marked as Explore, which
       told the user they had left the training journey when they had not.
       Containing links to explore routes does not make a screen Explore. */
    if (["dashboard", "plan", "v-home"].includes(route)) return "home";
    if (["explore", "hills", "v-mountain", "v-hills"].includes(route)) return "explore";
    if (["trails", "v-progress"].includes(route)) return "track";
    if (route === "account") return "you";
  }
  return null;
}

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