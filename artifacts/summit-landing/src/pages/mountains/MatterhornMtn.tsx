import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Clock, TrendingUp, Thermometer, MapPin, ShieldAlert } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

export default function MatterhornMtn() {
  usePageMeta({
    title: "Matterhorn — Mountain Profile | Routes, Conditions & Training | SummitReady",
    description: "Everything you need to know about the Matterhorn: the Hörnli Ridge, technical requirements, best conditions, and how to prepare for the Alps' most iconic peak.",
    canonical: "https://summitready.uk/mountains/matterhorn/",
  });

  return (
    <SiteLayout>
      <div className="bg-background">
        <section className="py-16 md:py-24 border-b border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.05),transparent_60%)]" />
          <div className="container mx-auto px-6 max-w-4xl relative">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/mountains" className="hover:text-primary transition-colors">Mountains</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">Matterhorn</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-red-400 bg-red-400/10 border-red-400/20">Expert</span>
              <span className="text-xs text-muted-foreground">Alpine · Switzerland / Italy</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-4 tracking-tight leading-[1.05]">Matterhorn</h1>
            <p className="text-lg text-muted-foreground italic mb-6">The most photographed mountain on Earth · 4,478m</p>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              The Matterhorn's pyramid silhouette is instantly recognisable. Beneath its iconic shape lies a genuinely demanding technical climb that should only be attempted by experienced alpinists.
            </p>
          </div>
        </section>

        <div className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            <section className="mb-12">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: TrendingUp, label: "Summit", value: "4,478m" },
                  { icon: MapPin, label: "Location", value: "Zermatt, Switzerland" },
                  { icon: Clock, label: "Summit day", value: "8–12 hours" },
                  { icon: Thermometer, label: "Summit temp", value: "–10°C to –25°C" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white/3 border border-white/8 rounded-xl p-5 text-center">
                    <stat.icon className="w-5 h-5 text-primary mx-auto mb-2" />
                    <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                    <div className="text-sm font-bold text-white">{stat.value}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Warning */}
            <section className="mb-12">
              <div className="flex gap-4 p-6 bg-red-500/8 border border-red-500/25 rounded-xl">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white mb-1">Technical mountain — not suitable for beginners</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">The Matterhorn requires prior alpine climbing experience, comfort on exposed rock, glacier travel skills, and the ability to use crampons and fixed ropes efficiently. Attempting it without these skills is genuinely dangerous.</p>
                </div>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">About the Matterhorn</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Matterhorn stands on the border between Switzerland and Italy, looming above the resort town of Zermatt. Its distinctive four-faced pyramid silhouette — the result of glacial cirques carving each side — has made it the most photographed mountain on Earth and one of the most recognisable natural landmarks in the world.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                First summited in 1865 by Edward Whymper's party — and infamous for the deaths of four of his companions on the descent — the Matterhorn has a long and sobering history. Approximately 500 people have died attempting it. Despite this, around 3,000 people summit each year, guided by experienced local guides who know the mountain intimately.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The key point: those who summit safely have earned it through years of alpine progression, not weeks of preparation.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">Routes</h2>
              <div className="space-y-4">
                {[
                  {
                    name: "Hörnli Ridge (Northeast Ridge)",
                    grade: "Standard route — PD+ / AD",
                    color: "text-primary",
                    desc: "The most commonly attempted route, starting from the Hörnli hut (3,260m). Involves 1,200m of mixed rock and fixed rope climbing. Sections reach near-vertical on the upper ridge. An early start (3–4am) is essential to avoid afternoon rockfall and thunderstorms.",
                  },
                  {
                    name: "Lion Ridge (Italian Side)",
                    grade: "Alternative — AD",
                    color: "text-blue-400",
                    desc: "Approached from Breuil-Cervinia in Italy. Similar difficulty to the Hörnli but longer. Less crowded. The Carrel hut serves as the high camp. Generally reserved for more experienced parties.",
                  },
                ].map((route) => (
                  <div key={route.name} className="bg-white/3 border border-white/8 rounded-xl p-6">
                    <div className={`text-xs font-bold mb-2 ${route.color}`}>{route.grade}</div>
                    <h3 className="font-bold text-white mb-2">{route.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{route.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">Best time to climb</h2>
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { season: "Mid-July to mid-August", desc: "Primary season. Snow and ice conditions best. Fixed ropes fully in place. Weather windows more predictable.", best: true },
                  { season: "Late August – September", desc: "Less snow on rock sections can make climbing harder, not easier. More rockfall. Weather deteriorates.", best: false },
                  { season: "Outside this window", desc: "Winter ascents are serious expeditions for elite mountaineers only. Not relevant for the majority of climbers.", best: false },
                ].map((s) => (
                  <div key={s.season} className={`p-5 rounded-xl border ${s.best ? "border-primary/30 bg-primary/5" : "border-white/8 bg-white/3"}`}>
                    <div className={`text-xs font-bold mb-2 ${s.best ? "text-primary" : "text-muted-foreground"}`}>{s.best ? "Recommended" : ""}</div>
                    <div className="font-semibold text-white text-sm mb-2">{s.season}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12 p-6 bg-white/3 border border-white/8 rounded-2xl">
              <h3 className="font-bold text-white mb-4">Prepare for the Matterhorn</h3>
              <div className="space-y-3">
                <Link to="/training-guides/matterhorn-preparation-guide" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Matterhorn Preparation Guide — 6–12 month programme
                </Link>
                <Link to="/training-guides/mont-blanc-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Training Plan — Complete this before the Matterhorn
                </Link>
              </div>
            </section>

            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Start Your Journey to the Matterhorn</h2>
              <p className="text-muted-foreground mb-6">Build the fitness foundation first. Summit Ready creates your progressive training plan from where you are now.</p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Training Plan <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
            </section>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
