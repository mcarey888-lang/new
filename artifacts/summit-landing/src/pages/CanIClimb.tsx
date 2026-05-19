import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, Users, ChevronRight, AlertTriangle } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

const MOUNTAINS = [
  {
    name: "Mont Blanc",
    href: "/can-i-climb/mont-blanc",
    elevation: "4,808m",
    location: "France / Italy",
    difficulty: "Hard",
    diffColor: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    beginner: "No — experience needed",
    beginnerOk: false,
    trainingTime: "12–16 weeks",
    description: "Western Europe's highest peak. The standard Goûter route is non-technical but long, cold, and at serious altitude. A realistic goal for fit, experienced hikers willing to train properly.",
    available: true,
  },
  {
    name: "Kilimanjaro",
    href: "/can-i-climb/kilimanjaro",
    elevation: "5,895m",
    location: "Tanzania",
    difficulty: "Moderate",
    diffColor: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    beginner: "Yes — with preparation",
    beginnerOk: true,
    trainingTime: "12–16 weeks",
    description: "Africa's highest peak. No technical climbing required — but altitude is relentless. With the right preparation, this is achievable for determined beginners.",
    available: true,
  },
  {
    name: "Matterhorn",
    href: "/training-guides/matterhorn-preparation-guide",
    elevation: "4,478m",
    location: "Switzerland / Italy",
    difficulty: "Expert",
    diffColor: "text-red-400 bg-red-400/10 border-red-400/20",
    beginner: "No — technical skills required",
    beginnerOk: false,
    trainingTime: "6–12 months",
    description: "One of the Alps' most iconic peaks. Rock scrambling, fixed ropes, and glacier travel are essential. Not suitable for anyone without prior alpine mountaineering experience.",
    available: false,
  },
  {
    name: "Everest Base Camp",
    href: "/can-i-climb",
    elevation: "5,364m",
    location: "Nepal",
    difficulty: "Challenging",
    diffColor: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    beginner: "Possible — with serious prep",
    beginnerOk: true,
    trainingTime: "16+ weeks",
    description: "Not a summit — but a 130km trek to 5,364m over two weeks. Achievable for non-climbers with strong cardiovascular fitness and prior multi-day trekking experience.",
    available: false,
  },
  {
    name: "Gran Paradiso",
    href: "/can-i-climb",
    elevation: "4,061m",
    location: "Italy",
    difficulty: "Moderate",
    diffColor: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    beginner: "Yes — ideal first 4000er",
    beginnerOk: true,
    trainingTime: "10–14 weeks",
    description: "Italy's highest entirely-Italian peak and an ideal first high-altitude mountain. Glacier travel required but technically straightforward with a guide.",
    available: false,
  },
  {
    name: "Breithorn",
    href: "/can-i-climb",
    elevation: "4,164m",
    location: "Switzerland",
    difficulty: "Easy",
    diffColor: "text-green-400 bg-green-400/10 border-green-400/20",
    beginner: "Yes — most accessible 4000er",
    beginnerOk: true,
    trainingTime: "6–10 weeks",
    description: "Often called the easiest 4,000m peak in the Alps. Most parties use the cable car to 3,820m, then hike the remaining 344m on a well-tracked glacier. A great first high-altitude experience.",
    available: false,
  },
];

export default function CanIClimb() {
  usePageMeta({
    title: "Can I Climb This Mountain? | SummitReady",
    description: "Find out what fitness and preparation you need before committing to Mont Blanc, Kilimanjaro, the Matterhorn and more. Honest assessments for real climbers.",
    canonical: "https://summitready.uk/can-i-climb/",
    schema: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Can I Climb This Mountain?",
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
              Can I Climb?
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Can I Climb This Mountain?
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mb-4">
              Find out what fitness and preparation you need before committing.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
              These honest guides cover difficulty, beginner suitability, required training time, and what you'll actually encounter on the mountain — so you can make a realistic decision before booking flights.
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
