import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleUserRound,
  Compass,
  Download,
  Footprints,
  Heart,
  Mountain,
  Play,
  Share2,
  Sparkles,
  TentTree,
} from "lucide-react";
import "./_group.css";

const image = (name: string) => `/__mockup/images/summitready-explore/${name}`;

const campaigns = [
  {
    key: "summit",
    kicker: "THE SUMMIT SERIES",
    title: "Above the weather.",
    caption: "A cold-front story for the days that ask for more.",
    image: "mont-blanc.jpg",
    accent: "#c4f36a",
    mode: "hero",
  },
  {
    key: "ridge",
    kicker: "RIDGELINE NOTES / 01",
    title: "Find your edge.",
    caption: "A tactile crop built for route reveals and early starts.",
    image: "tryfan.jpg",
    accent: "#ffbd66",
    mode: "split",
  },
  {
    key: "altitude",
    kicker: "ALTITUDE LOG / 05:42",
    title: "Earn the light.",
    caption: "A sunrise treatment for progress, pace and perspective.",
    image: "snowdon.jpg",
    accent: "#8be5d0",
    mode: "poster",
  },
  {
    key: "expedition",
    kicker: "EXPEDITION / NORTH FACE",
    title: "Go further out.",
    caption: "An expansive frame for the season's biggest route.",
    image: "matterhorn.jpg",
    accent: "#b6c7ff",
    mode: "wide",
  },
] as const;

export function EditorialSeasonalCampaign() {
  const [active, setActive] = useState("summit");
  const [saved, setSaved] = useState<string[]>([]);
  const [showInfo, setShowInfo] = useState(false);
  const current = useMemo(() => campaigns.find((item) => item.key === active) ?? campaigns[0], [active]);

  const toggleSaved = (key: string) => {
    setSaved((items) => (items.includes(key) ? items.filter((item) => item !== key) : [...items, key]));
  };

  return (
    <main className="sr-screen" style={{ background: "#08171b", fontFamily: "'DM Sans', sans-serif" }}>
      <div className="flex h-full flex-col overflow-hidden">
        <header className="relative z-10 flex items-center justify-between px-5 pb-3 pt-3">
          <button className="grid h-9 w-9 place-items-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/20" aria-label="Back">
            <ArrowLeft size={17} />
          </button>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-[11px] font-bold tracking-[0.2em] text-white">
              <span className="text-[#c4f36a]">⌃</span> SUMMITREADY
            </div>
            <div className="mt-0.5 text-[7px] tracking-[0.25em] text-[#9dadad]">EDITORIAL LAB / 04</div>
          </div>
          <button
            className={`grid h-9 w-9 place-items-center rounded-full border border-white/15 transition ${showInfo ? "bg-[#c4f36a] text-[#09211c]" : "bg-white/10 text-white hover:bg-white/20"}`}
            onClick={() => setShowInfo((value) => !value)}
            aria-label="About this campaign"
          >
            <Sparkles size={16} />
          </button>
        </header>

        <section className="relative mx-3 overflow-hidden rounded-[18px] border border-white/10 bg-[#132b2a]" style={{ height: 343 }}>
          <img src={image(current.image)} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500" style={{ objectPosition: current.mode === "poster" ? "center 62%" : "center" }} />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,17,20,.1)_0%,rgba(4,17,20,.1)_28%,rgba(4,17,20,.9)_100%)]" />
          <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
            <span className="rounded bg-[#091b1c]/75 px-2 py-1 text-[8px] font-bold tracking-[0.16em] text-white backdrop-blur-sm">{current.kicker}</span>
            <button onClick={() => toggleSaved(current.key)} className={`grid h-8 w-8 place-items-center rounded-full border border-white/25 backdrop-blur-sm transition ${saved.includes(current.key) ? "bg-[#c4f36a] text-[#09211c]" : "bg-[#102527]/70 text-white"}`} aria-label="Save campaign">
              <Heart size={15} fill={saved.includes(current.key) ? "currentColor" : "none"} />
            </button>
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <div className="mb-2 flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-[#c4f36a]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#c4f36a]" /> Autumn / 2025
            </div>
            <h1 className="max-w-[290px] text-[35px] font-bold leading-[0.94] tracking-[-0.07em] text-white">{current.title}</h1>
            <p className="mt-2 max-w-[270px] text-[11px] leading-4 text-[#d2ddda]">{current.caption}</p>
            <div className="mt-4 flex items-center gap-2">
              <button className="flex h-8 items-center gap-1.5 rounded-full bg-[#c4f36a] px-3 text-[10px] font-bold text-[#09211c] transition hover:bg-[#d7ff8f]"><Play size={12} fill="currentColor" /> Preview treatment</button>
              <button className="grid h-8 w-8 place-items-center rounded-full border border-white/30 bg-white/10 text-white backdrop-blur-sm" aria-label="Share treatment"><Share2 size={14} /></button>
            </div>
          </div>
        </section>

        {showInfo && (
          <div className="mx-3 mt-2 rounded-xl border border-[#c4f36a]/30 bg-[#122b27] px-3 py-2 text-[10px] leading-4 text-[#c9d7d2]">
            One mountain story, four crops. Each treatment keeps the route, season and series mark legible across launch surfaces.
          </div>
        )}

        <section className="min-h-0 flex-1 overflow-hidden px-4 pb-20 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold tracking-[0.18em] text-[#8ea3a2]">CAMPAIGN SYSTEM</p>
              <h2 className="mt-0.5 text-[16px] font-bold tracking-[-0.03em] text-white">Four ways up</h2>
            </div>
            <span className="text-[10px] text-[#8ea3a2]">{String(campaigns.indexOf(current) + 1).padStart(2, "0")} / 04</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {campaigns.map((item, index) => (
              <button key={item.key} onClick={() => setActive(item.key)} className={`group relative h-[104px] overflow-hidden rounded-xl border text-left transition duration-300 ${active === item.key ? "border-[#c4f36a] ring-1 ring-[#c4f36a]/30" : "border-white/10"}`}>
                <img src={image(item.image)} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,16,19,.05),rgba(4,16,19,.88))]" />
                <span className="absolute right-2 top-2 text-[10px] font-bold text-white/70">0{index + 1}</span>
                <span className="absolute bottom-2 left-2 right-2 text-[11px] font-bold tracking-[-0.01em] text-white">{item.title}<small className="mt-0.5 block text-[8px] font-normal uppercase tracking-[0.11em]" style={{ color: item.accent }}>{item.mode} crop</small></span>
                {active === item.key && <span className="absolute left-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-[#c4f36a] text-[#09211c]"><Check size={12} strokeWidth={3} /></span>}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-[#0c2226] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#1d4039] text-[#c4f36a]"><Mountain size={15} /></div>
              <div><p className="text-[10px] font-bold text-white">Built for the trailhead</p><p className="text-[8px] text-[#91a4a4]">Safe crops · clear route identity</p></div>
            </div>
            <button className="flex items-center gap-1 text-[9px] font-bold text-[#c4f36a]"><Download size={12} /> Kit <ChevronRight size={12} /></button>
          </div>
        </section>

        <nav className="absolute bottom-0 left-0 right-0 z-10 flex h-[70px] justify-around border-t border-white/10 bg-[#07191eeF] px-2 pt-2 backdrop-blur-md" aria-label="Primary navigation">
          {[
            ["Basecamp", TentTree],
            ["Explore", Compass],
            ["Track", Footprints],
            ["You", CircleUserRound],
          ].map(([label, Icon]) => (
            <button key={label as string} className={`flex w-16 flex-col items-center gap-1 text-[9px] ${label === "Explore" ? "text-[#c4f36a]" : "text-[#819395]"}`} onClick={() => undefined}>
              <span className={`grid h-7 w-7 place-items-center rounded-full ${label === "Explore" ? "bg-[#1e4238]" : ""}`}><Icon size={18} /></span>
              {label as string}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-[7px] left-[164px] z-20 h-1 w-[62px] rounded-full bg-white" />
      </div>
    </main>
  );
}