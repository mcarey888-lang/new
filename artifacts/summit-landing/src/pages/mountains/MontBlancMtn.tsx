import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Clock, TrendingUp, Thermometer, MapPin } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

export default function MontBlancMtn() {
  usePageMeta({
    title: "Mont Blanc — Mountain Profile | Routes, Conditions & Training | SummitReady",
    description: "Everything you need to know about climbing Mont Blanc: routes, best seasons, difficulty, kit list, and how to train for Western Europe's highest peak.",
    canonical: "https://summitready.uk/mountains/mont-blanc/",
    schema: {
      "@context": "https://schema.org",
      "@type": "TouristAttraction",
      "name": "Mont Blanc",
      "description": "The highest peak in the Alps and Western Europe at 4,808m, on the border of France and Italy. A non-technical but serious and committing mountain.",
      "url": "https://summitready.uk/mountains/mont-blanc/",
      "geo": { "@type": "GeoCoordinates", "latitude": 45.8326, "longitude": 6.8652 },
      "touristType": "Mountain climbing",
      "publisher": { "@type": "Organization", "name": "SummitReady", "url": "https://summitready.uk/" },
    },
  });

  return (
    <SiteLayout>
      <div className="bg-background">
        <section className="py-16 md:py-24 border-b border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(62,207,117,0.06),transparent_60%)]" />
          <div className="container mx-auto px-6 max-w-4xl relative">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/mountains" className="hover:text-primary transition-colors">Mountains</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">Mont Blanc</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-orange-400 bg-orange-400/10 border-orange-400/20">Hard</span>
              <span className="text-xs text-muted-foreground">Alpine · France / Italy</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-4 tracking-tight leading-[1.05]">Mont Blanc</h1>
            <p className="text-lg text-muted-foreground italic mb-6">The Roof of Western Europe · 4,808m</p>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              The highest peak in the Alps and Western Europe. A non-technical but serious and committing mountain that rewards proper preparation with one of the most spectacular summit views on Earth.
            </p>
          </div>
        </section>

        <div className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            {/* Key stats */}
            <section className="mb-12">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: TrendingUp, label: "Summit", value: "4,808m" },
                  { icon: MapPin, label: "Location", value: "Chamonix, France" },
                  { icon: Clock, label: "Summit day", value: "10–13 hours" },
                  { icon: Thermometer, label: "Summit temp", value: "–15°C to –30°C" },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white/3 border border-white/8 rounded-xl p-5 text-center">
                    <stat.icon className="w-5 h-5 text-primary mx-auto mb-2" />
                    <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                    <div className="text-sm font-bold text-white">{stat.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">About Mont Blanc</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Mont Blanc sits on the border of France and Italy, with its true summit marginally over the Italian side. The Chamonix valley in France serves as the primary base for most climbing expeditions, while Courmayeur in Italy offers the alternative southern approach.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                First summited in 1786 by Jacques Balmat and Michel-Gabriel Paccard, Mont Blanc became the founding objective of alpinism and continues to attract around 20,000 summit attempts each year. It has a significant fatality record — roughly 100 deaths annually — making it one of the deadliest mountains on Earth by absolute numbers despite being non-technical.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The mountain's relative accessibility combined with its serious nature creates a paradox: it attracts large numbers of under-prepared climbers alongside experienced alpinists. Mont Blanc sees roughly 100 deaths a year — higher than Everest in absolute numbers — not because it is technically extreme, but because thousands attempt it without adequate preparation. With the right training, a good guide, and a genuine weather window, it is one of the most rewarding mountain days in Europe.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">Main routes</h2>
              <div className="space-y-4">
                {[
                  {
                    name: "Voie des Cristalliers / Goûter Route",
                    grade: "Standard route",
                    color: "text-primary",
                    desc: "The most popular route. Takes the Tramway du Mont Blanc to Nid d'Aigle (2,372m), ascends the Goûter couloir (highest rockfall risk section), stays at the Goûter hut (3,835m), then follows the snow ridge to the summit. Non-technical but long and physically demanding.",
                  },
                  {
                    name: "Three Mont Blancs (Italian Side)",
                    grade: "Alternative",
                    color: "text-blue-400",
                    desc: "Approached from Courmayeur via the Torino hut. Less crowded than the Goûter route but requires slightly more technical competence. Summit via the Aiguille Grise and the Frêney face.",
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
                  { season: "Mid-June to July", desc: "Snow still covering the rocky sections above the Goûter hut — faster and more stable. Cooler temperatures.", best: true },
                  { season: "August", desc: "Peak season. More crowded at the huts. Higher chance of afternoon thunderstorms. Still viable.", best: false },
                  { season: "September", desc: "Quieter. Rockier as snow clears. Earlier closing of mountain huts. Shorter weather windows.", best: false },
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
              <h3 className="font-bold text-white mb-4">Prepare for Mont Blanc</h3>
              <div className="space-y-3">
                <Link to="/training-guides/mont-blanc-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Training Plan — Full 12–16 week programme
                </Link>
                <Link to="/can-i-climb/mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Am I Ready for Mont Blanc? — Fitness assessment
                </Link>
                <Link to="/readiness-check?mountain=mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Am I Ready for Mont Blanc? — Personalised readiness assessment
                </Link>
              </div>
            </section>

            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Train for Mont Blanc with Summit Ready</h2>
              <p className="text-muted-foreground mb-6">You could piece this together yourself — but most people either undertrain the back-to-back days or miss the crampon practice window entirely. Get a personalised training plan built around your summit date and the hills near you.</p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Mont Blanc Plan <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
            </section>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
