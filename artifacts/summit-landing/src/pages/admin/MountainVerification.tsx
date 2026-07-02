import { AdminGuard } from "@/components/AdminGuard";
import React, { useState } from "react";
import { Search, Loader2, CheckCircle, AlertCircle, Minus, TrendingUp, Mountain, Play, RefreshCw, FlaskConical } from "lucide-react";

const API = "/api";

interface GptRoute {
  name: string;
  distance: number;
  elevationGain: number;
  highestAltitude: number;
  difficulty: string;
  startingPoint: string;
}

interface GptResult {
  mountainName: string;
  country: string;
  region: string;
  routes: GptRoute[];
}

interface CalcRoute {
  routeName: string;
  distanceKm: number | null;
  totalElevationGain: number | null;
  summitElevation: number | null;
  trailheadElevation: number | null;
  averageGradient: number | null;
  maxGradient: number | null;
  confidenceScore: string;
  source: string;
  elevationProfileSampled: number[];
}

interface CalcResult {
  mountainName: string;
  lat: number;
  lon: number;
  summitElevation: number | null;
  routes: CalcRoute[];
}

interface StoredResult {
  id: number;
  mountainName: string;
  routeName: string;
  distanceKm: number | null;
  elevationGainM: number | null;
  summitElevationM: number | null;
  trailheadElevationM: number | null;
  averageGradient: number | null;
  maxGradient: number | null;
  confidenceScore: string;
  source: string | null;
  createdAt: string;
}

function confidenceBadge(score: string) {
  const map: Record<string, string> = {
    HIGH: "bg-green-500/20 text-green-400 border-green-500/30",
    MEDIUM: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    LOW: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${map[score] ?? map.LOW}`}>
      {score}
    </span>
  );
}

function diff(a: number | null | undefined, b: number | null | undefined): React.ReactNode {
  if (a == null || b == null) return <span className="text-muted-foreground">—</span>;
  const d = b - a;
  const pct = a !== 0 ? Math.round((Math.abs(d) / a) * 100) : null;
  const cls = d > 0 ? "text-green-400" : d < 0 ? "text-red-400" : "text-muted-foreground";
  return (
    <span className={cls}>
      {d > 0 ? "+" : ""}{Math.round(d)}{pct !== null ? ` (${pct}%)` : ""}
    </span>
  );
}

function MiniProfile({ values }: { values: number[] }) {
  if (!values.length) return <span className="text-muted-foreground text-xs">no data</span>;
  const min = Math.min(...values.filter(v => v > 0));
  const max = Math.max(...values.filter(v => v > 0));
  const range = max - min || 1;
  const w = 160;
  const h = 40;
  const pts = values.filter(v => v > 0);
  const coords = pts
    .map((v, i) => `${Math.round((i / (pts.length - 1)) * w)},${Math.round(h - ((v - min) / range) * h)}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="opacity-80">
      <polyline fill="none" stroke="rgb(62,207,117)" strokeWidth="1.5" points={coords} />
    </svg>
  );
}

const BATCH_MOUNTAINS = ["Musbury Tor", "Peel Tower", "Mam Tor", "Pen y Ghent", "Snowdon", "Ben Nevis"];

function MountainVerificationPage() {
  const [query, setQuery] = useState("");
  const [gptLoading, setGptLoading] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [gptResult, setGptResult] = useState<GptResult | null>(null);
  const [calcResult, setCalcResult] = useState<CalcResult | null>(null);
  const [gptError, setGptError] = useState<string | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [recentResults, setRecentResults] = useState<StoredResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);

  async function runSearch(name: string) {
    if (!name.trim()) return;
    setGptResult(null);
    setCalcResult(null);
    setGptError(null);
    setCalcError(null);
    setGptLoading(true);
    setCalcLoading(true);

    // Fire both requests simultaneously
    const gptPromise = fetch(`${API}/mountain-lookup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "GPT lookup failed");
      return body as GptResult;
    });

    const calcPromise = fetch(`${API}/mountain-verification-test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mountainName: name }),
    }).then(async (r) => {
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? "Calculation failed");
      return body as CalcResult;
    });

    gptPromise
      .then((r) => { setGptResult(r); setGptLoading(false); })
      .catch((e) => { setGptError(e.message); setGptLoading(false); });

    calcPromise
      .then((r) => { setCalcResult(r); setCalcLoading(false); })
      .catch((e) => { setCalcError(e.message); setCalcLoading(false); });
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API}/mountain-verification-results`);
      const data = await res.json() as StoredResult[];
      setRecentResults(data);
    } catch { /* ignore */ }
    setHistoryLoading(false);
  }

  async function runBatch() {
    setBatchRunning(true);
    setBatchMsg("Starting batch test for 6 mountains…");
    try {
      const res = await fetch(`${API}/mountain-verification-test/batch`, { method: "POST" });
      const data = await res.json() as { status: string; mountains: string[] };
      setBatchMsg(`Batch test started. Processing: ${data.mountains?.join(", ")}. Results will appear in history once complete (may take a few minutes).`);
    } catch {
      setBatchMsg("Failed to start batch test.");
    }
    setBatchRunning(false);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  return (
    <div className="min-h-screen bg-[#0a0f0a] text-white font-sans">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FlaskConical className="w-5 h-5 text-green-400" />
            <span className="font-bold text-lg">Mountain Verification Lab</span>
            <span className="text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Experimental</span>
          </div>
          <a href="/" className="text-sm text-muted-foreground hover:text-white transition-colors">← Back to site</a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">

        {/* Explainer */}
        <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
          <h2 className="font-bold text-lg mb-2 flex items-center gap-2">
            <Mountain className="w-5 h-5 text-green-400" />
            What this does
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            Enter any hill or mountain name to compare <strong className="text-white">GPT-generated route data</strong> (what the app currently uses)
            against <strong className="text-white">calculated data from real geographic sources</strong> (Nominatim geocoding → OpenStreetMap routes → OpenTopoData SRTM elevation profiles).
            Elevation gain is calculated by summing only positive changes ≥ 3m along the sampled route — matching how Garmin/Strava/AllTrails calculate it.
            The calculated result is also stored permanently for analysis.
          </p>
          <p className="text-sm text-yellow-400/80 mt-3 font-medium">
            ⚠ Calculated results take 15–60 seconds depending on route complexity. This is due to OpenTopoData rate limits (1 req/sec). GPT result appears immediately.
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSubmit} className="flex gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Snowdon, Mam Tor, Musbury Tor…"
              className="w-full bg-white/5 border border-white/15 rounded-xl pl-11 pr-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-green-500/50 focus:bg-white/8 transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={gptLoading || calcLoading || !query.trim()}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            {(gptLoading || calcLoading) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Run Test
          </button>
        </form>

        {/* Comparison */}
        {(gptResult || gptLoading || gptError || calcResult || calcLoading || calcError) && (
          <div className="grid lg:grid-cols-2 gap-6">
            {/* GPT Panel */}
            <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                  <span className="font-bold text-sm">Current GPT Result</span>
                </div>
                {gptLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {gptResult && <CheckCircle className="w-4 h-4 text-green-400" />}
                {gptError && <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>

              {gptLoading && (
                <div className="p-8 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Querying GPT-4o…
                </div>
              )}
              {gptError && <div className="p-6 text-red-400 text-sm">{gptError}</div>}
              {gptResult && (
                <div className="p-5 space-y-4">
                  <div>
                    <p className="font-bold text-base">{gptResult.mountainName}</p>
                    <p className="text-xs text-muted-foreground">{gptResult.region}, {gptResult.country}</p>
                  </div>
                  <div className="space-y-3">
                    {gptResult.routes.map((route, i) => (
                      <div key={i} className="bg-white/4 border border-white/8 rounded-xl p-4">
                        <p className="font-semibold text-sm mb-3">{route.name}</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="text-muted-foreground">Distance</div>
                          <div className="font-mono">{route.distance} km</div>
                          <div className="text-muted-foreground">Elevation gain</div>
                          <div className="font-mono font-bold text-orange-400">{route.elevationGain} m</div>
                          <div className="text-muted-foreground">Summit alt.</div>
                          <div className="font-mono">{route.highestAltitude} m asl</div>
                          <div className="text-muted-foreground">Start</div>
                          <div className="text-white/70">{route.startingPoint}</div>
                          <div className="text-muted-foreground">Difficulty</div>
                          <div>{route.difficulty}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Calculated Panel */}
            <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="font-bold text-sm">Calculated from Real Data</span>
                </div>
                {calcLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                {calcResult && <CheckCircle className="w-4 h-4 text-green-400" />}
                {calcError && <AlertCircle className="w-4 h-4 text-red-400" />}
              </div>

              {calcLoading && (
                <div className="p-8 text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Running pipeline…
                  </div>
                  <p className="text-xs text-muted-foreground">Geocoding → OSM routes → SRTM elevation profiles</p>
                  <p className="text-xs text-muted-foreground opacity-70">This may take up to 60 seconds</p>
                </div>
              )}
              {calcError && <div className="p-6 text-red-400 text-sm">{calcError}</div>}
              {calcResult && (
                <div className="p-5 space-y-4">
                  <div>
                    <p className="font-bold text-base">{calcResult.mountainName}</p>
                    <p className="text-xs text-muted-foreground">
                      {calcResult.lat.toFixed(4)}, {calcResult.lon.toFixed(4)}
                      {calcResult.summitElevation ? ` · Summit ${calcResult.summitElevation}m` : ""}
                    </p>
                  </div>
                  {calcResult.routes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No OSM hiking routes found near this location.</p>
                  ) : (
                    <div className="space-y-3">
                      {calcResult.routes.map((route, i) => (
                        <div key={i} className="bg-white/4 border border-white/8 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="font-semibold text-sm">{route.routeName}</p>
                            {confidenceBadge(route.confidenceScore)}
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                            <div className="text-muted-foreground">Distance (rt)</div>
                            <div className="font-mono">{route.distanceKm != null ? `${route.distanceKm} km` : "—"}</div>
                            <div className="text-muted-foreground">True elev. gain</div>
                            <div className="font-mono font-bold text-green-400">{route.totalElevationGain != null ? `${route.totalElevationGain} m` : "—"}</div>
                            <div className="text-muted-foreground">Summit alt.</div>
                            <div className="font-mono">{route.summitElevation != null ? `${route.summitElevation} m` : "—"}</div>
                            <div className="text-muted-foreground">Trailhead</div>
                            <div className="font-mono">{route.trailheadElevation != null ? `${route.trailheadElevation} m` : "—"}</div>
                            <div className="text-muted-foreground">Avg gradient</div>
                            <div className="font-mono">{route.averageGradient != null ? `${route.averageGradient}%` : "—"}</div>
                            <div className="text-muted-foreground">Max gradient</div>
                            <div className="font-mono">{route.maxGradient != null ? `${route.maxGradient}%` : "—"}</div>
                            <div className="text-muted-foreground">Source</div>
                            <div className="text-white/60">{route.source}</div>
                          </div>
                          {route.elevationProfileSampled.length > 2 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Elevation profile</p>
                              <MiniProfile values={route.elevationProfileSampled} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Difference table */}
        {gptResult && calcResult && calcResult.routes.length > 0 && gptResult.routes.length > 0 && (
          <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="font-bold text-sm">Difference Analysis — GPT vs Calculated (first matched route)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8">
                    <th className="text-left px-5 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Metric</th>
                    <th className="text-right px-5 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">GPT</th>
                    <th className="text-right px-5 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Calculated</th>
                    <th className="text-right px-5 py-3 text-muted-foreground font-medium text-xs uppercase tracking-wider">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      label: "Distance (km)",
                      gpt: gptResult.routes[0].distance,
                      calc: calcResult.routes[0].distanceKm,
                    },
                    {
                      label: "Elevation Gain (m)",
                      gpt: gptResult.routes[0].elevationGain,
                      calc: calcResult.routes[0].totalElevationGain,
                    },
                    {
                      label: "Summit Altitude (m)",
                      gpt: gptResult.routes[0].highestAltitude,
                      calc: calcResult.routes[0].summitElevation,
                    },
                  ].map((row) => (
                    <tr key={row.label} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-5 py-3 text-white/80">{row.label}</td>
                      <td className="px-5 py-3 text-right font-mono text-blue-300">{row.gpt ?? <Minus className="w-3 h-3 inline" />}</td>
                      <td className="px-5 py-3 text-right font-mono text-green-300">{row.calc != null ? Math.round(row.calc) : <Minus className="w-3 h-3 inline" />}</td>
                      <td className="px-5 py-3 text-right font-mono">{diff(row.gpt, row.calc)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Batch test */}
        <div className="bg-white/3 border border-white/10 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-bold mb-1">Phase 11 — Batch Test</h3>
              <p className="text-sm text-muted-foreground">
                Run the full verification pipeline for all 6 spec mountains in the background.
                Results are stored in the database and will appear in history below.
              </p>
              <p className="text-xs text-muted-foreground mt-1">Mountains: {BATCH_MOUNTAINS.join(", ")}</p>
              {batchMsg && (
                <p className="text-xs text-yellow-400/90 mt-2">{batchMsg}</p>
              )}
            </div>
            <button
              onClick={runBatch}
              disabled={batchRunning}
              className="flex items-center gap-2 bg-white/8 hover:bg-white/12 border border-white/15 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-5 py-2.5 rounded-xl transition-colors text-sm whitespace-nowrap shrink-0"
            >
              {batchRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Run Batch
            </button>
          </div>
        </div>

        {/* History */}
        <div className="bg-white/3 border border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <span className="font-bold text-sm">Stored Results History</span>
            <button
              onClick={loadHistory}
              disabled={historyLoading}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors"
            >
              {historyLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Load / Refresh
            </button>
          </div>
          {recentResults.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              {historyLoading ? "Loading…" : "Click 'Load / Refresh' to see stored test results."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/8">
                    {["Mountain", "Route", "Dist km", "Elev gain m", "Summit m", "Trailhead m", "Avg grad %", "Confidence", "Source", "Tested"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-muted-foreground font-medium uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentResults.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{r.mountainName}</td>
                      <td className="px-4 py-3 text-white/80 max-w-[180px] truncate">{r.routeName}</td>
                      <td className="px-4 py-3 font-mono">{r.distanceKm != null ? r.distanceKm.toFixed(1) : "—"}</td>
                      <td className="px-4 py-3 font-mono font-bold text-green-400">{r.elevationGainM != null ? Math.round(r.elevationGainM) : "—"}</td>
                      <td className="px-4 py-3 font-mono">{r.summitElevationM != null ? Math.round(r.summitElevationM) : "—"}</td>
                      <td className="px-4 py-3 font-mono">{r.trailheadElevationM != null ? Math.round(r.trailheadElevationM) : "—"}</td>
                      <td className="px-4 py-3 font-mono">{r.averageGradient != null ? r.averageGradient.toFixed(1) : "—"}</td>
                      <td className="px-4 py-3">{confidenceBadge(r.confidenceScore)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.source ?? "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MountainVerification() {
  return (
    <AdminGuard title="Mountain Verification Lab">
      <MountainVerificationPage />
    </AdminGuard>
  );
}
