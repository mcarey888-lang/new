import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  Award,
  BarChart3,
  Check,
  ChevronRight,
  CircleUserRound,
  Compass,
  Footprints,
  Mountain,
  Route,
  Sparkles,
  TentTree,
  Trophy,
  Waves,
  X,
} from "lucide-react";
import "./_group.css";

const img = (name: string) => `/__mockup/images/summitready-explore/${name}`;

type Achievement = {
  id: string;
  title: string;
  detail: string;
  metric: string;
  state: "earned" | "current" | "locked";
  x: number;
  y: number;
  icon: typeof Mountain;
  accent: string;
};

const achievements: Achievement[] = [
  { id: "first-light", title: "First Light", detail: "Finish your first sunrise session", metric: "Earned 12 Mar", state: "earned", x: 14, y: 36, icon: Waves, accent: "#f5b866" },
  { id: "switchback", title: "Switchback", detail: "Climb 1,000 m in a week", metric: "3 / 4 sessions", state: "current", x: 46, y: 19, icon: Route, accent: "#2ee5a4" },
  { id: "long-haul", title: "Long Haul", detail: "Complete a 20 km training day", metric: "20 km", state: "earned", x: 78, y: 39, icon: Footprints, accent: "#77c9ff" },
  { id: "high-country", title: "High Country", detail: "Reach 2,500 m of elevation", metric: "1,860 / 2,500 m", state: "current", x: 27, y: 67, icon: BarChart3, accent: "#2ee5a4" },
  { id: "three-peaks", title: "Three Peaks", detail: "Complete three summit routes", metric: "2 / 3 summits", state: "current", x: 63, y: 72, icon: Mountain, accent: "#a48cff" },
  { id: "alpine-line", title: "Alpine Line", detail: "Unlock after High Country", metric: "Locked", state: "locked", x: 89, y: 63, icon: Trophy, accent: "#71848e" },
];

const navItems: Array<[string, typeof TentTree]> = [
  ["Basecamp", TentTree],
  ["Explore", Compass],
  ["Track", Footprints],
  ["Expeditions", Mountain],
  ["You", CircleUserRound],
];

export function AchievementConstellation() {
  const [activeId, setActiveId] = useState("switchback");
  const [view, setView] = useState<"All" | "Earned" | "In progress">("All");
  const [toast, setToast] = useState(false);
  const active = achievements.find((item) => item.id === activeId) ?? achievements[1];
  const visible = useMemo(
    () => achievements.filter((item) => view === "All" || (view === "Earned" ? item.state === "earned" : item.state === "current")),
    [view],
  );

  return (
    <main className="sr-screen" style={{ background: "#06141c", overflow: "hidden", minHeight: 844, height: 844, flexShrink: 0 }}>
      <div className="sr-status"><span>9:41</span><span className="status-icons">▮▮▮ ◔ <b>100</b></span></div>
      <header style={{ height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 19px", borderBottom: "1px solid #1b3039" }}>
        <div className="wordmark">
          <span className="mark">⌃⌃</span>
          <span><strong>SUMMITREADY</strong><small>TRAIN MORE. GO FURTHER.</small></span>
        </div>
        <button aria-label="Profile" style={{ width: 33, height: 33, borderRadius: "50%", border: "1px solid #31505a", background: "#122932", color: "#dce8e9", display: "grid", placeItems: "center" }}><CircleUserRound size={17} /></button>
      </header>

      <section style={{ height: 211, padding: "19px 21px 0", position: "relative", background: "linear-gradient(180deg, #0c2429 0%, #0a1d25 56%, #06141c 100%)" }}>
        <div style={{ position: "absolute", inset: 0, opacity: 0.23, backgroundImage: `linear-gradient(180deg, transparent 26%, #06141c 100%), url(${img("hero.jpg")})`, backgroundSize: "cover", backgroundPosition: "center 43%" }} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ margin: 0, fontSize: 9, letterSpacing: "2px", color: "#70e2b4", fontWeight: 700 }}>YOUR PROGRESSION</p>
          <h1 style={{ font: "700 27px/29px 'Space Grotesk'", letterSpacing: "-1px", margin: "4px 0 5px", color: "#f3f7f5" }}>The sky keeps<br />score.</h1>
          <p style={{ color: "#b7c8cc", margin: 0, fontSize: 11, maxWidth: 250 }}>Every session lights another connection between where you are and your next summit.</p>
          <div style={{ display: "flex", gap: 7, marginTop: 15 }}>
            {[["12", "earned"], ["04", "in progress"], ["08", "to discover"]].map(([value, label]) => (
              <div key={label} style={{ padding: "7px 10px 6px", minWidth: 82, border: "1px solid #25424a", borderRadius: 7, background: "#0a2128cc" }}>
                <strong style={{ display: "block", font: "700 17px 'Space Grotesk'", color: "#eff8f4" }}>{value}</strong>
                <small style={{ fontSize: 8, color: "#9eb2b6" }}>{label}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ height: 398, padding: "12px 18px 0", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div>
            <span style={{ color: "#f1f6f4", font: "700 15px 'Space Grotesk'" }}>Achievement sky</span>
            <span style={{ color: "#82989e", fontSize: 9, marginLeft: 7 }}>4 of 24 revealed</span>
          </div>
          <button onClick={() => { setToast(true); window.setTimeout(() => setToast(false), 1800); }} style={{ border: 0, background: "transparent", color: "#94a9af", display: "flex", alignItems: "center", gap: 4, fontSize: 9 }}><Sparkles size={13} /> How it works</button>
        </div>
        <div style={{ display: "flex", gap: 6, margin: "6px 0 6px" }}>
          {(["All", "Earned", "In progress"] as const).map((item) => (
            <button key={item} onClick={() => setView(item)} style={{ height: 25, borderRadius: 15, padding: "0 11px", border: `1px solid ${view === item ? "#1fdc99" : "#29434d"}`, background: view === item ? "#0d3b36" : "#0a2028", color: view === item ? "#61f2ba" : "#a4b6ba", fontSize: 9 }}>{item}</button>
          ))}
        </div>
        <div style={{ height: 275, position: "relative", borderRadius: 13, border: "1px solid #1c3943", overflow: "hidden", background: "radial-gradient(circle at 53% 37%, #123d40 0%, #09252d 35%, #071b25 75%)" }}>
          <div style={{ position: "absolute", inset: 0, opacity: 0.38, backgroundImage: "radial-gradient(#7ca4a3 0.7px, transparent 0.7px)", backgroundSize: "23px 23px" }} />
          <div style={{ position: "absolute", left: "8%", right: "8%", top: "44%", height: 1, background: "linear-gradient(90deg, transparent, #2d8274aa, transparent)", transform: "rotate(-12deg)" }} />
          <div style={{ position: "absolute", left: "20%", right: "13%", top: "52%", height: 1, background: "linear-gradient(90deg, transparent, #337f72aa, transparent)", transform: "rotate(23deg)" }} />
          {visible.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === active.id;
            return (
              <button key={item.id} onClick={() => setActiveId(item.id)} aria-label={`View ${item.title}`} style={{ position: "absolute", left: `${item.x}%`, top: `${item.y}%`, transform: "translate(-50%, -50%)", width: item.state === "locked" ? 39 : 46, height: item.state === "locked" ? 39 : 46, borderRadius: "50%", border: `1px solid ${isActive ? "#c6ffe9" : item.accent}`, background: item.state === "locked" ? "#162c35" : "#0a252b", color: item.state === "locked" ? "#70868c" : item.accent, boxShadow: isActive ? `0 0 0 5px ${item.accent}28, 0 0 22px ${item.accent}70` : `0 0 12px ${item.accent}45`, display: "grid", placeItems: "center", transition: "transform .2s ease, box-shadow .2s ease" }}>
                <Icon size={item.state === "locked" ? 16 : 19} />
                {item.state === "earned" && <span style={{ position: "absolute", right: -1, bottom: -1, width: 14, height: 14, background: "#20d995", color: "#06201e", borderRadius: "50%", display: "grid", placeItems: "center", border: "2px solid #09212a" }}><Check size={9} strokeWidth={3} /></span>}
              </button>
            );
          })}
          <div style={{ position: "absolute", left: 15, bottom: 13, color: "#779096", fontSize: 8, letterSpacing: "1px" }}>NORTH STAR · 2025</div>
          <div style={{ position: "absolute", right: 14, top: 13, color: "#779096", fontSize: 8, letterSpacing: "1px" }}>ELEVATION / DISTANCE / TIME</div>
        </div>
        <div style={{ marginTop: 8, minHeight: 49, border: `1px solid ${active.accent}55`, borderRadius: 8, background: "#0b222a", display: "flex", alignItems: "center", padding: "8px 10px", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, display: "grid", placeItems: "center", color: active.accent, background: `${active.accent}1e` }}>{active.state === "locked" ? <X size={15} /> : <active.icon size={16} />}</div>
          <div style={{ flex: 1, minWidth: 0 }}><strong style={{ display: "block", fontSize: 11, color: "#f1f6f4" }}>{active.title}</strong><span style={{ display: "block", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", color: "#9db2b6", fontSize: 9 }}>{active.detail} · {active.metric}</span></div>
          <ChevronRight size={15} color="#81979c" />
        </div>
      </section>

      <section style={{ height: 66, padding: "7px 19px", background: "#081923", borderTop: "1px solid #19333e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <div style={{ width: 39, height: 39, borderRadius: "50%", background: "linear-gradient(145deg,#173f42,#0b252d)", display: "grid", placeItems: "center", color: "#eebf72", border: "1px solid #576c5e" }}><Award size={18} /></div>
          <div style={{ flex: 1 }}><strong style={{ display: "block", fontSize: 11 }}>Next horizon</strong><span style={{ color: "#9eb1b4", fontSize: 9 }}>140 m elevation until High Country</span><div style={{ height: 4, background: "#1c3740", borderRadius: 5, marginTop: 6 }}><div style={{ height: 4, width: "74%", background: "#24d998", borderRadius: 5 }} /></div></div>
          <ArrowUpRight size={16} color="#32dda0" />
        </div>
      </section>

      <nav className="bottom-nav" aria-label="Primary navigation">{navItems.map(([label, Icon]) => <button key={label} className={label === "You" ? "current" : ""} onClick={() => undefined}><span className="nav-icon"><Icon size={20} /></span><small>{label}</small></button>)}</nav>
      <div className="home-indicator" />
      {toast && <div style={{ position: "absolute", zIndex: 20, bottom: 86, left: 28, right: 28, padding: "11px 13px", borderRadius: 8, background: "#d9f5e7", color: "#102d29", fontSize: 10, boxShadow: "0 7px 24px #0008" }}><strong style={{ display: "block", fontSize: 11 }}>Each light has a story.</strong> Earn milestones across training, distance, elevation and summits.</div>}
    </main>
  );
}