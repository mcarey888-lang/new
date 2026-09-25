import React, { useState, useEffect } from "react";
import { Search, ChevronLeft, ChevronRight, CheckCircle, X, Image as ImagePlaceholder, XCircle, ArrowUpRight, Loader2, AlertCircle, ListChecks, WandSparkles } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useGetMountains, useGetCandidates, useApproveCandidate, useRejectCandidate, useGetMountainGeneration, useGenerateMountainArtwork, Candidate } from "../hooks/use-mountain-api";
import { ArtworkAdminHeader } from "@/components/ArtworkAdminHeader";

export default function MountainQueue() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("prominence");
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [batchBusy, setBatchBusy] = useState(false);
  const generateArtwork = useGenerateMountainArtwork();
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem("summitready-admin-key") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedMountainId, setSelectedMountainId] = useState<string | null>(null);
  const [selectedMountainName, setSelectedMountainName] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, isError, error } = useGetMountains({
    page,
    pageSize: 24,
    search: debouncedSearch,
    status: statusFilter,
    sort,
  });

  const generateSelected = async () => {
    if (!adminKey) {
      toast.error("Enter the admin key before generating artwork");
      return;
    }
    if (selected.size > 4) {
      toast.error("Generate up to four summits at a time. Deselect a few to continue.");
      return;
    }
    const entries = [...selected];
    if (!entries.length || !window.confirm(
      `Generate one AI illustration for each of these ${entries.length} summits?\n\n${entries.map(([, name]) => name).join(", ")}\n\nNew images stay in review until you explicitly approve them.`
    )) return;
    setBatchBusy(true);
    let started = 0;
    for (const [mountainId, name] of entries) {
      try {
        await generateArtwork.mutateAsync({ mountainId });
        started++;
        setSelected(current => {
          const next = new Map(current);
          next.delete(mountainId);
          return next;
        });
      } catch (err) {
        toast.error(`${name}: ${err instanceof Error ? err.message : "generation could not start"}`);
      }
    }
    setBatchBusy(false);
    if (started) toast.success(`Started artwork generation for ${started} summit${started === 1 ? "" : "s"}. Open a summit to monitor and review it.`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <ArtworkAdminHeader
        activeSection="mountains"
        actions={
          <form onSubmit={(event) => event.preventDefault()}>
          <Input
            type="password"
            autoComplete="current-password"
            aria-label="Admin API key"
            placeholder="Admin key for review actions"
            value={adminKey}
            onChange={(event) => {
              setAdminKey(event.target.value);
              if (event.target.value) sessionStorage.setItem("summitready-admin-key", event.target.value);
              else sessionStorage.removeItem("summitready-admin-key");
            }}
            className="w-64"
            data-testid="input-admin-key"
          />
          </form>
        }
      />

      <main className="flex-1 p-6 flex flex-col gap-6 max-w-screen-2xl mx-auto w-full">
        <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-lg border border-border">
          <div className="relative flex-1 min-w-[190px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search mountains, regions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">All Status</option>
            <option value="review-required">Review required</option>
            <option value="approved">Approved</option>
          </select>
          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="prominence">Most prominent</option>
            <option value="elevation">Highest elevation</option>
            <option value="name">Name A–Z</option>
          </select>
          <Badge variant="outline" className="gap-1"><ListChecks className="h-3.5 w-3.5" /> Curated queue: {selected.size}</Badge>
          <Button size="sm" onClick={generateSelected} disabled={!selected.size || batchBusy || !adminKey} className="gap-2">
            {batchBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <WandSparkles className="w-4 h-4" />}
            {batchBusy ? "Starting…" : "Generate selected artwork"}
          </Button>
          <div className="text-sm text-muted-foreground ml-auto">
            {data?.total ?? 0} mountains
          </div>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="flex-1 flex flex-col items-center justify-center text-destructive">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p>Error loading mountains: {error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="border border-border rounded-lg overflow-x-auto bg-card shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 font-medium w-10">Queue</th>
                    <th className="px-4 py-3 font-medium w-[120px]">Hero Image</th>
                    <th className="px-4 py-3 font-medium">Mountain</th>
                    <th className="px-4 py-3 font-medium">Location</th>
                    <th className="px-4 py-3 font-medium">Metrics</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.mountains.map((mountain) => (
                    <tr 
                      key={mountain.id} 
                      className="hover:bg-secondary/20 transition-colors cursor-pointer group"
                      onClick={() => {
                        if (!adminKey) {
                          toast.error("Enter the admin key before opening Mountain review actions");
                          return;
                        }
                        setSelectedMountainId(mountain.id);
                        setSelectedMountainName(mountain.name);
                      }}
                    >
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <Checkbox
                          checked={selected.has(mountain.id)}
                          onCheckedChange={(checked) => setSelected((current) => {
                            const next = new Map(current);
                            if (checked) next.set(mountain.id, mountain.name); else next.delete(mountain.id);
                            return next;
                          })}
                          aria-label={`Add ${mountain.name} to curated queue`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-20 h-14 rounded bg-secondary flex items-center justify-center overflow-hidden border border-border group-hover:border-primary/50 transition-colors">
                          {mountain.approvedImageUrl ? (
                            <img src={mountain.approvedImageUrl} alt={mountain.name} className="w-full h-full object-cover" />
                          ) : (
                            <ImagePlaceholder className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground text-base">{mountain.name}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          ID: <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">{mountain.id}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        <div className="font-medium text-foreground/80">{mountain.country || "Unknown Country"}</div>
                        <div className="mt-1">{mountain.region || "Unknown Region"}{mountain.area ? `, ${mountain.area}` : ""}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        <div>Elev: {mountain.elevationM ? <span className="font-medium text-foreground/80">{mountain.elevationM}m</span> : "N/A"}</div>
                        <div className="mt-1">Prom: {mountain.prominenceM ? `${mountain.prominenceM}m` : "N/A"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge 
                          variant="outline" 
                          className={mountain.status === "approved" ? "bg-green-500/10 text-green-500 border-green-500/20" : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"}
                        >
                          {mountain.status.toUpperCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {data?.mountains.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                        No mountains found matching the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {data && data.total > data.pageSize && (
              <div className="flex items-center justify-between px-2">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * data.pageSize + 1} to {Math.min(page * data.pageSize, data.total)} of {data.total}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                  </Button>
                  <span className="text-sm text-muted-foreground">Page</span>
                  <Input
                    type="number"
                    min={1}
                    max={Math.ceil(data.total / data.pageSize)}
                    value={page}
                    onChange={(event) => {
                      const next = Math.max(1, Math.min(Math.ceil(data.total / data.pageSize), Number(event.target.value) || 1));
                      setPage(next);
                    }}
                    className="h-8 w-20"
                    aria-label="Jump to page"
                  />
                  <span className="text-sm text-muted-foreground">of {Math.ceil(data.total / data.pageSize)}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page * data.pageSize >= data.total}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Candidate Review Drawer */}
      {selectedMountainId && (
        <CandidateDrawer
          key={selectedMountainId}
          mountainId={selectedMountainId}
          mountainName={selectedMountainName}
          onClose={() => setSelectedMountainId(null)}
        />
      )}
    </div>
  );
}

function CandidateDrawer({ mountainId, mountainName, onClose }: { mountainId: string, mountainName: string, onClose: () => void }) {
  const { data, isLoading, isError, error, refetch: refetchCandidates } = useGetCandidates(mountainId);
  const {
    data: generation, isError: isGenerationError, error: generationError,
    isLoading: isGenerationLoading, refetch: refetchGeneration,
  } = useGetMountainGeneration(mountainId);
  const generateArtwork = useGenerateMountainArtwork();
  const queryClient = useQueryClient();
  const approveCandidate = useApproveCandidate();
  const rejectCandidate = useRejectCandidate();
  const [rejectedUrls, setRejectedUrls] = useState<Set<string>>(new Set());
  const generatedCandidate = generation?.status === "ready" ? generation.candidate : undefined;
  const candidates = [
    ...(generatedCandidate && !rejectedUrls.has(generatedCandidate.imageUrl) ? [generatedCandidate] : []),
    ...(data?.candidates ?? []).filter(candidate => candidate.id !== generatedCandidate?.id && !rejectedUrls.has(candidate.imageUrl)),
  ];

  useEffect(() => {
    if (generation?.status === "ready") {
      queryClient.invalidateQueries({ queryKey: ["mountain-candidates", mountainId] });
      queryClient.invalidateQueries({ queryKey: ["mountains"] });
    }
  }, [generation?.jobId, generation?.status, mountainId, queryClient]);

  const handleGenerate = () => {
    if (!window.confirm(`Generate a new realistic AI hero for ${mountainName}? It will stay in review and will not replace an approved image until you approve it.`)) return;
    generateArtwork.mutate({ mountainId }, {
      onSuccess: () => toast.success(`Generating artwork for ${mountainName}. This can take a few minutes.`),
      onError: (err) => toast.error(`Could not start generation: ${err.message}`),
    });
  };

  const handleApprove = (candidate: Candidate) => {
    if (!window.confirm(`Approve “${candidate.title}” as the hero artwork for ${data?.mountain.name ?? mountainName}?`)) return;
    approveCandidate.mutate(
      { mountainId, candidate },
      {
        onSuccess: () => toast.success("Candidate approved!"),
        onError: (err) => toast.error(`Failed to approve: ${err.message}`),
      }
    );
  };

  const handleReject = (imageUrl: string) => {
    if (!window.confirm(`Reject this candidate for ${data?.mountain.name ?? mountainName}? The source record will be retained.`)) return;
    rejectCandidate.mutate(
      { mountainId, imageUrl },
      {
        onSuccess: () => {
          setRejectedUrls(current => new Set(current).add(imageUrl));
          toast.success("Candidate rejected");
        },
        onError: (err) => toast.error(`Failed to reject: ${err.message}`),
      }
    );
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm animate-in fade-in"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-[800px] max-w-[90vw] bg-card border-l border-border z-50 shadow-2xl flex flex-col animate-in slide-in-from-right-full">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {isLoading ? mountainName : data?.mountain.name ?? mountainName}
              {data?.mountain.status === "approved" && <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] ml-2">APPROVED</Badge>}
            </h2>
            <div className="text-xs text-muted-foreground font-mono">{mountainId}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={isGenerationLoading || isGenerationError || !generation ||
                generation.status === "generating" || generateArtwork.isPending}
              className="gap-2"
            >
              {generation?.status === "generating" || generateArtwork.isPending
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <WandSparkles className="w-4 h-4" />}
              {generation?.status === "generating" ? "Generating…" : "Generate AI artwork"}
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="Close review">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col bg-card">
          <div className="rounded-md border border-border bg-secondary/30 px-4 py-3 mb-5 text-sm">
            {generation?.status === "generating" ? (
              <p className="flex items-center gap-2 text-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Creating a realistic AI mountain hero. You can close this drawer; the result will be here for review when ready.</p>
            ) : generation?.status === "ready" ? (
              <p className="text-foreground">AI mountain hero ready for review. Admin-generated artwork will not appear in the app until you approve it.</p>
            ) : generation?.status === "failed" ? (
              <p className="text-destructive">Generation failed: {generation.error || "Unknown error"}. You can try again.</p>
            ) : isGenerationError ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-destructive">Could not check generation status: {generationError instanceof Error ? generationError.message : "Unknown error"}</p>
                <Button size="sm" variant="outline" onClick={() => void refetchGeneration()}>Retry status</Button>
              </div>
            ) : isGenerationLoading ? (
              <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Checking generation status…</p>
            ) : (
              <p className="text-muted-foreground">Generate a mountain-specific hero or review source photos. Admin-generated images require approval; user-triggered heroes can appear automatically.</p>
            )}
          </div>
          {data?.mountain.approvedImageUrl && (
            <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20 mb-5">
              <h3 className="text-sm font-semibold text-green-500 mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Currently Approved Hero
              </h3>
              <div className="flex gap-4">
                <img src={data.mountain.approvedImageUrl} alt="Approved" className="w-48 h-32 object-cover rounded-md border border-border" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><span className="font-medium text-foreground">Source:</span> {data.mountain.approvedSource?.source || "Unknown"}</p>
                  {data.mountain.approvedSource?.license && (
                    <p><span className="font-medium text-foreground">License:</span> {data.mountain.approvedSource.license}</p>
                  )}
                </div>
              </div>
            </div>
          )}
          {isLoading && candidates.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Fetching candidate photos...</p>
            </div>
          ) : isError && candidates.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-destructive">
              <AlertCircle className="w-8 h-8" />
              <p>Failed to load source photos: {error instanceof Error ? error.message : "Unknown error"}</p>
              <Button size="sm" variant="outline" onClick={() => void refetchCandidates()}>Retry photos</Button>
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <ImagePlaceholder className="w-12 h-12 opacity-20" />
              <p>No source photos found for this mountain. You can still generate an AI hero above.</p>
            </div>
          ) : (
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-4">Review Queue ({candidates.length})</h3>
                <div className="grid grid-cols-1 gap-6">
                  {candidates.map((candidate, idx) => (
                    <CandidateCard 
                      key={candidate.id || idx} 
                      candidate={candidate} 
                      mountainId={mountainId}
                      isPending={approveCandidate.isPending || rejectCandidate.isPending}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function CandidateCard({ 
  candidate, 
  mountainId, 
  isPending, 
  onApprove, 
  onReject 
}: { 
  candidate: Candidate, 
  mountainId: string, 
  isPending: boolean, 
  onApprove: (c: Candidate) => void, 
  onReject: (url: string) => void 
}) {
  return (
    <div className="flex flex-col bg-background border border-border rounded-lg overflow-hidden shadow-sm">
      <div className="relative group bg-secondary/20 min-h-[300px] flex items-center justify-center overflow-hidden">
        {/* Checked/cross patterns for transparent background images could be useful, but standard bg-secondary/20 works */}
        <img 
          src={candidate.imageUrl} 
          alt={candidate.title}
          className="w-full h-auto max-h-[500px] object-contain transition-transform group-hover:scale-[1.02]"
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
          <Button 
            variant="default" 
            className="bg-green-600 hover:bg-green-700 text-white border-none gap-2 px-6"
            disabled={isPending}
            onClick={() => onApprove(candidate)}
          >
            <CheckCircle className="w-5 h-5" /> Approve
          </Button>
          <Button 
            variant="destructive"
            className="gap-2 px-6"
            disabled={isPending}
            onClick={() => onReject(candidate.imageUrl)}
          >
            <XCircle className="w-5 h-5" /> Reject
          </Button>
        </div>
      </div>
      
      <div className="p-4 flex flex-col gap-3">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h4 className="font-medium text-sm text-foreground line-clamp-2" title={candidate.title}>{candidate.title}</h4>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px] font-mono px-1 py-0">{candidate.width}x{candidate.height}</Badge>
              <span>Score: {candidate.score.toFixed(1)}</span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
             <Button 
              size="sm" 
              variant="outline" 
              className="text-green-500 hover:text-green-600 border-green-500/30 hover:bg-green-500/10 h-8"
              disabled={isPending}
              onClick={() => onApprove(candidate)}
            >
              <CheckCircle className="w-4 h-4 mr-1" /> Approve
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-red-500 hover:text-red-600 border-red-500/30 hover:bg-red-500/10 h-8"
              disabled={isPending}
              onClick={() => onReject(candidate.imageUrl)}
            >
              <XCircle className="w-4 h-4 mr-1" /> Reject
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-xs bg-secondary/30 p-3 rounded text-muted-foreground border border-border/50">
          <div>
            <span className="font-semibold text-foreground/80 block mb-0.5">Author</span>
            {candidate.artist || "Unknown Artist"}
          </div>
          <div>
            <span className="font-semibold text-foreground/80 block mb-0.5">License</span>
            {candidate.license || "Unknown License"}
          </div>
          <div className="col-span-2 flex items-center justify-between">
            <div className="truncate pr-4">
              <span className="font-semibold text-foreground/80 block mb-0.5">Source</span>
              <span className="truncate block" title={candidate.source}>{candidate.source}</span>
            </div>
            {candidate.sourcePageUrl && (
              <a 
                href={candidate.sourcePageUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline flex items-center gap-1 font-medium shrink-0"
              >
                View Source <ArrowUpRight className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
