import React from "react";
import { Link } from "react-router-dom";
import { Mountain, ArrowRight, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import { MOUNTAINS as _MOUNTAINS } from "@/data/mountains";

const MOUNTAINS = _MOUNTAINS.map((m) => ({
  name: m.name,
  href: m.mountainHref,
  elevation: m.elevation,
  location: m.location,
  type: m.type,
  difficulty: m.difficulty,
  diffColor: `text-${m.diffColorBase}-400`,
  emoji: m.emoji,
  tagline: m.tagline,
  description: m.description,
  available: m.available,
  trainingHref: m.trainingHref,
  cic: m.cicHref,
  readinessHref: m.readinessHref,
}));

export default function Mountains() {
  usePageMeta({
    title: "Mountain Profiles | Mont Blanc, Kilimanjaro, Matterhorn | SummitReady",
    description: "Detailed profiles for Mont Blanc, Kilimanjaro, the Matterhorn and more. Discover what each mountain demands and how to train for it.",
    canonical: "https://summitready.uk/mountains/",
    schema: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Mountain Profiles",
      "description": "Detailed profiles for Mont Blanc, Kilimanjaro, the Matterhorn and more. Discover what each mountain demands and how to train for it.",
      "url": "https://summitready.uk/mountains/",
      "publisher": { "@type": "Organization", "name": "SummitReady", "url": "https://summitready.uk/" },
    },
  });

  return (
    <SiteLayout>
      <div className="bg-background min-h-screen">
        {/* Hero */}
        <section className="py-20 md:py-28 border-b border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(62,207,117,0.07),transparent_60%)]" />
          <div className="container mx-auto px-6 max-w-4xl relative">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary mb-6 uppercase tracking-widest">
              <Mountain className="w-3 h-3" />
              Mountains
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Mountain Profiles
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              Detailed information on the world's most popular summit objectives — covering difficulty, key facts, best routes, and how to train for each one.
            </p>
          </div>
        </section>

        {/* Mountain cards */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {MOUNTAINS.map((m) => (
                <div
                  key={m.name}
                  className={`bg-white/3 border border-white/8 rounded-2xl overflow-hidden flex flex-col hover:border-white/15 transition-all duration-200 ${!m.available ? "opacity-70" : ""}`}
                >
                  {/* Card header */}
                  <div className="p-6 border-b border-white/5 flex items-start gap-4">
                    <span className="text-3xl">{m.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold ${m.diffColor}`}>{m.difficulty}</span>
                        <span className="text-white/20">·</span>
                        <span className="text-xs text-muted-foreground">{m.type}</span>
                      </div>
                      <h2 className="text-xl font-bold text-white leading-tight">{m.name}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{m.tagline}</p>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 divide-x divide-white/5 border-b border-white/5">
                    <div className="p-4 text-center">
                      <div className="text-lg font-bold text-white">{m.elevation}</div>
                      <div className="text-xs text-muted-foreground">Elevation</div>
                    </div>
                    <div className="p-4 text-center">
                      <div className="text-sm font-semibold text-white leading-snug">{m.location}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Location</div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="p-6 flex-1">
                    <p className="text-sm text-muted-foreground leading-relaxed">{m.description}</p>
                  </div>

                  {/* Actions */}
                  <div className="px-6 pb-6 flex flex-wrap gap-2">
                    {m.available ? (
                      <>
                        <Link to={m.href}>
                          <Button variant="outline" size="sm" className="rounded-full border-white/15 hover:bg-white/5 hover:border-primary/40 hover:text-primary transition-all group text-xs">
                            Full profile
                            <ChevronRight className="w-3 h-3 ml-1" />
                          </Button>
                        </Link>
                        {m.trainingHref && (
                          <Link to={m.trainingHref}>
                            <Button size="sm" className="rounded-full bg-primary/15 text-primary hover:bg-primary/25 border border-primary/25 transition-all text-xs">
                              Training plan
                            </Button>
                          </Link>
                        )}
                        {m.readinessHref && (
                          <Link to={m.readinessHref}>
                            <Button size="sm" className="rounded-full bg-white/5 text-white/60 hover:bg-primary/10 hover:text-primary border border-white/10 hover:border-primary/25 transition-all text-xs">
                              Am I ready?
                            </Button>
                          </Link>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground bg-white/5 border border-white/8 px-3 py-1.5 rounded-full">Coming soon</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#081021] border-t border-white/5">
          <div className="container mx-auto px-6 max-w-3xl text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-5 tracking-tight">
              Know your mountain. Now train for it.
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Summit Ready is built around specific mountain goals — not generic fitness plans. Pick your peak and we'll build the plan to get you there.
            </p>
            <a href="/#get-started">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                Start Training for My Mountain
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
