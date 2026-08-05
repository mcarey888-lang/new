import React, { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  ArrowLeft, Github, CheckCircle, Clock, AlertCircle, Loader2,
  GitCommit, FolderOpen, Send, RefreshCw, ExternalLink, Globe,
  FileText, ChevronDown, ChevronUp, Package,
} from "lucide-react";

const BASE = "/api/atlas";

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, opts);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

interface QueueAsset {
  assetId: string; brandId: number; sceneVars: Record<string,string>;
  title?: string; published: boolean; gitCommitHash?: string;
  githubPublishedAt?: string; publishedFilename?: string;
  brandName: string; brandSlug: string; githubFolder?: string;
  assetTypeName: string; assetTypeSlug: string; githubSubfolder?: string;
}

interface Brand { id: number; slug: string; name: string; githubFolder?: string; }
interface GitHubStatus {
  ok: boolean; repo: string; branch: string;
  rateLimit: { remaining: number; limit: number; resetAt: string };
  latestCommit?: { sha: string; message: string; date: string };
}

interface PublishResult {
  ok: boolean; commitHash?: string; reason?: string;
  results: Array<{ assetId: string; slug: string; status: string; reason?: string; files?: string[] }>;
  manifestPath?: string;
}

export default function PublishPanel() {
  const qc = useQueryClient();
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set());
  const [publishing, setPublishing]           = useState(false);
  const [publishLog, setPublishLog]           = useState<string[]>([]);
  const [publishResult, setPublishResult]     = useState<PublishResult | null>(null);
  const [showManifest, setShowManifest]       = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const { data: brandsData } = useQuery({ queryKey: ["atlas-brands"], queryFn: () => apiFetch("/brands") });
  const brands: Brand[] = brandsData?.brands ?? [];

  const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["gh-status"], queryFn: () => apiFetch("/github/status"), refetchInterval: 60_000,
  });
  const ghStatus: GitHubStatus | null = statusData ?? null;

  const { data: queueData, isLoading: queueLoading, refetch: refetchQueue } = useQuery({
    queryKey: ["gh-queue", selectedBrandId],
    queryFn: () => apiFetch(`/github/queue${selectedBrandId ? `?brandId=${selectedBrandId}` : ""}`),
    enabled: true,
  });
  const queue: QueueAsset[] = queueData?.queue ?? [];
  const unpublished = queue.filter(a => !a.published);
  const alreadyPublished = queue.filter(a => a.published);

  // Auto-select first brand
  useEffect(() => {
    if (brands.length > 0 && selectedBrandId === null) setSelectedBrandId(brands[0].id);
  }, [brands, selectedBrandId]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [publishLog]);

  const selectedBrand = brands.find(b => b.id === selectedBrandId);

  const toggleSelect = (id: string) => setSelectedIds(s => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleAll = () => {
    if (selectedIds.size === unpublished.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(unpublished.map(a => a.assetId)));
  };

  const buildCommitPreview = () => {
    const targets = selectedIds.size > 0 ? unpublished.filter(a => selectedIds.has(a.assetId)) : unpublished;
    if (!selectedBrand || targets.length === 0) return null;
    const names = targets.map(a => a.assetTypeSlug).join(", ");
    return `feat(media): add ${selectedBrand.name.toLowerCase()} assets — ${names}`;
  };

  const buildManifestPreview = () => {
    const targets = selectedIds.size > 0 ? unpublished.filter(a => selectedIds.has(a.assetId)) : unpublished;
    if (!selectedBrand || targets.length === 0) return null;
    const folder = selectedBrand.githubFolder ?? `apps/${selectedBrand.slug}/public/images`;
    const assets: Record<string, object> = {};
    for (const a of targets) {
      const sub  = a.githubSubfolder ?? a.assetTypeSlug;
      const slug = `${a.assetTypeSlug}-${Object.values(a.sceneVars ?? {}).slice(0,2).join("-").toLowerCase().replace(/[^a-z0-9]+/g,"-")}`;
      assets[a.assetTypeSlug] = {
        desktop: `/${sub}/${slug}-desktop.webp`,
        tablet:  `/${sub}/${slug}-tablet.webp`,
        mobile:  `/${sub}/${slug}-mobile.webp`,
      };
    }
    return { brand: selectedBrand.name, folder, assets };
  };

  const startPublish = async (idsOverride?: string[]) => {
    setPublishing(true);
    setPublishLog(["Connecting to GitHub…"]);
    setPublishResult(null);
    try {
      const assetIds = idsOverride ?? (selectedIds.size > 0 ? [...selectedIds] : []);
      const resp = await fetch(`${BASE}/github/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetIds, brandId: selectedBrandId }),
      });
      if (!resp.body) throw new Error("No streaming body");
      const reader = resp.body.getReader();
      const dec    = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.status === "starting") setPublishLog(l => [...l, d.message]);
            if (d.status === "done")     setPublishResult(d.result);
            if (d.status === "error")    setPublishLog(l => [...l, `Error: ${d.reason}`]);
          } catch {}
        }
      }
      refetchQueue();
      qc.invalidateQueries({ queryKey: ["atlas-status"] });
    } catch (e) {
      setPublishLog(l => [...l, `Failed: ${e instanceof Error ? e.message : String(e)}`]);
    } finally {
      setPublishing(false);
    }
  };

  const commitPreview  = buildCommitPreview();
  const manifestPreview = buildManifestPreview();
  const publishTargets = selectedIds.size > 0 ? selectedIds.size : unpublished.length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-4">
        <Link href="/">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </Link>
        <div className="flex items-center gap-2">
          <Github className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold">GitHub Publish</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => { refetchStatus(); refetchQueue(); }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-border text-muted-foreground hover:text-foreground">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-border bg-card flex flex-col shrink-0">
          {/* GitHub status card */}
          <div className="p-4 border-b border-border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">GitHub Connection</div>
            {statusLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Checking…</div>
            ) : ghStatus ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${ghStatus.ok ? "bg-green-500" : "bg-red-500"}`} />
                  <span className="text-sm font-medium">{ghStatus.ok ? "Connected" : "Error"}</span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5"><ExternalLink className="w-3 h-3" />
                    <a href={`https://github.com/${ghStatus.repo}`} target="_blank" rel="noreferrer"
                      className="hover:text-foreground truncate">{ghStatus.repo}</a>
                  </div>
                  <div className="flex items-center gap-1.5"><GitCommit className="w-3 h-3" /> branch: <span className="font-mono">{ghStatus.branch}</span></div>
                  <div className="flex items-center gap-1.5"><Package className="w-3 h-3" />
                    API: {ghStatus.rateLimit.remaining}/{ghStatus.rateLimit.limit} remaining
                  </div>
                  {ghStatus.latestCommit && (
                    <div className="mt-2 p-2 rounded bg-secondary/50 text-[10px] font-mono leading-relaxed">
                      <div className="text-muted-foreground">{ghStatus.latestCommit.sha.slice(0, 7)}</div>
                      <div className="truncate">{ghStatus.latestCommit.message}</div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          {/* Brand selector */}
          <div className="p-4 border-b border-border">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Brand</div>
            <div className="space-y-1">
              {brands.map(b => (
                <button key={b.id} onClick={() => { setSelectedBrandId(b.id); setSelectedIds(new Set()); }}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${selectedBrandId === b.id ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground hover:text-foreground"}`}>
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          {/* Folder info */}
          {selectedBrand && (
            <div className="p-4 border-b border-border">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Destination</div>
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <FolderOpen className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span className="font-mono break-all leading-relaxed">
                  {selectedBrand.githubFolder ?? `apps/${selectedBrand.slug}/public/images`}
                </span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="p-4">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Queue</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ready to publish</span>
                <span className="font-medium text-primary">{unpublished.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Already published</span>
                <span className="font-medium text-green-500">{alreadyPublished.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Selected</span>
                <span className="font-medium">{selectedIds.size}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Commit preview */}
          {commitPreview && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-2">
                <GitCommit className="w-3.5 h-3.5" /> Commit Preview
              </div>
              <code className="text-sm text-foreground font-mono bg-secondary/50 px-3 py-2 rounded block">{commitPreview}</code>
            </div>
          )}

          {/* Manifest preview */}
          {manifestPreview && (
            <div className="rounded-lg border border-border bg-card p-4">
              <button onClick={() => setShowManifest(v => !v)}
                className="flex items-center justify-between w-full text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                <span className="flex items-center gap-2"><FileText className="w-3.5 h-3.5" /> Manifest Preview</span>
                {showManifest ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {showManifest && (
                <pre className="text-xs font-mono bg-secondary/50 rounded p-3 overflow-x-auto text-muted-foreground leading-relaxed max-h-60">
                  {JSON.stringify(manifestPreview, null, 2)}
                </pre>
              )}
            </div>
          )}

          {/* Asset list */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium">Approved Assets</span>
                {unpublished.length > 0 && (
                  <button onClick={toggleAll} className="text-xs text-muted-foreground hover:text-foreground">
                    {selectedIds.size === unpublished.length ? "Deselect all" : "Select all"}
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={publishing || unpublished.length === 0 || selectedIds.size === 0}
                  onClick={() => startPublish([...selectedIds])}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  <Send className="w-3.5 h-3.5" /> Publish Selected ({selectedIds.size})
                </button>
                <button
                  disabled={publishing || unpublished.length === 0}
                  onClick={() => startPublish([])}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium">
                  {publishing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                  Publish All Approved ({unpublished.length})
                </button>
              </div>
            </div>

            {queueLoading ? (
              <div className="flex items-center justify-center h-32 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading…
              </div>
            ) : unpublished.length === 0 && alreadyPublished.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
                <CheckCircle className="w-8 h-8 opacity-20" />
                <p className="text-sm">No approved assets for this brand yet.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-secondary/30">
                  <tr className="text-xs text-muted-foreground uppercase tracking-wide">
                    <th className="px-4 py-2 w-10" />
                    <th className="px-4 py-2 text-left">Asset</th>
                    <th className="px-4 py-2 text-left">Scene</th>
                    <th className="px-4 py-2 text-left">Destination</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...unpublished, ...alreadyPublished].map(asset => {
                    const isPublished = asset.published;
                    const isSelected  = selectedIds.has(asset.assetId);
                    const sub         = asset.githubSubfolder ?? asset.assetTypeSlug;
                    const sceneLabel  = Object.values(asset.sceneVars ?? {}).filter(Boolean).join(" · ");
                    return (
                      <tr key={asset.assetId}
                        className={`border-b border-border/50 hover:bg-secondary/20 transition-colors ${isSelected ? "bg-primary/5" : ""}`}>
                        <td className="px-4 py-3 text-center">
                          {!isPublished && (
                            <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(asset.assetId)}
                              className="rounded border-border" />
                          )}
                          {isPublished && <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{asset.assetTypeName}</div>
                          <div className="text-xs font-mono text-muted-foreground">{asset.assetId}</div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {sceneLabel || <span className="italic">No scene vars</span>}
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                          …/{sub}/
                        </td>
                        <td className="px-4 py-3">
                          {isPublished ? (
                            <div>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-500 border border-green-500/20">
                                <CheckCircle className="w-3 h-3" /> Published
                              </span>
                              {asset.gitCommitHash && (
                                <div className="text-[10px] font-mono text-muted-foreground mt-1">{asset.gitCommitHash.slice(0, 7)}</div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                              <Clock className="w-3 h-3" /> Ready
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Publish log / result */}
          {(publishLog.length > 0 || publishResult) && (
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Publish Log</div>

              {/* Live log */}
              {publishing && (
                <div ref={logRef} className="font-mono text-xs text-muted-foreground space-y-1 max-h-40 overflow-y-auto mb-3">
                  {publishLog.map((l, i) => <div key={i}>{l}</div>)}
                  <div className="flex items-center gap-2 text-primary"><Loader2 className="w-3 h-3 animate-spin" /> Publishing…</div>
                </div>
              )}

              {/* Result */}
              {publishResult && (
                <div className="space-y-3">
                  {publishResult.ok ? (
                    <div className="flex items-start gap-3 p-3 rounded bg-green-500/10 border border-green-500/20">
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-medium text-green-500">Published successfully</div>
                        {publishResult.commitHash && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Commit: <a href={`https://github.com/${ghStatus?.repo}/commit/${publishResult.commitHash}`}
                              target="_blank" rel="noreferrer" className="font-mono hover:text-foreground">
                              {publishResult.commitHash.slice(0, 7)}
                            </a>
                          </div>
                        )}
                        {publishResult.manifestPath && (
                          <div className="text-xs text-muted-foreground">Manifest: <span className="font-mono">{publishResult.manifestPath}</span></div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-3 rounded bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                      <div className="text-sm text-red-500">{publishResult.reason ?? "Publish failed"}</div>
                    </div>
                  )}

                  {/* Per-asset results */}
                  {publishResult.results.length > 0 && (
                    <div className="space-y-1">
                      {publishResult.results.map(r => (
                        <div key={r.assetId} className="flex items-center gap-2 text-xs">
                          {r.status === "published" ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> :
                           r.status === "skipped"   ? <Clock className="w-3.5 h-3.5 text-yellow-500" /> :
                                                      <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                          <span className="font-mono text-muted-foreground">{r.assetId}</span>
                          <span className={r.status === "published" ? "text-green-500" : r.status === "skipped" ? "text-yellow-500" : "text-red-500"}>
                            {r.status}
                          </span>
                          {r.reason && <span className="text-muted-foreground">— {r.reason}</span>}
                          {r.files && <span className="text-muted-foreground">{r.files.length} files</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
