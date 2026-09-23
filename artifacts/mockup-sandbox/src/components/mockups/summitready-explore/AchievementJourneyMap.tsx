import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Flag,
  Footprints,
  LockKeyhole,
  MapPinned,
  Mountain,
  Route,
  Share2,
  ShieldCheck,
  Star,
  Trophy,
} from "lucide-react";
import "./_group.css";

const image = (name: string) => `/__mockup/images/summitready-explore/${name}`;

const milestones = [
  {
    id: "first-light",
    date: "14 APR 2024",
    title: "First Light",
    subtitle: "Your first sunrise above the treeline",
    place: "Helvellyn · Lake District",
    stat: "984 m",
    image: "snowdon.jpg",
    earned: true,
    accent: "#f3bd69",
  },
  {
    id: "ridge-walker",
    date: "02 JUN 2024",
    title: "Ridge Walker",
    subtitle: "A route with nowhere to hide",
    place: "Crib Goch · Snowdonia",
    stat: "7.2 km",
    image: "snowdon.jpg",
    earned: true,
    accent: "#45d99a",
  },
  {
    id: "weather-wise",
    date: "21 JUL 2024",
    title: "Weather Wise",
    subtitle: "You turned back early. That was the win.",
    place: "Ben Nevis · Scottish Highlands",
    stat: "1,345 m",
    image: "ben-nevis.jpg",
    earned: true,
    accent: "#8bd4d2",
  },
  {
    id: "alpine-standard",
    date: "NEXT MILESTONE",
    title: "Alpine Standard",
    subtitle: "Complete one route above 2,000 m",
    place: "Your next chapter",
    stat: "1 of 3",
    image: "mont-blanc.jpg",
    earned: false,
    accent: "#77909a",
  },
];

export function AchievementJourneyMap() {
  const [selected, setSelected] = useState("ridge-walker");
  const [shared, setShared] = useState(false);
  const active = milestones.find((milestone) => milestone.id === selected) ?? milestones[1];

  return (
    <main className="sr-screen" style={{ background: "#07171c", overflow: "hidden" }}>
      <div
        style={{
          height: 142,
          position: "relative",
          backgroundImage: `linear-gradient(180deg, rgba(7,23,28,.12) 0%, rgba(7,23,28,.86) 94%), url(${image("hero.jpg")})`,
          backgroundSize: "cover",
          backgroundPosition: "center 48%",
        }}
      >
        <div className="sr-status"><span>9:41</span><span className="status-icons">▮▮▮ ◔ <b>100</b></span></div>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 18px 0" }}>
          <button aria-label="Back" style={iconButton}><ArrowLeft size={18} /></button>
          <div style={{ textAlign: "center", marginLeft: 28 }}>
            <div style={{ font: "700 11px 'Space Grotesk'", letterSpacing: 2.3 }}>YOUR JOURNEY</div>
            <div style={{ color: "#aebdc1", fontSize: 8.5, letterSpacing: 1.1, marginTop: 3 }}>SEASON 02 · 2024</div>
          </div>
          <button
            aria-label="Share journey"
            onClick={() => setShared(!shared)}
            style={{ ...iconButton, color: shared ? "#42e8a3" : "#eef4f1" }}
          >
            {shared ? <Check size={17} /> : <Share2 size={17} />}
          </button>
        </header>
        <div style={{ position: "absolute", bottom: 14, left: 20, right: 20, display: "flex", alignItems: "end", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#42e8a3", font: "700 9px 'Space Grotesk'", letterSpacing: 1.9 }}>ACHIEVEMENTS</div>
            <h1 style={{ font: "700 26px/25px 'Space Grotesk'", letterSpacing: -1.1, margin: "3px 0 0" }}>The long way up.</h1>
          </div>
          <div style={{ textAlign: "right", color: "#dce6e5" }}>
            <strong style={{ display: "block", font: "700 19px 'Space Grotesk'" }}>3 <span style={{ color: "#82959b", fontSize: 12 }}>/ 8</span></strong>
            <span style={{ fontSize: 8, letterSpacing: 1 }}>MILESTONES</span>
          </div>
        </div>
      </div>

      <section style={{ height: 627, overflow: "hidden", padding: "15px 18px 90px", position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
          <div>
            <div style={{ color: "#adbdc1", fontSize: 9, letterSpacing: 1.6 }}>SEASON PROGRESS</div>
            <div style={{ color: "#edf4f1", font: "700 13px 'Space Grotesk'", marginTop: 3 }}>From foothill to high country</div>
          </div>
          <div style={{ display: "flex", gap: 5, alignItems: "center", color: "#43dfa1", fontSize: 10, fontWeight: 700 }}>
            <ShieldCheck size={15} /> 38%
          </div>
        </div>
        <div style={{ height: 5, background: "#183038", borderRadius: 8, marginBottom: 17 }}>
          <div style={{ width: "38%", height: "100%", background: "#3cdda0", borderRadius: 8 }} />
        </div>

        <div style={{ position: "relative", paddingLeft: 39 }}>
          <div style={{ position: "absolute", left: 14, top: 12, bottom: 18, width: 1, background: "linear-gradient(#3edb9d 0 60%, #365159 60%)" }} />
          {milestones.map((item, index) => {
            const isActive = selected === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item.id)}
                aria-pressed={isActive}
                style={{
                  display: "block", width: "100%", textAlign: "left", position: "relative",
                  border: 0, padding: 0, background: "none", color: "#f1f6f3", marginBottom: index === milestones.length - 1 ? 0 : 12,
                }}
              >
                <span style={{
                  position: "absolute", left: -39, top: 15, width: 30, height: 30, borderRadius: "50%",
                  display: "grid", placeItems: "center", zIndex: 2,
                  background: item.earned ? "#123d36" : "#17282e",
                  border: `1px solid ${item.earned ? item.accent : "#48616a"}`,
                  color: item.earned ? item.accent : "#82959a",
                  boxShadow: isActive ? `0 0 0 4px #42dda022` : "none",
                }}>
                  {item.earned ? <Check size={14} strokeWidth={3} /> : <LockKeyhole size={13} />}
                </span>
                <div style={{
                  minHeight: item.earned ? 92 : 84, padding: "10px 10px 9px", borderRadius: 8,
                  border: `1px solid ${isActive ? "#2d9879" : "#1d3b43"}`, background: isActive ? "#102d2b" : "#0c2028",
                  transition: "transform .2s ease, border-color .2s ease", transform: isActive ? "translateX(3px)" : "none",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                    <div>
                      <div style={{ color: item.earned ? item.accent : "#87999d", font: "700 8px 'Space Grotesk'", letterSpacing: 1.4 }}>{item.date}</div>
                      <div style={{ font: "700 16px 'Space Grotesk'", marginTop: 3 }}>{item.title}</div>
                    </div>
                    <ChevronRight size={15} color={isActive ? "#48e0a5" : "#70858a"} />
                  </div>
                  <p style={{ margin: "3px 0 7px", color: "#b8c7c8", fontSize: 10 }}>{item.subtitle}</p>
                  <div style={{ display: "flex", gap: 12, color: "#93a9ab", fontSize: 9 }}>
                    <span style={{ display: "flex", gap: 4, alignItems: "center" }}><MapPinned size={11} /> {item.place}</span>
                    <span style={{ display: "flex", gap: 4, alignItems: "center" }}><Route size={11} /> {item.stat}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 12, borderTop: "1px solid #1a353c", paddingTop: 11, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ color: "#3fdda0" }}><Trophy size={17} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ font: "700 11px 'Space Grotesk'" }}>One route, one story.</div>
            <div style={{ color: "#93a9ad", fontSize: 9, marginTop: 2 }}>Every summit you log becomes part of your map.</div>
          </div>
          <button aria-label="View map" style={{ ...iconButton, width: 28, height: 28, background: "#15352f", color: "#43dda0" }}><MapPinned size={14} /></button>
        </div>
      </section>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {[
          ["Basecamp", Mountain], ["Explore", Route], ["Track", Footprints], ["Expeditions", Flag], ["You", Star],
        ].map(([label, Icon]) => <button key={label as string} className={label === "You" ? "current" : ""} onClick={() => undefined}><span className="nav-icon"><Icon size={20} /></span><small>{label as string}</small></button>)}
      </nav>
      <div className="home-indicator" />
    </main>
  );
}

const iconButton = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  border: "1px solid #8ba0a055",
  background: "#0c2229bb",
  color: "#eef4f1",
  display: "grid",
  placeItems: "center",
} as const;