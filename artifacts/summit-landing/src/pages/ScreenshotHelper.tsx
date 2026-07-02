import { AdminGuard } from "@/components/AdminGuard";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

const C = {
  bg:       "#0B1120",
  card:     "#0F1B2D",
  surface:  "#162236",
  border:   "#1E3050",
  text:     "#F0F6FF",
  muted:    "#8DA6C6",
  dim:      "#4A6080",
  green:    "#3ECF75",
  greenDim: "rgba(62,207,117,0.12)",
  orange:   "#F59E0B",
  blue:     "#60A5FA",
  red:      "#F87171",
};

const mountain = "Kilimanjaro (Marangu Route)";
const summitDate = "2026-08-14";
const daysLeft = 84;
const readiness = 45;

const API = "/api";

function daysFromNow(n: number) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().split("T")[0];
}

function fmtDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Progress Ring ─────────────────────────────────────────────────────────────
function Ring({ pct, size = 80, stroke = 7 }: { pct: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct / 100);
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.green} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
    </svg>
  );
}

// ── Dashboard Screen ──────────────────────────────────────────────────────────
function DashboardScreen() {
  const [imgOk, setImgOk] = useState(true);
  const imgUrl = `${API}/mountain-image?name=${encodeURIComponent(mountain)}`;

  const sessions = [
    { label: "Easy Run",     type: "cardio", done: true },
    { label: "Carl Wark Reps", type: "hill", done: true },
    { label: "Long Hike",    type: "bigDay", done: false },
  ];

  const typeColor: Record<string, string> = { cardio: C.blue, hill: C.green, bigDay: C.orange };
  const typeLabel: Record<string, string> = { cardio: "Cardio", hill: "Hill", bigDay: "Big Day" };

  return (
    <div style={{ width: 390, height: 844, background: C.bg, fontFamily: "'Inter', sans-serif", overflowY: "auto", position: "relative" }}>
      {/* Mountain Hero */}
      <div style={{ position: "relative", height: 240, overflow: "hidden" }}>
        {imgOk
          ? <img src={imgUrl} alt={mountain} onError={() => setImgOk(false)}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <div style={{ width: "100%", height: "100%", background: "linear-gradient(180deg, #162236 0%, #0B1120 100%)" }} />
        }
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(11,17,32,0.95) 0%, rgba(11,17,32,0.3) 60%, transparent 100%)" }} />
        <div style={{ position: "absolute", bottom: 16, left: 16, right: 16 }}>
          <div style={{ color: C.muted, fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>
            Summit Goal
          </div>
          <div style={{ color: C.text, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{mountain}</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: C.green, fontSize: 13, fontWeight: 600 }}>{daysLeft} days to go</span>
            <span style={{ color: C.dim, fontSize: 12 }}>14 Aug 2026</span>
          </div>
        </div>
      </div>

      {/* Readiness Card */}
      <div style={{ margin: "12px 16px 0", background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ position: "relative", width: 80, height: 80 }}>
          <Ring pct={readiness} size={80} />
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ color: C.text, fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{readiness}</div>
            <div style={{ color: C.muted, fontSize: 10, fontWeight: 600 }}>/ 100</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: C.muted, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Summit Readiness</div>
          <div style={{ color: "#F59E0B", fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Building Fitness</div>
          <div style={{ color: C.muted, fontSize: 12 }}>Week 8 of 12 · Peak Phase</div>
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: "flex", gap: 8, margin: "10px 16px 0" }}>
        {[
          { label: "Sessions", val: "12" },
          { label: "Elevation", val: "7.1km" },
          { label: "Streak", val: "4 wks" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "10px 12px", textAlign: "center" }}>
            <div style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>{s.val}</div>
            <div style={{ color: C.muted, fontSize: 11 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* This Week */}
      <div style={{ margin: "12px 16px 0", background: C.card, borderRadius: 16, border: `1px solid ${C.border}`, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ color: C.text, fontSize: 14, fontWeight: 700 }}>This Week · Peak</div>
          <div style={{ background: C.greenDim, color: C.green, fontSize: 11, fontWeight: 700, borderRadius: 6, padding: "3px 8px" }}>1,200m target</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.done ? C.green : C.border, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ color: s.done ? C.muted : C.text, fontSize: 13, fontWeight: 500, textDecoration: s.done ? "line-through" : "none" }}>{s.label}</span>
              </div>
              <div style={{ background: s.done ? C.greenDim : C.surface, color: s.done ? C.green : typeColor[s.type], fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 7px" }}>
                {s.done ? "Done" : typeLabel[s.type]}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Coach tip */}
      <div style={{ margin: "10px 16px 0", background: C.surface, borderRadius: 14, border: `1px solid ${C.border}`, padding: 13, display: "flex", gap: 10 }}>
        <div style={{ fontSize: 20 }}>🏔️</div>
        <div>
          <div style={{ color: C.text, fontSize: 13, fontWeight: 600, marginBottom: 3 }}>AI Coach Insight</div>
          <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>Your elevation consistency over the past 3 weeks is excellent. You're on track for Kilimanjaro — keep prioritising the long days.</div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 70, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex" }}>
        {["Dashboard","Plan","Log","Hills","Account"].map((tab, i) => (
          <div key={tab} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 0 ? C.greenDim : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: i === 0 ? C.green : C.dim }} />
            </div>
            <div style={{ color: i === 0 ? C.green : C.dim, fontSize: 10, fontWeight: i === 0 ? 700 : 400 }}>{tab}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Plan Screen ───────────────────────────────────────────────────────────────
function PlanScreen() {
  const weeks = [
    { wk: 6, phase: "Build", elev: 950, done: true, hill: "Stanage Edge" },
    { wk: 7, phase: "Build", elev: 1050, done: true, hill: "Stanage Edge" },
    { wk: 8, phase: "Peak",  elev: 1200, done: false, hill: "Carl Wark", current: true },
    { wk: 9, phase: "Peak",  elev: 1200, done: false, hill: "Stanage Edge" },
    { wk: 10, phase: "Taper", elev: 700, done: false, hill: "Carl Wark" },
    { wk: 11, phase: "Taper", elev: 400, done: false, hill: "Carl Wark" },
  ];
  const phaseColor: Record<string, string> = { Base: C.blue, Build: C.orange, Peak: "#A855F7", Taper: C.green };

  return (
    <div style={{ width: 390, height: 844, background: C.bg, fontFamily: "'Inter', sans-serif", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ padding: "52px 16px 14px", background: C.bg }}>
        <div style={{ color: C.text, fontSize: 22, fontWeight: 700 }}>Training Plan</div>
        <div style={{ color: C.muted, fontSize: 13 }}>{mountain} · 12 weeks</div>
      </div>

      {/* Progress bar */}
      <div style={{ margin: "0 16px 14px", background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ color: C.text, fontSize: 13, fontWeight: 600 }}>Overall Progress</div>
          <div style={{ color: C.green, fontSize: 13, fontWeight: 700 }}>7 / 12 weeks</div>
        </div>
        <div style={{ height: 6, background: C.surface, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: "58%", background: `linear-gradient(90deg, ${C.green}, #2AB860)`, borderRadius: 3 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
          {["Base","Build","Peak","Taper"].map(p => (
            <div key={p} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: phaseColor[p] }} />
              <span style={{ color: C.muted, fontSize: 10 }}>{p}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weeks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
        {weeks.map((w) => (
          <div key={w.wk} style={{
            background: w.current ? C.surface : C.card,
            borderRadius: 14,
            border: `1px solid ${w.current ? C.green + "50" : C.border}`,
            padding: "12px 14px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            {/* Week badge */}
            <div style={{ width: 38, height: 38, borderRadius: 10, background: w.done ? C.greenDim : w.current ? C.greenDim : C.surface, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              {w.done
                ? <div style={{ color: C.green, fontSize: 16, fontWeight: 800 }}>✓</div>
                : <div style={{ color: w.current ? C.green : C.dim, fontSize: 13, fontWeight: 700 }}>W{w.wk}</div>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                <span style={{ color: w.done ? C.muted : C.text, fontSize: 13, fontWeight: 700, textDecoration: w.done ? "line-through" : "none" }}>Week {w.wk}</span>
                {w.current && <span style={{ background: C.green, color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 4, padding: "2px 6px" }}>NOW</span>}
              </div>
              <div style={{ color: C.muted, fontSize: 11 }}>{w.hill} · {w.elev}m target</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ background: phaseColor[w.phase] + "20", color: phaseColor[w.phase], fontSize: 10, fontWeight: 700, borderRadius: 5, padding: "2px 7px" }}>{w.phase}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 70, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex" }}>
        {["Dashboard","Plan","Log","Hills","Account"].map((tab, i) => (
          <div key={tab} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 1 ? C.greenDim : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: i === 1 ? C.green : C.dim }} />
            </div>
            <div style={{ color: i === 1 ? C.green : C.dim, fontSize: 10, fontWeight: i === 1 ? 700 : 400 }}>{tab}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Log Screen ────────────────────────────────────────────────────────────────
function LogScreen() {
  const logs = [
    { id: 1, type: "bigDay",  label: "Long Hike",    date: daysFromNow(-10), dist: 14.2, elev: 720, dur: "3h 30m", effort: 4 },
    { id: 2, type: "hill",   label: "Stanage Reps",  date: daysFromNow(-14), dist: 4.8,  elev: 460, dur: "1h 20m", effort: 4 },
    { id: 3, type: "cardio", label: "Easy Run",       date: daysFromNow(-17), dist: 7.2,  elev: 120, dur: "48 min",  effort: 3 },
    { id: 4, type: "bigDay", label: "Long Hike",     date: daysFromNow(-21), dist: 14.2, elev: 720, dur: "3h 30m", effort: 4 },
    { id: 5, type: "hill",   label: "Carl Wark Reps", date: daysFromNow(-24), dist: 4.8,  elev: 460, dur: "1h 20m", effort: 3 },
  ];
  const typeColor: Record<string, string> = { cardio: C.blue, hill: C.green, bigDay: C.orange };
  const typeEmoji: Record<string, string> = { cardio: "🏃", hill: "⛰️", bigDay: "🥾" };

  return (
    <div style={{ width: 390, height: 844, background: C.bg, fontFamily: "'Inter', sans-serif", overflowY: "auto" }}>
      {/* Header */}
      <div style={{ padding: "52px 16px 14px" }}>
        <div style={{ color: C.text, fontSize: 22, fontWeight: 700 }}>Session Log</div>
        <div style={{ color: C.muted, fontSize: 13 }}>12 sessions completed</div>
      </div>

      {/* Monthly totals */}
      <div style={{ display: "flex", gap: 8, padding: "0 16px 14px" }}>
        {[
          { label: "This month", val: "4 sessions" },
          { label: "Elevation", val: "2.1km" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: "10px 12px" }}>
            <div style={{ color: C.text, fontSize: 16, fontWeight: 700 }}>{s.val}</div>
            <div style={{ color: C.muted, fontSize: 11, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Log entries */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 16px" }}>
        {logs.map((l) => (
          <div key={l.id} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "12px 14px", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: typeColor[l.type] + "20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
              {typeEmoji[l.type]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: C.text, fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{l.label}</div>
              <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>{fmtDate(l.date)}</div>
              <div style={{ display: "flex", gap: 10 }}>
                <span style={{ color: C.muted, fontSize: 11 }}>📍 {l.dist}km</span>
                <span style={{ color: C.muted, fontSize: 11 }}>⬆ {l.elev}m</span>
                <span style={{ color: C.muted, fontSize: 11 }}>⏱ {l.dur}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 3, alignItems: "center", paddingTop: 2 }}>
              {[1,2,3,4,5].map(n => <div key={n} style={{ width: 6, height: 6, borderRadius: "50%", background: n <= l.effort ? typeColor[l.type] : C.border }} />)}
            </div>
          </div>
        ))}

        <div style={{ textAlign: "center", padding: "8px 0 90px", color: C.dim, fontSize: 12 }}>
          +7 more sessions
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 70, background: C.card, borderTop: `1px solid ${C.border}`, display: "flex", width: 390 }}>
        {["Dashboard","Plan","Log","Hills","Account"].map((tab, i) => (
          <div key={tab} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: i === 2 ? C.greenDim : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: i === 2 ? C.green : C.dim }} />
            </div>
            <div style={{ color: i === 2 ? C.green : C.dim, fontSize: 10, fontWeight: i === 2 ? 700 : 400 }}>{tab}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function ScreenshotHelperPage() {
  const [params] = useSearchParams();
  const screen = params.get("s") ?? "dashboard";

  useEffect(() => {
    // Force Inter font to load
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap";
    document.head.appendChild(link);
  }, []);

  return (
    <div style={{ background: "#000", minHeight: "100vh", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 0, margin: 0 }}>
      {screen === "dashboard" && <DashboardScreen />}
      {screen === "plan" && <PlanScreen />}
      {screen === "log" && <LogScreen />}
    </div>
  );
}

export default function ScreenshotHelper() {
  return (
    <AdminGuard title="Screenshot Helper">
      <ScreenshotHelperPage />
    </AdminGuard>
  );
}
