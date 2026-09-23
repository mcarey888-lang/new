import { useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronRight,
  Compass,
  Crosshair,
  Footprints,
  Heart,
  Layers3,
  MapPin,
  Mountain,
  Navigation,
  Share2,
  SlidersHorizontal,
  Sparkles,
  TentTree,
} from "lucide-react";
import "./_group.css";

const img = (name: string) => `/__mockup/images/summitready-explore/${name}`;

const treatments = [
  { id: "contour", kicker: "01 / TERRAIN", title: "Contour Cut", image: "mont-blanc.jpg", accent: "#b8f26b" },
  { id: "route", kicker: "02 / MOVEMENT", title: "Route Ledger", image: "tryfan.jpg", accent: "#7fe1d0" },
  { id: "field", kicker: "03 / OBSERVATION", title: "Field Note", image: "snowdon.jpg", accent: "#f5bb72" },
  { id: "index", kicker: "04 / REFERENCE", title: "Summit Index", image: "matterhorn.jpg", accent: "#d6a2ff" },
];

export function EditorialTopographicStory() {
  const [active, setActive] = useState("contour");
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const selected = treatments.find((item) => item.id === active) ?? treatments[0];

  return (
    <main className="et-screen">
      <div className="et-status"><span>9:41</span><span>▮▮▮ ◔ <b>100</b></span></div>
      <header className="et-header">
        <button className="et-icon-button" aria-label="Back"><ArrowLeft size={18} /></button>
        <div className="et-title-lockup"><span className="et-mark">⌃⌃</span><div><strong>SUMMITREADY</strong><small>FIELD ATLAS / EDITORIALS</small></div></div>
        <button className={`et-icon-button ${saved ? "is-saved" : ""}`} aria-label="Save collection" onClick={() => setSaved(!saved)}><Bookmark size={17} fill={saved ? "currentColor" : "none"} /></button>
      </header>

      <section className="et-intro">
        <div className="et-eyebrow"><span className="et-live-dot" /> COLLECTION 04 <span className="et-rule" /> 4 PLATES</div>
        <h1>Read the<br /><em>mountain.</em></h1>
        <p>Four editorial treatments for routes that deserve more than a pin on a map.</p>
        <div className="et-intro-meta"><span><Layers3 size={13} /> Topographic stories</span><span>Updated 18 Jun 2024</span></div>
      </section>

      <section className="et-feature" aria-label="Selected editorial treatment">
        <div className="et-photo-wrap">
          <img src={img(selected.image)} alt={`${selected.title} treatment featuring mountain terrain`} />
          <div className="et-photo-wash" />
          <div className="et-coordinates"><Crosshair size={12} /> 45°55′N&nbsp; 6°52′E</div>
          <div className="et-plate-number">PLATE {String(treatments.findIndex((x) => x.id === active) + 1).padStart(2, "0")}</div>
          <button className={`et-heart ${liked ? "liked" : ""}`} aria-label="Like treatment" onClick={() => setLiked(!liked)}><Heart size={15} fill={liked ? "currentColor" : "none"} /></button>
          <svg className="et-contours" viewBox="0 0 390 160" preserveAspectRatio="none" aria-hidden="true"><path d="M-15 115 C50 65 85 153 153 102 S286 57 410 98" /><path d="M-20 138 C55 88 93 174 170 119 S292 82 417 115" /><path d="M-12 93 C45 43 97 127 158 81 S298 37 414 77" /><path d="M10 155 C92 114 128 182 198 139 S311 112 402 136" /></svg>
        </div>
        <div className="et-feature-copy">
          <div className="et-feature-kicker" style={{ color: selected.accent }}>{selected.kicker}</div>
          <h2>{selected.title}</h2>
          <p>{active === "contour" ? "Let elevation shape the frame. A quiet topographic layer turns the approach into a readable landscape." : active === "route" ? "Make the trace the protagonist. Every bend carries the evidence of a day spent moving uphill." : active === "field" ? "A compact observation card for weather, footing, and the small decisions that make a summit day." : "A disciplined reference plate: coordinates, grade, distance, and the one fact worth remembering."}</p>
          <div className="et-data-row"><span><strong>4,808</strong><small>METRES</small></span><span><strong>10.8</strong><small>KM TO SUMMIT</small></span><span><strong>+1,450</strong><small>ASCENT</small></span></div>
        </div>
      </section>

      <div className="et-selector-head"><div><span>THE LIBRARY</span><strong>Choose a treatment</strong></div><button onClick={() => setShowAll(!showAll)}>{showAll ? "Close" : "View all"} <ChevronRight size={14} /></button></div>
      <div className={`et-treatment-list ${showAll ? "expanded" : ""}`}>
        {treatments.map((item) => (
          <button key={item.id} className={`et-treatment ${active === item.id ? "active" : ""}`} onClick={() => setActive(item.id)}>
            <span className="et-thumb"><img src={img(item.image)} alt="" /><span className="et-thumb-lines" /></span>
            <span className="et-treatment-text"><small>{item.kicker}</small><strong>{item.title}</strong><span>{item.id === "contour" ? "Layered elevation" : item.id === "route" ? "Trace + tempo" : item.id === "field" ? "Human observations" : "Compact reference"}</span></span>
            {active === item.id && <Check size={16} className="et-check" />}
          </button>
        ))}
      </div>

      <div className="et-footer-note"><Sparkles size={14} /><span>Designed for the moments between planning and going.</span><button aria-label="Share collection"><Share2 size={15} /></button></div>
      <nav className="et-bottom-nav" aria-label="Primary navigation">
        <button><TentTree size={19} /><small>Basecamp</small></button><button className="current"><Compass size={19} /><small>Explore</small></button><button><Footprints size={19} /><small>Track</small></button><button><Mountain size={19} /><small>Expeditions</small></button><button><Navigation size={19} /><small>You</small></button>
      </nav>
      <div className="et-home-indicator" />
      <style>{`
        .et-screen{width:390px;height:844px;position:relative;overflow:hidden;background:#08151b;color:#f4f7f4;font-family:'DM Sans',sans-serif;font-size:11px;letter-spacing:-.01em}
        .et-screen *{box-sizing:border-box}.et-status{height:29px;padding:10px 20px 0;display:flex;justify-content:space-between;font-weight:700;font-size:13px}.et-status span:last-child{font-size:10px;letter-spacing:1px}.et-status b{border:1px solid #bfcbd0;border-radius:4px;padding:1px 2px;letter-spacing:-1px}
        .et-header{height:50px;display:flex;align-items:center;justify-content:space-between;padding:0 19px;border-bottom:1px solid #29404a}.et-icon-button{border:0;background:#112731;color:#dbe6e5;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;transition:transform .2s,background .2s}.et-icon-button:active{transform:scale(.92)}.et-icon-button.is-saved{background:#183b30;color:#b8f26b}.et-title-lockup{display:flex;align-items:center;gap:8px}.et-mark{font-size:21px;line-height:18px;transform:scaleX(1.2);color:#dfeae8}.et-title-lockup strong{display:block;font:700 11px 'Space Grotesk';letter-spacing:2.8px}.et-title-lockup small{display:block;font-size:5px;letter-spacing:1.7px;color:#99abb0;margin-top:3px}
        .et-intro{padding:20px 23px 14px}.et-eyebrow{display:flex;align-items:center;gap:7px;color:#a9bdba;font-size:8px;letter-spacing:1.7px;font-weight:700}.et-live-dot{width:5px;height:5px;border-radius:50%;background:#b8f26b;box-shadow:0 0 0 3px #b8f26b22}.et-rule{height:1px;width:30px;background:#39535a}.et-intro h1{font:700 32px/29px 'Space Grotesk';letter-spacing:-1.5px;margin:12px 0 8px}.et-intro h1 em{font-family:'Instrument Serif',Georgia,serif;font-size:38px;font-weight:400;color:#b8f26b;letter-spacing:-1px}.et-intro p{margin:0;width:290px;color:#b8c8c8;font-size:11px;line-height:15px}.et-intro-meta{display:flex;justify-content:space-between;margin-top:11px;color:#71878b;font-size:8px;letter-spacing:.2px}.et-intro-meta span:first-child{display:flex;align-items:center;gap:4px;color:#a7bcba}
        .et-feature{margin:0 19px;border:1px solid #31515a;border-radius:10px;background:#0e232b;overflow:hidden;box-shadow:0 9px 20px #0003}.et-photo-wrap{height:160px;position:relative;overflow:hidden}.et-photo-wrap img{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(.82) contrast(1.06)}.et-photo-wash{position:absolute;inset:0;background:linear-gradient(180deg,#07161b22 25%,#07151bd9 100%)}.et-coordinates{position:absolute;top:11px;left:12px;display:flex;align-items:center;gap:5px;color:#d6e6df;font:9px 'Space Mono',monospace;letter-spacing:.3px}.et-plate-number{position:absolute;right:12px;top:12px;color:#d9e8e5;font:8px 'Space Mono',monospace;letter-spacing:1px}.et-heart{position:absolute;right:10px;bottom:10px;width:28px;height:28px;border:1px solid #d4e1de77;border-radius:50%;background:#102b31aa;color:#edf4ef;display:grid;place-items:center;transition:color .2s,transform .2s}.et-heart:active{transform:scale(.9)}.et-heart.liked{color:#f28f8d}.et-contours{position:absolute;bottom:0;left:0;width:100%;height:72%;fill:none;stroke:#b8f26b66;stroke-width:1.3}.et-feature-copy{padding:11px 13px 12px}.et-feature-kicker{font:8px 'Space Mono',monospace;letter-spacing:1.5px}.et-feature-copy h2{font:700 21px 'Space Grotesk';margin:3px 0 3px}.et-feature-copy p{font-size:10px;line-height:13px;color:#afc2c1;margin:0;max-width:305px}.et-data-row{display:flex;gap:23px;margin-top:11px;border-top:1px solid #29434b;padding-top:8px}.et-data-row span{display:flex;flex-direction:column;gap:2px}.et-data-row strong{font:700 13px 'Space Mono',monospace;color:#e9f2ec}.et-data-row small{font-size:7px;color:#779097;letter-spacing:.6px}
        .et-selector-head{display:flex;align-items:center;justify-content:space-between;padding:15px 21px 7px}.et-selector-head div{display:flex;flex-direction:column;gap:3px}.et-selector-head span{font:8px 'Space Mono',monospace;letter-spacing:1.5px;color:#7f979a}.et-selector-head strong{font:700 15px 'Space Grotesk'}.et-selector-head button{border:0;background:none;color:#b8f26b;font-size:10px;display:flex;align-items:center;gap:2px}
        .et-treatment-list{display:flex;gap:7px;padding:0 19px;overflow:hidden}.et-treatment-list.expanded{overflow:visible}.et-treatment{position:relative;display:flex;flex:1;min-width:0;height:71px;border:1px solid #29434b;border-radius:7px;background:#0d222a;color:#eff6f1;padding:5px;text-align:left;gap:7px;transition:border-color .2s,transform .2s,background .2s}.et-treatment:active{transform:translateY(1px)}.et-treatment.active{border-color:#b8f26b;background:#122c2c}.et-thumb{position:relative;width:44px;height:59px;flex:none;overflow:hidden;border-radius:4px}.et-thumb img{width:100%;height:100%;object-fit:cover;filter:saturate(.75)}.et-thumb-lines{position:absolute;inset:35% 0 0;background:linear-gradient(transparent,#10292e99)}.et-treatment-text{display:flex;flex-direction:column;min-width:0;padding-top:2px;gap:2px}.et-treatment-text small{font:6px 'Space Mono',monospace;color:#9aadac;letter-spacing:.7px}.et-treatment-text strong{font:700 11px 'Space Grotesk';white-space:nowrap}.et-treatment-text>span{font-size:8px;color:#88a2a2;white-space:nowrap}.et-check{position:absolute;right:5px;top:5px;color:#b8f26b}.et-treatment-list:not(.expanded) .et-treatment:nth-child(n+4){display:none}
        .et-footer-note{margin:12px 22px 0;padding-top:10px;border-top:1px solid #203943;color:#80989a;font-size:9px;display:flex;align-items:center;gap:7px}.et-footer-note svg:first-child{color:#b8f26b}.et-footer-note button{margin-left:auto;border:0;background:none;color:#b8f26b;display:grid;place-items:center}.et-bottom-nav{position:absolute;z-index:5;bottom:0;left:0;right:0;height:75px;background:#071721ed;border-top:1px solid #1a303c;display:flex;justify-content:space-around;padding-top:8px}.et-bottom-nav button{width:68px;border:0;background:none;color:#84959e;display:flex;align-items:center;flex-direction:column;gap:3px}.et-bottom-nav small{font-size:9px}.et-bottom-nav button.current{color:#b8f26b}.et-bottom-nav button.current svg{background:#21473b;border-radius:50%;padding:6px;width:29px;height:29px}.et-home-indicator{position:absolute;bottom:7px;left:164px;width:62px;height:4px;background:#f3f5f5;border-radius:3px;z-index:6}
      `}</style>
    </main>
  );
}