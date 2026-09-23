import { useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Compass,
  LockKeyhole,
  Map,
  Mountain,
  Route,
  Sparkles,
  Target,
  TentTree,
  UserRound,
} from "lucide-react";
import "./_group.css";

const img = (name: string) => `/__mockup/images/summitready-explore/${name}`;
const navItems: Array<[typeof TentTree, string]> = [
  [TentTree, "Basecamp"],
  [Compass, "Explore"],
  [Route, "Ranks"],
  [UserRound, "You"],
];

type Branch = {
  id: string;
  name: string;
  subtitle: string;
  elevation: string;
  state: "earned" | "current" | "locked";
  x: number;
  y: number;
};

const branches: Branch[] = [
  { id: "trail", name: "Trail Walker", subtitle: "Foundation", elevation: "1,200 m", state: "earned", x: 8, y: 0 },
  { id: "ridge", name: "Ridge Seeker", subtitle: "Current line", elevation: "2,100 m", state: "current", x: 106, y: 76 },
  { id: "alpine", name: "Alpine Route", subtitle: "Next ascent", elevation: "3,200 m", state: "locked", x: 9, y: 171 },
  { id: "summit", name: "Summit Tactician", subtitle: "High mountain", elevation: "4,000 m", state: "locked", x: 202, y: 171 },
];

export function RankMountainLineage() {
  const [selected, setSelected] = useState("ridge");
  const [view, setView] = useState<"lineage" | "map">("lineage");
  const active = branches.find((branch) => branch.id === selected) ?? branches[1];

  return (
    <main
      className="relative mx-auto h-[844px] w-[390px] overflow-hidden text-[#edf3f0]"
      style={{ background: "#07161b", fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "linear-gradient(110deg, transparent 30%, #3f745f 30.2%, transparent 30.5%), linear-gradient(25deg, transparent 49%, #284d44 49.2%, transparent 49.6%)" }} />
      <header className="relative z-10 border-b border-[#284039] bg-[#07161b]/90 px-5 pb-4 pt-3 backdrop-blur-md">
        <div className="mb-5 flex items-center justify-between">
          <button className="grid h-9 w-9 place-items-center rounded-full border border-[#2d4843] bg-[#0c2428] text-[#b8c9c5]" aria-label="Back">
            <ArrowLeft size={17} />
          </button>
          <div className="text-center">
            <p className="m-0 text-[9px] font-semibold tracking-[2.5px] text-[#8da7a0]">SUMMITREADY</p>
            <p className="m-1 text-[16px] font-bold tracking-[-.5px]">Your Ranks</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-full border border-[#2d4843] bg-[#0c2428] text-[#b8c9c5]" aria-label="Open map">
            <Map size={16} />
          </button>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="mb-1 text-[10px] font-semibold tracking-[2px] text-[#43dda4]">DISCIPLINE LINEAGE</p>
            <h1 className="m-0 text-[29px] font-bold leading-[.98] tracking-[-1.5px]">Choose your<br />mountain line.</h1>
          </div>
          <div className="pb-1 text-right">
            <p className="m-0 text-[22px] font-bold text-[#3ee0a3]">02</p>
            <p className="m-0 text-[9px] uppercase tracking-[1.6px] text-[#8da7a0]">of 06 ranks</p>
          </div>
        </div>
        <p className="mb-0 mt-3 max-w-[310px] text-[11px] leading-[1.45] text-[#b4c4c1]">Every route changes what comes next. Follow the line you want to climb.</p>
      </header>

      <section className="relative z-10 px-5 pt-4">
        <div className="flex rounded-xl border border-[#29433e] bg-[#0b2428] p-1">
          {(["lineage", "map"] as const).map((item) => (
            <button key={item} onClick={() => setView(item)} className={`h-8 flex-1 rounded-lg text-[10px] font-semibold uppercase tracking-[1.5px] transition-all ${view === item ? "bg-[#c5d7c9] text-[#10211f]" : "text-[#91aaa3]"}`}>
              {item === "lineage" ? "Lineage" : "Route map"}
            </button>
          ))}
        </div>
      </section>

      {view === "lineage" ? (
        <>
          <section className="relative z-10 mx-5 mt-4 h-[337px] overflow-hidden rounded-2xl border border-[#315149] bg-[#0a2025]">
            <img src={img("hero.jpg")} alt="" className="absolute inset-0 h-full w-full object-cover opacity-[0.16] mix-blend-screen" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,#0a202533,#0a2025_78%)]" />
            <div className="absolute left-[26px] top-5 text-[9px] font-semibold tracking-[2px] text-[#6d8d83]">THE ASCENT / 01</div>
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 350 337" fill="none" aria-hidden="true">
              <path d="M56 48 C56 90 174 80 174 125 C174 160 53 173 53 223" stroke="#375a50" strokeWidth="2" strokeDasharray="4 6" />
              <path d="M174 125 C174 166 250 174 250 222" stroke="#365950" strokeWidth="2" strokeDasharray="4 6" />
              <path d="M174 125 C174 144 112 168 112 222" stroke="#3ee0a3" strokeWidth="2" />
            </svg>
            {branches.map((branch) => {
              const isSelected = selected === branch.id;
              const locked = branch.state === "locked";
              return (
                <button key={branch.id} onClick={() => setSelected(branch.id)} className="absolute z-10 w-[115px] text-left transition-transform active:scale-95" style={{ left: branch.x, top: branch.y + 43 }}>
                  <div className={`relative rounded-xl border p-2.5 shadow-[0_8px_18px_#020b0d55] transition-all ${isSelected ? "border-[#42e2a7] bg-[#10372f]" : locked ? "border-[#2a403f] bg-[#10252a]" : "border-[#668379] bg-[#18332f]"}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`grid h-7 w-7 place-items-center rounded-full ${locked ? "bg-[#1e3438] text-[#718883]" : isSelected ? "bg-[#43dda4] text-[#09221e]" : "bg-[#b9d0c1] text-[#173129]"}`}>
                        {locked ? <LockKeyhole size={13} /> : branch.state === "current" ? <Target size={14} /> : <Mountain size={14} />}
                      </span>
                      {isSelected && <Sparkles size={13} className="text-[#43dda4]" />}
                    </div>
                    <strong className="block text-[11px] leading-[1.05]">{branch.name}</strong>
                    <span className="mt-1 block text-[9px] text-[#9eb5ae]">{branch.subtitle}</span>
                    <span className={`mt-2 block text-[9px] font-semibold ${locked ? "text-[#718883]" : "text-[#43dda4]"}`}>{locked ? "LOCKED" : branch.elevation}</span>
                  </div>
                </button>
              );
            })}
            <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between border-t border-[#34504a] pt-2 text-[9px] text-[#87a49b]">
              <span>YOU ARE HERE</span><span className="flex items-center gap-1 text-[#a9c1b6]"><Route size={11} /> 2,100 m elevation gain</span>
            </div>
          </section>
          <section className="relative z-10 mx-5 mt-4 rounded-2xl border border-[#38564d] bg-[#d1dfd1] p-4 text-[#102521] shadow-[0_12px_30px_#020b0d55]">
            <div className="flex items-start justify-between">
              <div><p className="m-0 text-[9px] font-bold tracking-[1.8px] text-[#3c7060]">SELECTED PATH</p><h2 className="mb-0 mt-1 text-[22px] font-bold tracking-[-.8px]">{active.name}</h2></div>
              <span className="rounded-full bg-[#a7c6b5] px-2 py-1 text-[9px] font-bold uppercase tracking-[1px]">{active.state === "current" ? "Current" : active.state}</span>
            </div>
            <p className="mb-3 mt-2 text-[11px] leading-[1.35] text-[#45635a]">{active.id === "ridge" ? "Build balance, exposure, and confidence above the tree line." : "A future discipline waiting beyond your current route."}</p>
            <button onClick={() => setSelected(active.id === "ridge" ? "alpine" : "ridge")} className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#123b31] text-[10px] font-bold uppercase tracking-[1.4px] text-[#d8eee0] transition-transform active:scale-[.98]">
              {active.state === "current" ? "View rank details" : "Return to my line"} <ChevronRight size={14} />
            </button>
          </section>
        </>
      ) : (
        <section className="relative z-10 mx-5 mt-4 h-[500px] overflow-hidden rounded-2xl border border-[#315149] bg-[#18372f]">
          <img src={img("map.jpg")} alt="Topographic route map" className="h-full w-full object-cover opacity-60 mix-blend-screen" />
          <div className="absolute inset-0 bg-[#09231e66]" />
          <div className="absolute left-4 top-4 rounded-lg border border-[#7a9b88] bg-[#0a2624dd] px-3 py-2 text-[9px] uppercase tracking-[1.4px] text-[#d4e4d6]">Alpine corridor · 47° N</div>
          <div className="absolute left-[58px] top-[145px] rounded-full border-2 border-[#43dda4] bg-[#103a30] p-2 text-[#43dda4] shadow-[0_0_0_5px_#43dda422]"><Target size={16} /></div>
          <div className="absolute right-[55px] top-[250px] rounded-full border border-[#c6d6ba] bg-[#18362c] p-2 text-[#d8e8d5]"><Mountain size={15} /></div>
          <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-[#071b1ddd] p-3 backdrop-blur-sm"><p className="m-0 text-[9px] uppercase tracking-[1.5px] text-[#6f9c8d]">Adjacent specialism</p><strong className="mt-1 block text-[16px]">Alpine Route</strong><span className="mt-1 block text-[10px] text-[#afc2bb]">12 km east · unlock at Ridge Seeker II</span></div>
        </section>
      )}

      <nav className="absolute bottom-0 left-0 right-0 z-20 flex h-[74px] justify-around border-t border-[#1d3639] bg-[#07171deF] pt-2 backdrop-blur-md">
        {navItems.map(([Icon, label]) => (
          <button key={String(label)} className={`flex w-16 flex-col items-center gap-1 text-[9px] ${label === "Ranks" ? "text-[#43dda4]" : "text-[#829994]"}`}>
            <span className={`grid h-8 w-8 place-items-center rounded-full ${label === "Ranks" ? "bg-[#0d3b32]" : ""}`}><Icon size={19} /></span>{label}
          </button>
        ))}
      </nav>
      <div className="absolute bottom-2 left-[164px] z-30 h-1 w-[62px] rounded-full bg-[#eaf3ed]" />
    </main>
  );
}