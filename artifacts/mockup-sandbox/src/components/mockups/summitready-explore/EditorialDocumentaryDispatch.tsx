import { useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  Compass,
  Image as ImageIcon,
  MapPin,
  Mountain,
  Navigation,
  Play,
  Share2,
  Wind,
} from "lucide-react";
import "./_group.css";

const img = (name: string) => `/__mockup/images/summitready-explore/${name}`;

const dispatches = [
  {
    label: "FRAME 01 · TRAILHEAD",
    title: "Before the first step",
    copy: "The car park is quiet. Boots are still clean. Every route starts with a small decision to leave.",
    image: "ben-nevis.jpg",
    accent: "#d8ad68",
    meta: "05:42 · Glen Nevis",
  },
  {
    label: "FRAME 02 · WEATHER WINDOW",
    title: "The mountain sets the pace",
    copy: "Cloud is moving fast across the ridge. We wait ten minutes, then take the gap the weather gives us.",
    image: "snowdon.jpg",
    accent: "#65d6b0",
    meta: "08:17 · Pen-y-Pass",
  },
  {
    label: "FRAME 03 · HUMAN SCALE",
    title: "Small against the line",
    copy: "The path narrows above the loch. Slow is not a setback here. Slow is how the day stays yours.",
    image: "tryfan.jpg",
    accent: "#92b9d2",
    meta: "11:26 · Tryfan East Ridge",
  },
  {
    label: "FRAME 04 · SUMMIT LOG",
    title: "A view earned honestly",
    copy: "Wind, wet gloves, a long pause. The summit is the final frame, not the whole story.",
    image: "mont-blanc.jpg",
    accent: "#e5c680",
    meta: "14:03 · Mont Blanc route",
  },
];

export function EditorialDocumentaryDispatch() {
  const [saved, setSaved] = useState(false);
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = dispatches[active];

  return (
    <main
      className="sr-screen"
      style={{
        background: "#07151d",
        overflowY: "auto",
        overflowX: "hidden",
        height: "844px",
        color: "#eff5f2",
      }}
    >
      <div style={{ minHeight: "100%", paddingBottom: 78 }}>
        <header
          style={{
            height: 66,
            padding: "16px 18px 8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "linear-gradient(#07151df5, #07151dce)",
            backdropFilter: "blur(12px)",
          }}
        >
          <button aria-label="Back to explore" style={iconButton} onClick={() => undefined}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ font: "700 11px 'Space Grotesk'", letterSpacing: "2.2px" }}>SUMMITREADY</div>
            <div style={{ color: "#91a6ae", fontSize: 8, letterSpacing: "1.6px", marginTop: 3 }}>FIELD NOTES</div>
          </div>
          <button
            aria-label={saved ? "Remove saved dispatch" : "Save dispatch"}
            style={{ ...iconButton, color: saved ? "#4de4ae" : "#e9efec" }}
            onClick={() => setSaved((value) => !value)}
          >
            <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
          </button>
        </header>

        <section style={{ padding: "15px 19px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }}>
            <div style={{ color: "#51dda9", font: "700 9px 'Space Grotesk'", letterSpacing: "1.8px" }}>EDITORIAL / 04</div>
            <div style={{ color: "#a9b8bc", fontSize: 9 }}>A FIELD REPORT</div>
          </div>
          <h1 style={{ font: "700 30px/29px 'Space Grotesk'", letterSpacing: "-1.2px", margin: 0, maxWidth: 315 }}>
            The mountain,<br /><span style={{ color: "#7de4bb" }}>as it really is.</span>
          </h1>
          <p style={{ color: "#b7c5c8", lineHeight: "16px", fontSize: 11, margin: "11px 0 0", maxWidth: 322 }}>
            Four reusable image treatments for the days that do not fit in a highlight reel.
          </p>
        </section>

        <section style={{ padding: "0 19px" }}>
          <div
            style={{
              height: 262,
              borderRadius: 12,
              position: "relative",
              overflow: "hidden",
              border: "1px solid #33505a",
              background: "#15262e",
              boxShadow: "0 12px 28px #02080b70",
            }}
          >
            <img
              src={img(current.image)}
              alt={`${current.title} in the field`}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(.82) contrast(1.05)" }}
            />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg,#07151d18 28%,#07151de8 100%)" }} />
            <div style={{ position: "absolute", left: 14, top: 14, right: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ ...tag, borderColor: current.accent, color: current.accent }}>{current.label}</span>
              <span style={{ color: "#e7efed", fontSize: 9, background: "#07151db8", padding: "5px 7px", borderRadius: 4 }}>LIVE NOTE</span>
            </div>
            <div style={{ position: "absolute", left: 15, right: 15, bottom: 16 }}>
              <div style={{ color: "#b7c5c8", fontSize: 9, letterSpacing: ".5px", display: "flex", gap: 5, alignItems: "center" }}>
                <MapPin size={11} color={current.accent} /> {current.meta}
              </div>
              <h2 style={{ margin: "6px 0 5px", font: "700 24px/24px 'Space Grotesk'", letterSpacing: "-.7px" }}>{current.title}</h2>
              <p style={{ margin: 0, color: "#d4dedf", fontSize: 10, lineHeight: "14px", maxWidth: 292 }}>{current.copy}</p>
            </div>
            <button
              aria-label="Play field sequence"
              onClick={() => setPlaying((value) => !value)}
              style={{ position: "absolute", right: 14, bottom: 17, width: 33, height: 33, borderRadius: "50%", border: `1px solid ${current.accent}`, color: current.accent, background: "#0a2426d9", display: "grid", placeItems: "center" }}
            >
              {playing ? <Check size={15} /> : <Play size={14} fill="currentColor" />}
            </button>
          </div>
          <div style={{ display: "flex", gap: 5, marginTop: 9 }}>
            {dispatches.map((item, index) => (
              <button
                key={item.label}
                aria-label={`Show ${item.title}`}
                onClick={() => { setActive(index); setPlaying(false); }}
                style={{ height: 4, flex: 1, padding: 0, border: 0, borderRadius: 4, background: index === active ? item.accent : "#29404a", transition: "background .2s ease" }}
              />
            ))}
          </div>
        </section>

        <section style={{ padding: "18px 19px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ font: "700 14px 'Space Grotesk'" }}>Four ways to report back</div>
              <div style={{ fontSize: 9, color: "#91a6ae", marginTop: 3 }}>A modular visual language for every outing</div>
            </div>
            <ImageIcon size={17} color="#50dca9" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {dispatches.map((item, index) => (
              <button
                key={item.label}
                onClick={() => { setActive(index); setPlaying(false); }}
                style={{
                  textAlign: "left", padding: 0, borderRadius: 8, overflow: "hidden", border: index === active ? `1px solid ${item.accent}` : "1px solid #24404a",
                  background: "#0b2029", color: "#eef3f1", cursor: "pointer", transition: "border-color .2s ease, transform .2s ease",
                }}
              >
                <div style={{ height: 70, position: "relative", overflow: "hidden" }}>
                  <img src={img(item.image)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: "saturate(.7)" }} />
                  <div style={{ position: "absolute", inset: 0, background: "#07151d42" }} />
                  <span style={{ position: "absolute", top: 7, left: 7, color: item.accent, font: "700 8px 'Space Grotesk'", letterSpacing: "1px" }}>0{index + 1}</span>
                </div>
                <div style={{ padding: "8px 8px 9px" }}>
                  <div style={{ font: "700 10px 'Space Grotesk'" }}>{item.title}</div>
                  <div style={{ color: "#91a6ae", fontSize: 8, marginTop: 3 }}>{item.meta.split("·")[0].trim()}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section style={{ margin: "18px 19px 0", padding: "12px 13px", borderRadius: 9, background: "#0b2028", border: "1px solid #203b45", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 31, height: 31, borderRadius: 8, background: "#103a35", display: "grid", placeItems: "center", color: "#51dda9", flex: "0 0 auto" }}><Compass size={16} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ font: "700 10px 'Space Grotesk'" }}>Built for the field, not the feed</div>
            <div style={{ color: "#91a6ae", fontSize: 8, lineHeight: "12px", marginTop: 3 }}>Honest conditions make useful stories.</div>
          </div>
          <button aria-label="Share field report" onClick={() => undefined} style={{ background: "none", border: 0, color: "#b8c8c9", padding: 5 }}><Share2 size={15} /></button>
        </section>
      </div>
      <nav className="bottom-nav" aria-label="Primary navigation" style={{ position: "sticky", bottom: 0 }}>
        {[
          ["Basecamp", Mountain],
          ["Explore", Compass],
          ["Track", Navigation],
          ["You", Wind],
        ].map(([label, Icon]) => (
          <button key={label as string} className={label === "Explore" ? "current" : ""} onClick={() => undefined}>
            <span className="nav-icon"><Icon size={19} /></span><small>{label as string}</small>
          </button>
        ))}
      </nav>
      <div className="home-indicator" />
    </main>
  );
}

const iconButton: CSSProperties = {
  border: "1px solid #29434e",
  background: "#10252e",
  color: "#edf4f1",
  width: 34,
  height: 34,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
};

const tag: CSSProperties = {
  border: "1px solid",
  background: "#07151dcc",
  borderRadius: 3,
  padding: "5px 7px",
  font: "700 8px 'Space Grotesk'",
  letterSpacing: "1px",
};