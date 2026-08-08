import React, { useState, useEffect, useMemo, useRef } from "react";
import { getAdminToken } from "@/components/AdminGuard";
import {
  useGetArtworkStatus,
  getGetArtworkStatusQueryKey,
  useGetArtworkPrompt,
  getGetArtworkPromptQueryKey,
  useGenerateArtwork,
  useApproveArtwork,
  useRejectArtwork,
  useClearArtwork,
} from "@workspace/api-client-react";

type ChallengeArtworkStatus = {
  challengeId: string;
  challengeName: string;
  targetMountainName: string;
  regions?: string | null;
  difficulty?: string | null;
  adventureScore?: number | null;
  heroImage?: string | null;
  cardImage?: string | null;
  thumbnailImage?: string | null;
  imagePrompt?: string | null;
  imageVersion?: number | null;
  imageStatus?: string | null;
  approved?: boolean | null;
  generatedAt?: string | null;
  provider?: string | null;
  generationCost?: number | null;
  lastGenerated?: string | null;
};

import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  RotateCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
  X,
  Play,
  Copy,
  Loader2,
} from "lucide-react";
import { toast } from "sonner"; // Assuming sonner is available based on package.json, fallback to simple toast if not but sonner is better. Let's stick to standard if we don't have it initialized. Actually package.json has sonner. We'll use it if we want or just console.

export default function ArtworkManager() {
  const { data: statusData, isLoading, error } = useGetArtworkStatus();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeArtworkStatus | null>(null);

  // Bulk Generation State
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{
    index: number;
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
    currentChallenge?: string;
    report: any;
  } | null>(null);

  const challenges = statusData?.challenges || [];

  const filteredChallenges = useMemo(() => {
    return challenges.filter((c) => {
      const matchSearch =
        c.challengeName.toLowerCase().includes(search.toLowerCase()) ||
        c.targetMountainName.toLowerCase().includes(search.toLowerCase()) ||
        c.challengeId.toLowerCase().includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "All" ||
        (statusFilter === "pending" && (!c.imageStatus || c.imageStatus === "pending")) ||
        c.imageStatus === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [challenges, search, statusFilter]);

  const startBulkGeneration = async () => {
    setIsBulkGenerating(true);
    setBulkProgress({ index: 0, total: challenges.length, succeeded: 0, failed: 0, skipped: 0, report: null });
    try {
      const token = getAdminToken();
      const response = await fetch("/api/artwork/bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ force: false }),
      });
      if (!response.body) throw new Error("No response body");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) {
                setBulkProgress((prev) => (prev ? { ...prev, report: data.report } : null));
                queryClient.invalidateQueries({ queryKey: getGetArtworkStatusQueryKey() });
              } else if (data.index !== undefined) {
                setBulkProgress((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    index: data.index,
                    total: data.total,
                    currentChallenge: data.result.challengeId,
                    succeeded: prev.succeeded + (data.result.status === "generated" ? 1 : 0),
                    failed: prev.failed + (data.result.status === "failed" ? 1 : 0),
                    skipped: prev.skipped + (data.result.status === "skipped" ? 1 : 0),
                  };
                });
                // Optimistically update the UI list somewhat by refetching often, or just let it be until end.
                // Refetching every 5 index to avoid spam
                if (data.index % 5 === 0) {
                  queryClient.invalidateQueries({ queryKey: getGetArtworkStatusQueryKey() });
                }
              }
            } catch (e) {
              // ignore parse error for incomplete chunk
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      queryClient.invalidateQueries({ queryKey: getGetArtworkStatusQueryKey() });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            SummitReady <span className="text-muted-foreground font-normal">Artwork Admin</span>
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Button onClick={startBulkGeneration} disabled={isBulkGenerating} className="gap-2 font-medium">
            <Play className="w-4 h-4" />
            Generate All
          </Button>
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-6 max-w-screen-2xl mx-auto w-full">
        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border border-border">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search challenges, mountains..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="All">All Status</option>
            <option value="pending">Pending</option>
            <option value="generating">Generating</option>
            <option value="generated">Generated</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </select>
          <div className="text-sm text-muted-foreground ml-auto">
            {filteredChallenges.length} challenges
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium">Preview</th>
                  <th className="px-4 py-3 font-medium">Challenge</th>
                  <th className="px-4 py-3 font-medium">Details</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredChallenges.map((challenge) => (
                  <ChallengeRow
                    key={challenge.challengeId}
                    challenge={challenge}
                    onOpenPreview={() => setSelectedChallenge(challenge)}
                  />
                ))}
                {filteredChallenges.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      No challenges found matching the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Bulk Generation Modal */}
      <Dialog open={isBulkGenerating} onOpenChange={(open) => {
        if (!open && (!bulkProgress || bulkProgress.report)) {
          setIsBulkGenerating(false);
          setBulkProgress(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Generation</DialogTitle>
            <DialogDescription>
              Processing artwork for all missing or failed challenges.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {bulkProgress?.report ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-4">
                  <CheckCircle className="w-12 h-12 text-primary" />
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-primary">{bulkProgress.succeeded}</div>
                    <div className="text-xs text-muted-foreground mt-1">Generated</div>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-destructive">{bulkProgress.failed}</div>
                    <div className="text-xs text-muted-foreground mt-1">Failed</div>
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-3">
                    <div className="text-2xl font-bold text-muted-foreground">{bulkProgress.skipped}</div>
                    <div className="text-xs text-muted-foreground mt-1">Skipped</div>
                  </div>
                </div>
                <div className="text-sm text-center text-muted-foreground">
                  Total processed: {bulkProgress.report.total}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{bulkProgress?.currentChallenge || "Starting..."}</span>
                  <span className="text-muted-foreground font-mono">
                    {bulkProgress?.index || 0} / {bulkProgress?.total || 0}
                  </span>
                </div>
                <Progress
                  value={bulkProgress?.total ? ((bulkProgress.index || 0) / bulkProgress.total) * 100 : 0}
                />
                <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                  <span>Generated: {bulkProgress?.succeeded || 0}</span>
                  <span>Failed: {bulkProgress?.failed || 0}</span>
                  <span>Skipped: {bulkProgress?.skipped || 0}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setIsBulkGenerating(false);
                setBulkProgress(null);
              }}
              disabled={!bulkProgress?.report}
            >
              {bulkProgress?.report ? "Close" : "Processing..."}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Preview Drawer */}
      {selectedChallenge && (
        <ImagePreviewDrawer
          challenge={selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
        />
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// ChallengeRow Component
// -----------------------------------------------------------------------------

function ChallengeRow({
  challenge,
  onOpenPreview,
}: {
  challenge: ChallengeArtworkStatus;
  onOpenPreview: () => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const queryClient = useQueryClient();

  const generateMutation = useGenerateArtwork();
  const approveMutation = useApproveArtwork();
  const rejectMutation = useRejectArtwork();
  const clearMutation = useClearArtwork();

  const { data: fetchedPrompt, isLoading: isLoadingPrompt } = useGetArtworkPrompt(
    challenge.challengeId,
    {
      query: { 
        enabled: showPrompt && !challenge.imagePrompt,
        queryKey: getGetArtworkPromptQueryKey(challenge.challengeId)
      },
    }
  );

  const promptText = challenge.imagePrompt || fetchedPrompt?.prompt;

  const isPending =
    generateMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending ||
    clearMutation.isPending ||
    challenge.imageStatus === "generating";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetArtworkStatusQueryKey() });
  };

  const handleAction = async (action: "generate" | "regenerate" | "approve" | "reject" | "clear") => {
    try {
      if (action === "generate") {
        await generateMutation.mutateAsync({ challengeId: challenge.challengeId, data: { force: false } });
      } else if (action === "regenerate") {
        await generateMutation.mutateAsync({ challengeId: challenge.challengeId, data: { force: true } });
      } else if (action === "approve") {
        await approveMutation.mutateAsync({ challengeId: challenge.challengeId });
      } else if (action === "reject") {
        await rejectMutation.mutateAsync({ challengeId: challenge.challengeId });
      } else if (action === "clear") {
        await clearMutation.mutateAsync({ challengeId: challenge.challengeId });
      }
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const statusColors: Record<string, string> = {
    approved: "bg-green-500/10 text-green-500 border-green-500/20",
    generated: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    pending: "bg-gray-500/10 text-gray-400 border-gray-500/20",
    rejected: "bg-red-500/10 text-red-500 border-red-500/20",
    failed: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    generating: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse",
  };

  const status = challenge.imageStatus || "pending";
  const badgeClass = statusColors[status] || statusColors.pending;

  const thumbnailUrl = challenge.thumbnailImage
    ? `/api/artwork/image/${challenge.challengeId}/thumbnail?v=${challenge.imageVersion || 0}`
    : null;

  return (
    <>
      <tr className="hover:bg-secondary/20 transition-colors group">
        <td className="px-4 py-3 w-20">
          <div
            className="w-12 h-12 rounded bg-secondary flex items-center justify-center overflow-hidden cursor-pointer border border-border group-hover:border-primary/50 transition-colors"
            onClick={onOpenPreview}
          >
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt="Thumb" className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-foreground">{challenge.challengeName}</div>
          <div className="text-xs text-muted-foreground flex gap-2 items-center mt-1">
            <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">
              {challenge.challengeId}
            </span>
            <span>{challenge.targetMountainName}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          <div>{challenge.regions || "Unknown region"}</div>
          <div className="mt-1 flex gap-2">
            <span>Diff: {challenge.difficulty || "N/A"}</span>
            <span>Score: {challenge.adventureScore || "0"}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline" className={badgeClass}>
            {status.toUpperCase()}
          </Badge>
          {challenge.imageVersion ? (
            <div className="text-[10px] text-muted-foreground mt-1 ml-1">
              v{challenge.imageVersion}
            </div>
          ) : null}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-2">
            {isPending && <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />}
            
            <div className="flex gap-1">
              {(!challenge.imageStatus || challenge.imageStatus === "pending" || challenge.imageStatus === "failed") && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleAction("generate")}
                  title="Generate"
                >
                  <Play className="w-3.5 h-3.5" />
                </Button>
              )}
              {(challenge.imageStatus === "generated" || challenge.imageStatus === "rejected" || challenge.imageStatus === "approved") && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() => handleAction("regenerate")}
                    title="Force Regenerate"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                  </Button>
                  {challenge.imageStatus !== "approved" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-500 hover:text-green-400 border-green-500/20 hover:bg-green-500/10"
                      disabled={isPending}
                      onClick={() => handleAction("approve")}
                      title="Approve"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {challenge.imageStatus !== "rejected" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-orange-500 hover:text-orange-400 border-orange-500/20 hover:bg-orange-500/10"
                      disabled={isPending}
                      onClick={() => handleAction("reject")}
                      title="Reject"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-500 hover:text-red-400 border-red-500/20 hover:bg-red-500/10"
                    disabled={isPending}
                    onClick={() => handleAction("clear")}
                    title="Clear Artwork"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>

            <Button
              size="sm"
              variant="ghost"
              className="px-2 ml-2"
              onClick={() => setShowPrompt(!showPrompt)}
            >
              {showPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </td>
      </tr>
      {showPrompt && (
        <tr className="bg-secondary/10 border-b border-border">
          <td colSpan={5} className="px-6 py-4">
            <div className="flex gap-4 items-start">
              <div className="flex-1 bg-background p-3 rounded border border-border text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {isLoadingPrompt ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> Loading prompt...
                  </span>
                ) : promptText ? (
                  promptText
                ) : (
                  "No prompt available."
                )}
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={!promptText}
                onClick={() => {
                  if (promptText) {
                    navigator.clipboard.writeText(promptText);
                    // toast("Copied to clipboard");
                  }
                }}
                className="shrink-0"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy
              </Button>
            </div>
            {challenge.generationCost !== null && challenge.generationCost !== undefined && (
              <div className="mt-2 text-xs text-muted-foreground flex gap-4">
                <span>Cost: ${challenge.generationCost.toFixed(3)}</span>
                <span>Provider: {challenge.provider || "N/A"}</span>
                {challenge.generatedAt && (
                  <span>Generated: {new Date(challenge.generatedAt).toLocaleString()}</span>
                )}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// -----------------------------------------------------------------------------
// ImagePreviewDrawer Component
// -----------------------------------------------------------------------------

function ImagePreviewDrawer({
  challenge,
  onClose,
}: {
  challenge: ChallengeArtworkStatus;
  onClose: () => void;
}) {
  const v = challenge.imageVersion || 0;
  const baseUrl = `/api/artwork/image/${challenge.challengeId}`;

  const hasImages = challenge.imageStatus === "generated" || challenge.imageStatus === "approved" || challenge.imageStatus === "rejected";

  const downloadImage = async (type: string) => {
    try {
      const url = `${baseUrl}/${type}?v=${v}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Fetch failed");
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${challenge.challengeId}-${type}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadAll = () => {
    downloadImage("hero");
    setTimeout(() => downloadImage("card"), 500);
    setTimeout(() => downloadImage("thumbnail"), 1000);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-[600px] max-w-[90vw] bg-card border-l border-border z-50 shadow-2xl flex flex-col animate-in slide-in-from-right-full">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background">
          <div>
            <h2 className="text-lg font-semibold">{challenge.challengeName}</h2>
            <div className="text-xs text-muted-foreground font-mono">{challenge.challengeId}</div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleDownloadAll} disabled={!hasImages} variant="secondary">
              <Download className="w-4 h-4 mr-2" />
              Download All
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 bg-card">
          {!hasImages ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
              <ImageIcon className="w-12 h-12 opacity-20" />
              <p>No artwork generated yet.</p>
            </div>
          ) : (
            <>
              {/* Hero Preview 16:9 */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm font-medium">
                  <span>Hero (16:9)</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => downloadImage("hero")}>
                    <Download className="w-3 h-3" />
                  </Button>
                </div>
                <div className="bg-secondary rounded-lg overflow-hidden border border-border aspect-video">
                  <img
                    src={`${baseUrl}/hero?v=${v}`}
                    alt="Hero"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Card Preview 4:5 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span>Card (4:5)</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => downloadImage("card")}>
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="bg-secondary rounded-lg overflow-hidden border border-border aspect-[4/5]">
                    <img
                      src={`${baseUrl}/card?v=${v}`}
                      alt="Card"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Thumbnail Preview 1:1 */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm font-medium">
                    <span>Thumbnail (1:1)</span>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => downloadImage("thumbnail")}>
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="bg-secondary rounded-lg overflow-hidden border border-border aspect-square w-full max-w-[200px] mx-auto">
                    <img
                      src={`${baseUrl}/thumbnail?v=${v}`}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
