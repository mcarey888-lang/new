import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminKeyHeader } from "@/lib/adminKey";
import { readArtworkJson } from "@/lib/artworkResponse";

function adminHeaders(): Record<string, string> {
  const key = sessionStorage.getItem("summitready-admin-key");
  return key ? adminKeyHeader(key) : {};
}

export type ReviewStatus = "pending" | "in_review" | "approved" | "rejected";
export type ActivitySuggestion = {
  owner: string;
  hikeId: string;
  evidenceRevision: string;
  status: ReviewStatus;
  reviewNotes?: string | null;
  reviewedAt?: string | null;
  name?: string | null;
  date?: string | null;
  distance?: number | null;
  elevationGain?: number | null;
  currentRevision?: string | null;
};

export function useActivityReview(status: ReviewStatus, page: number) {
  return useQuery({
    queryKey: ["activity-review", status, page],
    queryFn: async () => {
      const res = await fetch(`/api/activity-review?status=${status}&page=${page}`, { headers: adminHeaders() });
      return readArtworkJson<{ suggestions: ActivitySuggestion[]; hasMore?: boolean }>(res);
    },
  });
}

export function useUpdateActivityReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { owner: string; hikeId: string; status: Exclude<ReviewStatus, "pending">; evidenceRevision: string; reviewNotes: string }) => {
      const res = await fetch(`/api/activity-review/${encodeURIComponent(v.owner)}/${encodeURIComponent(v.hikeId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...adminHeaders() },
        body: JSON.stringify({ status: v.status, evidenceRevision: v.evidenceRevision, reviewNotes: v.reviewNotes }),
      });
      return readArtworkJson<{ ok: true }>(res);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity-review"] }),
  });
}
