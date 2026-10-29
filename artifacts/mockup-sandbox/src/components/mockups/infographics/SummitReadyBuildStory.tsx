import React from "react";

const styles = `
  @page { size: 1080px 1600px; margin: 0; }
  * { box-sizing: border-box; }
  .sr-poster {
    --ink: #102b3a; --muted: #526b72; --pine: #196553; --mint: #b9dfc6;
    --sky: #c6e2e5; --paper: #f4f2e9; --line: rgba(16,43,58,.19);
    position: relative; width: 1080px; height: 1600px; overflow: hidden;
    margin: 0 auto; color: var(--ink); background: var(--paper);
    font-family: "DM Sans", "Avenir Next", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .sr-poster:before {
    content:""; position:absolute; inset:0; pointer-events:none; opacity:.22;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.13'/%3E%3C/svg%3E");
    mix-blend-mode:multiply; z-index:5;
  }
  .sr-inner { height:100%; padding:48px 58px 38px; display:flex; flex-direction:column; position:relative; z-index:1; }
  .sr-top { height:40px; display:flex; justify-content:space-between; align-items:center; font-size:14px; font-weight:800; letter-spacing:.15em; text-transform:uppercase; }
  .sr-brand { display:flex; align-items:center; gap:12px; }
  .sr-mark { width:31px; height:25px; }
  .sr-edition { color:#48656b; font:600 12px "Spline Sans Mono",monospace; letter-spacing:.05em; }
  .sr-hero { height:360px; margin:25px -58px 0; padding:45px 58px 0; position:relative; overflow:hidden; background:linear-gradient(180deg,#d9ece9 0%,#d3e4df 43%,#c4d7c9 100%); }
  .sr-hero:after { content:""; position:absolute; left:0; right:0; bottom:0; height:128px; background:linear-gradient(0deg,rgba(16,43,58,.08),transparent); }
  .sr-kicker { font:700 13px "Spline Sans Mono",monospace; letter-spacing:.16em; text-transform:uppercase; color:#236955; position:relative; z-index:2; }
  .sr-title { position:relative; z-index:2; font-size:78px; letter-spacing:-.075em; line-height:.92; font-weight:800; margin:16px 0 13px; }
  .sr-title span { color:#216d58; }
  .sr-deck { position:absolute; z-index:3; left:0; right:0; bottom:0; padding:11px 58px; font-size:16px; line-height:1.35; font-weight:500; margin:0; color:#f4f2e9; background:#102b3a; }
  .sr-mountains { position:absolute; z-index:1; left:0; bottom:-1px; width:100%; height:175px; }
  .sr-hero-note { position:absolute; right:62px; bottom:77px; z-index:3; font:700 11px "Spline Sans Mono",monospace; letter-spacing:.13em; text-transform:uppercase; color:#f3f3e7; }
  .sr-section-label { display:flex; align-items:center; gap:12px; font:700 12px "Spline Sans Mono",monospace; letter-spacing:.15em; color:#47706b; text-transform:uppercase; }
  .sr-section-label:after { content:""; height:1px; background:var(--line); flex:1; }
  .sr-proof { padding:30px 0 27px; }
  .sr-proof-grid { display:grid; grid-template-columns:1.2fr 1fr 1fr 1fr; margin-top:18px; border-top:1px solid var(--line); border-bottom:1px solid var(--line); }
  .sr-stat { padding:19px 14px 18px 0; min-height:125px; position:relative; }
  .sr-stat:not(:last-child) { border-right:1px solid var(--line); margin-right:18px; }
  .sr-stat strong { display:block; font-size:47px; line-height:.96; letter-spacing:-.07em; font-weight:800; color:#153d49; }
  .sr-stat:first-child strong { font-size:59px; color:#17644f; }
  .sr-stat span { display:block; margin-top:10px; font-size:14px; line-height:1.25; color:#435d65; font-weight:600; }
  .sr-stat small { display:block; margin-top:5px; color:#637b7f; font:10px "Spline Sans Mono",monospace; }
  .sr-measure { font:600 11px "Spline Sans Mono",monospace; color:#6c7e7c; margin-top:12px; }
  .sr-architecture { padding:3px 0 22px; }
  .sr-architecture-head { display:flex; align-items:flex-end; justify-content:space-between; margin:12px 0 15px; }
  .sr-architecture h2 { font-size:29px; letter-spacing:-.045em; line-height:1.05; margin:0; max-width:550px; }
  .sr-architecture-head p { margin:0; font-size:13px; color:#5f7474; max-width:260px; line-height:1.35; text-align:right; }
  .sr-system { min-height:365px; border:1px solid #b7cbc2; background:#e8ede4; display:grid; grid-template-columns:1fr 245px; overflow:hidden; }
  .sr-system-main { position:relative; padding:20px 20px 17px; }
  .sr-system-main:before { content:""; position:absolute; inset:0; opacity:.23; background:repeating-radial-gradient(ellipse at 15% 80%, transparent 0 25px, #9bb7aa 26px 27px, transparent 28px 50px); }
  .sr-stack { position:relative; z-index:1; display:flex; flex-direction:column; gap:8px; }
  .sr-layer { display:grid; grid-template-columns:111px 1fr; min-height:65px; border:1px solid rgba(16,43,58,.2); background:rgba(250,250,242,.88); }
  .sr-layer-name { display:flex; flex-direction:column; justify-content:center; padding:8px 11px; border-right:1px solid rgba(16,43,58,.17); background:#dce8db; }
  .sr-layer-name b { font-size:15px; letter-spacing:-.025em; }
  .sr-layer-name small { margin-top:3px; color:#58736b; font:9px "Spline Sans Mono",monospace; text-transform:uppercase; letter-spacing:.04em; }
  .sr-pills { display:flex; flex-wrap:wrap; align-content:center; align-items:center; gap:6px; padding:8px 10px; }
  .sr-pill { border:1px solid #c4d2c7; border-radius:2px; padding:5px 7px; color:#294d4d; background:#f4f4ea; font-size:11px; line-height:1; font-weight:650; white-space:nowrap; }
  .sr-system-side { background:#173b49; color:#e8efe5; padding:23px 20px; display:flex; flex-direction:column; justify-content:space-between; }
  .sr-side-kicker { color:#a8d4b5; font:700 10px "Spline Sans Mono",monospace; letter-spacing:.12em; text-transform:uppercase; }
  .sr-route-count { margin-top:14px; display:flex; align-items:baseline; gap:8px; }
  .sr-route-count strong { font-size:49px; line-height:.9; letter-spacing:-.07em; }
  .sr-route-count span { font-size:12px; line-height:1.15; color:#bdd2ca; font-weight:600; }
  .sr-side-rule { height:1px; background:rgba(230,240,227,.22); margin:18px 0 15px; }
  .sr-side-stat { display:flex; justify-content:space-between; gap:10px; align-items:baseline; margin:9px 0; }
  .sr-side-stat strong { font-size:27px; letter-spacing:-.05em; }
  .sr-side-stat span { text-align:right; max-width:105px; color:#c7d7d0; font-size:11px; line-height:1.2; }
  .sr-platforms { display:flex; gap:6px; margin-top:14px; }
  .sr-platforms span { border:1px solid rgba(222,238,225,.35); padding:6px 7px; font:700 10px "Spline Sans Mono",monospace; }
  .sr-history { padding:19px 0 17px; }
  .sr-history-row { display:grid; grid-template-columns:1fr 1fr 1.2fr; gap:18px; margin-top:15px; }
  .sr-history-item { border-left:3px solid #5c9a78; padding-left:12px; min-height:53px; }
  .sr-history-item strong { font-size:27px; letter-spacing:-.05em; line-height:1; display:block; }
  .sr-history-item span { display:block; margin-top:5px; color:#536c6d; font-size:12px; line-height:1.25; font-weight:600; }
  .sr-takeaway { margin-top:12px; background:#dce8dc; border-left:5px solid #267458; padding:13px 16px; display:flex; justify-content:space-between; align-items:center; gap:22px; }
  .sr-takeaway strong { font-size:19px; line-height:1.16; letter-spacing:-.025em; max-width:530px; }
  .sr-takeaway span { font:600 10px "Spline Sans Mono",monospace; text-align:right; color:#4d6c67; max-width:210px; line-height:1.4; }
  .sr-foot { margin-top:auto; padding-top:14px; border-top:1px solid var(--line); color:#52686b; }
  .sr-foot-title { font:700 10px "Spline Sans Mono",monospace; letter-spacing:.12em; text-transform:uppercase; color:#315850; margin-bottom:6px; }
  .sr-foot p { font-size:10px; line-height:1.45; margin:0; max-width:930px; }
  .sr-foot .sr-foot-sub { margin-top:5px; color:#74827f; font:9px "Spline Sans Mono",monospace; }
  @media print {
    html, body { margin:0 !important; padding:0 !important; width:1080px; height:1600px; }
    .sr-poster { width:1080px !important; height:1600px !important; margin:0 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  }
`;

function MountainArtwork() {
  return (
    <svg className="sr-mountains" viewBox="0 0 1080 190" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 112 96 45l38 30 91-61 62 77 75-39 92 67 82-81 47 38 70-65 66 50 76-39 70 55 87-34 128 87v60H0Z" fill="#b8cec0" />
      <path d="m225 14 28 34-28-11-26 23ZM536 76l48-57 39 39-33-12-28 18ZM744 47l41-35 39 39-32-12-28 19Z" fill="#ecf0e4" opacity=".86" />
      <path d="m0 145 145-66 78 39 97-43 123 64 91-56 78 48 92-66 83 53 119-35 174 64v44H0Z" fill="#64877b" />
      <path d="m0 162 122-39 92 22 102-30 100 45 117-36 97 26 100-42 112 45 127-29 111 41v25H0Z" fill="#173e49" />
      <path d="M0 174c130-18 210 13 328-1s171-21 285-4 184-11 286 1 111 8 181-1v21H0Z" fill="#102e3d" />
      <path d="M668 29c44 16 63 33 81 53M84 131c33-18 67-22 105-13" fill="none" stroke="#e6eee2" strokeWidth="2" opacity=".55" />
    </svg>
  );
}

export function SummitReadyBuildStory() {
  return (
    <div className="sr-poster">
      <style>{styles}</style>
      <div className="sr-inner">
        <header className="sr-top">
          <div className="sr-brand">
            <svg className="sr-mark" viewBox="0 0 42 32" aria-hidden="true">
              <path d="M1 29 13 7l8 12 6-9 14 19H1Z" fill="#1b6954" />
              <path d="m13 7 5 8-5-2-4 4ZM27 10l4 6-4-2-3 4Z" fill="#e8efe3" />
            </svg>
            <span>SUMMITREADY</span>
          </div>
          <div className="sr-edition">BUILD STORY / 2026</div>
        </header>

        <section className="sr-hero">
          <div className="sr-kicker">A mountain app, built from the ground up</div>
          <h1 className="sr-title">Local hills.<br /><span>Big summits.</span></h1>
          <p className="sr-deck">SummitReady turns the walks near home into expedition progress—and helps each person prepare for a much bigger climb.</p>
          <MountainArtwork />
          <div className="sr-hero-note">From first hill to far horizon</div>
        </section>

        <section className="sr-proof">
          <div className="sr-section-label">The work, in perspective</div>
          <div className="sr-proof-grid">
            <div className="sr-stat"><strong>142k</strong><span>nonblank lines<br />of source code</span><small>141,998 exact</small></div>
            <div className="sr-stat"><strong>777</strong><span>source files</span></div>
            <div className="sr-stat"><strong>31k</strong><span>nonblank test<br />and fixture lines</span><small>30,985 exact</small></div>
            <div className="sr-stat"><strong>265</strong><span>test / fixture<br />files</span></div>
          </div>
          <div className="sr-measure">Repository snapshot measured 29 October 2026 · test code counted separately</div>
        </section>

        <section className="sr-architecture">
          <div className="sr-section-label">What sits behind the experience</div>
          <div className="sr-architecture-head">
            <h2>One mountain journey.<br />Many connected systems.</h2>
            <p>Each familiar feature depends on services, data, and careful checks working together.</p>
          </div>
          <div className="sr-system">
            <div className="sr-system-main">
              <div className="sr-stack">
                <div className="sr-layer">
                  <div className="sr-layer-name"><b>Explore</b><small>Find a way up</small></div>
                  <div className="sr-pills"><span className="sr-pill">Maps &amp; summit search</span><span className="sr-pill">Route planning</span><span className="sr-pill">Weather</span></div>
                </div>
                <div className="sr-layer">
                  <div className="sr-layer-name"><b>Go</b><small>Track the outing</small></div>
                  <div className="sr-pills"><span className="sr-pill">GPS recording</span><span className="sr-pill">Background recovery</span><span className="sr-pill">Activity history</span></div>
                </div>
                <div className="sr-layer">
                  <div className="sr-layer-name"><b>Progress</b><small>Build toward more</small></div>
                  <div className="sr-pills"><span className="sr-pill">Flexible expedition stages</span><span className="sr-pill">Local hill progress</span><span className="sr-pill">Celebrations</span></div>
                </div>
                <div className="sr-layer">
                  <div className="sr-layer-name"><b>Prepare</b><small>Make it personal</small></div>
                  <div className="sr-pills"><span className="sr-pill">Training plans</span><span className="sr-pill">Readiness</span><span className="sr-pill">AI coaching</span></div>
                </div>
                <div className="sr-layer">
                  <div className="sr-layer-name"><b>Connect</b><small>People &amp; access</small></div>
                  <div className="sr-pills"><span className="sr-pill">Private member community</span><span className="sr-pill">Store billing &amp; restores</span><span className="sr-pill">Sign-in &amp; account isolation</span></div>
                </div>
                <div className="sr-layer">
                  <div className="sr-layer-name"><b>Operate</b><small>Keep it dependable</small></div>
                  <div className="sr-pills"><span className="sr-pill">Artwork management</span><span className="sr-pill">Privacy &amp; data storage</span><span className="sr-pill">Regression checks</span></div>
                </div>
              </div>
            </div>
            <aside className="sr-system-side">
              <div>
                <div className="sr-side-kicker">The build spans</div>
                <div className="sr-route-count"><strong>61</strong><span>mobile app<br />route files*</span></div>
                <div className="sr-side-rule" />
                <div className="sr-side-stat"><strong>58</strong><span>backend route modules</span></div>
                <div className="sr-side-stat"><strong>1</strong><span>connected product journey</span></div>
              </div>
              <div>
                <div className="sr-side-kicker">Three implementations</div>
                <div className="sr-platforms"><span>iOS</span><span>ANDROID</span><span>WEB</span></div>
              </div>
            </aside>
          </div>
          <div className="sr-measure">* App route files, excluding layouts and onboarding prototypes—not a count of unique visible screens.</div>
        </section>

        <section className="sr-history">
          <div className="sr-section-label">A record of iteration</div>
          <div className="sr-history-row">
            <div className="sr-history-item"><strong>1,183</strong><span>recorded source-history revisions</span></div>
            <div className="sr-history-item"><strong>123</strong><span>distinct dates with recorded changes—not person-days</span></div>
            <div className="sr-history-item"><strong>27 Apr — 29 Oct</strong><span>2026 history window, including automated checkpoints</span></div>
          </div>
          <div className="sr-takeaway">
            <strong>The visible screens are only the summit.<br />Behind them: connected systems, testing, and refinement.</strong>
            <span>Recorded history shows activity over time; it does not establish continuous full-time work.</span>
          </div>
        </section>

        <footer className="sr-foot">
          <div className="sr-foot-title">Source &amp; method</div>
          <p>Repository snapshot 29 Oct 2026. Scope: SummitReady app, API, landing website, artwork admin, and DB / membership libraries. Nonblank source includes comments; generated, vendor, and native code excluded. Test / fixture code counted separately. History entries include automated checkpoints. Hours not tracked.</p>
          <p className="sr-foot-sub">Counts describe repository contents and recorded history—not effort-hours, team size, completed tasks, or product readiness.</p>
        </footer>
      </div>
    </div>
  );
}
