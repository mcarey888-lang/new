import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronRight, Clock, TrendingUp, Thermometer, MapPin } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

export default function KilimanjaroMtn() {
  usePageMeta({
    title: "Kilimanjaro — Mountain Profile | Routes, Conditions & Training | SummitReady",
    description: "Everything you need to know about climbing Kilimanjaro: routes, best season, altitude effects, and how to train for Africa's highest peak.",
    canonical: "https://summitready.uk/mountains/kilimanjaro/",
    schema: {
      "@context": "https://schema.org",
      "@type": "TouristAttraction",
      "name": "Kilimanjaro",
      "description": "Africa's highest peak and one of the Seven Summits at 5,895m in Tanzania. No technical climbing required, but altitude demands serious preparation.",
      "url": "https://summitready.uk/mountains/kilimanjaro/",
      "geo": { "@type": "GeoCoordinates", "latitude": -3.0674, "longitude": 37.3556 },
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
              <span className="text-white">Kilimanjaro</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-blue-400 bg-blue-400/10 border-blue-400/20">Moderate</span>
              <span className="text-xs text-muted-foreground">Volcanic · Tanzania</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-4 tracking-tight leading-[1.05]">Kilimanjaro</h1>
            <p className="text-lg text-muted-foreground italic mb-6">The Roof of Africa · 5,895m</p>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              Africa's highest peak and one of the Seven Summits. No technical climbing required, but altitude makes this a serious undertaking that demands proper preparation and the right route choice.
            </p>
          </div>
        </section>

        <div className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            <section className="mb-12">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: TrendingUp, label: "Summit", value: "5,895m" },
                  { icon: MapPin, label: "Location", value: "Tanzania, Africa" },
                  { icon: Clock, label: "Route length", value: "5–8 days" },
                  { icon: Thermometer, label: "Summit temp", value: "–15°C to –25°C" },
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
              <h2 className="text-2xl font-display font-bold text-white mb-5">About Kilimanjaro</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Kilimanjaro is a dormant stratovolcano in northeastern Tanzania, close to the border with Kenya. It stands completely alone on the savannah, rising dramatically from 800m at its base to 5,895m at Uhuru Peak — a height gain with no other peaks nearby to help with acclimatisation.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                This isolation is part of what makes Kilimanjaro both accessible and deceptively hard. As a standalone peak, it's logistically simple — no complex glacier systems, no technical climbing, well-maintained trails with clear signage. But that accessibility misleads people. There are no lower neighbouring peaks to pre-acclimatise on, the altitude gain from the park gate to the summit is nearly 5,000m in five to seven days, and at 5,895m you're operating on roughly half the oxygen available at sea level. Most people are genuinely surprised by how hard it is.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Around 50,000 people attempt Kilimanjaro each year. Overall summit success rates sit around 65–85%, depending heavily on route and operator choice.
              </p>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">Routes</h2>
              <div className="space-y-4">
                {[
                  { name: "Machame Route (7 days)", grade: "Recommended", color: "text-primary", desc: "The most popular route and the one with the best acclimatisation profile. Scenic traverse of the mountain with good height gain/loss ratios. 85%+ success rate with a reputable operator." },
                  { name: "Lemosho Route (8 days)", grade: "Best acclimatisation", color: "text-blue-400", desc: "The longest route and the one with the highest success rates. More remote, fewer other trekkers, and the best acclimatisation profile of all routes. Ideal for those with more time." },
                  { name: "Marangu Route (5–6 days)", grade: "Not recommended", color: "text-orange-400", desc: "The shortest and cheapest route. Hut accommodation instead of camping. Lower acclimatisation time means significantly lower success rates — around 65% over 5 days. The only route with huts rather than tents." },
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
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { season: "January – March", desc: "Cold and clear. Snow on the upper mountain. Excellent summit conditions. Fewer tourists than peak season.", best: true },
                  { season: "June – October", desc: "Primary dry season. Best weather reliability. Higher traffic on the mountain, especially August.", best: true },
                  { season: "April – May", desc: "Long rains. High failure rates due to poor trail conditions and visibility. Avoid.", best: false },
                  { season: "November", desc: "Short rains. Conditions variable but can be viable with flexibility.", best: false },
                ].map((s) => (
                  <div key={s.season} className={`p-5 rounded-xl border ${s.best ? "border-primary/30 bg-primary/5" : "border-white/8 bg-white/3"}`}>
                    <div className={`text-xs font-bold mb-2 ${s.best ? "text-primary" : "text-red-400/70"}`}>{s.best ? "Good season" : "Avoid"}</div>
                    <div className="font-semibold text-white text-sm mb-2">{s.season}</div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12 p-6 bg-white/3 border border-white/8 rounded-2xl">
              <h3 className="font-bold text-white mb-4">Prepare for Kilimanjaro</h3>
              <div className="space-y-3">
                <Link to="/training-guides/kilimanjaro-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Training Plan — Full 12–16 week programme
                </Link>
                <Link to="/can-i-climb/kilimanjaro" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb Kilimanjaro? — Honest fitness assessment
                </Link>
              </div>
            </section>

            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Train for Kilimanjaro with Summit Ready</h2>
              <p className="text-muted-foreground mb-6">You could plan this yourself — but route choice, back-to-back training, and altitude preparation have to work together from the start. Get a personalised plan built for your route choice, fitness level, and local hills.</p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Kilimanjaro Plan <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
            </section>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
