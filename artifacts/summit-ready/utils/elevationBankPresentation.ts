import type {
  ElevationBankResponse,
  ElevationBankUnavailable,
} from "@workspace/api-client-react";

export type ElevationBankPresentation =
  | { kind: "loading" }
  | { kind: "unavailable" }
  | { kind: "empty" }
  | { kind: "ready"; data: ElevationBankResponse };

export function getElevationBankPresentation(input: {
  isLoading: boolean;
  isError: boolean;
  data?: ElevationBankResponse | ElevationBankUnavailable;
}): ElevationBankPresentation {
  if (input.isLoading) return { kind: "loading" };
  if (
    input.isError
    || !input.data
    || input.data.status !== "available"
  ) {
    return { kind: "unavailable" };
  }
  if (input.data.lifetimeAscentM === 0 && input.data.recentCredits.length === 0) {
    return { kind: "empty" };
  }
  return { kind: "ready", data: input.data };
}

export function formatElevationBankMetres(value: number): string {
  return `${Math.round(value).toLocaleString()}m`;
}