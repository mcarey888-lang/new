import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminKeyHeader } from "@/lib/adminKey";
import { readArtworkJson } from "@/lib/artworkResponse";
import { generateAdminExpedition, getExpeditionArtworkLibrary, assignExpeditionArtwork, getAdminExpeditionTargetProfile, getGetArtworkStatusQueryKey, type VirtualExpeditionSearchInput, type ExpeditionArtworkAssignment } from "@workspace/api-client-react";

const BASE = "/api/admin/expeditions";

function adminHeaders(): Record<string, string> {
  const key = sessionStorage.getItem("summitready-admin-key");
  return key ? adminKeyHeader(key) : {};
}

async function call<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...adminHeaders() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return readArtworkJson<T>(res);
}

export type CatalogueMountain = {
  id: string; name: string; country?: string | null; region?: string | null;
  latitude?: number | null; longitude?: number | null; elevationM?: number | null; status?: string;
};
export type ExpeditionStage = {
  routeName: string; region?: string | null; distanceKm: number; ascentM: number;
  estimatedHours?: number | null; difficulty?: string | null; dnaContribution?: string | null;
  whySelected?: string | null; routeKey?: string | null; mountainId?: string | null;
  catalogueMountain?: CatalogueMountain | null;
};
export type ExpeditionSummary = {
  challengeId: string; challengeName: string; targetMountainName: string; targetRoute?: string | null;
  summary?: string | null; regions?: string[] | string | null; difficulty?: string | null;
  recommendedDays?: number | null; status: string; updatedAt: string;
  imageVersion?: number | null; approved?: boolean | null; imageStatus?: string | null;
  stages?: ExpeditionStage[]; limitations?: string[];
};
export type ExpeditionInput = Record<string, unknown>;
export type PreviewEntry = {
  index: number; challengeId: string; challengeName: string;
  errors: string[]; warnings: string[]; expedition: ExpeditionInput | null;
};
export type PreviewResult = { valid: boolean; entries: PreviewEntry[]; errors: string[] };

export function useExpeditionList() {
  return useQuery({ queryKey: ["expeditions"], queryFn: () => call<{ expeditions: ExpeditionSummary[] }>(""), retry: false });
}
export function useExpedition(id: string | null) {
  return useQuery({
    queryKey: ["expeditions", id], enabled: !!id,
    queryFn: () => call<{ expedition: ExpeditionSummary }>(`/${encodeURIComponent(id!)}`),
  });
}
export function useCatalogueSearch(q: string) {
  return useQuery({
    queryKey: ["expeditions-catalogue", q], enabled: q.trim().length >= 2,
    queryFn: () => call<{ items: CatalogueMountain[]; hasMore: boolean }>(`/catalogue?q=${encodeURIComponent(q.trim())}`),
  });
}
export function usePreviewExpeditions() {
  return useMutation({ mutationFn: (expeditions: ExpeditionInput[]) => call<PreviewResult>("/preview", "POST", { expeditions }) });
}
export function useImportExpeditions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (expeditions: ExpeditionInput[]) => call<{ created: string[] }>("/import", "POST", { expeditions }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expeditions"] }),
  });
}
export function useUpdateExpedition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; expedition: ExpeditionInput; expectedUpdatedAt: string }) =>
      call<{ expedition: ExpeditionSummary }>(`/${encodeURIComponent(v.id)}`, "PUT", { expedition: v.expedition, expectedUpdatedAt: v.expectedUpdatedAt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expeditions"] }),
  });
}
export function useDeleteExpedition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; expectedUpdatedAt: string }) =>
      call<{ deleted: true }>(`/${encodeURIComponent(v.id)}`, "DELETE", { expectedUpdatedAt: v.expectedUpdatedAt }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expeditions"] }),
  });
}

export function useGenerateExpedition() {
  return useMutation({
    mutationFn: (input: VirtualExpeditionSearchInput) => generateAdminExpedition(input, { headers: adminHeaders() }),
  });
}

export function useArtworkLibrary(enabled: boolean) {
  return useQuery({
    queryKey: ["expeditions-artwork-library"], enabled, staleTime: 0,
    queryFn: () => getExpeditionArtworkLibrary({ headers: adminHeaders() }),
  });
}
export function useAssignExpeditionArtwork() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; body: ExpeditionArtworkAssignment }) => assignExpeditionArtwork(v.id, v.body, { headers: adminHeaders() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expeditions"] });
      qc.invalidateQueries({ queryKey: ["expedition"] });
      qc.invalidateQueries({ queryKey: ["expeditions-artwork-library"] });
      qc.invalidateQueries({ queryKey: getGetArtworkStatusQueryKey() });
    },
  });
}
export function useTargetProfile() {
  return useMutation({
    mutationFn: (input: VirtualExpeditionSearchInput) => getAdminExpeditionTargetProfile(input, { headers: adminHeaders() }),
  });
}
