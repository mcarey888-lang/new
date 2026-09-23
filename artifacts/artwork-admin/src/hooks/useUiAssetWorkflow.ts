import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminKeyHeader } from "@/lib/adminKey";
import { useAdminKey } from "@/contexts/AdminKeyContext";

export type FamilyId = "SIGNATURE_SYMBOLS" | "RANKS" | "ACHIEVEMENTS" | "EDITORIAL";

export type UiAssetCandidate = {
  candidateId: string;
  assetKey: string;
  familyId: FamilyId;
  version: number;
  prompt: string;
  negativePrompt: string;
  model: string;
  referenceAssets: string[];
  status: "DRAFT" | "SELECTED" | "REJECTED" | "APPROVED_ASSET" | "APPROVED_FAMILY_REFERENCE";
  generatedAt: string;
  paths: Record<string, string>;
  sourceCandidateId?: string;
};

export type UiAssetHistory = {
  id: string;
  timestamp: string;
  assetKey: string;
  familyId: FamilyId;
  prompt: string;
  negativePrompt: string;
  model: string;
  referenceAssets: string[];
  candidateCount: number;
  resultCandidateIds: string[];
  selectedCandidateId?: string;
  outcome: string;
  referenceCandidateIds?: string[];
  referenceDescriptors?: { candidateId: string; assetKey: string; version: number; objectPath: string }[];
  provider?: string;
  error?: string;
};

export type UiAssetFamily = {
  familyId: FamilyId;
  displayName: string;
  familyArtDirection: string;
  masterReferenceAsset?: string;
  additionalReferenceAssets: string[];
  generationNotes: string;
  status: "DRAFT" | "LOCKED" | "UNLOCKED";
};

export type UiAssetManifest = {
  version: 1;
  updatedAt: string;
  families: UiAssetFamily[];
  candidates: UiAssetCandidate[];
  history: UiAssetHistory[];
};

export function useUiAssetManifest() {
  const adminKey = useAdminKey();
  return useQuery({
    queryKey: ["ui-asset-workflow", adminKey],
    queryFn: async ({ signal }) => {
      if (!adminKey) return null;
      const res = await fetch("/api/artwork/ui-assets/workflow", {
        headers: adminKeyHeader(adminKey),
        signal,
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch workflow manifest: ${res.statusText}`);
      }
      return res.json() as Promise<UiAssetManifest>;
    },
    retry: false,
    enabled: !!adminKey,
  });
}

export type GenerateUiAssetInput = {
  assetKey?: string;
  candidateCount?: 1 | 2 | 4;
  prompt?: string;
  referenceCandidates?: { candidateId: string; version: number }[];
  confirmed?: boolean;
  overrideFamilyWarning?: boolean;
  refineCandidateId?: string;
  familyId?: FamilyId;
  mode?: "family-master";
  model?: string;
};

export function useGenerateUiAsset() {
  const queryClient = useQueryClient();
  const adminKey = useAdminKey();
  return useMutation({
    mutationFn: async (body: GenerateUiAssetInput) => {
      const res = await fetch("/api/artwork/ui-assets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminKeyHeader(adminKey) },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Generation failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ui-asset-workflow"] });
    },
  });
}

export function useTransitionCandidate() {
  const queryClient = useQueryClient();
  const adminKey = useAdminKey();
  return useMutation({
    mutationFn: async ({ candidateId, action, reason }: { candidateId: string; action: string; reason?: string }) => {
      const res = await fetch(`/api/artwork/ui-assets/candidates/${candidateId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminKeyHeader(adminKey) },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Action failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ui-asset-workflow"] });
    },
  });
}

export function useLockFamily() {
  const queryClient = useQueryClient();
  const adminKey = useAdminKey();
  return useMutation({
    mutationFn: async ({ familyId, locked }: { familyId: string; locked: boolean }) => {
      const res = await fetch(`/api/artwork/ui-assets/families/${familyId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminKeyHeader(adminKey) },
        body: JSON.stringify({ locked, confirmed: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Lock failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ui-asset-workflow"] });
    },
  });
}
