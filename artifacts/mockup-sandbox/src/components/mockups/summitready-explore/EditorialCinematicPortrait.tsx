import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Check,
  ChevronRight,
  CircleUserRound,
  Compass,
  Footprints,
  Heart,
  Mountain,
  Play,
  Share2,
  TentTree,
} from "lucide-react";

const image = (name: string) => `/__mockup/images/summitready-explore/${name}`;

const treatments = [
  {
    id: "portrait",
    label: "01 / THE ASCENT",
    title: "Hold the line",
    kicker: "CINEMATIC PORTRAIT",
    description: "A human-scale frame for the moment before the ridge gives way.",
    image: "ben-nevis.jpg",
    accent: "#b7e1c2",
    format: "9:16 · STILL",
  },
  {
    id: "contour",
    label: "02 / CONTOUR STUDY",
    title: "Read the weather",
    kicker: "TOPOGRAPHIC DIPTYCH",
    description: "Route language and lived effort sit side by side.",
    image: "mont-blanc.jpg",
    accent: "#d8b47e",
    format: "4:5 · EDITORIAL",
  },
  {
    id: "window",
    label: "03 / WEATHER WINDOW",
    title: "Ten minutes of blue",
    kicker: "LIGHT / ALTITUDE",
    description: "A quiet study in patience, light, and the space between forecasts.",
    image: "matterhorn.jpg",
    accent: "#b3d4df",
    format: "16:9 · FIELD CUT",
  },
  {
    id: "notes",
    label: "04 / FIELD NOTES",
    title: "Leave a trace",
    kicker: "RECOVERY / REFLECTION",
    description: "The details that stay with you long after the summit photo.",
    image: "snowdon.jpg",
    accent: "#d3c5a2",
    format: "1:1 · JOURNAL",
  },
] as const;

export function EditorialCinematicPortrait() {
  const [selected, setSelected] = useState("portrait");
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [playing, setPlaying] = useState(false);

  const active = useMemo(
    () => treatments.find((treatment) => treatment.id === selected) ?? treatments[0],
    [selected],
  );

  return (
    <main
      className="relative mx-auto h-[844px] w-[390px] overflow-hidden bg-[#08181b] text-[#eef3ed]"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_8%,rgba(77,111,94,.22),transparent_32%),linear-gradient(180deg,#10282a_0%,#08181b_52%,#061215_100%)]" />
      <div className="relative z-10 h-full">
        <div className="flex h-[29px] items-center justify-between px-5 pt-2 text-[12px] font-semibold tracking-tight">
          <span>9:41</span>
          <span className="flex items-center gap-2 text-[10px] text-[#bfccc9]">
            <span>▮▮▮</span><span>◔</span><span className="rounded-[3px] border border-[#bfccc9] px-1 text-[9px]">100</span>
          </span>
        </div>

        <header className="flex h-[59px] items-center justify-between border-b border-white/[.08] px-5">
          <button aria-label="Back" className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/[.05] transition-transform active:scale-95">
            <ArrowLeft size={17} />
          </button>
          <div className="text-center">
            <div className="font-['Space_Grotesk'] text-[11px] font-bold tracking-[3px]">SUMMITREADY</div>
            <div className="mt-0.5 text-[7px] tracking-[2px] text-[#91aaa7]">EDITORIAL STUDIES</div>
          </div>
          <button
            aria-label="Save collection"
            onClick={() => setSaved((value) => !value)}
            className={`grid h-9 w-9 place-items-center rounded-full border transition-all active:scale-95 ${saved ? "border-[#b7e1c2] bg-[#b7e1c2] text-[#12312b]" : "border-white/10 bg-white/[.05]"}`}
          >
            {saved ? <Check size={16} /> : <Bookmark size={16} />}
          </button>
        </header>

        <section className="px-5 pb-3 pt-5">
          <p className="mb-1 text-[9px] font-semibold tracking-[2.5px] text-[#a9c7b1]">THE SUMMITREADY IMAGE LIBRARY</p>
          <h1 className="max-w-[330px] font-['Space_Grotesk'] text-[29px] font-bold leading-[.98] tracking-[-1.3px]">
            Images for the<br /><span className="text-[#b7e1c2]">long way up.</span>
          </h1>
          <p className="mt-2 max-w-[310px] text-[11px] leading-[1.45] text-[#b7c6c2]">
            Four visual treatments for real effort, changing weather, and the people who keep moving.
          </p>
        </section>

        <section className="mx-5 overflow-hidden rounded-[11px] border border-white/[.12] bg-[#13282a] shadow-[0_15px_40px_rgba(0,0,0,.25)]">
          <div className="relative h-[254px] overflow-hidden">
            <img
              src={image(active.image)}
              alt={`${active.title} editorial treatment`}
              className={`h-full w-full object-cover transition-transform duration-700 ${playing ? "scale-105" : "scale-100"}`}
              style={{ filter: active.id === "notes" ? "grayscale(.72) contrast(1.08)" : "saturate(.82) contrast(1.05)" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,.05)_30%,rgba(2,12,14,.88)_100%)]" />
            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span className="rounded-[3px] border border-white/25 bg-[#12252a]/70 px-2 py-1 text-[8px] font-semibold tracking-[1.5px]">{active.kicker}</span>
              <span className="text-[8px] tracking-[1px] text-[#cad8d4]">{active.format}</span>
            </div>
            <button
              onClick={() => setPlaying((value) => !value)}
              aria-label={playing ? "Pause preview" : "Play preview"}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full border border-white/40 bg-[#11252a]/70 transition-transform active:scale-90"
            >
              <Play size={14} fill={playing ? "currentColor" : "none"} className={playing ? "rotate-90" : ""} />
            </button>
            <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
              <div>
                <div className="mb-1 text-[9px] font-semibold tracking-[2px]" style={{ color: active.accent }}>{active.label}</div>
                <h2 className="font-['Space_Grotesk'] text-[25px] font-bold leading-none tracking-[-.8px]">{active.title}</h2>
              </div>
              <button
                onClick={() => setLiked((value) => !value)}
                aria-label={liked ? "Remove from favorites" : "Favorite treatment"}
                className={`grid h-9 w-9 place-items-center rounded-full border transition-all active:scale-90 ${liked ? "border-[#e8b6a7] bg-[#e8b6a7] text-[#39231e]" : "border-white/30 bg-[#102329]/70"}`}
              >
                <Heart size={15} fill={liked ? "currentColor" : "none"} />
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <p className="max-w-[245px] text-[10px] leading-[1.35] text-[#b6c6c2]">{active.description}</p>
            <button className="flex items-center gap-1 text-[9px] font-semibold text-[#b7e1c2]">
              Details <ChevronRight size={13} />
            </button>
          </div>
        </section>

        <section className="mt-4">
          <div className="mb-2 flex items-center justify-between px-5">
            <h3 className="font-['Space_Grotesk'] text-[14px] font-bold">Four ways to frame the climb</h3>
            <span className="text-[9px] text-[#8fa5a1]">{treatments.findIndex((t) => t.id === selected) + 1} / 04</span>
          </div>
          <div className="flex gap-2 overflow-hidden px-5 pb-2">
            {treatments.map((treatment) => (
              <button
                key={treatment.id}
                onClick={() => setSelected(treatment.id)}
                className={`group relative h-[88px] min-w-[79px] overflow-hidden rounded-[7px] border text-left transition-all active:scale-95 ${selected === treatment.id ? "border-[#b7e1c2] shadow-[0_0_0_1px_rgba(183,225,194,.25)]" : "border-white/10 opacity-70"}`}
              >
                <img src={image(treatment.image)} alt="" className="h-full w-full object-cover saturate-[.7]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#071416] via-transparent to-transparent" />
                <span className="absolute bottom-2 left-2 right-1 text-[8px] font-semibold leading-[1.05]">{treatment.id === "portrait" ? "Ascent" : treatment.id === "contour" ? "Contour" : treatment.id === "window" ? "Weather" : "Notes"}</span>
              </button>
            ))}
            <button aria-label="Share collection" className="grid h-[88px] min-w-[53px] place-items-center rounded-[7px] border border-dashed border-white/20 text-[#a9bfba] transition-colors hover:border-[#b7e1c2] hover:text-[#b7e1c2]">
              <Share2 size={15} />
            </button>
          </div>
        </section>

        <div className="absolute bottom-0 left-0 right-0 flex h-[76px] items-start justify-around border-t border-white/[.08] bg-[#071619]/95 px-2 pt-2 backdrop-blur-md">
          {[
            ["Basecamp", TentTree, false],
            ["Explore", Compass, false],
            ["Track", Footprints, true],
            ["Expeditions", Mountain, false],
            ["You", CircleUserRound, false],
          ].map(([label, Icon, current]) => {
            const NavIcon = Icon as typeof Mountain;
            return <button key={label as string} className={`flex w-[62px] flex-col items-center gap-1 text-[9px] transition-colors ${current ? "text-[#b7e1c2]" : "text-[#7e9693]"}`}><span className={`grid h-7 w-7 place-items-center rounded-full ${current ? "bg-[#174237]" : ""}`}><NavIcon size={18} /></span>{label as string}</button>;
          })}
        </div>
        <div className="absolute bottom-[7px] left-[164px] h-[4px] w-[62px] rounded-full bg-[#e7efec]" />
      </div>
    </main>
  );
}