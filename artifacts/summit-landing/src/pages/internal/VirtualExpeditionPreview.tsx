import React, { useEffect, useState, useCallback } from "react";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronRight, Info } from "lucide-react";

const API = "/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface VirtualExpedition {
  id: number;
  mountainSlug: string;
  name: string;
  countryRegion: string | null;
  continent: string | null;
  summitAltitudeM: number | null;
  category: string | null;
  altitudeRisk: number | null;
  maxTechnicality: number | null;
  status: string;
  routeCount: number;
}

interface ExpeditionRoute {
  id: number;
  spreadsheetRouteId: string;
  routeName: string;
  distanceKm: number | null;
  ascentM: number | null;
  typicalDays: number | null;
  avgGradientPct: number | null;
  maxGradientPct: number | null;
  glacierPct: number | null;
  snowIcePct: number | null;
  altitude15: number | null;
  dataConfidence: string;
}

interface DnaRow {
  sustainedClimbingScore: number;
  steepnessScore: number;
  longDurationEnduranceScore: number;
  rockyTerrainScore: number;
  looseTerrainScore: number;
  scramblingScore: number;
  exposureScore: number;
  navigationScore: number;
  technicalMovementScore: number;
  loadCarryingScore: number;
  altitudeDemandScore: number;
  recoveryDemandScore: number;
  overallDifficultyScore: number;
}

interface TrainingRouteMatch {
  score: number;
  matchReasons: string[];
  warnings: string[];
  trainingRoute: {
    id: number;
    spreadsheetRouteId: string;
    region: string;
    mountainHill: string;
    routeName: string;
    ascentM: number | null;
    distanceKm: number | null;
    typicalHours: number | null;
    dataConfidence: string;
    sourceUrl: string | null;
  };
}

interface MatchResponse {
  expeditionRoute: ExpeditionRoute;
  matches: TrainingRouteMatch[];
  globalWarnings: string[];
  matchCount: number;
}

// ── DNA bar component ─────────────────────────────────────────────────────────

const DNA_LABELS: Record<keyof DnaRow, string> = {
  sustainedClimbingScore:     "Sustained Climbing",
  steepnessScore:             "Steepness",
  longDurationEnduranceScore: "Long Endurance",
  rockyTerrainScore:          "Rocky Terrain",
  looseTerrainScore:          "Loose/Scree",
  scramblingScore:            "Scrambling",
  exposureScore:              "Exposure",
  navigationScore:            "Navigation",
  technicalMovementScore:     "Technical Movement",
  loadCarryingScore:          "Load Carrying",
  altitudeDemandScore:        "Altitude Demand",
  recoveryDemandScore:        "Recovery Demand",
  overallDifficultyScore:     "Overall Difficulty",
};

function DnaBar({ label, score, highlight = false }: { label: string; score: number; highlight?: boolean }) {
  const color = highlight
    ? "bg-orange-500"
    : score >= 70 ? "bg-red-500" : score >= 40 ? "bg-yellow-500" : "bg-green-500";

  return (
    <div className="flex items-center gap-3 py-1">
      <div className="w-44 text-xs text-right text-gray-300 shrink-0">{label}</div>
      <div className="flex-1 bg-gray-700 rounded h-4 relative overflow-hidden">
        <div
          className={`h-full rounded transition-all duration-500 ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="w-8 text-xs text-right font-mono text-gray-200 shrink-0">{score}</div>
    </div>
  );
}

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const bg = score >= 70 ? "bg-green-600" : score >= 50 ? "bg-yellow-600" : score >= 30 ? "bg-orange-600" : "bg-red-800";
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${bg}`}>
      {score}%
    </span>
  );
}

// ── Confidence badge ──────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: string }) {
  const map: Record<string, string> = {
    Estimated:    "bg-gray-600 text-gray-100",
    Verified:     "bg-blue-700 text-blue-100",
    GPX_Verified: "bg-purple-700 text-purple-100",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[value] ?? map.Estimated}`}>
      {value}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function VirtualExpeditionPreview() {
  const [expeditions, setExpeditions] = useState<VirtualExpedition[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<number | null>(null);
  const [routes, setRoutes] = useState<ExpeditionRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [routeDna, setRouteDna] = useState<DnaRow | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<ExpeditionRoute | null>(null);
  const [regionFilter, setRegionFilter] = useState("");
  const [matchData, setMatchData] = useState<MatchResponse | null>(null);
  const [loadingExp, setLoadingExp] = useState(false);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load expeditions on mount
  useEffect(() => {
    setLoadingExp(true);
    fetch(`${API}/vx/expeditions`)
      .then((r) => r.json())
      .then((d) => {
        setExpeditions(d.expeditions ?? []);
        setLoadingExp(false);
      })
      .catch(() => {
        setError("Failed to load expeditions — is the API server running and the import complete?");
        setLoadingExp(false);
      });
  }, []);

  // Load routes when expedition selected
  useEffect(() => {
    if (!selectedExpId) { setRoutes([]); setSelectedRouteId(null); return; }
    const exp = expeditions.find((e) => e.id === selectedExpId);
    if (!exp) return;

    setLoadingRoutes(true);
    fetch(`${API}/vx/expeditions/${exp.mountainSlug}`)
      .then((r) => r.json())
      .then((d) => {
        setRoutes(d.routes ?? []);
        setLoadingRoutes(false);
      })
      .catch(() => { setLoadingRoutes(false); });
  }, [selectedExpId]);

  // Load DNA + matches when route selected
  const loadRouteData = useCallback(async (routeId: number) => {
    setLoadingMatches(true);
    setRouteDna(null);
    setMatchData(null);

    try {
      const [routeResp, matchResp] = await Promise.all([
        fetch(`${API}/vx/expedition-routes/${routeId}`).then((r) => r.json()),
        fetch(`${API}/vx/expedition-routes/${routeId}/matches?limit=20${regionFilter ? `&region=${encodeURIComponent(regionFilter)}` : ""}`)
          .then((r) => r.json()),
      ]);

      setSelectedRoute(routeResp.route ?? null);
      setRouteDna(routeResp.dna ?? null);
      setMatchData(matchResp);
    } finally {
      setLoadingMatches(false);
    }
  }, [regionFilter]);

  useEffect(() => {
    if (selectedRouteId) loadRouteData(selectedRouteId);
  }, [selectedRouteId, regionFilter]);

  const selectedExpedition = expeditions.find((e) => e.id === selectedExpId);
  const hasAltitudeWarning  = (selectedRoute?.altitude15 ?? 0) >= 3;
  const hasGlacierWarning   = (selectedRoute?.glacierPct ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono text-sm">
      {/* ── Header banner ── */}
      <div className="sticky top-0 z-50 bg-yellow-500 text-black px-6 py-3 flex items-center gap-3 shadow-lg">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <div>
          <span className="font-black uppercase tracking-wider">⚠ INTERNAL PREVIEW — NOT FOR PUBLIC USE</span>
          <span className="ml-4 font-normal text-sm">
            VX Engine data explorer — all data marked "Estimated" from spreadsheet source
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Title ── */}
        <div>
          <h1 className="text-2xl font-black text-white">Virtual Expedition Engine</h1>
          <p className="text-gray-400 mt-1">
            Explore route DNA scores and UK training route matches. Data loaded from{" "}
            <code className="text-green-400">virtual_expeditions</code> /
            <code className="text-green-400"> expedition_routes</code> /
            <code className="text-green-400"> training_routes</code> tables.
          </p>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300">
            {error}
          </div>
        )}

        {/* ── Selectors ── */}
        <div className="bg-gray-900 rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-green-400" />
            Select expedition + route
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Expedition picker */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Target Mountain</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500"
                value={selectedExpId ?? ""}
                onChange={(e) => {
                  setSelectedExpId(e.target.value ? Number(e.target.value) : null);
                  setSelectedRouteId(null);
                  setMatchData(null);
                }}
              >
                <option value="">{loadingExp ? "Loading…" : `— ${expeditions.length} mountains —`}</option>
                {expeditions.map((exp) => (
                  <option key={exp.id} value={exp.id}>
                    {exp.name} ({exp.continent}) · {exp.summitAltitudeM?.toLocaleString()}m · {exp.routeCount} routes
                  </option>
                ))}
              </select>
            </div>

            {/* Route picker */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Route</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500"
                value={selectedRouteId ?? ""}
                onChange={(e) => setSelectedRouteId(e.target.value ? Number(e.target.value) : null)}
                disabled={!selectedExpId || loadingRoutes}
              >
                <option value="">{loadingRoutes ? "Loading…" : `— ${routes.length} routes —`}</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.spreadsheetRouteId} · {r.routeName}</option>
                ))}
              </select>
            </div>

            {/* Region filter */}
            <div>
              <label className="block text-xs text-gray-400 mb-1">Region filter (optional)</label>
              <input
                type="text"
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-green-500"
                placeholder="e.g. Lake District"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
              />
            </div>
          </div>

          {selectedExpedition && (
            <div className="text-xs text-gray-400 space-x-4 pt-2">
              <span>Altitude risk: <span className="text-white">{selectedExpedition.altitudeRisk ?? "—"}/5</span></span>
              <span>Technicality: <span className="text-white">{selectedExpedition.maxTechnicality ?? "—"}/5</span></span>
              <span>Category: <span className="text-white">{selectedExpedition.category ?? "—"}</span></span>
              <span>Status: <span className={selectedExpedition.status === "active" ? "text-green-400" : "text-yellow-400"}>{selectedExpedition.status}</span></span>
            </div>
          )}
        </div>

        {/* ── Route + DNA panel ── */}
        {selectedRoute && (
          <div className="bg-gray-900 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">{selectedRoute.routeName}</h2>
                <div className="text-xs text-gray-400 space-x-4 mt-1">
                  <span>ID: <code className="text-green-400">{selectedRoute.spreadsheetRouteId}</code></span>
                  <span>Distance: <span className="text-white">{selectedRoute.distanceKm ?? "—"} km</span></span>
                  <span>Ascent: <span className="text-white">{selectedRoute.ascentM?.toLocaleString() ?? "—"} m</span></span>
                  <span>Days: <span className="text-white">{selectedRoute.typicalDays ?? "—"}</span></span>
                  <span>Avg grad: <span className="text-white">{selectedRoute.avgGradientPct ?? "—"}%</span></span>
                  <span>Max grad: <span className="text-white">{selectedRoute.maxGradientPct ?? "—"}%</span></span>
                </div>
                <div className="text-xs text-gray-400 space-x-3 mt-1">
                  <span>Altitude 1–5: <span className="text-white">{selectedRoute.altitude15 ?? "—"}</span></span>
                  <span>Glacier: <span className="text-white">{selectedRoute.glacierPct ?? "—"}%</span></span>
                  <span>Snow/ice: <span className="text-white">{selectedRoute.snowIcePct ?? "—"}%</span></span>
                  <ConfidenceBadge value={selectedRoute.dataConfidence} />
                </div>
              </div>
            </div>

            {/* Altitude/glacier warning */}
            {(hasAltitudeWarning || hasGlacierWarning) && (
              <div className="bg-orange-950/60 border border-orange-700 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                <p className="text-orange-200 text-sm">
                  ⚠️ UK training routes cannot reproduce altitude acclimatisation, glacier travel, or sustained snow/ice conditions.
                  This is a training similarity score, not a safety readiness assessment.
                </p>
              </div>
            )}

            {/* DNA scores */}
            {routeDna ? (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Route DNA — 12 Dimensions</h3>
                {(Object.entries(DNA_LABELS) as [keyof DnaRow, string][]).map(([key, label]) => (
                  <DnaBar
                    key={key}
                    label={label}
                    score={routeDna[key]}
                    highlight={key === "altitudeDemandScore" && routeDna.altitudeDemandScore > 0}
                  />
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-sm">
                No DNA scores available — run <code className="text-yellow-400">POST /api/vx/admin/recalculate-dna</code> after import.
              </div>
            )}
          </div>
        )}

        {/* ── UK training matches ── */}
        {selectedRouteId && (
          <div className="bg-gray-900 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ChevronDown className="w-4 h-4 text-green-400" />
                UK Training Route Matches
                {matchData && (
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    ({matchData.matchCount} shown{regionFilter ? ` · ${regionFilter}` : ""})
                  </span>
                )}
              </h2>
              {selectedRouteId && (
                <button
                  onClick={() => loadRouteData(selectedRouteId)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reload
                </button>
              )}
            </div>

            {loadingMatches && (
              <div className="text-gray-400 py-8 text-center">Loading matches…</div>
            )}

            {!loadingMatches && matchData && matchData.globalWarnings?.length > 0 && (
              <div className="space-y-2">
                {matchData.globalWarnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-orange-300 bg-orange-950/40 px-3 py-2 rounded">
                    <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {w}
                  </div>
                ))}
              </div>
            )}

            {!loadingMatches && matchData && matchData.matches.length === 0 && (
              <div className="text-gray-500 text-sm py-4 text-center">
                No training routes found with score ≥ 20.
                {regionFilter && " Try clearing the region filter."}
                {!routeDna && " DNA scores may not be calculated yet — try recalculating."}
              </div>
            )}

            {!loadingMatches && matchData && matchData.matches.map((m, idx) => (
              <div key={idx} className="bg-gray-800 rounded-lg p-4 space-y-2 border border-gray-700">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">
                      {m.trainingRoute.mountainHill} — {m.trainingRoute.routeName}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 space-x-3">
                      <span><code className="text-green-400">{m.trainingRoute.spreadsheetRouteId}</code></span>
                      <span className="text-purple-300">{m.trainingRoute.region}</span>
                      <span>Ascent: {m.trainingRoute.ascentM?.toLocaleString() ?? "—"} m</span>
                      <span>Dist: {m.trainingRoute.distanceKm ?? "—"} km</span>
                      <span>Hours: {m.trainingRoute.typicalHours ?? "—"}</span>
                      <ConfidenceBadge value={m.trainingRoute.dataConfidence} />
                    </div>
                  </div>
                  <div className="shrink-0">
                    <ScoreBadge score={m.score} />
                  </div>
                </div>

                {m.matchReasons.length > 0 && (
                  <div className="text-xs text-green-300 space-y-0.5">
                    {m.matchReasons.map((r, i) => (
                      <div key={i}>✓ {r}</div>
                    ))}
                  </div>
                )}

                {m.warnings.length > 0 && (
                  <div className="text-xs text-orange-300 space-y-0.5">
                    {m.warnings.map((w, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                        {w}
                      </div>
                    ))}
                  </div>
                )}

                {m.trainingRoute.sourceUrl && (
                  <a
                    href={m.trainingRoute.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 underline hover:text-blue-300"
                  >
                    Source →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!selectedExpId && !loadingExp && expeditions.length === 0 && (
          <div className="bg-gray-900 rounded-xl p-12 text-center text-gray-500">
            <div className="text-4xl mb-4">📥</div>
            <div className="text-lg text-gray-300 mb-2">No data loaded yet</div>
            <div className="text-sm">
              Upload <code className="text-yellow-400">summit_ready_route_intelligence_database_v1.xlsx</code>{" "}
              to <code className="text-yellow-400">attached_assets/</code> then run:
            </div>
            <code className="block mt-3 bg-gray-800 px-4 py-3 rounded text-green-400 text-sm">
              pnpm --filter @workspace/scripts run import:virtual
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
