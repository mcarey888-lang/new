import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminKeyHeader } from "@/lib/adminKey";
import { readArtworkJson } from "@/lib/artworkResponse";

function adminHeaders(): Record<string, string> {
  const key = sessionStorage.getItem("summitready-admin-key");
  return key ? adminKeyHeader(key) : {};
}

export type Mountain = {
  id: string;
  canonicalSourceKey?: string;
  name: string;
  country?: string;
  region?: string;
  area?: string;
  elevationM?: number;
  prominenceM?: number;
  status: "pending" | "approved";
  approvedImageUrl?: string;
  approvedSource?: Candidate | null;
};

export type Candidate = {
  id: string;
  title: string;
  imageUrl: string;
  sourcePageUrl: string;
  source: string;
  width: number;
  height: number;
  license: string | null;
  artist: string | null;
  score: number;
  prompt?: string;
};

export type MountainGeneration = {
  status: "idle" | "generating" | "ready" | "failed";
  jobId?: string;
  candidate?: Candidate;
  previousCandidates?: Candidate[];
  prompt?: string;
  error?: string;
};

export function useGetMountainPrompt(mountainId: string | null) {
  return useQuery({
    queryKey: ["mountain-prompt", mountainId],
    queryFn: async () => {
      if (!mountainId) throw new Error("No mountain id");
      const res = await fetch(`/api/artwork/mountains/${mountainId}/prompt`, {
        headers: adminHeaders(),
      });
      return readArtworkJson<{ prompt: string; hasReference: boolean }>(res);
    },
    enabled: !!mountainId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useGetMountainGeneration(mountainId: string | null) {
  return useQuery({
    queryKey: ["mountain-generation", mountainId],
    queryFn: async () => {
      if (!mountainId) throw new Error("No mountain id");
      const res = await fetch(`/api/artwork/mountains/${mountainId}/generation`, {
        headers: adminHeaders(),
      });
      return readArtworkJson<MountainGeneration>(res);
    },
    enabled: !!mountainId,
    refetchInterval: (query) => query.state.data?.status === "generating" ? 4000 : false,
  });
}

export function useGenerateMountainArtwork() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mountainId, prompt }: { mountainId: string; prompt?: string }) => {
      const res = await fetch(`/api/artwork/mountains/${mountainId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ confirmed: true, ...(prompt !== undefined ? { prompt } : {}) }),
      });
      return readArtworkJson<{ jobId: string; status: "generating" }>(res);
    },
    onSuccess: (_, { mountainId }) => {
      queryClient.invalidateQueries({ queryKey: ["mountain-generation", mountainId] });
    },
  });
}

export function useGetMountains(params: { page: number; pageSize: number; search: string; status: string; sort: string }) {
  return useQuery({
    queryKey: ["mountains", params],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: params.page.toString(),
        pageSize: params.pageSize.toString(),
        search: params.search,
        status: params.status,
        sort: params.sort,
      });
      const res = await fetch(`/api/artwork/mountains?${searchParams.toString()}`);
      return readArtworkJson<{
        mountains: Mountain[];
        total: number;
        page: number;
        pageSize: number;
      }>(res);
    },
  });
}

export function useGetCandidates(mountainId: string | null) {
  return useQuery({
    queryKey: ["mountain-candidates", mountainId],
    queryFn: async () => {
      if (!mountainId) throw new Error("No mountain id");
      const res = await fetch(`/api/artwork/mountains/${mountainId}/candidates`, {
        method: "POST",
        headers: adminHeaders(),
      });
      return readArtworkJson<{
        mountain: Mountain;
        candidates: Candidate[];
      }>(res);
    },
    enabled: !!mountainId,
  });
}

export function useApproveCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mountainId, candidate }: { mountainId: string; candidate: Candidate }) => {
      const res = await fetch(`/api/artwork/mountains/${mountainId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ candidate }),
      });
      return readArtworkJson(res);
    },
    onSuccess: (_, { mountainId }) => {
      queryClient.invalidateQueries({ queryKey: ["mountains"] });
      queryClient.invalidateQueries({ queryKey: ["mountain-candidates", mountainId] });
    },
  });
}

export function useRejectCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ mountainId, imageUrl }: { mountainId: string; imageUrl: string }) => {
      const res = await fetch(`/api/artwork/mountains/${mountainId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ imageUrl }),
      });
      return readArtworkJson(res);
    },
    onSuccess: (_, { mountainId }) => {
      // Invalidate candidates so the rejected one goes away
      queryClient.invalidateQueries({ queryKey: ["mountain-candidates", mountainId] });
    },
  });
}
