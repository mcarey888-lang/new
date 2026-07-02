import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Users, ChevronRight, AlertTriangle } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import { MOUNTAINS as _MOUNTAINS } from "@/data/mountains";

const MOUNTAINS = _MOUNTAINS.map((m) => ({
  name: m.name,
  href: m.cicHref ?? m.mountainHref,
  elevation: m.elevation,
  location: m.location,
  difficulty: m.difficulty,
  diffColor: `text-${m.diffColorBase}-400 bg-${m.diffColorBase}-400/10 border-${m.diffColorBase}-400/20`,
  beginner: m.beginner,
  beginnerOk: m.beginnerOk,
  trainingTime: m.trainingTime,
  description: m.cicDescription,
  available: m.available,
}));

export default function CanIClimb() {
  usePageMeta({
    title: "Am I Ready to Climb? | SummitReady",
    description: "Find out what fitness and preparation you need before committing to Mont Blanc, Kilimanjaro, the Matterhorn and more. Honest assessments for real climbers.",
    canonical: "https://summitready.uk/can-i-climb/",
    schema: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Am I Ready to Climb?",
      "description": "Find out what fitness and preparation you need before committing to your mountain.",
      "url": "https://summitready.uk/can-i-climb/",
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
              <AlertTriangle className="w-3 h-3" />
              Am I Ready?
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Am I Ready to Climb?
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mb-4">
              Find out what fitness and preparation you need before committing.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
              These honest guides cover difficulty, beginner suitability, required training time, and what you'll actually encounter on the mountain — so you can make a realistic decision before booking flights.
            </p>
          </div>
        </section>

        {/* Readiness Assessment Banner */}
        <section className="py-8 border-b border-white/5">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
              <div className="flex-1">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Free Assessment</div>
                <h3 className="font-bold text-white mb-1">Not sure which mountain fits your current level?</h3>
                <p className="text-sm text-muted-foreground">Answer 17 questions and get a personalised readiness score — calibrated to your chosen mountain's specific demands.</p>
              </div>
              <Link to="/readiness-check" className="shrink-0">
                <Button className="rounded-full bg-primary/15 text-primary hover:bg-primary/25 border border-primary/25 transition-all text-sm whitespace-nowrap font-semibold">
                  Take the assessment
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Mountain cards */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {MOUNTAINS.map((m) => (
                <div
                  key={m.name}
                  className={`bg-white/3 border border-white/8 rounded-2xl p-6 flex flex-col gap-4 hover:border-white/15 transition-all duration-200 ${!m.available ? "opacity-70" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${m.diffColor}`}>
                      {m.difficulty}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">{m.elevation} · {m.location}</span>
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">{m.name}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mb-4">{m.description}</p>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-xs text-muted-foreground mb-1">Beginner?</div>
                        <div className={`text-xs font-semibold ${m.beginnerOk ? "text-primary" : "text-orange-400"}`}>{m.beginner}</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-3">
                        <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Training
                        </div>
                        <div className="text-xs font-semibold text-white">{m.trainingTime}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-1">
                    {m.available ? (
                      <Link to={m.href}>
                        <Button variant="outline" size="sm" className="rounded-full border-white/15 hover:bg-white/5 hover:border-primary/40 hover:text-primary transition-all group">
                          Full guide
                          <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                        </Button>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground bg-white/5 border border-white/8 px-3 py-1.5 rounded-full inline-block">Coming soon</span>
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
              Not sure where to start?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              Summit Ready assesses your current fitness, summit goal, and available time — then builds your training plan automatically. No guesswork.
            </p>
            <a href="/#get-started">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                Build My Training Plan
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
