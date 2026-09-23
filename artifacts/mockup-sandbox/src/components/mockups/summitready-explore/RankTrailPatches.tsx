import { useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CircleHelp,
  Compass,
  Footprints,
  LockKeyhole,
  Mountain,
  Share2,
  ShieldCheck,
  Sparkles,
  TentTree,
  Trophy,
} from "lucide-react";

const img = (name: string) => `/__mockup/images/summitready-explore/${name}`;

type Patch = {
  id: string;
  title: string;
  sub: string;
  detail: string;
  image: string;
  status: "earned" | "current" | "locked";
  tone: string;
  progress?: number;
};

const patches: Patch[] = [
  {
    id: "first-light",
    title: "First Light",
    sub: "First summit logged",
    detail: "You started before the crowds. The first of many.",
    image: "ben-nevis.jpg",
    status: "earned",
    tone: "#d49d58",
  },
  {
    id: "ridge-walker",
    title: "Ridge Walker",
    sub: "5 summits completed",
    detail: "Five ridgelines, one growing instinct for the high ground.",
    image: "tryfan.jpg",
    status: "current",
    tone: "#63d0a2",
    progress: 4,
  },
  {
    id: "alpine-hand",
    title: "Alpine Hand",
    sub: "10 summits completed",
    detail: "A steady hand where the air gets thin.",
    image: "mont-blanc.jpg",
    status: "locked",
    tone: "#7e9aa0",
  },
  {
    id: "high-country",
    title: "High Country",
    sub: "2,500 m gained",
    detail: "Altitude is earned one patient step at a time.",
    image: "kilimanjaro.jpg",
    status: "locked",
    tone: "#a6b6ae",
  },
];

export function RankTrailPatches() {
  const [activeTab, setActiveTab] = useState<"rank" | "collection">("rank");
  const [selected, setSelected] = useState("ridge-walker");
  const [showAll, setShowAll] = useState(false);
  const [shared, setShared] = useState(false);
  const activePatch = patches.find((patch) => patch.id === selected) ?? patches[1];

  return (
    <main
      className="relative mx-auto min-h-[844px] w-[390px] overflow-hidden text-[#edf3ef]"
      style={{
        background: "#07161a",
        fontFamily: "'DM Sans', sans-serif",
        letterSpacing: "-0.01em",
      }}
    >
      <div className="absolute inset-0 pointer-events-none opacity-[0.12]" style={{ backgroundImage: "radial-gradient(#d5dccf 0.55px, transparent 0.55px)", backgroundSize: "6px 6px" }} />
      <header className="relative z-10 h-[104px] border-b border-[#203a3a] bg-[#091a1e]/95 px-5 pt-3">
        <div className="flex items-center justify-between text-[10px] font-bold text-[#b9c8c3]">
          <span>9:41</span>
          <span className="tracking-[2px]">▮▮▮ ◔ <b className="tracking-normal">100</b></span>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <button aria-label="Back" className="grid h-8 w-8 place-items-center rounded-full border border-[#2b4747] bg-[#10262a] text-[#d9e5e0] transition-transform active:scale-95">
            <ArrowLeft size={16} />
          </button>
          <div className="text-center">
            <div className="font-['Space_Grotesk'] text-[13px] font-bold tracking-[2.5px]">SUMMITREADY</div>
            <div className="mt-0.5 text-[6px] tracking-[2px] text-[#7e9794]">THE LONG GAME UPWARD</div>
          </div>
          <button aria-label="Help" className="grid h-8 w-8 place-items-center rounded-full border border-[#2b4747] bg-[#10262a] text-[#b7cbc4] transition-transform active:scale-95">
            <CircleHelp size={16} />
          </button>
        </div>
      </header>

      <section className="relative z-10 px-5 pt-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="mb-1 text-[9px] font-semibold tracking-[2.2px] text-[#61d3a3]">YOUR FIELD NOTES</p>
            <h1 className="font-['Space_Grotesk'] text-[28px] font-bold leading-[28px] tracking-[-1px]">Trail patches</h1>
          </div>
          <button
            onClick={() => setShared(!shared)}
            className="flex h-8 items-center gap-1.5 rounded-full border border-[#2e5d55] bg-[#102b2a] px-3 text-[9px] font-bold text-[#8ce0bc] transition-all active:scale-95"
          >
            <Share2 size={13} /> {shared ? "Saved" : "Share"}
          </button>
        </div>
        <p className="mt-2 max-w-[300px] text-[11px] leading-[16px] text-[#aebeba]">The miles leave a mark. Collect the moments that made you stronger.</p>

        <div className="mt-4 flex gap-1 rounded-xl bg-[#0d2528] p-1">
          {(["rank", "collection"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-8 flex-1 rounded-lg text-[10px] font-bold transition-all ${activeTab === tab ? "bg-[#d2dfc9] text-[#102326]" : "text-[#8fa6a1]"}`}
            >
              {tab === "rank" ? "Current rank" : "Patch collection"}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "rank" ? (
        <section className="relative z-10 px-5 pt-4">
          <div className="relative h-[177px] overflow-hidden rounded-2xl border border-[#3d594f] bg-[#20382f]">
            <img src={img(activePatch.image)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35 mix-blend-luminosity" />
            <div className="absolute inset-0 bg-[linear-gradient(105deg,#18372f_8%,transparent_68%),linear-gradient(0deg,#0c1d20,transparent_70%)]" />
            <div className="relative flex h-full items-center gap-4 px-5">
              <div className="relative grid h-[112px] w-[112px] shrink-0 place-items-center rounded-[24px] border-2 border-[#89ddb7] bg-[#173d35] shadow-[4px_5px_0_#0a2223] rotate-[-4deg]">
                <div className="absolute inset-[7px] rounded-[18px] border border-dashed border-[#75c6a4]/70" />
                <div className="grid h-[67px] w-[67px] place-items-center rounded-full border border-[#bce6d0] bg-[#234e42] text-[#bce6d0]">
                  <Mountain size={34} strokeWidth={1.4} />
                </div>
                <span className="absolute bottom-[10px] font-['Space_Grotesk'] text-[8px] font-bold tracking-[1.5px] text-[#c1edda]">RIDGE WALKER</span>
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold tracking-[1.8px] text-[#67d7a8]">YOU ARE HERE</p>
                <h2 className="mt-1 font-['Space_Grotesk'] text-[22px] font-bold leading-[22px]">{activePatch.title}</h2>
                <p className="mt-1 text-[10px] text-[#c1cfca]">{activePatch.sub}</p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-1.5 w-[82px] overflow-hidden rounded-full bg-[#4c655b]"><div className="h-full w-[80%] rounded-full bg-[#62d2a1]" /></div>
                  <span className="text-[9px] font-bold text-[#d5e4dc]">4 / 5</span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl border border-[#1e3d3d] bg-[#0c2528] px-4 py-3">
            <div className="flex items-center gap-3"><div className="grid h-7 w-7 place-items-center rounded-full bg-[#173c35] text-[#68d8a8]"><Footprints size={14} /></div><div><p className="text-[9px] font-bold text-[#dce8e1]">One more summit to go</p><p className="mt-0.5 text-[9px] text-[#8da7a0]">Next up: Alpine Hand</p></div></div>
            <ChevronRight size={15} className="text-[#6bd5aa]" />
          </div>
        </section>
      ) : (
        <section className="relative z-10 px-5 pt-4">
          <div className="mb-3 flex items-center justify-between"><p className="text-[10px] font-bold tracking-[1.5px] text-[#9db2ad]">4 PATCHES DISCOVERED</p><button onClick={() => setShowAll(!showAll)} className="text-[10px] text-[#65d5a6]">{showAll ? "Show less" : "View all"}</button></div>
          <div className="grid grid-cols-2 gap-3">
            {patches.map((patch) => <PatchTile key={patch.id} patch={patch} selected={selected === patch.id} onClick={() => setSelected(patch.id)} />)}
          </div>
        </section>
      )}

      <section className="relative z-10 px-5 pt-5">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-['Space_Grotesk'] text-[15px] font-bold">On your pack</h2><span className="text-[9px] text-[#7e9991]">3 earned · 1 in progress</span></div>
        <div className="flex gap-2 overflow-hidden pb-1">
          {patches.map((patch) => <PatchTile key={patch.id} patch={patch} selected={selected === patch.id} onClick={() => setSelected(patch.id)} compact />)}
        </div>
      </section>

      <section className="relative z-10 mx-5 mt-4 rounded-xl border border-[#243f40] bg-[#0c2226] px-4 py-3">
        <div className="flex items-center gap-3"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#203b35] text-[#65d6a7]"><Trophy size={15} /></div><div className="flex-1"><p className="text-[10px] font-bold">Your next story is taking shape</p><p className="mt-0.5 text-[9px] text-[#8fa8a0]">32 km logged this month</p></div><Sparkles size={14} className="text-[#d1ad6c]" /></div>
      </section>

      <nav className="absolute bottom-0 left-0 right-0 z-20 flex h-[74px] justify-around border-t border-[#1e363c] bg-[#08191e]/95 pt-2">
        {([["Basecamp", TentTree], ["Explore", Compass], ["Track", Footprints], ["Ranks", ShieldCheck], ["You", Mountain] ] as const).map(([label, Icon]) => <button key={label} className={`flex w-[62px] flex-col items-center gap-1 text-[9px] ${label === "Ranks" ? "text-[#5cdda7]" : "text-[#788e91]"}`}><span className={`grid h-8 w-8 place-items-center ${label === "Ranks" ? "rounded-full bg-[#123f36]" : ""}`}><Icon size={18} /></span>{label}</button>)}
      </nav>
      <div className="absolute bottom-[7px] left-[164px] z-30 h-1 w-[62px] rounded-full bg-[#ebf2ec]" />
    </main>
  );
}

function PatchTile({ patch, selected, onClick, compact = false }: { patch: Patch; selected: boolean; onClick: () => void; compact?: boolean }) {
  return (
    <button onClick={onClick} className={`relative shrink-0 overflow-hidden rounded-xl border text-left transition-all active:scale-[.97] ${compact ? "h-[94px] w-[112px]" : "h-[142px] w-full"} ${selected ? "border-[#5ed5a5]" : "border-[#284345]"}`}>
      <img src={img(patch.image)} alt="" className={`absolute inset-0 h-full w-full object-cover ${patch.status === "locked" ? "grayscale opacity-25" : "opacity-35"}`} />
      <div className="absolute inset-0 bg-[linear-gradient(0deg,#071619,transparent_80%)]" />
      <div className={`relative flex h-full flex-col justify-between ${compact ? "p-2" : "p-3"}`}>
        <span className={`self-end rounded-full p-1.5 ${patch.status === "locked" ? "bg-[#23383b]/90 text-[#9aada8]" : "bg-[#173c35]/90 text-[#6ddcaf]"}`}>{patch.status === "locked" ? <LockKeyhole size={11} /> : <Check size={11} />}</span>
        <div><p className={`font-['Space_Grotesk'] font-bold ${compact ? "text-[11px]" : "text-[15px]"}`}>{patch.title}</p><p className="mt-0.5 text-[8px] text-[#b2c3bd]">{patch.sub}</p></div>
      </div>
    </button>
  );
}