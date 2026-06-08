import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, XCircle, AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

export default function GranParadisoCIC() {
  usePageMeta({
    title: "Can I Climb Gran Paradiso? | Fitness & Preparation Guide | SummitReady",
    description: "Find out if you're ready to climb Gran Paradiso. An honest assessment of what Italy's highest peak demands — fitness, experience, and the right preparation.",
    canonical: "https://summitready.uk/can-i-climb/gran-paradiso/",
    schema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can a beginner climb Gran Paradiso?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Gran Paradiso is accessible to motivated beginners with prior mountain hiking experience and 10–14 weeks of dedicated preparation. It requires glacier travel (crampons and ice axe) but no technical rock climbing. A guided ascent makes it achievable for those newer to alpine terrain."
          }
        },
        {
          "@type": "Question",
          "name": "How hard is Gran Paradiso to climb?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Gran Paradiso is rated PD (peu difficile) in alpine grading — non-technical but a genuine mountain day. Summit day from the Vittorio Emanuele II hut is 6–8 hours with 1,400m elevation gain on glacier terrain. The main demands are cardiovascular fitness, comfort on snow and ice, and the ability to sustain effort at altitude."
          }
        }
      ]
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
              <Link to="/can-i-climb" className="hover:text-primary transition-colors">Can I Climb?</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">Gran Paradiso</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-blue-400 bg-blue-400/10 border-blue-400/20">Moderate–Hard</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> 10–14 weeks training
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" /> 4,061m · Italy
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Can I Climb Gran Paradiso?
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              Gran Paradiso is Italy's highest peak and one of the most accessible 4,000m summits in the Alps. Here's an honest look at whether you're ready — and what it actually takes.
            </p>
          </div>
        </section>

        <div className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            <section className="mb-12">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">The honest answer</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                Yes — with genuine preparation. Gran Paradiso is rated PD (peu difficile) in alpine climbing grades, which means "not very difficult" by alpine standards. The standard route from the Vittorio Emanuele II hut involves glacier travel but no technical rock climbing. It's one of the best first 4,000m peaks in the Alps, and an excellent stepping stone toward Mont Blanc.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The important caveat: "not very difficult" in alpine terms still means a long, demanding day at real altitude with crampons on a glacier. People who underestimate the preparation required don't fail dramatically — they just have a miserable, exhausting day and frequently don't reach the summit. More specifically: the final section involves a steep snow couloir that demands something in reserve. An under-prepared climber often turns back here — 45 minutes from the top — not because of technical difficulty, but because their legs are empty.
              </p>
            </section>

            <section className="mb-12">
              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                {[
                  { label: "Beginner friendly?", value: "Some experience needed", ok: true },
                  { label: "Training needed", value: "10–14 weeks minimum", ok: true },
                  { label: "Technical skills?", value: "Crampons and glacier travel", ok: true },
                ].map((item) => (
                  <div key={item.label} className="bg-white/3 border border-white/8 rounded-xl p-5 text-center">
                    <div className="text-2xl mb-2">✓</div>
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-sm font-semibold text-primary">{item.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">You're a good candidate if</h2>
              <ul className="space-y-3 mb-8">
                {[
                  "You've completed full-day mountain hikes with 700m+ elevation gain",
                  "You're comfortable hiking for 6–8 hours continuously",
                  "You do regular aerobic exercise — running, cycling, hiking — at least 3× per week",
                  "You're willing to use crampons and follow guide instructions on glacier terrain",
                  "You have no serious fear of heights or moderately exposed ridge walking",
                  "You have 10–14 weeks available to train specifically for this objective",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <h2 className="text-2xl font-display font-bold text-white mb-5">You're not ready yet if</h2>
              <ul className="space-y-3">
                {[
                  "You've never done a full-day mountain walk with significant elevation",
                  "You have less than 8 weeks to train before your planned climb",
                  "You're completely sedentary and haven't exercised regularly in over a year",
                  "You have a significant fear of heights or enclosed spaces",
                  "You plan to attempt it without a guide and have no glacier experience",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">What summit day actually looks like</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Most parties stay the night before at the Vittorio Emanuele II hut (2,732m), departing at 3–4am. From the hut to summit and back is 6–8 hours for a fit, guided party. The glacier approach is straightforward but exposed — and the summit ridge is steep snow with some rock scrambling in late season.
              </p>
              <div className="space-y-3">
                {[
                  { time: "03:00–04:00", label: "Depart hut in darkness, crampons on — follow guide closely on glacier" },
                  { time: "05:30–07:00", label: "Upper glacier and snow slopes — the longest sustained climb" },
                  { time: "07:00–09:00", label: "Summit (4,061m) — exposed final ridge with rock scrambling" },
                  { time: "10:00–12:00", label: "Return to hut — descent faster but requires care on steep snow" },
                ].map((step) => (
                  <div key={step.time} className="flex gap-4 bg-white/3 border border-white/8 rounded-xl p-4">
                    <div className="text-xs font-bold text-primary shrink-0 w-20 pt-0.5">{step.time}</div>
                    <p className="text-sm text-muted-foreground">{step.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">Key risks to understand</h2>
              <div className="space-y-4">
                {[
                  { title: "Altitude", body: "At 4,061m you're at genuine altitude. Most people won't experience serious AMS (Acute Mountain Sickness) on Gran Paradiso, but headaches, reduced performance, and poor sleep at the hut are common. Arriving in the Aosta Valley a day early helps significantly." },
                  { title: "Weather on the glacier", body: "Glaciers amplify weather. Temperature drops rapidly in cloud or wind, and afternoon storms are common in the Alps from June onwards. An early start is protection against this — most guides will turn back if conditions deteriorate above 3,500m." },
                  { title: "Crevasses", body: "The Gran Paradiso glacier has crevasse zones. These are well-marked and managed with a guide, but they're a real hazard for parties without proper glacier training attempting the route unguided. Do not attempt this route without a qualified alpine guide if you have no glacier experience." },
                ].map((item) => (
                  <div key={item.title} className="flex gap-4 bg-white/3 border border-white/8 rounded-xl p-6">
                    <AlertTriangle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-bold text-white mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12 p-6 bg-white/3 border border-white/8 rounded-2xl">
              <h3 className="font-bold text-white mb-4">Plan your Gran Paradiso preparation</h3>
              <div className="space-y-3">
                <Link to="/training-guides/gran-paradiso-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Gran Paradiso Training Plan — Full 10–14 week programme
                </Link>
                <Link to="/can-i-climb/mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb Mont Blanc? — The natural next step after Gran Paradiso
                </Link>
                <Link to="/training-guides/mont-blanc-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Training Plan — For when you're ready to go higher
                </Link>
              </div>
            </section>

            {/* Readiness assessment inline CTA */}
            <section className="mb-8 bg-white/3 border border-white/8 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
              <div className="flex-1">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Free Assessment</div>
                <h3 className="font-bold text-white mb-1">Check your personal readiness score</h3>
                <p className="text-sm text-muted-foreground">Answer 17 questions and get an instant result — including what to work on and how long you need to prepare for Gran Paradiso.</p>
              </div>
              <Link to="/readiness-check?mountain=gran-paradiso" className="shrink-0">
                <Button size="sm" className="rounded-full bg-primary/15 text-primary hover:bg-primary/25 border border-primary/25 transition-all text-xs whitespace-nowrap font-semibold">
                  Take the assessment →
                </Button>
              </Link>
            </section>

            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Ready to build your plan?</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                You could plan this yourself — but Gran Paradiso's specific combination of back-to-back endurance, crampon practice, and altitude timing is easy to get wrong without a structured programme. Summit Ready builds a personalised training plan based on your current fitness, your summit date, and the hills near you.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Gran Paradiso Plan
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
            </section>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
