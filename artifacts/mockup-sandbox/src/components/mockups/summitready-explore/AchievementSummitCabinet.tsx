import { useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  Award,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Crown,
  Footprints,
  Info,
  LockKeyhole,
  Mountain,
  Sparkles,
  TentTree,
  Trophy,
} from "lucide-react";
import "./_group.css";

const image = (name: string) => `/__mockup/images/summitready-explore/${name}`;

type TrophyItem = {
  id: string;
  title: string;
  kicker: string;
  detail: string;
  image: string;
  earned?: boolean;
  progress?: number;
  accent: string;
};

const trophies: TrophyItem[] = [
  {
    id: "first-light",
    title: "First Light",
    kicker: "FOUNDATION",
    detail: "Complete your first sunrise start",
    image: "snowdon.jpg",
    earned: true,
    accent: "#bca36a",
  },
  {
    id: "ridge-line",
    title: "Ridge Line",
    kicker: "DISTANCE",
    detail: "Walk 50 km above the tree line",
    image: "tryfan.jpg",
    earned: true,
    accent: "#64d6ae",
  },
  {
    id: "four-thousand",
    title: "Four Thousand",
    kicker: "ALTITUDE",
    detail: "Reach 4,000 m of accumulated gain",
    image: "mont-blanc.jpg",
    progress: 68,
    accent: "#d5b675",
  },
  {
    id: "weather-wise",
    title: "Weather Wise",
    kicker: "JUDGEMENT",
    detail: "Complete three changing-weather routes",
    image: "ben-nevis.jpg",
    progress: 33,
    accent: "#83a6aa",
  },
  {
    id: "summit-standard",
    title: "Summit Standard",
    kicker: "MASTERED",
    detail: "Complete a 2,000 m ascent week",
    image: "matterhorn.jpg",
    progress: 0,
    accent: "#8c9b9a",
  },
];

const navItems: Array<[string, typeof TentTree]> = [
  ["Basecamp", TentTree],
  ["Explore", Compass],
  ["Track", Footprints],
  ["You", Award],
];

export function AchievementSummitCabinet() {
  const [selected, setSelected] = useState<TrophyItem>(trophies[2]);
  const [showInfo, setShowInfo] = useState(false);
  const earnedCount = trophies.filter((item) => item.earned).length;

  return (
    <main className="sr-screen" style={{ background: "#07151a", color: "#f4f2e9" }}>
      <div style={{ height: "100%", overflow: "hidden", position: "relative" }}>
        <header
          style={{
            height: 88,
            padding: "12px 20px 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(180deg,#0b2027 0%,#0a1b21 100%)",
            borderBottom: "1px solid #29403e",
          }}
        >
          <button aria-label="Back" style={iconButtonStyle} onClick={() => undefined}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ textAlign: "center", marginTop: 3 }}>
            <p style={eyebrowStyle}>YOUR PROGRESS</p>
            <h1 style={{ font: "700 19px/21px 'Space Grotesk'", margin: 2, letterSpacing: "-.5px" }}>
              Summit Cabinet
            </h1>
          </div>
          <button aria-label="About achievements" style={iconButtonStyle} onClick={() => setShowInfo((value) => !value)}>
            <CircleHelp size={18} />
          </button>
        </header>

        <section
          style={{
            height: 184,
            padding: "17px 20px",
            background:
              "linear-gradient(105deg,rgba(8,27,32,.94),rgba(8,27,32,.46)),url('/__mockup/images/summitready-explore/mont-blanc.jpg') center 45%/cover",
            position: "relative",
            borderBottom: "1px solid #2b4743",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,#07151a 0%,transparent 62%)" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <p style={{ ...eyebrowStyle, color: "#c5aa6a", marginBottom: 7 }}>THE HIGHER STANDARD</p>
            <h2 style={{ font: "700 27px/27px 'Space Grotesk'", margin: 0, letterSpacing: "-1px" }}>
              Earn your<br />place on the ridge.
            </h2>
            <p style={{ color: "#c2cecb", fontSize: 11, margin: "9px 0 0", maxWidth: 220, lineHeight: 1.45 }}>
              A record of the routes, habits and hard-won days that move you higher.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 11, marginTop: 16 }}>
              <div style={{ width: 116, height: 5, background: "#223b3c", borderRadius: 5, overflow: "hidden" }}>
                <div style={{ width: "40%", height: "100%", background: "#34d19a", borderRadius: 5 }} />
              </div>
              <span style={{ font: "600 10px 'Space Grotesk'", color: "#c9d9d2" }}>{earnedCount} of {trophies.length} earned</span>
            </div>
          </div>
          <div style={{ position: "absolute", right: 22, bottom: 20, color: "#c5aa6a", opacity: .9 }}>
            <Crown size={42} strokeWidth={1.1} />
          </div>
        </section>

        <div style={{ height: 497, overflowY: "auto", padding: "15px 19px 88px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <p style={eyebrowStyle}>THE COLLECTION</p>
              <h2 style={{ font: "700 16px 'Space Grotesk'", margin: "3px 0 0" }}>Cabinet of summits</h2>
            </div>
            <span style={{ color: "#8fa7a4", fontSize: 10 }}>3 categories</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
            {trophies.map((trophy) => {
              const isSelected = selected.id === trophy.id;
              return (
                <button
                  key={trophy.id}
                  onClick={() => setSelected(trophy)}
                  style={{
                    textAlign: "left",
                    padding: 0,
                    height: 154,
                    overflow: "hidden",
                    position: "relative",
                    borderRadius: 7,
                    border: `1px solid ${isSelected ? trophy.accent : "#28413f"}`,
                    background: isSelected ? "#16312f" : "#0d242a",
                    color: "#f4f2e9",
                    boxShadow: isSelected ? `0 0 0 1px ${trophy.accent}33, 0 7px 18px #02090955` : "none",
                    transition: "transform .2s ease, border-color .2s ease",
                    transform: isSelected ? "translateY(-2px)" : "translateY(0)",
                  }}
                >
                  <div style={{ height: 74, position: "relative", overflow: "hidden" }}>
                    <img src={image(trophy.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: trophy.earned ? "saturate(.85)" : "grayscale(.75) brightness(.55)" }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg,#0d242a,transparent 70%)" }} />
                    {trophy.earned ? (
                      <span style={{ position: "absolute", right: 7, top: 7, display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: "50%", background: "#34d19a", color: "#082019" }}>
                        <Check size={13} strokeWidth={3} />
                      </span>
                    ) : (
                      <span style={{ position: "absolute", right: 7, top: 7, display: "grid", placeItems: "center", width: 20, height: 20, borderRadius: "50%", background: "#122b31dd", color: "#a6b7b4" }}>
                        <LockKeyhole size={12} />
                      </span>
                    )}
                  </div>
                  <div style={{ padding: "3px 9px 8px" }}>
                    <p style={{ color: trophy.accent, font: "600 7px 'Space Grotesk'", letterSpacing: "1.2px", margin: 0 }}>{trophy.kicker}</p>
                    <strong style={{ display: "block", font: "700 14px 'Space Grotesk'", marginTop: 2 }}>{trophy.title}</strong>
                    <p style={{ color: "#9fb1ae", fontSize: 8.5, lineHeight: 1.25, margin: "4px 0 0" }}>
                      {trophy.earned ? "Awarded · tap to inspect" : `${trophy.progress}% · in progress`}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <section style={{ marginTop: 15, border: "1px solid #31504a", borderRadius: 7, background: "#102b2c", padding: "12px 12px 11px", position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", right: -8, top: -11, color: selected.accent, opacity: .12 }}><Trophy size={88} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
              <div>
                <p style={{ ...eyebrowStyle, color: selected.accent }}>INSPECTING {selected.earned ? "EARNED" : "LOCKED"}</p>
                <h3 style={{ font: "700 18px 'Space Grotesk'", margin: "4px 0 4px" }}>{selected.title}</h3>
                <p style={{ color: "#bbc9c5", fontSize: 10, margin: 0, maxWidth: 247, lineHeight: 1.35 }}>{selected.detail}.</p>
              </div>
              <div style={{ color: selected.accent, paddingTop: 4 }}>{selected.earned ? <Award size={25} /> : <LockKeyhole size={23} />}</div>
            </div>
            {!selected.earned && <div style={{ marginTop: 11, height: 4, background: "#203f3d", borderRadius: 4 }}><div style={{ width: `${selected.progress}%`, height: "100%", background: selected.accent, borderRadius: 4 }} /></div>}
            <button onClick={() => setShowInfo(true)} style={{ marginTop: 10, border: 0, padding: 0, background: "none", color: "#dce7df", fontSize: 9, display: "flex", alignItems: "center", gap: 4 }}>
              {selected.earned ? "View route record" : "See how to earn"} <ChevronRight size={12} />
            </button>
          </section>
        </div>

        {showInfo && (
          <div style={{ position: "absolute", zIndex: 8, left: 18, right: 18, top: 122, padding: 15, borderRadius: 8, border: "1px solid #61705c", background: "#102b2ccc", backdropFilter: "blur(12px)", boxShadow: "0 12px 28px #0008" }}>
            <button onClick={() => setShowInfo(false)} aria-label="Close details" style={{ position: "absolute", top: 9, right: 10, border: 0, background: "none", color: "#d3dfda" }}><ChevronRight size={16} style={{ transform: "rotate(90deg)" }} /></button>
            <p style={{ ...eyebrowStyle, color: "#c5aa6a" }}>A NOTE FROM BASECAMP</p>
            <p style={{ margin: "8px 18px 2px 0", color: "#e0e8e2", fontSize: 11, lineHeight: 1.45 }}>Achievements mark durable habits, not one perfect day. Keep showing up and the next brass plate will have your name on it.</p>
          </div>
        )}

        <nav className="bottom-nav" aria-label="Primary navigation" style={{ background: "#071721f5" }}>
          {navItems.map(([label, Icon]) => (
            <button key={label} className={label === "You" ? "current" : ""} onClick={() => undefined}>
              <span className="nav-icon">{label === "You" ? <Sparkles size={19} /> : <Icon size={19} />}</span>
              <small>{label}</small>
            </button>
          ))}
        </nav>
        <div className="home-indicator" />
      </div>
    </main>
  );
}

const iconButtonStyle: CSSProperties = {
  width: 33,
  height: 33,
  borderRadius: "50%",
  border: "1px solid #35504d",
  background: "#132c31",
  color: "#d5e0dc",
  display: "grid",
  placeItems: "center",
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: "#91aba5",
  font: "600 8px 'Space Grotesk'",
  letterSpacing: "1.8px",
};