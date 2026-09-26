/**
 * A target-resolution response deliberately omits the planned hill list.
 * Validate the branch we requested before the results screen can render it.
 */
export function validateExpeditionResultContract(
  body: {
    targetProfile?: unknown;
    resolutionOnly?: boolean;
    recommendedHills?: unknown;
    manualBuilder?: unknown;
  },
  request: { resolveOnly: boolean; mode: "automatic" | "manual" },
): void {
  if (!body.targetProfile || typeof body.targetProfile !== "object") {
    throw new Error("The expedition target could not be loaded. Please try again.");
  }
  if (request.resolveOnly) {
    if (body.resolutionOnly !== true) {
      throw new Error("The expedition target response was incomplete. Please try again.");
    }
    return;
  }
  if (!Array.isArray(body.recommendedHills)) {
    throw new Error("The expedition plan is missing its recommended hills. Please try again.");
  }
  if (request.mode === "manual" && !body.manualBuilder) {
    throw new Error("The custom expedition builder could not be loaded. Please try again.");
  }
}