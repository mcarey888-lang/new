import { useState } from "react";
import {
  ArrowLeft, CalendarDays, Check, ChevronRight, CircleCheck, Clock3,
  Footprints, Mountain, MoreHorizontal, Share2, ShieldCheck, Star,
} from "lucide-react";
import "./_group.css";

const image = (name: string) => `/__mockup/images/summitready-explore/${name}`;

const entries = [
  {
    date: "18 MAY 2025",
    title: "The long way to Ben Nevis",
    place: "Glen Nevis · Scotland",
    note: "Rain on the first ridge, clear air above the cloud line. Kept the pace steady all the way to the trig point.",
    image: "ben-nevis.jpg",
    stat: "1,345 m",
    time: "6h 42m",
    accent: "#85e6bd",
  },
  {
    date: "02 MAR 2025",
    title: "A winter day on Tryfan",
    place: "Ogwen Valley · Wales",
    note: "Cold fingers, blue sky, and a quiet summit. The first time the scramble felt like a conversation instead of a test.",
    image: "tryfan.jpg",
    stat: "918 m",
    time: "5h 18m",
    accent: "#e7bd70",
  },
];

export function AchievementFieldJournal() {
  const [tab, setTab] = useState<"field notes" | "milestones">("field notes");
  const [expanded, setExpanded] = useState<number | null>(0);
  const [saved, setSaved] = useState(false);

  return (
    <main className="sr-journal" style={{ background: "#08171b", color: "#f4f1e9", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="journal-status"><span>9:41</span><span>▮▮▮ ◔ <b>100</b></span></div>
      <header className="journal-header">
        <button className="journal-icon" aria-label="Back"><ArrowLeft size={18} /></button>
        <div className="journal-brand"><span className="journal-mark">⌃⌃</span><span><strong>SUMMITREADY</strong><small>PERSONAL FIELD LOG</small></span></div>
        <button className="journal-icon" aria-label="More options"><MoreHorizontal size={20} /></button>
      </header>

      <section className="journal-intro">
        <p className="journal-kicker"><span className="kicker-line" /> FIELD JOURNAL</p>
        <h1>Proof of<br /><em>the places.</em></h1>
        <p className="journal-dek">A record of the days you chose the trail, kept in your own words.</p>
        <div className="journal-count">
          <div><strong>07</strong><span>PEAKS LOGGED</span></div>
          <div className="count-rule" />
          <div><strong>42.8</strong><span>KM THIS YEAR</span></div>
          <div className="count-rule" />
          <div><strong>03</strong><span>FIRSTS</span></div>
        </div>
      </section>

      <div className="journal-tabs" role="tablist">
        {(["field notes", "milestones"] as const).map((label) => (
          <button key={label} className={tab === label ? "active" : ""} onClick={() => setTab(label)} role="tab">
            {label}<span>{label === "field notes" ? "07" : "03"}</span>
          </button>
        ))}
      </div>

      <section className="journal-scroll">
        {tab === "field notes" ? (
          <>
            <div className="year-stamp"><span>2025</span><i>Most recent first</i></div>
            {entries.map((entry, index) => {
              const isOpen = expanded === index;
              return (
                <article className={`field-entry ${isOpen ? "open" : ""}`} key={entry.title}>
                  <div className="entry-date"><CalendarDays size={12} />{entry.date}</div>
                  <div className="entry-card">
                    <div className="entry-photo"><img src={image(entry.image)} alt="" /><span className="photo-stamp">SUMMITREADY<br /><b>FIELD NOTE</b></span><span className="elevation">{entry.stat}</span></div>
                    <div className="entry-content">
                      <p className="entry-place"><Mountain size={12} /> {entry.place}</p>
                      <h2>{entry.title}</h2>
                      <p className="entry-note">{entry.note}</p>
                      <div className="entry-meta"><span><Clock3 size={12} /> {entry.time}</span><span><Footprints size={12} /> Completed</span></div>
                      <div className="entry-actions">
                        <button onClick={() => setExpanded(isOpen ? null : index)}>{isOpen ? "Close note" : "Read field note"} <ChevronRight size={14} className={isOpen ? "rotate" : ""} /></button>
                        <button className="share" aria-label="Share field note"><Share2 size={15} /></button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
            <div className="archive-hint"><div className="archive-dot"><Check size={13} /></div><span><strong>Your logbook is growing.</strong><br />Next entry: Snowdon · planned for 14 June</span></div>
          </>
        ) : (
          <div className="milestones">
            <div className="year-stamp"><span>THE SHORT LIST</span><i>earned, not counted</i></div>
            {[
              ["First summit", "Ben Nevis · 18 May 2025", "A day that changed the shape of the year.", ShieldCheck],
              ["Three peaks in a season", "Scotland · 2024", "Three weather windows. One stubborn summer.", Star],
              ["100 km on foot", "Training log · 2024", "The quiet miles are still miles.", CircleCheck],
            ].map(([title, sub, copy, Icon]) => <div className="milestone-row" key={String(title)}><div className="milestone-icon"><Icon size={18} /></div><div><p>{String(title)}</p><span>{String(sub)}</span><small>{String(copy)}</small></div><ChevronRight size={15} /></div>)}
          </div>
        )}
      </section>

      <nav className="journal-nav">
        <button><Mountain size={19} /><small>Basecamp</small></button>
        <button><Footprints size={19} /><small>Track</small></button>
        <button className="current"><div><Star size={17} /></div><small>Journal</small></button>
        <button><CircleCheck size={19} /><small>Plan</small></button>
        <button onClick={() => setSaved(!saved)}><span className={`profile-ring ${saved ? "saved" : ""}`}>AR</span><small>You</small></button>
      </nav>
      <div className="journal-home" />
      <style>{`
        .sr-journal{width:390px;height:844px;overflow:hidden;position:relative;background:#08171b;letter-spacing:-.015em}
        .sr-journal button{font:inherit;cursor:pointer}.journal-status{height:29px;padding:10px 20px 0;display:flex;justify-content:space-between;font-size:12px;font-weight:700}.journal-status span:last-child{font-size:9px;letter-spacing:1px}.journal-status b{border:1px solid #b7c6c6;border-radius:4px;padding:1px 2px;letter-spacing:-1px}
        .journal-header{height:55px;padding:0 19px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #234047}.journal-icon{width:34px;height:34px;border:1px solid #35545a;background:#10272b;color:#eaf1ed;border-radius:50%;display:grid;place-items:center}.journal-brand{display:flex;align-items:center;gap:7px}.journal-mark{font-size:24px;line-height:18px;transform:scaleX(1.2);color:#dfe9e4}.journal-brand strong{display:block;font:700 11px 'Space Grotesk';letter-spacing:2.6px}.journal-brand small{display:block;font-size:5px;letter-spacing:1.7px;color:#91aaa6;margin-top:3px}
        .journal-intro{padding:19px 24px 14px;background:linear-gradient(130deg,#0e2729,#0a1d21 55%,#132d2b)}.journal-kicker{margin:0 0 8px;color:#88d9b4;font:600 9px 'Space Grotesk';letter-spacing:2px;display:flex;align-items:center;gap:7px}.kicker-line{width:21px;height:1px;background:#52c995}.journal-intro h1{font:700 30px/28px 'Space Grotesk';letter-spacing:-1.5px;margin:0;color:#f4f1e9}.journal-intro h1 em{font-family:Georgia,serif;font-weight:400;color:#bde5cf}.journal-dek{font-size:11px;line-height:15px;color:#afc4c0;max-width:270px;margin:9px 0 14px}.journal-count{display:flex;align-items:center;gap:14px}.journal-count div:not(.count-rule){display:flex;flex-direction:column}.journal-count strong{font:700 17px 'Space Grotesk';color:#ecf5ef}.journal-count span{font-size:7px;letter-spacing:.8px;color:#86a49e;margin-top:2px}.count-rule{width:1px;height:25px;background:#31534f}
        .journal-tabs{height:44px;display:flex;gap:23px;padding:0 20px;border-bottom:1px solid #28434a;background:#091a1f}.journal-tabs button{border:0;border-bottom:2px solid transparent;background:none;color:#7c9598;text-transform:uppercase;font:600 9px 'Space Grotesk';letter-spacing:1.2px;display:flex;align-items:center;gap:6px}.journal-tabs button span{color:#587476;font-size:8px}.journal-tabs button.active{color:#dff0e7;border-color:#58d6a0}.journal-tabs button.active span{color:#7be6b7}
        .journal-scroll{height:580px;overflow-y:auto;padding:15px 19px 90px}.year-stamp{display:flex;justify-content:space-between;align-items:center;margin-bottom:9px}.year-stamp span{font:700 12px 'Space Grotesk';letter-spacing:1px;color:#d3e0da}.year-stamp i{font:italic 10px Georgia,serif;color:#75918d}.field-entry{margin-bottom:17px}.entry-date{display:flex;align-items:center;gap:5px;color:#82b8a2;font:600 8px 'Space Grotesk';letter-spacing:1.4px;margin:0 0 6px 3px}.entry-card{border:1px solid #284a4d;background:#102429;border-radius:10px;overflow:hidden;box-shadow:0 8px 20px #00000025}.entry-photo{height:113px;position:relative;overflow:hidden;background:#173136}.entry-photo img{width:100%;height:100%;object-fit:cover;filter:saturate(.78) contrast(1.05)}.entry-photo:after{content:'';position:absolute;inset:0;background:linear-gradient(0deg,#07171bcc,transparent 60%)}.photo-stamp{position:absolute;z-index:1;left:10px;top:9px;color:#e9efe8;border:1px solid #d8e4db88;padding:4px 5px;font:6px 'Space Mono',monospace;letter-spacing:1px;line-height:8px}.photo-stamp b{color:#90dfb6;font-weight:400}.elevation{position:absolute;z-index:1;right:10px;bottom:8px;font:700 19px 'Space Grotesk';color:#f4f3e8}.entry-content{padding:10px 12px 11px}.entry-place{display:flex;align-items:center;gap:4px;color:#87beaa;font-size:9px;margin:0 0 4px}.entry-content h2{font:700 17px/19px 'Space Grotesk';margin:0;color:#f2f1e9}.entry-note{font:11px/15px Georgia,serif;color:#bbcbc5;margin:6px 0 8px;max-width:322px}.entry-meta{display:flex;gap:13px;color:#7e9a97;font-size:9px;padding-bottom:9px;border-bottom:1px solid #294047}.entry-meta span{display:flex;gap:4px;align-items:center}.entry-meta svg{color:#67d1a3}.entry-actions{display:flex;justify-content:space-between;align-items:center;padding-top:8px}.entry-actions button{border:0;background:none;color:#92e1bb;padding:3px 0;font-size:10px;display:flex;align-items:center;gap:4px}.entry-actions .share{border:1px solid #38535a;color:#a8c1bb;border-radius:50%;width:27px;height:27px;display:grid;place-items:center;padding:0}.rotate{transform:rotate(90deg)}.archive-hint{border-top:1px dashed #36504d;margin-top:5px;padding:15px 4px;display:flex;gap:10px;color:#87a19c;font:10px/14px Georgia,serif}.archive-hint strong{color:#c8ddd2;font-family:'DM Sans',sans-serif;font-size:10px}.archive-dot{width:22px;height:22px;border:1px solid #3c7060;border-radius:50%;display:grid;place-items:center;color:#6ed7a7;flex:none}
        .milestones{padding-top:1px}.milestone-row{min-height:74px;border-bottom:1px solid #263e43;display:flex;align-items:center;gap:11px}.milestone-icon{width:37px;height:37px;border-radius:50%;background:#163832;border:1px solid #347d68;color:#8be0b6;display:grid;place-items:center;flex:none}.milestone-row div:nth-child(2){display:flex;flex-direction:column;flex:1}.milestone-row p{font:700 13px 'Space Grotesk';margin:0 0 2px}.milestone-row span{color:#88aaa1;font-size:9px}.milestone-row small{font:italic 10px Georgia,serif;color:#b5c6be;margin-top:4px}.milestone-row>svg{color:#70918a}
        .journal-nav{position:absolute;z-index:5;bottom:0;left:0;right:0;height:76px;background:#081a20f2;border-top:1px solid #234047;display:flex;justify-content:space-around;padding-top:8px}.journal-nav button{width:60px;border:0;background:none;color:#779093;display:flex;align-items:center;flex-direction:column;gap:4px}.journal-nav button small{font-size:9px}.journal-nav button.current{color:#65dca8}.journal-nav button.current div{width:29px;height:29px;border-radius:50%;background:#104538;display:grid;place-items:center}.profile-ring{height:27px;width:27px;border:1px solid #7a9d93;border-radius:50%;display:grid;place-items:center;font:700 8px 'Space Grotesk';color:#d7e6de}.profile-ring.saved{border-color:#69d8a8;color:#69d8a8;background:#12382f}.journal-home{position:absolute;bottom:7px;left:164px;width:62px;height:4px;background:#edf4ef;border-radius:3px;z-index:6}
      `}</style>
    </main>
  );
}