import React, { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search, Image as ImageIcon, CheckCircle, XCircle, RotateCw, Trash2,
  ChevronDown, ChevronUp, Download, X, Play, Copy, Loader2, Archive,
  Globe, Bookmark, Lock, Plus, BookOpen, ChevronRight, Upload,
} from "lucide-react";

// ── API helpers ────────────────────────────────────────────────────────────────
const BASE = "/api/atlas";
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, opts);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface Brand { id: number; slug: string; name: string; styleProfile: Record<string,string[]>; styleLock: Record<string,string>; }
interface AssetType { id: number; slug: string; name: string; }
interface AtlasAsset {
  assetId: string; brandId: number; assetTypeId: number;
  sceneVars: Record<string,string>; imagePrompt?: string; imageVersion?: number;
  imageStatus?: string; approved?: boolean; published?: boolean; archived?: boolean;
  masterImage?: string; desktopHeroImage?: string; mobileHeroImage?: string;
  sectionImage?: string; cardImage?: string; squareImage?: string;
  portraitImage?: string; landscapeImage?: string; socialImage?: string;
  generatedAt?: string; lastGenerated?: string; provider?: string; generationCost?: number;
  matchReferenceId?: number; brandName: string; brandSlug: string;
  assetTypeName: string; assetTypeSlug: string;
}

const SCENE_OPTIONS = {
  scene:     ["Office","Retail","Warehouse","Airport","Construction Site","Industrial Estate","Fuel Station"],
  task:      ["Sign Installation","Vehicle Graphics","Architectural Vinyl","Window Manifestation","Survey","Totem Installation","MEWP","Night Installation"],
  equipment: ["None","Scissor Lift","Boom Lift","Spider Lift","HIAB","Crane","Forklift"],
  crewSize:  ["1","2","3","4"],
  lighting:  ["Sunrise","Day","Golden Hour","Night"],
  weather:   ["Dry","Wet Ground","Overcast","Rain"],
};

const STYLE_LOCK_FIELDS = ["Lighting","Colour grading","Composition","Architecture","Camera lens","Perspective","Mood","Depth of field","Contrast","Camera height"];

const STATUS_COLORS: Record<string,string> = {
  approved:  "bg-green-500/10 text-green-500 border-green-500/20",
  generated: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  pending:   "bg-gray-500/10 text-gray-400 border-gray-500/20",
  rejected:  "bg-red-500/10 text-red-500 border-red-500/20",
  failed:    "bg-orange-500/10 text-orange-500 border-orange-500/20",
  generating:"bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse",
  archived:  "bg-gray-500/10 text-gray-500 border-gray-500/20",
  published: "bg-purple-500/10 text-purple-400 border-purple-500/20",
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AtlasMediaStudio() {
  const qc = useQueryClient();
  const [selectedBrandId, setSelectedBrandId] = useState<number | null>(null);
  const [selectedTypeSlug, setSelectedTypeSlug] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedAsset, setSelectedAsset] = useState<AtlasAsset | null>(null);
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [showStyleLock, setShowStyleLock] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{index:number;total:number;succeeded:number;failed:number;skipped:number;report:any}|null>(null);
  const [matchReference, setMatchReference] = useState<AtlasAsset | null>(null);

  const { data: brandsData } = useQuery({ queryKey: ["atlas-brands"], queryFn: () => apiFetch("/brands") });
  const { data: typesData }  = useQuery({ queryKey: ["atlas-types"],  queryFn: () => apiFetch("/asset-types") });
  const { data: statusData, isLoading } = useQuery({
    queryKey: ["atlas-status", selectedBrandId],
    queryFn: () => apiFetch(`/status${selectedBrandId ? `?brandId=${selectedBrandId}` : ""}`),
    refetchInterval: 8000,
  });

  const brands: Brand[]    = brandsData?.brands ?? [];
  const assetTypes: AssetType[] = typesData?.assetTypes ?? [];
  const allAssets: AtlasAsset[] = statusData?.assets ?? [];

  // Auto-select first brand
  useEffect(() => {
    if (brands.length > 0 && selectedBrandId === null) {
      setSelectedBrandId(brands[0].id);
    }
  }, [brands, selectedBrandId]);

  const selectedBrand = brands.find(b => b.id === selectedBrandId) ?? null;

  const filteredAssets = useMemo(() => allAssets.filter(a => {
    const matchSearch = !search ||
      a.assetTypeName.toLowerCase().includes(search.toLowerCase()) ||
      a.assetId.toLowerCase().includes(search.toLowerCase()) ||
      Object.values(a.sceneVars ?? {}).some(v => v.toLowerCase().includes(search.toLowerCase()));
    const matchType = selectedTypeSlug === "all" || a.assetTypeSlug === selectedTypeSlug;
    const matchStatus = statusFilter === "All" ||
      (statusFilter === "pending" && (!a.imageStatus || a.imageStatus === "pending")) ||
      a.imageStatus === statusFilter;
    return matchSearch && matchType && matchStatus;
  }), [allAssets, search, selectedTypeSlug, statusFilter]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["atlas-status", selectedBrandId] });

  const startBulkGeneration = async () => {
    setIsBulkGenerating(true);
    setBulkProgress({ index: 0, total: allAssets.length, succeeded: 0, failed: 0, skipped: 0, report: null });
    try {
      const resp = await fetch(`${BASE}/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: false, brandId: selectedBrandId }),
      });
      if (!resp.body) throw new Error("No body");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n"); buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done) {
              setBulkProgress(p => p ? { ...p, report: data.report } : null);
              refresh();
            } else if (data.index !== undefined) {
              setBulkProgress(p => p ? { ...p, index: data.index, total: data.total,
                succeeded: p.succeeded + (data.result.status === "generated" ? 1 : 0),
                failed:    p.failed    + (data.result.status === "failed"    ? 1 : 0),
                skipped:   p.skipped   + (data.result.status === "skipped"   ? 1 : 0),
              } : null);
              if (data.index % 5 === 0) refresh();
            }
          } catch {}
        }
      }
    } catch (e) { console.error(e); refresh(); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <ImageIcon className="w-5 h-5 text-primary" />
          <span className="text-xl font-semibold tracking-tight text-white">Atlas</span>
          <span className="text-xl font-light text-muted-foreground">Media Studio</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/library">
            <button className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <BookOpen className="w-4 h-4" /> Asset Library
            </button>
          </Link>
          {selectedBrand && (
            <button onClick={() => setShowStyleLock(true)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
              <Lock className="w-4 h-4" /> Style Lock
            </button>
          )}
          <button onClick={() => setShowNewAsset(true)} className="flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            <Plus className="w-4 h-4" /> New Asset
          </button>
          {selectedBrand && (
            <button onClick={startBulkGeneration} disabled={isBulkGenerating} className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-colors font-medium">
              <Play className="w-4 h-4" /> Generate All — {selectedBrand.name}
            </button>
          )}
        </div>
      </header>

      {/* Brand selector */}
      <div className="border-b border-border bg-card/50 px-6 py-3 flex items-center gap-2 overflow-x-auto">
        {brands.map(b => (
          <button key={b.id} onClick={() => setSelectedBrandId(b.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              selectedBrandId === b.id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}>
            {b.name}
          </button>
        ))}
        {brands.length === 0 && <span className="text-sm text-muted-foreground">Loading brands…</span>}
      </div>

      {/* Asset type tabs */}
      <div className="border-b border-border px-6 py-2 flex items-center gap-1 overflow-x-auto bg-card/30">
        <button onClick={() => setSelectedTypeSlug("all")}
          className={`px-3 py-1 rounded text-sm transition-colors whitespace-nowrap ${selectedTypeSlug === "all" ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
          All Types
        </button>
        {assetTypes.map(t => (
          <button key={t.slug} onClick={() => setSelectedTypeSlug(t.slug)}
            className={`px-3 py-1 rounded text-sm transition-colors whitespace-nowrap ${selectedTypeSlug === t.slug ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
            {t.name}
          </button>
        ))}
      </div>

      {/* Match reference banner */}
      {matchReference && (
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-2 flex items-center gap-3">
          <Bookmark className="w-4 h-4 text-primary" />
          <span className="text-sm text-primary">Matching visual style of: <strong>{matchReference.assetId}</strong></span>
          <button onClick={() => setMatchReference(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}

      <main className="flex-1 p-6 flex flex-col gap-4 max-w-screen-2xl mx-auto w-full">
        {/* Filters */}
        <div className="flex items-center gap-4 bg-card p-4 rounded-lg border border-border">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input placeholder="Search assets, scenes…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="All">All Status</option>
            <option value="pending">Pending</option>
            <option value="generating">Generating</option>
            <option value="generated">Generated</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="failed">Failed</option>
          </select>
          <span className="text-sm text-muted-foreground ml-auto">{filteredAssets.length} assets</span>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-card shadow-sm">
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium">Preview</th>
                  <th className="px-4 py-3 font-medium">Asset</th>
                  <th className="px-4 py-3 font-medium">Scene</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAssets.map(asset => (
                  <AssetRow
                    key={asset.assetId}
                    asset={asset}
                    assetTypes={assetTypes}
                    onOpenPreview={() => setSelectedAsset(asset)}
                    onSetMatchReference={() => setMatchReference(asset)}
                    matchReference={matchReference}
                    onRefresh={refresh}
                  />
                ))}
                {filteredAssets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">
                      {allAssets.length === 0
                        ? <span>No assets yet. <button onClick={() => setShowNewAsset(true)} className="text-primary underline">Create your first asset</button></span>
                        : "No assets match the filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Bulk modal */}
      {isBulkGenerating && (
        <div className="fixed inset-0 bg-black/60 z-40 flex items-center justify-center">
          <div className="bg-card border border-border rounded-xl shadow-2xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-1">Bulk Generation</h2>
            <p className="text-sm text-muted-foreground mb-4">Generating images for {selectedBrand?.name ?? "all brands"}…</p>
            {bulkProgress?.report ? (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-4"><CheckCircle className="w-12 h-12 text-primary" /></div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  {[["Generated", bulkProgress.succeeded, "text-primary"],["Failed", bulkProgress.failed, "text-destructive"],["Skipped", bulkProgress.skipped, "text-muted-foreground"]].map(([label, n, cls]) => (
                    <div key={label as string} className="bg-secondary/50 rounded-lg p-3">
                      <div className={`text-2xl font-bold ${cls}`}>{n}</div>
                      <div className="text-xs text-muted-foreground mt-1">{label}</div>
                    </div>
                  ))}
                </div>
                <button onClick={() => { setIsBulkGenerating(false); setBulkProgress(null); }} className="w-full py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium">Close</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processing…</span>
                  <span className="text-muted-foreground font-mono">{bulkProgress?.index ?? 0} / {bulkProgress?.total ?? 0}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${bulkProgress?.total ? ((bulkProgress.index) / bulkProgress.total) * 100 : 0}%` }} />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>Generated: {bulkProgress?.succeeded ?? 0}</span>
                  <span>Failed: {bulkProgress?.failed ?? 0}</span>
                  <span>Skipped: {bulkProgress?.skipped ?? 0}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New asset dialog */}
      {showNewAsset && selectedBrand && (
        <NewAssetDialog
          brand={selectedBrand}
          assetTypes={assetTypes}
          matchReference={matchReference}
          onClose={() => setShowNewAsset(false)}
          onCreated={refresh}
        />
      )}

      {/* Style lock dialog */}
      {showStyleLock && selectedBrand && (
        <StyleLockDialog
          brand={selectedBrand}
          onClose={() => setShowStyleLock(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["atlas-brands"] })}
        />
      )}

      {/* Image preview drawer */}
      {selectedAsset && (
        <ImagePreviewDrawer
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}

// ── Asset Row ──────────────────────────────────────────────────────────────────
function AssetRow({ asset, assetTypes, onOpenPreview, onSetMatchReference, matchReference, onRefresh }: {
  asset: AtlasAsset; assetTypes: AssetType[];
  onOpenPreview: () => void; onSetMatchReference: () => void;
  matchReference: AtlasAsset | null; onRefresh: () => void;
}) {
  const [showPrompt, setShowPrompt] = useState(false);
  const qc = useQueryClient();

  const doPost = async (path: string, body?: object) => {
    await fetch(`/api/atlas${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    onRefresh();
  };
  const doDel = async (path: string) => {
    await fetch(`/api/atlas${path}`, { method: "DELETE" });
    onRefresh();
  };

  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };

  const status = asset.imageStatus || "pending";
  const badgeClass = STATUS_COLORS[status] || STATUS_COLORS.pending;
  const hasImage = ["generated","approved","rejected"].includes(status);
  const thumbUrl = hasImage ? `/api/atlas/image/${asset.assetId}/square?v=${asset.imageVersion ?? 0}` : null;
  const isRef = matchReference?.assetId === asset.assetId;

  const sceneLabel = Object.entries(asset.sceneVars ?? {}).filter(([,v]) => v).map(([,v]) => v).join(" · ");

  return (
    <>
      <tr className={`hover:bg-secondary/20 transition-colors group ${isRef ? "ring-1 ring-primary/30" : ""}`}>
        <td className="px-4 py-3 w-20">
          <div className="w-12 h-12 rounded bg-secondary flex items-center justify-center overflow-hidden cursor-pointer border border-border group-hover:border-primary/50 transition-colors" onClick={onOpenPreview}>
            {thumbUrl ? <img src={thumbUrl} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-muted-foreground" />}
          </div>
        </td>
        <td className="px-4 py-3">
          <div className="font-medium text-foreground">{asset.assetTypeName}</div>
          <div className="text-xs text-muted-foreground flex gap-2 items-center mt-1">
            <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">{asset.assetId}</span>
            <span>{asset.brandName}</span>
            {asset.published && <span className="text-purple-400">● Published</span>}
          </div>
        </td>
        <td className="px-4 py-3 text-xs text-muted-foreground">
          {sceneLabel || <span className="italic">No scene vars</span>}
        </td>
        <td className="px-4 py-3">
          <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${badgeClass}`}>{status.toUpperCase()}</span>
          {(asset.imageVersion ?? 0) > 0 && <div className="text-[10px] text-muted-foreground mt-1 ml-1">v{asset.imageVersion}</div>}
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {(busy || status === "generating") && <Loader2 className="w-4 h-4 animate-spin text-primary mr-1" />}
            {(!status || status === "pending" || status === "failed") && (
              <ActionBtn icon={<Play className="w-3.5 h-3.5" />} title="Generate" disabled={busy} onClick={() => act(() => doPost(`/generate/${asset.assetId}`, { force: false }))} />
            )}
            {hasImage && <>
              <ActionBtn icon={<RotateCw className="w-3.5 h-3.5" />} title="Regenerate" disabled={busy} onClick={() => act(() => doPost(`/generate/${asset.assetId}`, { force: true }))} />
              {status !== "approved" && <ActionBtn icon={<CheckCircle className="w-3.5 h-3.5" />} title="Approve" cls="text-green-500 border-green-500/20 hover:bg-green-500/10" disabled={busy} onClick={() => act(() => doPost(`/approve/${asset.assetId}`))} />}
              {status !== "rejected" && <ActionBtn icon={<XCircle className="w-3.5 h-3.5" />} title="Reject" cls="text-orange-500 border-orange-500/20 hover:bg-orange-500/10" disabled={busy} onClick={() => act(() => doPost(`/reject/${asset.assetId}`))} />}
            </>}
            {status === "approved" && (
              <ActionBtn icon={<Bookmark className="w-3.5 h-3.5" />} title="Use as reference" cls={isRef ? "text-primary border-primary/40 bg-primary/10" : ""} disabled={busy} onClick={onSetMatchReference} />
            )}
            <ActionBtn icon={<Trash2 className="w-3.5 h-3.5" />} title="Clear" cls="text-red-500 border-red-500/20 hover:bg-red-500/10" disabled={busy} onClick={() => act(() => doDel(`/${asset.assetId}`))} />
            <button onClick={() => setShowPrompt(v => !v)} className="p-1 rounded hover:bg-secondary/50 text-muted-foreground ml-1">
              {showPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </td>
      </tr>
      {showPrompt && (
        <tr className="bg-secondary/10 border-b border-border">
          <td colSpan={5} className="px-6 py-4">
            <div className="flex gap-4 items-start">
              <div className="flex-1 bg-background p-3 rounded border border-border text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                {asset.imagePrompt || "No prompt available."}
              </div>
              {asset.imagePrompt && (
                <button onClick={() => navigator.clipboard.writeText(asset.imagePrompt!)} className="shrink-0 flex items-center gap-2 px-3 py-1.5 rounded border border-border text-xs text-muted-foreground hover:text-foreground">
                  <Copy className="w-3.5 h-3.5" /> Copy
                </button>
              )}
            </div>
            {asset.generationCost != null && (
              <div className="mt-2 text-xs text-muted-foreground flex gap-4">
                <span>Cost: ${asset.generationCost.toFixed(3)}</span>
                <span>Provider: {asset.provider ?? "N/A"}</span>
                {asset.generatedAt && <span>Generated: {new Date(asset.generatedAt).toLocaleString()}</span>}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function ActionBtn({ icon, title, onClick, disabled, cls = "" }: { icon: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; cls?: string; }) {
  return (
    <button title={title} disabled={disabled} onClick={onClick}
      className={`p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors disabled:opacity-40 ${cls}`}>
      {icon}
    </button>
  );
}

// ── Image Preview Drawer ───────────────────────────────────────────────────────
function ImagePreviewDrawer({ asset, onClose, onRefresh }: { asset: AtlasAsset; onClose: () => void; onRefresh: () => void; }) {
  const v = asset.imageVersion ?? 0;
  const base = `/api/atlas/image/${asset.assetId}`;
  const hasImages = ["generated","approved","rejected"].includes(asset.imageStatus ?? "");
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const act = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); onRefresh(); } finally { setBusy(false); } };
  const post = (path: string) => fetch(`/api/atlas${path}`, { method: "POST" });

  const handleUpload = async (file: File) => {
    setUploadError(null);
    setBusy(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const r = await fetch(`/api/atlas/upload/${asset.assetId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: b64, mimeType: file.type }),
      });
      const json = await r.json();
      if (!json.ok) setUploadError(json.reason ?? "Upload failed");
      else onRefresh();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const download = async (crop: string) => {
    const r = await fetch(`${base}/${crop}?v=${v}`);
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${asset.assetId}-${crop}.webp`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const crops: [string, string, string][] = [
    ["Desktop Hero (1920×1080)", "desktopHero", "aspect-video"],
    ["Mobile Hero (390×844)", "mobileHero", "aspect-[390/844] max-w-[180px]"],
    ["Section (1440×600)", "section", "aspect-[1440/600]"],
    ["Card (400×500)", "card", "aspect-[4/5] max-w-[160px]"],
    ["Square (1080×1080)", "square", "aspect-square max-w-[200px]"],
    ["Portrait (1080×1350)", "portrait", "aspect-[1080/1350] max-w-[180px]"],
    ["Landscape (1920×1080)", "landscape", "aspect-video"],
    ["Social (1080×1080)", "social", "aspect-square max-w-[200px]"],
  ];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-[640px] max-w-[92vw] bg-card border-l border-border z-50 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-background">
          <div>
            <h2 className="text-lg font-semibold">{asset.assetTypeName}</h2>
            <div className="text-xs text-muted-foreground font-mono">{asset.assetId} · {asset.brandName}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => { crops.forEach(([,crop], i) => setTimeout(() => download(crop), i * 400)); }} disabled={!hasImages} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40">
              <Download className="w-4 h-4" /> All
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-secondary/50"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Action bar — always visible */}
        <div className="px-6 py-3 border-b border-border bg-card/50 flex items-center gap-2 flex-wrap">
          {busy && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          {hasImages && <>
            {asset.imageStatus !== "approved" && (
              <button disabled={busy} onClick={() => act(() => post(`/approve/${asset.assetId}`).then(() => {}))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-green-500/30 text-green-500 hover:bg-green-500/10 disabled:opacity-40">
                <CheckCircle className="w-3.5 h-3.5" /> Approve
              </button>
            )}
            {asset.imageStatus !== "rejected" && (
              <button disabled={busy} onClick={() => act(() => post(`/reject/${asset.assetId}`).then(() => {}))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-orange-500/30 text-orange-500 hover:bg-orange-500/10 disabled:opacity-40">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            )}
            <button disabled={busy} onClick={() => act(() => fetch(`/api/atlas/generate/${asset.assetId}`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({force:true}) }).then(()=>{}))}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40">
              <RotateCw className="w-3.5 h-3.5" /> Regenerate
            </button>
            <button disabled={busy} onClick={() => act(() => post(`/archive/${asset.assetId}`).then(() => {}))}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-40">
              <Archive className="w-3.5 h-3.5" /> Archive
            </button>
            {asset.approved && (
              <button disabled={busy} onClick={() => act(() => post(`/publish/${asset.assetId}`).then(() => {}))}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border ${asset.published ? "border-purple-500/30 text-purple-400 bg-purple-500/10" : "border-border text-muted-foreground hover:text-foreground"} disabled:opacity-40`}>
                <Globe className="w-3.5 h-3.5" /> {asset.published ? "Published" : "Publish"}
              </button>
            )}
          </>}
          {/* Upload from local computer — always available */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
          />
          <button disabled={busy} onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-primary/30 text-primary hover:bg-primary/10 disabled:opacity-40 ml-auto">
            <Upload className="w-3.5 h-3.5" /> Upload Image
          </button>
          {uploadError && <span className="text-xs text-red-500 w-full mt-1">{uploadError}</span>}
        </div>

        {/* Crops */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 bg-card">
          {!hasImages ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
              <ImageIcon className="w-12 h-12 opacity-20" />
              <p>No artwork yet — generate or upload an image above.</p>
            </div>
          ) : (
            <>
              {/* Desktop Hero — full width */}
              <CropPreview label="Desktop Hero (1920×1080)" crop="desktopHero" assetId={asset.assetId} v={v} aspectClass="aspect-video" onDownload={() => download("desktopHero")} />
              {/* Section — full width */}
              <CropPreview label="Section Banner (1440×600)" crop="section" assetId={asset.assetId} v={v} aspectClass="aspect-[1440/600]" onDownload={() => download("section")} />
              {/* Landscape — full width */}
              <CropPreview label="Landscape (1920×1080)" crop="landscape" assetId={asset.assetId} v={v} aspectClass="aspect-video" onDownload={() => download("landscape")} />
              {/* Grid: mobile, card, square, portrait, social */}
              <div className="grid grid-cols-2 gap-6">
                <CropPreview label="Mobile Hero" crop="mobileHero" assetId={asset.assetId} v={v} aspectClass="aspect-[390/844]" onDownload={() => download("mobileHero")} />
                <CropPreview label="Card (400×500)" crop="card" assetId={asset.assetId} v={v} aspectClass="aspect-[4/5]" onDownload={() => download("card")} />
                <CropPreview label="Square (1080×1080)" crop="square" assetId={asset.assetId} v={v} aspectClass="aspect-square" onDownload={() => download("square")} />
                <CropPreview label="Portrait (1080×1350)" crop="portrait" assetId={asset.assetId} v={v} aspectClass="aspect-[1080/1350]" onDownload={() => download("portrait")} />
                <CropPreview label="Social (1080×1080)" crop="social" assetId={asset.assetId} v={v} aspectClass="aspect-square" onDownload={() => download("social")} />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function CropPreview({ label, crop, assetId, v, aspectClass, onDownload }: { label: string; crop: string; assetId: string; v: number; aspectClass: string; onDownload: () => void; }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-sm font-medium">
        <span>{label}</span>
        <button onClick={onDownload} className="p-1 rounded hover:bg-secondary/50 text-muted-foreground"><Download className="w-3.5 h-3.5" /></button>
      </div>
      <div className={`bg-secondary rounded-lg overflow-hidden border border-border ${aspectClass} w-full`}>
        <img src={`/api/atlas/image/${assetId}/${crop}?v=${v}`} alt={label} className="w-full h-full object-cover" />
      </div>
    </div>
  );
}

// ── New Asset Dialog ───────────────────────────────────────────────────────────
function NewAssetDialog({ brand, assetTypes, matchReference, onClose, onCreated }: {
  brand: Brand; assetTypes: AssetType[]; matchReference: AtlasAsset | null;
  onClose: () => void; onCreated: () => void;
}) {
  const [assetTypeId, setAssetTypeId] = useState(assetTypes[0]?.id ?? 0);
  const [sceneVars, setSceneVars] = useState<Record<string,string>>({});
  const [busy, setBusy] = useState(false);
  const [generateNow, setGenerateNow] = useState(true);

  const setVar = (k: string, v: string) => setSceneVars(p => ({ ...p, [k]: v }));

  const handleCreate = async () => {
    setBusy(true);
    try {
      const { assetId } = await apiFetch("/assets", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandId: brand.id, assetTypeId, sceneVars }),
      });
      if (generateNow) {
        await fetch(`/api/atlas/generate/${assetId}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ force: false }),
        });
      }
      onCreated(); onClose();
    } catch (e) { console.error(e); } finally { setBusy(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold">New Asset — {brand.name}</h2>
            <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <div className="p-6 space-y-5">
            {/* Asset type */}
            <div>
              <label className="text-sm font-medium block mb-2">Asset Type</label>
              <select value={assetTypeId} onChange={e => setAssetTypeId(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                {assetTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {/* Scene variables */}
            <div>
              <label className="text-sm font-medium block mb-2">Scene Variables</label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(SCENE_OPTIONS).map(([key, opts]) => (
                  <div key={key}>
                    <label className="text-xs text-muted-foreground block mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                    <select value={sceneVars[key] ?? ""} onChange={e => setVar(key, e.target.value)}
                      className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring">
                      <option value="">— None —</option>
                      {opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            {matchReference && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
                <span className="text-primary font-medium">Using visual reference:</span>{" "}
                <span className="text-muted-foreground">{matchReference.assetId} · {matchReference.assetTypeName}</span>
              </div>
            )}
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" checked={generateNow} onChange={e => setGenerateNow(e.target.checked)} className="rounded" />
              <span className="text-sm">Generate image immediately</span>
            </label>
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded border border-border text-muted-foreground hover:text-foreground">Cancel</button>
            <button onClick={handleCreate} disabled={busy || !assetTypeId}
              className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 font-medium flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />}
              {generateNow ? "Create & Generate" : "Create Asset"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Style Lock Dialog ──────────────────────────────────────────────────────────
function StyleLockDialog({ brand, onClose, onSaved }: { brand: Brand; onClose: () => void; onSaved: () => void; }) {
  const [lock, setLock] = useState<Record<string,string>>(brand.styleLock ?? {});
  const [busy, setBusy] = useState(false);

  const handleSave = async () => {
    setBusy(true);
    try {
      await fetch(`/api/atlas/brands/${brand.id}/style-lock`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleLock: lock }),
      });
      onSaved(); onClose();
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold flex items-center gap-2"><Lock className="w-4 h-4 text-primary" /> Style Lock — {brand.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">Visual DNA injected into every future generation for this brand</p>
            </div>
            <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>
          <div className="p-6 space-y-4">
            {STYLE_LOCK_FIELDS.map(field => (
              <div key={field}>
                <label className="text-xs font-medium text-muted-foreground block mb-1">{field}</label>
                <input value={lock[field] ?? ""} onChange={e => setLock(p => ({ ...p, [field]: e.target.value }))}
                  placeholder={`Describe the ${field.toLowerCase()}…`}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            ))}
          </div>
          <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
            <button onClick={onClose} className="px-4 py-2 text-sm rounded border border-border text-muted-foreground">Cancel</button>
            <button onClick={handleSave} disabled={busy} className="px-4 py-2 text-sm rounded bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 font-medium flex items-center gap-2">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save Style Lock
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
