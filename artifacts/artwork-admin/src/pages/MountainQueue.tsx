import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Search, ImageIcon, ChevronLeft, ChevronRight, CheckCircle, X, Image as ImagePlaceholder, XCircle, ArrowUpRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useGetMountains, useGetCandidates, useApproveCandidate, useRejectCandidate, Mountain, Candidate } from "../hooks/use-mountain-api";

export default function MountainQueue() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [selectedMountainId, setSelectedMountainId] = useState<string | null>(null);

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
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            SummitReady <span className="text-muted-foreground font-normal">Artwork Admin</span>
          </h1>
          <nav className="flex items-center gap-1 bg-secondary/50 p-1 rounded-md">
            <Link href="/" className="px-3 py-1.5 text-sm font-medium rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              Signatures
            </Link>
            <Link href="/mountains" className="px-3 py-1.5 text-sm font-medium rounded bg-background text-foreground shadow-sm">
              Mountain Heroes
            </Link>
            {import.meta.env.DEV && (
              <Link href="/assets" className="px-3 py-1.5 text-sm font-medium rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" data-testid="link-asset-gallery">
                Assets (DEV)
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-6 max-w-screen-2xl mx-auto w-full">
        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border border-border">
          <div className="relative flex-1 max-w-md">
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
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
          </select>
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
            <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                  <tr>
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
                      onClick={() => setSelectedMountainId(mountain.id)}
                    >
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
                      <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                  </Button>
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
          mountainId={selectedMountainId} 
          onClose={() => setSelectedMountainId(null)} 
        />
      )}
    </div>
  );
}

function CandidateDrawer({ mountainId, onClose }: { mountainId: string, onClose: () => void }) {
  const { data, isLoading, isError, error } = useGetCandidates(mountainId);
  const approveCandidate = useApproveCandidate();
  const rejectCandidate = useRejectCandidate();

  const handleApprove = (candidate: Candidate) => {
    approveCandidate.mutate(
      { mountainId, candidate },
      {
        onSuccess: () => toast.success("Candidate approved!"),
        onError: (err) => toast.error(`Failed to approve: ${err.message}`),
      }
    );
  };

  const handleReject = (imageUrl: string) => {
    rejectCandidate.mutate(
      { mountainId, imageUrl },
      {
        onSuccess: () => toast.success("Candidate rejected"),
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
              {isLoading ? "Loading..." : data?.mountain.name}
              {data?.mountain.status === "approved" && <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 text-[10px] ml-2">APPROVED</Badge>}
            </h2>
            <div className="text-xs text-muted-foreground font-mono">{mountainId}</div>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col bg-card">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Fetching candidate photos...</p>
            </div>
          ) : isError ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-destructive">
              <AlertCircle className="w-8 h-8" />
              <p>Failed to load candidates</p>
            </div>
          ) : !data || data.candidates.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
              <ImagePlaceholder className="w-12 h-12 opacity-20" />
              <p>No candidates found for this mountain.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {data.mountain.approvedImageUrl && (
                <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                  <h3 className="text-sm font-semibold text-green-500 mb-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" /> Currently Approved Hero
                  </h3>
                  <div className="flex gap-4">
                    <img 
                      src={data.mountain.approvedImageUrl} 
                      alt="Approved" 
                      className="w-48 h-32 object-cover rounded-md border border-border"
                    />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p><span className="font-medium text-foreground">Source:</span> {data.mountain.approvedSource?.source || "Unknown"}</p>
                      {data.mountain.approvedSource?.license && (
                        <p><span className="font-medium text-foreground">License:</span> {data.mountain.approvedSource.license}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-4">Review Queue ({data.candidates.length})</h3>
                <div className="grid grid-cols-1 gap-6">
                  {data.candidates.map((candidate, idx) => (
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
