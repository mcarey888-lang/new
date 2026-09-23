import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CircleUserRound,
  Footprints,
  Info,
  Mountain,
  Navigation,
  ShieldCheck,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import "./_group.css";

const img = (name: string) => `/__mockup/images/summitready-explore/${name}`;

type Rank = {
  position: number;
  name: string;
  region: string;
  score: number;
  elevation: string;
  trend: string;
  avatar: string;
  you?: boolean;
};

const ranks: Rank[] = [
  { position: 1, name: "Maya Chen", region: "Alpine North", score: 982, elevation: "12,480 m", trend: "+3", avatar: "MC" },
  { position: 2, name: "Luca Hart", region: "Peak District", score: 941, elevation: "11,920 m", trend: "+1", avatar: "LH" },
  { position: 3, name: "Amelia Stone", region: "Lake District", score: 918, elevation: "10,870 m", trend: "−2", avatar: "AS" },
  { position: 4, name: "You", region: "Highland Chapter", score: 876, elevation: "9,640 m", trend: "+6", avatar: "YO", you: true },
  { position: 5, name: "Jon Bell", region: "West Country", score: 842, elevation: "9,110 m", trend: "+2", avatar: "JB" },
];

const periods = ["This season", "This month", "All time"];

export function RankExpeditionLeague() {
  const [period, setPeriod] = useState("This season");
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(4);
  const [infoOpen, setInfoOpen] = useState(false);
  const visibleRanks = useMemo(() => (showAll ? ranks : ranks.slice(0, 4)), [showAll]);

  return (
    <main className="sr-screen" style={{ background: "#07151b", color: "#edf4f1", overflowY: "auto", overflowX: "hidden" }}>
      <div style={{ minHeight: "100%", paddingBottom: 76 }}>
        <section
          style={{
            position: "relative",
            minHeight: 294,
            padding: "10px 20px 20px",
            backgroundImage: `linear-gradient(180deg, rgba(5,18,24,.25) 0%, rgba(7,21,27,.48) 36%, #07151b 100%), url(${img("hero.jpg")})`,
            backgroundPosition: "center 36%",
            backgroundSize: "cover",
          }}
        >
          <div className="sr-status" style={{ padding: 0, height: 24 }}><span>9:41</span><span className="status-icons">▮▮▮ ◔ <b>100</b></span></div>
          <header style={{ height: 54, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="wordmark">
              <span className="mark">⌃⌃</span>
              <span><strong>SUMMITREADY</strong><small>TRAIN MORE. GO FURTHER.</small></span>
            </div>
            <button onClick={() => setInfoOpen((v) => !v)} aria-label="About expedition league" style={{ width: 34, height: 34, borderRadius: 99, border: "1px solid #a4b6b455", color: "#eef5f1", background: "#152b31cc", display: "grid", placeItems: "center" }}>
              <Info size={16} />
            </button>
          </header>
          <div style={{ marginTop: 23 }}>
            <p style={{ margin: 0, color: "#a7d9c8", fontSize: 10, fontWeight: 700, letterSpacing: "2px" }}>RANKS · EXPEDITION LEAGUE</p>
            <h1 style={{ fontFamily: "'Space Grotesk'", fontSize: 31, lineHeight: ".98", letterSpacing: "-1.3px", margin: "7px 0 8px", fontWeight: 700 }}>Find your place<br />above the clouds.</h1>
            <p style={{ color: "#d2dcda", fontSize: 11, margin: 0, maxWidth: 250, lineHeight: 1.45 }}>Every climb counts. This season, you are setting the pace.</p>
          </div>
          {infoOpen && <div style={{ position: "absolute", right: 20, top: 80, zIndex: 3, width: 224, border: "1px solid #49645e", background: "#0c2528f5", borderRadius: 10, padding: "12px 13px", boxShadow: "0 12px 24px #0006" }}>
            <strong style={{ fontSize: 11 }}>How the league works</strong>
            <p style={{ color: "#b9cbc7", fontSize: 10, lineHeight: 1.45, margin: "6px 0 0" }}>Your score blends completed sessions, elevation, and consistency. Rankings refresh every Monday.</p>
          </div>}
        </section>

        <section style={{ padding: "0 18px" }}>
          <div style={{ marginTop: -26, position: "relative", zIndex: 1, border: "1px solid #29453f", background: "linear-gradient(135deg,#12332e,#0b2429)", borderRadius: 12, padding: "14px 15px 13px", boxShadow: "0 10px 22px #0003" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ margin: 0, color: "#9dbeb3", letterSpacing: "1.4px", fontSize: 9, fontWeight: 700 }}>YOUR CURRENT RANK</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 2 }}>
                  <span style={{ color: "#43e2a4", fontFamily: "'Space Grotesk'", fontSize: 34, fontWeight: 700 }}>#4</span>
                  <span style={{ color: "#a5bcb7", fontSize: 10 }}>of 1,248 climbers</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}><span style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, color: "#42e3a2", fontSize: 10, fontWeight: 700 }}><TrendingUp size={13} /> +6 places</span><small style={{ color: "#93aaa5", fontSize: 9 }}>since last week</small></div>
            </div>
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", color: "#bacbc7", fontSize: 9 }}><span>92nd percentile</span><span>124 pts to #3</span></div>
            <div style={{ height: 6, borderRadius: 9, background: "#071b1d", marginTop: 5, overflow: "hidden" }}><div style={{ width: "92%", height: "100%", background: "#35d99c", borderRadius: 9 }} /></div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "19px 0 9px" }}>
            <h2 style={{ margin: 0, fontFamily: "'Space Grotesk'", fontSize: 16, letterSpacing: "-.3px" }}>The leaderboard</h2>
            <button onClick={() => setInfoOpen((v) => !v)} style={{ border: 0, background: "none", color: "#a4b6b5", display: "flex", alignItems: "center", gap: 4, fontSize: 9 }}>{period}<ChevronDown size={13} /></button>
          </div>
          <div style={{ display: "flex", gap: 5, borderBottom: "1px solid #1c343a", paddingBottom: 9 }}>
            {periods.map((item) => <button key={item} onClick={() => setPeriod(item)} style={{ border: "1px solid", borderColor: period === item ? "#3fdb9e" : "#294048", borderRadius: 15, background: period === item ? "#123c35" : "#0b2028", color: period === item ? "#53e4ae" : "#9db0b5", padding: "6px 10px", fontSize: 9, transition: "all .2s" }}>{item}</button>)}
          </div>

          <div style={{ marginTop: 8 }}>
            {visibleRanks.map((rank) => {
              const isExpanded = expanded === rank.position;
              return <div key={rank.position} style={{ borderBottom: "1px solid #183039", background: rank.you ? "#0c2d2b" : "transparent", borderRadius: rank.you ? 8 : 0, transition: "background .2s" }}>
                <button onClick={() => setExpanded(isExpanded ? null : rank.position)} style={{ width: "100%", minHeight: 59, padding: "7px 4px", display: "grid", gridTemplateColumns: "25px 31px 1fr auto 18px", gap: 7, alignItems: "center", border: 0, color: "#e6efec", background: "transparent", textAlign: "left" }}>
                  <span style={{ color: rank.position <= 3 ? "#cfd8c8" : rank.you ? "#44e1a4" : "#83979c", fontFamily: "'Space Grotesk'", fontSize: 13, fontWeight: 700 }}>{rank.position === 1 ? "01" : rank.position === 2 ? "02" : rank.position === 3 ? "03" : `0${rank.position}`}</span>
                  <span style={{ width: 29, height: 29, borderRadius: "50%", display: "grid", placeItems: "center", color: rank.you ? "#50e6ac" : "#c5d2ce", background: rank.you ? "#174b3e" : "#20343a", border: rank.you ? "1px solid #35c992" : "1px solid #40535a", fontSize: 9, fontWeight: 700 }}>{rank.avatar}</span>
                  <span><strong style={{ display: "block", fontSize: 11, fontWeight: rank.you ? 700 : 600 }}>{rank.name}{rank.you && <span style={{ marginLeft: 5, color: "#48dfa4", fontSize: 8, letterSpacing: ".6px" }}>YOU</span>}</strong><small style={{ display: "block", color: "#82969b", fontSize: 8, marginTop: 2 }}>{rank.region}</small></span>
                  <span style={{ textAlign: "right" }}><strong style={{ display: "block", fontSize: 11 }}>{rank.score}</strong><small style={{ color: "#85999c", fontSize: 8 }}>{rank.elevation}</small></span>
                  <ChevronRight size={14} style={{ color: isExpanded ? "#48dfa4" : "#70858a", transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
                </button>
                {isExpanded && <div style={{ margin: "0 13px 10px 36px", padding: "9px 10px", borderLeft: "2px solid #2b9d78", background: "#0b2529", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <span><small style={{ color: "#819b98", display: "block", fontSize: 8 }}>WEEKLY MOVE</small><strong style={{ color: "#4bdd9f", fontSize: 10 }}>{rank.trend} places</strong></span>
                  <span><small style={{ color: "#819b98", display: "block", fontSize: 8 }}>CONSISTENCY</small><strong style={{ fontSize: 10 }}>87%</strong></span>
                  <span><small style={{ color: "#819b98", display: "block", fontSize: 8 }}>NEXT UP</small><strong style={{ fontSize: 10 }}>{rank.you ? "124 pts" : "—"}</strong></span>
                </div>}
              </div>;
            })}
          </div>
          <button onClick={() => setShowAll((v) => !v)} style={{ width: "100%", height: 34, border: "1px solid #29434a", borderRadius: 7, background: "#0b2028", color: "#c5d3d2", fontSize: 10, marginTop: 11 }}>{showAll ? "Show less" : "View full leaderboard"} <ArrowUpRight size={13} style={{ verticalAlign: "middle", marginLeft: 4 }} /></button>

          <section style={{ marginTop: 18, padding: "12px 13px", borderRadius: 9, border: "1px solid #263b3d", background: "#0a2026", display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: 8, background: "#173a34", color: "#50e3a9" }}><ShieldCheck size={20} /></div>
            <div style={{ flex: 1 }}><strong style={{ fontSize: 11, display: "block" }}>Promotion line: Alpine Elite</strong><span style={{ color: "#91a9a5", fontSize: 9 }}>Top 3 by 30 Jun · keep climbing</span></div>
            <Target size={16} color="#d4b56c" />
          </section>
        </section>
      </div>

      <nav className="bottom-nav" aria-label="Primary navigation" style={{ position: "fixed", width: 390, maxWidth: "100%", bottom: 0 }}>
        {[
          ["Basecamp", Navigation], ["Explore", Mountain], ["Track", Footprints], ["Ranks", Trophy], ["You", CircleUserRound],
        ].map(([label, Icon]) => <button key={label as string} className={label === "Ranks" ? "current" : ""} onClick={() => undefined}><span className="nav-icon"><Icon size={20} /></span><small>{label as string}</small></button>)}
      </nav>
      <div className="home-indicator" style={{ position: "fixed" }} />
    </main>
  );
}