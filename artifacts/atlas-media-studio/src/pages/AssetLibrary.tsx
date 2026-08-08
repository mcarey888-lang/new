import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, Search, Image as ImageIcon, Loader2, X, Download, CheckCircle, Globe } from "lucide-react";

interface AtlasAsset {
  assetId: string; brandId: number; assetTypeId: number;
  sceneVars: Record<string,string>; imageStatus?: string;
  approved?: boolean; published?: boolean;
  squareImage?: string; desktopHeroImage?: string;
  imageVersion?: number; brandName: string; assetTypeName: string;
  assetTypeSlug: string; brandSlug: string;
}
interface Brand { id: number; slug: string; name: string; }
interface AssetType { id: number; slug: string; name: string; }

import { adminApiFetch } from "@/lib/adminToken";
async function apiFetch(path: string) {
  const r = await adminApiFetch(`/api/atlas${path}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export default function AssetLibrary() {
  const { data: brandsData }   = useQuery({ queryKey: ["atlas-brands"],  queryFn: () => apiFetch("/brands") });
  const { data: typesData }    = useQuery({ queryKey: ["atlas-types"],   queryFn: () => apiFetch("/asset-types") });
  const { data: statusData, isLoading } = useQuery({
    queryKey: ["atlas-library"],
    queryFn: () => apiFetch("/status"),
    refetchInterval: 30_000,
  });

  const brands: Brand[]       = brandsData?.brands ?? [];
  const assetTypes: AssetType[] = typesData?.assetTypes ?? [];
  const allAssets: AtlasAsset[] = (statusData?.assets ?? []).filter((a: AtlasAsset) => a.approved);

  const [search, setSearch]               = useState("");
  const [brandFilter, setBrandFilter]     = useState<number[]>([]);
  const [typeFilter, setTypeFilter]       = useState<string>("");
  const [sceneFilter, setSceneFilter]     = useState("");
  const [lightingFilter, setLightingFilter] = useState("");
  const [statusFilter, setStatusFilter]   = useState<"all"|"approved"|"published">("all");
  const [selected, setSelected]           = useState<AtlasAsset | null>(null);

  const toggleBrand = (id: number) =>
    setBrandFilter(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const filtered = useMemo(() => allAssets.filter(a => {
    if (brandFilter.length > 0 && !brandFilter.includes(a.brandId)) return false;
    if (typeFilter && a.assetTypeSlug !== typeFilter) return false;
    if (sceneFilter && !(a.sceneVars?.scene ?? "").toLowerCase().includes(sceneFilter.toLowerCase())) return false;
    if (lightingFilter && !(a.sceneVars?.lighting ?? "").toLowerCase().includes(lightingFilter.toLowerCase())) return false;
    if (statusFilter === "published" && !a.published) return false;
    if (search) {
      const q = search.toLowerCase();
      if (![a.assetTypeName, a.brandName, a.assetId, ...Object.values(a.sceneVars ?? {})].some(v => v?.toLowerCase().includes(q))) return false;
    }
    return true;
  }), [allAssets, brandFilter, typeFilter, sceneFilter, lightingFilter, statusFilter, search]);

  const download = async (assetId: string, crop: string, v: number) => {
    const r = await fetch(`/api/atlas/image/${assetId}/${crop}?v=${v}`);
    if (!r.ok) return;
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${assetId}-${crop}.webp`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center gap-4 sticky top-0 z-20">
        <Link href="/">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Studio
          </button>
        </Link>
        <div className="w-px h-5 bg-border" />
        <h1 className="text-lg font-semibold flex items-center gap-2"><ImageIcon className="w-4 h-4 text-primary" /> Asset Library</h1>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} approved assets</span>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar filters */}
        <aside className="w-60 border-r border-border bg-card p-5 overflow-y-auto flex-shrink-0 space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 h-9 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>

          {/* Status */}
          <FilterSection title="Status">
            {(["all","approved","published"] as const).map(s => (
              <FilterChip key={s} label={s.charAt(0).toUpperCase()+s.slice(1)} active={statusFilter === s} onClick={() => setStatusFilter(s)} />
            ))}
          </FilterSection>

          {/* Brands */}
          <FilterSection title="Brand">
            {brands.map(b => (
              <FilterChip key={b.id} label={b.name} active={brandFilter.includes(b.id)} onClick={() => toggleBrand(b.id)} />
            ))}
          </FilterSection>

          {/* Asset Types */}
          <FilterSection title="Asset Type">
            <FilterChip label="All" active={!typeFilter} onClick={() => setTypeFilter("")} />
            {assetTypes.map(t => (
              <FilterChip key={t.slug} label={t.name} active={typeFilter === t.slug} onClick={() => setTypeFilter(t.slug)} />
            ))}
          </FilterSection>

          {/* Scene */}
          <FilterSection title="Scene">
            <input placeholder="Filter by scene…" value={sceneFilter} onChange={e => setSceneFilter(e.target.value)}
              className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
          </FilterSection>

          {/* Lighting */}
          <FilterSection title="Lighting">
            <input placeholder="Filter by lighting…" value={lightingFilter} onChange={e => setLightingFilter(e.target.value)}
              className="w-full h-8 rounded border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring" />
          </FilterSection>
        </aside>

        {/* Gallery grid */}
        <main className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-4">
              <ImageIcon className="w-12 h-12 opacity-20" />
              <p>No approved assets yet.</p>
            </div>
          ) : (
            <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
              {filtered.map(asset => (
                <div key={asset.assetId} onClick={() => setSelected(asset)}
                  className="break-inside-avoid bg-card border border-border rounded-lg overflow-hidden cursor-pointer hover:border-primary/40 transition-colors group">
                  <div className="aspect-square bg-secondary relative">
                    <img
                      src={`/api/atlas/image/${asset.assetId}/square?v=${asset.imageVersion ?? 0}`}
                      alt={asset.assetTypeName}
                      className="w-full h-full object-cover"
                    />
                    {asset.published && (
                      <div className="absolute top-2 right-2 bg-purple-500/80 rounded-full p-1"><Globe className="w-3 h-3 text-white" /></div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="text-xs font-medium text-foreground">{asset.assetTypeName}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{asset.brandName}</div>
                    {Object.entries(asset.sceneVars ?? {}).filter(([,v]) => v).length > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-1 truncate">
                        {Object.values(asset.sceneVars).filter(Boolean).join(" · ")}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Asset detail overlay */}
      {selected && (
        <>
          <div className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="font-semibold">{selected.assetTypeName}</h2>
                <div className="text-xs text-muted-foreground font-mono">{selected.assetId} · {selected.brandName}</div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => download(selected.assetId, "desktopHero", selected.imageVersion ?? 0)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground">
                  <Download className="w-3.5 h-3.5" /> Desktop
                </button>
                <button onClick={() => download(selected.assetId, "social", selected.imageVersion ?? 0)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-border text-muted-foreground hover:text-foreground">
                  <Download className="w-3.5 h-3.5" /> Social
                </button>
                <button onClick={() => setSelected(null)} className="p-1.5 rounded hover:bg-secondary/50">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg overflow-hidden border border-border aspect-video bg-secondary">
                <img src={`/api/atlas/image/${selected.assetId}/desktopHero?v=${selected.imageVersion ?? 0}`} alt="" className="w-full h-full object-cover" />
              </div>
              {Object.entries(selected.sceneVars ?? {}).filter(([,v]) => v).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(selected.sceneVars).filter(([,v]) => v).map(([k, v]) => (
                    <span key={k} className="px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground capitalize">{v}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4">
                {selected.approved && <span className="flex items-center gap-1 text-xs text-green-500"><CheckCircle className="w-3.5 h-3.5" /> Approved</span>}
                {selected.published && <span className="flex items-center gap-1 text-xs text-purple-400"><Globe className="w-3.5 h-3.5" /> Published</span>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{title}</h3>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-2.5 py-1 rounded-full text-xs transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
      {label}
    </button>
  );
}
