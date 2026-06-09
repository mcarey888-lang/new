import React, { useCallback, useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  MapPin,
  Mountain,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  X,
} from "lucide-react";

const API = "/api";

interface HillSession {
  id: number;
  userId: string | null;
  plannedHillName: string | null;
  plannedRouteName: string | null;
  completionType: string;
  targetReps: number | null;
  estimatedGainPerRepM: number | null;
  estimatedTotalGainM: number | null;
  recordedDistanceKm: number | null;
  recordedElevationGainM: number | null;
  recordedDurationSeconds: number | null;
  dataQualityScore: number | null;
  matchConfidence: number | null;
  usedForVerification: boolean;
  adminApproved: boolean | null;
  hillId: number | null;
  createdAt: string;
  completedAt: string | null;
}

interface Stats {
  sessions: {
    totalSessions: number;
    trackedGps: number;
    estimatedManual: number;
    highQuality: number;
    usedForVerif: number;
    adminApproved: number;
  };
  hills: {
    totalHills: number;
    highConfidence: number;
    medConfidence: number;
    lowConfidence: number;
  };
}

function qualityColor(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  return "text-red-400";
}

function qualityBadge(score: number | null) {
  if (score == null) return "bg-muted/20 text-muted-foreground border-muted/30";
  if (score >= 80) return "bg-green-500/20 text-green-400 border-green-500/30";
  if (score >= 60) return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
  return "bg-red-500/20 text-red-400 border-red-500/30";
}

function fmtDuration(secs: number | null): string {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function StatCard({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <span className="text-xs text-muted-foreground uppercase tracking-wider">{label}</span>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

export default function HillVerification() {
  const [sessions, setSessions]       = useState<HillSession[]>([]);
  const [stats, setStats]             = useState<Stats | null>(null);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [typeFilter, setTypeFilter]   = useState<"all" | "tracked_gps" | "estimated_manual">("all");
  const [expandedId, setExpandedId]   = useState<number | null>(null);
  const [actionBusy, setActionBusy]   = useState<Record<number, boolean>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessRes, statsRes] = await Promise.all([
        fetch(`${API}/admin/hill-verification/sessions?limit=100${typeFilter !== "all" ? `&type=${typeFilter}` : ""}`),
        fetch(`${API}/admin/hill-verification/stats`),
      ]);
      if (!sessRes.ok || !statsRes.ok) throw new Error("Failed to fetch");
      const [sessData, statsData] = await Promise.all([sessRes.json(), statsRes.json()]);
      setSessions(sessData.sessions ?? []);
      setStats(statsData);
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleApprove(id: number) {
    setActionBusy(b => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`${API}/admin/hill-verification/approve/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to approve");
      setSessions(prev => prev.map(s => s.id === id ? { ...s, adminApproved: true, usedForVerification: true } : s));
    } catch { /* ignore */ }
    setActionBusy(b => ({ ...b, [id]: false }));
  }

  async function handleReject(id: number) {
    setActionBusy(b => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`${API}/admin/hill-verification/reject/${id}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to reject");
      setSessions(prev => prev.map(s => s.id === id ? { ...s, adminApproved: false, usedForVerification: false } : s));
    } catch { /* ignore */ }
    setActionBusy(b => ({ ...b, [id]: false }));
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Mountain className="text-green-400" size={28} />
            Hill Verification Admin
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Review GPS-tracked hill sessions and help build the verified elevation database.
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border text-sm hover:bg-muted/20 transition-colors"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          <StatCard label="Total sessions" value={stats.sessions.totalSessions} />
          <StatCard label="GPS tracked" value={stats.sessions.trackedGps} sub="have elevation data" />
          <StatCard label="Estimated" value={stats.sessions.estimatedManual} sub="manual completion" />
          <StatCard label="High quality" value={stats.sessions.highQuality} sub="score ≥ 70" />
          <StatCard label="Used for verif." value={stats.sessions.usedForVerif} />
          <StatCard label="Admin approved" value={stats.sessions.adminApproved} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400">
          <AlertCircle size={16} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <span className="text-sm text-muted-foreground">Show:</span>
        {(["all", "tracked_gps", "estimated_manual"] as const).map(f => (
          <button
            key={f}
            onClick={() => setTypeFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              typeFilter === f
                ? "bg-green-500/20 text-green-400 border-green-500/40"
                : "bg-card border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {f === "all" ? "All sessions" : f === "tracked_gps" ? "GPS tracked" : "Manual"}
          </button>
        ))}
        {loading && <Loader2 size={14} className="animate-spin text-muted-foreground ml-2" />}
        <span className="text-xs text-muted-foreground ml-auto">{sessions.length} result{sessions.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Session list */}
      <div className="flex flex-col gap-3">
        {sessions.length === 0 && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            <Mountain size={32} className="mx-auto mb-3 opacity-30" />
            <p>No sessions recorded yet.</p>
          </div>
        )}

        {sessions.map(sess => {
          const isExpanded = expandedId === sess.id;
          const busy       = actionBusy[sess.id];

          return (
            <div
              key={sess.id}
              className="bg-card border border-border rounded-xl overflow-hidden"
            >
              {/* Row header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/10 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : sess.id)}
              >
                {/* Type pill */}
                <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${
                  sess.completionType === "tracked_gps"
                    ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                    : "bg-muted/20 text-muted-foreground border-muted/30"
                }`}>
                  {sess.completionType === "tracked_gps" ? "GPS" : "Manual"}
                </span>

                {/* Hill name */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{sess.plannedHillName ?? "Unknown hill"}</p>
                  {sess.plannedRouteName && (
                    <p className="text-xs text-muted-foreground truncate">{sess.plannedRouteName}</p>
                  )}
                </div>

                {/* Quick stats */}
                <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  {sess.recordedElevationGainM != null && (
                    <span className="flex items-center gap-1">
                      <TrendingUp size={11} />
                      {sess.recordedElevationGainM}m
                    </span>
                  )}
                  {sess.recordedDistanceKm != null && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11} />
                      {sess.recordedDistanceKm.toFixed(2)}km
                    </span>
                  )}
                  {sess.dataQualityScore != null && (
                    <span className={`font-semibold ${qualityColor(sess.dataQualityScore)}`}>
                      Q:{sess.dataQualityScore}
                    </span>
                  )}
                </div>

                {/* Status */}
                <div className="shrink-0">
                  {sess.adminApproved === true && (
                    <span className="flex items-center gap-1 text-xs text-green-400">
                      <CheckCircle size={13} /> Approved
                    </span>
                  )}
                  {sess.adminApproved === false && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <X size={13} /> Rejected
                    </span>
                  )}
                  {sess.adminApproved == null && sess.completionType === "tracked_gps" && (
                    <span className="flex items-center gap-1 text-xs text-yellow-400">
                      <Activity size={13} /> Pending
                    </span>
                  )}
                </div>

                {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="border-t border-border px-4 py-4 flex flex-col gap-4">
                  {/* Data grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-background rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Elev gain recorded</p>
                      <p className="text-lg font-bold">
                        {sess.recordedElevationGainM != null ? `${sess.recordedElevationGainM}m` : "—"}
                      </p>
                      {sess.estimatedTotalGainM != null && (
                        <p className="text-xs text-muted-foreground">Est. {sess.estimatedTotalGainM}m</p>
                      )}
                    </div>
                    <div className="bg-background rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Distance recorded</p>
                      <p className="text-lg font-bold">
                        {sess.recordedDistanceKm != null ? `${sess.recordedDistanceKm.toFixed(2)}km` : "—"}
                      </p>
                    </div>
                    <div className="bg-background rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Duration</p>
                      <p className="text-lg font-bold">{fmtDuration(sess.recordedDurationSeconds)}</p>
                    </div>
                    <div className="bg-background rounded-lg p-3">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Target reps</p>
                      <p className="text-lg font-bold">
                        {sess.targetReps != null ? `${sess.targetReps}×` : "—"}
                      </p>
                      {sess.estimatedGainPerRepM != null && (
                        <p className="text-xs text-muted-foreground">{sess.estimatedGainPerRepM}m/rep est.</p>
                      )}
                    </div>
                  </div>

                  {/* Quality badges */}
                  <div className="flex flex-wrap gap-3 items-center">
                    {sess.dataQualityScore != null && (
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${qualityBadge(sess.dataQualityScore)}`}>
                        Data quality: {sess.dataQualityScore}/100
                      </span>
                    )}
                    {sess.matchConfidence != null && (
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${qualityBadge(sess.matchConfidence)}`}>
                        Match confidence: {sess.matchConfidence}%
                      </span>
                    )}
                    {sess.usedForVerification && (
                      <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-green-500/20 text-green-400 border-green-500/30">
                        ✓ Used for verification
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      ID #{sess.id} · {new Date(sess.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Admin actions — only for GPS sessions that haven't been reviewed */}
                  {sess.completionType === "tracked_gps" && sess.adminApproved == null && (
                    <div className="flex gap-3 pt-1">
                      <button
                        onClick={() => handleApprove(sess.id)}
                        disabled={busy}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/40 text-green-400 text-sm font-semibold hover:bg-green-500/30 transition-colors disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <ThumbsUp size={13} />}
                        Approve & use for verification
                      </button>
                      <button
                        onClick={() => handleReject(sess.id)}
                        disabled={busy}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <ThumbsDown size={13} />}
                        Reject
                      </button>
                    </div>
                  )}

                  {/* Approved/rejected state */}
                  {sess.adminApproved === true && (
                    <div className="flex items-center gap-2 text-sm text-green-400 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
                      <CheckCircle size={14} />
                      Approved — this session is contributing to hill elevation verification.
                    </div>
                  )}
                  {sess.adminApproved === false && (
                    <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                      <X size={14} />
                      Rejected — this session is excluded from verification data.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
