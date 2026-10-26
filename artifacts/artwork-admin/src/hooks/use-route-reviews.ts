import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { adminKeyHeader } from "@/lib/adminKey";
import { readArtworkJson } from "@/lib/artworkResponse";

export type RouteCandidateInput = {
  candidateKey: string; revisionVersion: string; geometryFile: string;
  sourceManifest: Record<string, unknown>[];
  canonicalGeometryId?: string;
  profileFile?: string; terrainManifestFile?: string;
};
export type RouteReviewPreview = {
  valid: boolean; errors: string[]; warnings: string[]; blockers: string[];
  pointCount: number; bindingCurrent: boolean; profileIncluded: boolean;
  elevationCoverageComplete: boolean;
  files: { name: string; sha256: string; bytes: number }[];
};
export type RouteRevision = {
  id: string; candidateKey: string; revisionVersion: string;
  canonicalGeometryId: string | null; geometrySha256: string;
  sourceManifestSha256: string; profileSha256: string | null;
  terrainManifestSha256: string | null; createdAt: string;
  geometryDigestAlgorithm: string; manifestDigestAlgorithm: string;
  sourceManifest: Record<string, unknown>[];
  geometry?: { type: "LineString"; coordinates: number[][] };
  bindingCurrent: boolean; eligible: boolean;
  latestDecision: "approved" | "revoked" | null;
  latestMapReview: "looks_correct" | "needs_changes" | "rejected" | null;
  latestDecisionId: string | null; latestValidationId: string | null;
  reviewFileHashes: { files?: Record<string, { sha256: string; bytes: number }> };
};
export type RouteValidation = {
  id: string; outcome: "needs_review" | "rejected" | "accepted";
  evaluatorVersion: string; evaluatorSha256: string; reviewAuthority: string;
  diagnostics: string[]; createdAt: string; validUntil: string | null;
  sourceRightsReviewed: boolean; routeAccessReviewed: boolean;
  terrainRightsReviewed: boolean; profileReviewed: boolean;
};
export type RouteDecision = {
  id: string; decision: "approved" | "revoked"; validationId: string;
  reason: string; reviewAuthority: string; createdAt: string;
};
export type RouteMapReview = {
  id: string; reviewRevisionId: string;
  outcome: "looks_correct" | "needs_changes" | "rejected";
  note: string; createdAt: string;
};
export type RouteMapReviewInput = {
  outcome: RouteMapReview["outcome"]; note?: string; expectedReviewId: string | null;
};
export type RouteReviewDetail = {
  revision: RouteRevision; validations: RouteValidation[]; decisions: RouteDecision[];
  mapReviews?: RouteMapReview[];
};
export type RouteValidationInput = {
  outcome: "needs_review" | "rejected" | "accepted";
  sourceRightsReviewed: boolean; routeAccessReviewed: boolean;
  terrainRightsReviewed: boolean; profileReviewed: boolean;
  authority: string; reason: string; validUntil?: string;
};
export type RouteDecisionInput = {
  decision: "approved" | "revoked"; validationId: string;
  expectedDecisionId: string | null; authority: string; reason: string;
};
const BASE = "/api/admin/route-reviews";
export async function routeReviewCall<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const key = sessionStorage.getItem("summitready-admin-key");
  const response = await fetch(`${BASE}${path}`, {
    method, cache: "no-store",
    headers: { ...(key ? adminKeyHeader(key) : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return readArtworkJson<T>(response);
}
export function useRouteReviews() {
  return useQuery({
    queryKey: ["route-reviews"], staleTime: 0, refetchOnWindowFocus: true, refetchInterval: 30_000,
    queryFn: () => routeReviewCall<{ environment: "development"; items: RouteRevision[] }>("/"),
  });
}
export function useRouteReview(id: string | null) {
  return useQuery({
    queryKey: ["route-reviews", id], enabled: !!id, staleTime: 0,
    refetchOnWindowFocus: true, refetchInterval: 30_000,
    queryFn: () => routeReviewCall<RouteReviewDetail>(`/${id}`),
  });
}
export function usePreviewRouteReview() {
  return useMutation({ mutationFn: (input: RouteCandidateInput) => routeReviewCall<RouteReviewPreview>("/preview", "POST", input) });
}
export function useImportRouteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RouteCandidateInput) => routeReviewCall<{ id: string }>("/import", "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["route-reviews"] }),
  });
}
export function useValidateRouteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: RouteValidationInput & { id: string }) =>
      routeReviewCall<{ id: string }>(`/${id}/validate`, "POST", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["route-reviews"] }),
  });
}
export function useDecideRouteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: RouteDecisionInput & { id: string }) =>
      routeReviewCall<{ id: string }>(`/${id}/decision`, "POST", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["route-reviews"] }),
  });
}
export function useSaveMapReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: RouteMapReviewInput & { id: string }) =>
      routeReviewCall<RouteMapReview>(`/${id}/map-review`, "POST", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["route-reviews"] }),
  });
}
export async function downloadRouteReviewFile(id: string, name: string) {
  const key = sessionStorage.getItem("summitready-admin-key");
  const response = await fetch(`${BASE}/${id}/files/${encodeURIComponent(name)}`, {
    cache: "no-store", headers: key ? adminKeyHeader(key) : {},
  });
  if (!response.ok) return readArtworkJson<never>(response);
  const url = URL.createObjectURL(await response.blob());
  const a = document.createElement("a"); a.href = url; a.download = `${name}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type ExpeditionRouteQueueRoute = {
  routeKey: string; routeName: string; region: string; stageUses: number;
  expeditionIds: string[]; distanceKm: number[]; ascentM: number[];
  reviews: { id: string; candidateKey: string; revisionVersion: string; canonicalGeometryId: string | null }[];
  sourceLeads: { id: number; name: string; url: string; status: string }[];
  blockers: string[];
};
export type ExpeditionRouteQueue = {
  environment: "development"; generatedAt: string | null;
  summary: { expeditions: number; stages: number; distinctRoutes: number };
  routes: ExpeditionRouteQueueRoute[];
};
export function useExpeditionRouteQueue() {
  return useQuery({
    queryKey: ["route-reviews", "expedition-queue"], staleTime: 0, refetchOnWindowFocus: true,
    queryFn: () => routeReviewCall<ExpeditionRouteQueue>("/expedition-queue"),
  });
}

export function useEditRouteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; coordinates: number[][]; note?: string; expectedLatestRevisionId: string }) =>
      routeReviewCall<{ id: string }>(`/${id}/edit`, "POST", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["route-reviews"] }),
  });
}
