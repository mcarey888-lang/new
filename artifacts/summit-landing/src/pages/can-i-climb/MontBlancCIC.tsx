import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, XCircle, AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

export default function MontBlancCIC() {
  usePageMeta({
    title: "Can I Climb Mont Blanc? | Fitness & Preparation Guide | SummitReady",
    description: "Find out if you're ready to climb Mont Blanc. Honest assessment of the fitness, experience, and preparation required for the Goûter route.",
    canonical: "https://summitready.uk/can-i-climb/mont-blanc/",
    schema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can a beginner climb Mont Blanc?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Mont Blanc is not suitable for complete beginners. You need prior mountain hiking experience, comfort carrying a heavy pack, and ideally some experience on alpine terrain. With 12–16 weeks of dedicated training, a fit person with prior mountain experience can realistically summit."
          }
        },
        {
          "@type": "Question",
          "name": "How fit do you need to be to climb Mont Blanc?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "You need to be able to hike 20km+ with 1,500m elevation gain carrying a 12–15kg pack, and sustain 10–13 hours of effort on summit day. A strong aerobic base and specific hill training are essential."
          }
        }
      ]
    },
  });

  return (
    <SiteLayout>
      <div className="bg-background">
        {/* Hero */}
        <section className="py-16 md:py-24 border-b border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(62,207,117,0.06),transparent_60%)]" />
          <div className="container mx-auto px-6 max-w-4xl relative">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/can-i-climb" className="hover:text-primary transition-colors">Can I Climb?</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">Mont Blanc</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-orange-400 bg-orange-400/10 border-orange-400/20">Hard</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> 12–16 weeks training
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" /> 4,808m · France / Italy
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Can I Climb Mont Blanc?
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              An honest assessment of the fitness, experience, and preparation required before you book your trip to Chamonix.
            </p>
          </div>
        </section>

        <div className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            {/* Quick verdict */}
            <section className="mb-12">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">The honest answer</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                Yes — but not without preparation. Mont Blanc's standard Goûter route is non-technical, meaning it doesn't require rock climbing ability or ropes. But it's a serious, committing mountain day at nearly 4,800m with significant objective hazard, long distances, and altitude that will test even well-trained climbers.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The success rate on Mont Blanc varies significantly by preparation. Under-prepared climbers make up the majority of those who turn back — or worse. With proper training (12–16 weeks minimum), this is a realistic goal for a fit person with prior mountain experience.
              </p>
            </section>

            {/* Quick cards */}
            <section className="mb-12">
              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                {[
                  { label: "Beginner friendly?", value: "No — experience needed", ok: false },
                  { label: "Training needed", value: "12–16 weeks minimum", ok: true },
                  { label: "Technical skills?", value: "Basic crampons only", ok: true },
                ].map((item) => (
                  <div key={item.label} className="bg-white/3 border border-white/8 rounded-xl p-5 text-center">
                    <div className={`text-2xl mb-2`}>{item.ok ? "✓" : "✗"}</div>
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className={`text-sm font-semibold ${item.ok ? "text-primary" : "text-orange-400"}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* Good candidate */}
            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">You're a good candidate if you can say yes to most of these</h2>
              <ul className="space-y-3 mb-8">
                {[
                  "You've completed full-day mountain hikes with 1,000m+ elevation gain",
                  "You're comfortable hiking for 8+ hours continuously",
                  "You regularly do aerobic exercise (running, cycling, hiking) at least 3× a week",
                  "You've carried a 10kg+ pack on a mountain walk",
                  "You have no significant fear of heights or exposed ridge walking",
                  "You have at least 12 weeks available to train before your climb",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <h2 className="text-2xl font-display font-bold text-white mb-5">You're not ready yet if any of these apply</h2>
              <ul className="space-y-3">
                {[
                  "You've never done a full-day mountain hike with significant elevation gain",
                  "You struggle to hike for more than 3–4 hours without exhaustion",
                  "You have less than 8 weeks to train before your planned summit date",
                  "You have an untreated cardiovascular condition",
                  "You have significant anxiety about exposure, heights, or steep terrain",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* What summit day is like */}
            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">What summit day actually looks like</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Most parties stay at the Goûter hut (3,835m) the night before, leaving at 1–2am for the summit. From the hut to the summit and back is 10–13 hours total for most climbers — on legs that have already been working since the previous morning's hut approach. By the time you reach the Vallot emergency shelter (4,362m), roughly three hours in, you understand what altitude actually feels like: breathing is audible on inclines that would be trivial at lower elevation, each step takes deliberate effort, and the cold is deeper than your layers suggest it should be. This is when under-prepared climbers start making poor decisions.
              </p>
              <div className="space-y-3">
                {[
                  { time: "01:00–02:00", label: "Depart Goûter hut in darkness, crampons on" },
                  { time: "05:00–06:00", label: "Reach the Vallot emergency hut (4,362m) — many climbers assess here" },
                  { time: "07:00–09:00", label: "Summit (4,808m) — weather window critical" },
                  { time: "11:00–14:00", label: "Return to Goûter hut — quads under maximum load on descent" },
                ].map((step) => (
                  <div key={step.time} className="flex gap-4 bg-white/3 border border-white/8 rounded-xl p-4">
                    <div className="text-xs font-bold text-primary shrink-0 w-20 pt-0.5">{step.time}</div>
                    <p className="text-sm text-muted-foreground">{step.label}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Key risks */}
            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">Key risks to plan around</h2>
              <div className="space-y-4">
                {[
                  { title: "Altitude sickness", body: "Above 4,000m, AMS (acute mountain sickness) affects a significant proportion of climbers. Symptoms include headache, nausea, and disorientation. Acclimatise properly in Chamonix for 2–3 days before your summit attempt." },
                  { title: "Weather", body: "Mont Blanc weather can change in minutes. A good forecast at 6am does not guarantee a safe summit. Check Chamonix's summit forecast daily, not just on departure day." },
                  { title: "Objective hazard", body: "The Goûter couloir — the section between the Nid d'Aigle and the Goûter hut — sees regular rockfall. Move quickly through this section and don't linger." },
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

            {/* Related */}
            <section className="mb-12 p-6 bg-white/3 border border-white/8 rounded-2xl">
              <h3 className="font-bold text-white mb-4">Plan your Mont Blanc preparation</h3>
              <div className="space-y-3">
                <Link to="/training-guides/mont-blanc-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Training Plan — Full 12–16 week programme
                </Link>
                <Link to="/mountains/mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Mountain Profile — Routes, conditions, and logistics
                </Link>
                <Link to="/can-i-climb/kilimanjaro" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb Kilimanjaro? — Compare Mont Blanc vs Kilimanjaro
                </Link>
              </div>
            </section>

            {/* CTA */}
            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Ready to build your plan?</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                You could research and plan this yourself — but the most common failures come from people who trained hard without direction: too much gym work, not enough hills, no back-to-back days. Summit Ready builds a personalised training plan based on your current fitness, your summit date, and the hills near you.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Mont Blanc Plan
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
