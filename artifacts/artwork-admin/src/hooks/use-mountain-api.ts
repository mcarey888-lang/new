import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function adminHeaders(): Record<string, string> {
  const key = sessionStorage.getItem("summitready-admin-key");
  return key ? { "x-vx-admin-key": key } : {};
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
};

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
      if (!res.ok) throw new Error("Failed to fetch mountains");
      return res.json() as Promise<{
        mountains: Mountain[];
        total: number;
        page: number;
        pageSize: number;
      }>;
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
      if (!res.ok) throw new Error("Failed to fetch candidates");
      return res.json() as Promise<{
        mountain: Mountain;
        candidates: Candidate[];
      }>;
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
      if (!res.ok) throw new Error("Failed to approve candidate");
      return res.json();
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
      if (!res.ok) throw new Error("Failed to reject candidate");
      return res.json();
    },
    onSuccess: (_, { mountainId }) => {
      // Invalidate candidates so the rejected one goes away
      queryClient.invalidateQueries({ queryKey: ["mountain-candidates", mountainId] });
    },
  });
}
