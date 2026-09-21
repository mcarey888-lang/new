import { useState } from "react";
import {
  ArrowRight, BarChart3, ChevronRight, CircleUserRound, Compass,
  Heart, Map, Mountain, Navigation, Search, SlidersHorizontal,
  TentTree, Route, Footprints, Waves, X,
} from "lucide-react";
import "./_group.css";

const img = (name: string) => `/__mockup/images/summitready-explore/${name}`;

const filters = [
  ["All", "1,200+", Mountain], ["Europe", "428", Mountain], ["UK", "184", Route],
  ["Classic Routes", "", Route], ["Beginner Friendly", "", BarChart3], ["Technical", "", Footprints],
] as const;

const popular = [
  ["Ben Nevis", "1,345 m", "Moderate", "ben-nevis.jpg"],
  ["Tryfan", "918 m", "Challenging", "tryfan.jpg"],
  ["Snowdon", "1,085 m", "Moderate", "snowdon.jpg"],
  ["Matterhorn", "4,478 m", "Very Challenging", "matterhorn.jpg"],
];
const navItems: Array<[string, typeof TentTree]> = [
  ["Basecamp", TentTree], ["Explore", Compass], ["Track", Footprints],
  ["Expeditions", Mountain], ["You", CircleUserRound],
];

export function ApprovedReference() {
  const [mode, setMode] = useState("Training");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [liked, setLiked] = useState<string[]>([]);
  const toggleLike = (name: string) => setLiked((v) => v.includes(name) ? v.filter((x) => x !== name) : [...v, name]);

  return (
    <main className="sr-screen">
      <div className="sr-hero">
        <div className="sr-status"><span>9:41</span><span className="status-icons">▮▮▮ ◔ <b>100</b></span></div>
        <header className="sr-header">
          <div className="wordmark"><span className="mark">⌃⌃</span><span><strong>SUMMITREADY</strong><small>TRAIN MORE. GO FURTHER.</small></span></div>
          <div className="header-actions">
            <div className="segmented">{["Training", "Expeditions"].map((x) => <button key={x} className={mode === x ? "active" : ""} onClick={() => setMode(x)}>{x}</button>)}</div>
            <button className="round" aria-label="Open map"><Map size={17} /></button>
            <button className="round" aria-label="Filters"><SlidersHorizontal size={17} /></button>
          </div>
        </header>
        <section className="hero-copy">
          <p className="eyebrow">EXPLORE</p>
          <h1>Discover<br />Your Next Peak</h1>
          <p className="hero-sub">Real mountains. Real routes. Real progress.</p>
          <label className="search"><Search size={18} /><input aria-label="Search mountains" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search mountains, regions or countries..." />{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={14}/></button>}</label>
        </section>
      </div>

      <div className="sr-content">
        <div className="filter-row" aria-label="Discovery filters">
          {filters.map(([name, count, Icon]) => <button key={name} className={`filter ${filter === name ? "selected" : ""}`} onClick={() => setFilter(name)}><Icon size={21} /><strong>{name}</strong>{count && <small>{count}</small>}</button>)}
        </div>
        <SectionTitle title="Featured Mountains" action="View all" />
        <div className="featured-scroll">
          <article className="featured-card"><img className="card-photo" src={img("mont-blanc.jpg")} alt="" />
            <div className="featured-inner"><span className="tiny-tag">FEATURED</span><div className="card-bottom"><h2>Mont Blanc</h2><p>4,808 m · France / Italy</p><div className="meta"><span><BarChart3 size={13}/> Challenging</span><span><Route size={13}/> Multiple routes</span><span><Heart size={14}/> Popular</span></div></div></div><button className="circle-go" aria-label="View Mont Blanc"><ChevronRight size={20}/></button>
          </article>
          <article className="featured-card second"><img className="card-photo" src={img("kilimanjaro.jpg")} alt="" /><div className="featured-inner"><div className="card-bottom"><h2>Kilimanjaro</h2><p>5,895 m · Tanzania</p><div className="meta"><span className="green"><BarChart3 size={13}/> Challenging</span></div></div></div></article>
        </div>
        <SectionTitle title="Popular This Month" action="View all" />
        <div className="popular-row">
          {popular.map(([name, elevation, difficulty, image]) => <article className="popular-card" key={name}><div className="popular-image"><img src={img(image)} alt="" /><button onClick={() => toggleLike(name)} aria-label={`Favorite ${name}`} className={`heart ${liked.includes(name) ? "liked" : ""}`}><Heart size={15} fill={liked.includes(name) ? "currentColor" : "none"} /></button></div><div className="popular-info"><strong>{name}</strong><small>{elevation}</small><span className={difficulty === "Moderate" ? "amber" : ""}><BarChart3 size={11}/>{difficulty}</span></div></article>)}
        </div>
        <section className="map-section"><SectionTitle title="Explore by Map" /><p>Browse mountains and routes on an interactive map.</p><div className="map-card"><img src={img("map.jpg")} alt="Map of mountain routes" /><button className="open-map"><Map size={17}/> Open Map <ChevronRight size={14}/></button><span className="map-pin pin1"><Mountain size={12}/></span><span className="map-pin pin2"><Mountain size={12}/></span><span className="map-pin pin3"><Mountain size={12}/></span></div></section>
      </div>
      <nav className="bottom-nav" aria-label="Primary navigation">{navItems.map(([label, Icon]) => <button key={label} className={label === "Explore" ? "current" : ""} onClick={() => undefined}><span className="nav-icon"><Icon size={20}/></span><small>{label}</small></button>)}</nav>
      <div className="home-indicator" />
    </main>
  );
}

function SectionTitle({ title, action }: { title: string; action?: string }) {
  return <div className="section-title"><h2>{title}</h2>{action && <button>{action} <ArrowRight size={13}/></button>}</div>;
}