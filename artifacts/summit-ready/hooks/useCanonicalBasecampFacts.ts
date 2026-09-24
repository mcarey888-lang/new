import { useEffect, useState } from "react";

import type { MountainLookupResponse } from "@/utils/mountainDetailPresentation";

/** The Basecamp location/altitude row contains verified catalogue facts only. */
export interface CanonicalBasecampFacts {
  elevationM: number | null;
  region: string | null;
  country: string | null;
}

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

export function useCanonicalBasecampFacts(mountainName: string): CanonicalBasecampFacts | null {
  const [result, setResult] = useState<{ name: string; facts: CanonicalBasecampFacts | null } | null>(null);

  useEffect(() => {
    if (!mountainName.trim()) return;
    const controller = new AbortController();
    fetch(`${API_BASE}/mountain-lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: mountainName.trim() }),
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Mountain lookup failed: ${response.status}`);
        return response.json() as Promise<MountainLookupResponse>;
      })
      .then((data) => {
        if (data.source !== "canonical" || !data.canonicalIdentity?.id) {
          setResult({ name: mountainName, facts: null });
          return;
        }
        const elevation = data.trustedFacts?.elevationM;
        setResult({
          name: mountainName,
          facts: {
            elevationM: typeof elevation === "number" && Number.isFinite(elevation) && elevation > 0
              ? elevation : null,
            region: data.region?.trim() || null,
            country: data.country?.trim() || null,
          },
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.warn("Verified mountain facts unavailable", error);
          setResult({ name: mountainName, facts: null });
        }
      });
    return () => controller.abort();
  }, [mountainName]);

  // Never show the last mountain's facts while the selected objective changes.
  return result?.name === mountainName ? result.facts : null;
}