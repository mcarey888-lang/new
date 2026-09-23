import { useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  Compass,
  Footprints,
  Mountain,
  Route,
  ShieldCheck,
  TentTree,
  Trophy,
  LockKeyhole,
  Flag,
} from "lucide-react";

const image = (name: string) => `/__mockup/images/summitready-explore/${name}`;

type Rank = {
  name: string;
  altitude: string;
  detail: string;
  state: "earned" | "current" | "locked";
  progress?: number;
};

const ranks: Rank[] = [
  { name: "Trailhead", altitude: "0 m", detail: "First steps logged", state: "earned" },
  { name: "Ridgeline", altitude: "1,200 m", detail: "Consistency unlocks range", state: "earned" },
  { name: "Alpine", altitude: "2,450 m", detail: "The air gets thinner", state: "current", progress: 68 },
  { name: "High Camp", altitude: "3,600 m", detail: "Build your reserve", state: "locked" },
  { name: "Summit Ready", altitude: "4,808 m", detail: "Ready for the big one", state: "locked" },
];

const nav = [
  ["Basecamp", TentTree],
  ["Explore", Compass],
  ["Track", Footprints],
  ["Expeditions", Mountain],
  ["You", CircleUserRound],
] as const;

export function RankAlpineAscent() {
  const [selected, setSelected] = useState(2);
  const [showDetails, setShowDetails] = useState(false);
  const active = ranks[selected];

  return (
    <main
      className="relative mx-auto min-h-[844px] w-[390px] overflow-hidden text-[#eff5f2]"
      style={{
        background: "#071820",
        fontFamily: "'DM Sans', sans-serif",
        letterSpacing: "-.01em",
      }}
    >
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(115deg, transparent 0 48%, #20413f 48.2% 48.5%, transparent 48.8%), linear-gradient(12deg, transparent 0 68%, #102d30 68.2% 68.6%, transparent 69%)" }} />
      <header className="relative z-10 flex h-[69px] items-center justify-between border-b border-[#25414a] bg-[#071820]/90 px-5">
        <button className="grid h-9 w-9 place-items-center rounded-full border border-[#33515a] bg-[#0d2730] text-[#d9e6e5]" aria-label="Go back">
          <ChevronLeft size={19} />
        </button>
        <div className="text-center">
          <p className="m-0 text-[9px] font-semibold tracking-[2.4px] text-[#91a9ad]">YOUR PROGRESSION</p>
          <h1 className="m-0 mt-0.5 font-['Space_Grotesk'] text-[18px] font-bold tracking-[-.6px]">Ranks</h1>
        </div>
        <button className="grid h-9 w-9 place-items-center rounded-full border border-[#33515a] bg-[#0d2730] text-[#d9e6e5]" aria-label="Rank information" onClick={() => setShowDetails((v) => !v)}>
          <ShieldCheck size={17} />
        </button>
      </header>

      <section className="relative z-10 px-5 pb-3 pt-4">
        <div className="relative h-[174px] overflow-hidden rounded-[14px] border border-[#36585c] shadow-[0_14px_35px_rgba(0,0,0,.22)]">
          <img src={image("mont-blanc.jpg")} alt="Mont Blanc ridge at dawn" className="absolute inset-0 h-full w-full object-cover object-center opacity-75" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,21,27,.96)_0%,rgba(6,21,27,.72)_46%,rgba(6,21,27,.18)_100%)]" />
          <div className="relative flex h-full flex-col justify-between p-4">
            <div className="flex items-center justify-between">
              <span className="rounded-sm bg-[#d6ece4]/15 px-2 py-1 text-[8px] font-bold tracking-[1.6px] text-[#cfe8df]">CURRENT ALTITUDE</span>
              <span className="flex items-center gap-1 text-[10px] font-semibold text-[#55e6ad]"><Trophy size={12} /> TOP 18%</span>
            </div>
            <div>
              <p className="mb-0.5 text-[11px] font-medium text-[#b1c7c6]">Rank 03 of 05</p>
              <h2 className="m-0 font-['Space_Grotesk'] text-[30px] font-bold leading-[30px] tracking-[-1.2px]">Alpine</h2>
              <p className="m-0 mt-1 text-[10px] text-[#cfdddd]">2,450 m · You have found your rhythm.</p>
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between px-1">
          <div>
            <p className="m-0 text-[9px] font-semibold tracking-[1.4px] text-[#8fa6aa]">NEXT RANK</p>
            <p className="m-0 mt-0.5 text-[12px] font-semibold text-[#e7efed]">High Camp <span className="font-normal text-[#8da5a8]">· 3,600 m</span></p>
          </div>
          <div className="w-[142px]">
            <div className="mb-1 flex justify-between text-[9px] text-[#aac0bd]"><span>68% complete</span><span>1,150 m to go</span></div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#203b3d]"><div className="h-full rounded-full bg-[#29dc9d]" style={{ width: "68%" }} /></div>
          </div>
        </div>
      </section>

      <section className="relative z-10 px-5 pt-2">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <p className="m-0 text-[9px] font-semibold tracking-[1.6px] text-[#86a1a5]">THE ASCENT</p>
            <p className="m-0 mt-0.5 font-['Space_Grotesk'] text-[16px] font-bold">One mountain. Your pace.</p>
          </div>
          <button className="flex items-center gap-1 text-[10px] font-semibold text-[#38df9f]" onClick={() => setShowDetails((v) => !v)}>
            {showDetails ? "Hide guide" : "How it works"} <ArrowUpRight size={13} />
          </button>
        </div>

        {showDetails && (
          <div className="mb-3 rounded-lg border border-[#31544e] bg-[#0e2a2b] px-3 py-2 text-[10px] leading-[14px] text-[#c2d5d1]">
            Every rank reflects your completed training load, not speed. Keep showing up and the route opens one ridge at a time.
          </div>
        )}

        <div className="relative h-[379px] overflow-hidden rounded-[15px] border border-[#28474c] bg-[#0b232c]">
          <img src={image("hero.jpg")} alt="" className="absolute inset-0 h-full w-full object-cover object-[58%] opacity-20" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#09232b_3%,rgba(8,28,35,.82)_48%,#0b1d27_100%)]" />
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 350 379" fill="none" aria-hidden="true">
            <path d="M67 331 C 109 294, 55 254, 134 228 S 276 174, 220 137 S 162 82, 277 40" stroke="#183d42" strokeWidth="10" strokeLinecap="round" />
            <path d="M67 331 C 109 294, 55 254, 134 228 S 276 174, 220 137 S 162 82, 277 40" stroke="#30d596" strokeWidth="2.5" strokeDasharray="6 7" strokeLinecap="round" />
          </svg>
          <div className="absolute left-3 top-3 rounded-md bg-[#071820]/80 px-2 py-1 text-[8px] font-semibold tracking-[1px] text-[#94aaad]">ELEVATION PROFILE</div>
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-[#071820]/80 px-2 py-1 text-[8px] font-semibold text-[#55e6ad]"><Route size={11} /> 4,808 m</div>

          {ranks.map((rank, index) => {
            const positions = [{ left: 42, top: 299 }, { left: 104, top: 221 }, { left: 196, top: 130 }, { left: 183, top: 75 }, { left: 253, top: 25 }];
            const p = positions[index];
            const isSelected = selected === index;
            return (
              <button key={rank.name} onClick={() => setSelected(index)} className="absolute z-10 text-left transition-transform duration-200 hover:scale-[1.03]" style={{ left: p.left, top: p.top }} aria-label={`View ${rank.name} rank`}>
                <span className={`grid h-10 w-10 place-items-center rounded-full border-2 shadow-[0_5px_15px_rgba(0,0,0,.3)] ${rank.state === "locked" ? "border-[#617479] bg-[#263940] text-[#a7b6b7]" : rank.state === "current" ? "border-[#54edb0] bg-[#10624d] text-white" : "border-[#54dca8] bg-[#113e3b] text-[#4ee3aa]"} ${isSelected ? "ring-4 ring-[#41dc9c]/20" : ""}`}>
                  {rank.state === "locked" ? <LockKeyhole size={15} /> : rank.state === "earned" ? <Check size={17} strokeWidth={3} /> : <Mountain size={17} />}
                </span>
                <span className={`absolute left-[47px] top-1 whitespace-nowrap ${isSelected ? "text-[#f0faf6]" : "text-[#b7caca]"}`}>
                  <strong className="block font-['Space_Grotesk'] text-[12px] font-bold">{rank.name}</strong>
                  <small className="block text-[9px] text-[#91a8a9]">{rank.altitude}</small>
                </span>
              </button>
            );
          })}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between border-t border-[#315054] pt-2 text-[9px] text-[#8fa7aa]">
            <span className="flex items-center gap-1"><Flag size={11} /> Trailhead</span><span>Keep climbing · next check-in Sunday</span>
          </div>
        </div>
      </section>

      <div className="absolute bottom-[74px] left-5 right-5 z-20 flex items-center justify-between rounded-xl border border-[#315449] bg-[#102e2e]/95 px-3 py-2 shadow-[0_8px_20px_rgba(0,0,0,.25)]">
        <div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#1d7459] text-[#72f0ba]"><Mountain size={15} /></span><span><strong className="block text-[10px]">{active.name}</strong><small className="text-[9px] text-[#9bb8b2]">{active.detail}</small></span></div>
        <button className="grid h-7 w-7 place-items-center rounded-full border border-[#4a746a] text-[#63e6b2]" aria-label="View selected rank"><ChevronRight size={15} /></button>
      </div>
      <nav className="absolute bottom-0 left-0 right-0 z-30 flex h-[75px] justify-around border-t border-[#1c3841] bg-[#071721]/95 pt-2" aria-label="Primary navigation">
        {nav.map(([label, Icon]) => <button key={label} className={`flex w-[68px] flex-col items-center gap-1 border-0 bg-transparent text-[9px] ${label === "You" ? "text-[#25dda0]" : "text-[#82979d]"}`}><span className={`grid h-7 w-7 place-items-center ${label === "You" ? "rounded-full bg-[#0e4138]" : ""}`}><Icon size={19} /></span>{label}</button>)}
      </nav>
      <div className="absolute bottom-[7px] left-[164px] z-40 h-1 w-[62px] rounded-full bg-[#ecf2f0]" />
    </main>
  );
}