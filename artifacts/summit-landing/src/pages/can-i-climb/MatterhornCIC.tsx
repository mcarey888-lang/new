import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, XCircle, AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

export default function MatterhornCIC() {
  usePageMeta({
    title: "Can I Climb the Matterhorn? | Honest Fitness & Experience Guide | SummitReady",
    description: "An honest guide to what it takes to climb the Matterhorn. The fitness, technical skills, and alpine experience required — and why most people aren't ready yet.",
    canonical: "https://summitready.uk/can-i-climb/matterhorn/",
    schema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can a beginner climb the Matterhorn?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "No. The Matterhorn is not suitable for beginners or intermediate mountaineers. It requires confident rock climbing ability (UIAA Grade III+), extensive alpine experience, and comfort on exposed ridges at altitude. Most guides recommend several seasons of serious alpine climbing before attempting it."
          }
        },
        {
          "@type": "Question",
          "name": "How long does it take to get fit enough for the Matterhorn?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Fitness is only part of the equation. The technical skills required for the Matterhorn take years to develop. Most guides suggest 2–3 years of progressive alpine experience, including completing routes like Mont Blanc and Gran Paradiso, plus development of rock climbing competence to at least UIAA Grade III."
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
              <span className="text-white">Matterhorn</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-red-400 bg-red-400/10 border-red-400/20">Expert</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> 2–3 years progressive training
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" /> 4,478m · Switzerland / Italy
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Can I Climb the Matterhorn?
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              The Matterhorn is one of the most recognisable mountains in the world — and one of the most dangerous. Here's an honest answer to whether you're ready for it, and what the realistic path looks like.
            </p>
          </div>
        </section>

        <div className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            <section className="mb-12">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">The honest answer</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                Probably not yet — and that's not a criticism. The Matterhorn via the Hörnli ridge (the standard route) involves sustained UIAA Grade III rock climbing at altitude, highly exposed terrain, and objective hazard from rockfall and weather that changes faster than almost any other peak in the Alps. It kills experienced mountaineers every season.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Unlike Mont Blanc, which an ambitious beginner can realistically train for in 16 weeks, the Matterhorn requires genuine technical climbing ability that takes years to develop safely. The good news is that the progression path is clear — and starting that path is entirely within reach.
              </p>
            </section>

            <section className="mb-12">
              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                {[
                  { label: "Beginner friendly?", value: "No — expert only", ok: false },
                  { label: "Rock climbing required?", value: "Yes — UIAA Grade III+", ok: false },
                  { label: "With a guide?", value: "Essential — not optional", ok: true },
                ].map((item) => (
                  <div key={item.label} className="bg-white/3 border border-white/8 rounded-xl p-5 text-center">
                    <div className="text-2xl mb-2">{item.ok ? "✓" : "✗"}</div>
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className={`text-sm font-semibold ${item.ok ? "text-primary" : "text-red-400"}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">You're ready to attempt the Matterhorn if</h2>
              <ul className="space-y-3 mb-8">
                {[
                  "You have multiple alpine seasons of experience — including several 4,000m peaks",
                  "You've summited Mont Blanc, Gran Paradiso, or similar routes independently",
                  "You're a confident rock climber at UIAA Grade III or above — outdoors, not just in a climbing gym",
                  "You're comfortable moving fast on steep, exposed terrain in mountain boots",
                  "You've experienced and managed poor weather, cold, and altitude on previous climbs",
                  "You're physically capable of 9–12 hours at altitude with 1,200m+ of climbing",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <h2 className="text-2xl font-display font-bold text-white mb-5">You're not ready if any of these apply</h2>
              <ul className="space-y-3">
                {[
                  "You've never climbed a glaciated alpine peak before",
                  "You can't confidently move on UIAA Grade III rock without protection",
                  "You've never used crampons and an ice axe in serious terrain",
                  "Mont Blanc is still on your to-do list — complete it first",
                  "You're counting on a guide to keep you safe on terrain you've never experienced",
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
                Most parties stay at the Hörnli hut (3,260m) the night before, departing at 3–4am. The Hörnli ridge is 1,200m of rock and mixed terrain. The upper section involves fixed ropes on genuinely exposed ground. Summit day is typically 9–12 hours round trip from the hut for a fast, competent party — longer for those less experienced.
              </p>
              <div className="space-y-3">
                {[
                  { time: "03:00–04:00", label: "Depart Hörnli hut in darkness with headtorch" },
                  { time: "07:00–09:00", label: "Upper ridge — crux sections, fixed ropes, highly exposed" },
                  { time: "08:00–10:00", label: "Summit (4,478m) — timing is weather-dependent, not guaranteed" },
                  { time: "13:00–15:00", label: "Return to hut — descent is slower and statistically more dangerous than ascent" },
                ].map((step) => (
                  <div key={step.time} className="flex gap-4 bg-white/3 border border-white/8 rounded-xl p-4">
                    <div className="text-xs font-bold text-primary shrink-0 w-20 pt-0.5">{step.time}</div>
                    <p className="text-sm text-muted-foreground">{step.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">The realistic progression path</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                If the Matterhorn is your goal and you're not there yet, here's what the sensible path looks like. This isn't a reason to give up — it's a roadmap.
              </p>
              <div className="space-y-4">
                {[
                  { step: "Step 1", title: "Build your hiking and mountain base", body: "Ben Nevis, Snowdon, Scafell Pike, or equivalent. Get comfortable on UK mountain terrain in all weather. This takes 1–2 seasons.", color: "text-primary" },
                  { step: "Step 2", title: "First alpine summit", body: "Gran Paradiso or a similar non-technical 4,000m peak with a guide. Learn crampons, glacier travel, hut culture, and the feel of altitude. This is a genuine step up.", color: "text-blue-400" },
                  { step: "Step 3", title: "Mont Blanc", body: "The Goûter route is the benchmark alpine objective. If you can climb Mont Blanc in good style, you have the physical base for the Matterhorn.", color: "text-orange-400" },
                  { step: "Step 4", title: "Rock climbing development", body: "Take a guided rock climbing course in the Alps or spend time at an outdoor crag developing UIAA Grade III+ competence. This is non-negotiable for the Matterhorn.", color: "text-purple-400" },
                  { step: "Step 5", title: "Matterhorn", body: "With several alpine seasons, Mont Blanc under your belt, and solid rock climbing ability, the Matterhorn becomes a realistic goal — still serious, still committing, but within reach.", color: "text-red-400" },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4 bg-white/3 border border-white/8 rounded-xl p-5">
                    <div className={`text-xs font-bold ${item.color} shrink-0 w-12 pt-0.5 uppercase tracking-widest`}>{item.step}</div>
                    <div>
                      <h3 className="font-bold text-white mb-1 text-sm">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">Key risks on the Matterhorn</h2>
              <div className="space-y-4">
                {[
                  { title: "Rockfall", body: "The Hörnli ridge sees significant rockfall, particularly as the day warms and ice binding the rock melts. This is why early starts are non-negotiable — and why helmets are essential. Don't linger below other parties on the ridge." },
                  { title: "Technical difficulty on tired legs", body: "Grade III rock climbing at sea level with fresh legs is manageable for an experienced climber. At 4,000m+ with 6 hours of effort already behind you, the same terrain is considerably harder. Fatigue management and pace judgement are critical." },
                  { title: "Weather", body: "Zermatt's weather is notoriously volatile. Summit windows can close in under an hour. Any competent guide will turn around without hesitation — and you need to trust that call completely." },
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
              <h3 className="font-bold text-white mb-4">Start building toward the Matterhorn</h3>
              <div className="space-y-3">
                <Link to="/mountains/matterhorn" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Matterhorn Mountain Profile — Routes, conditions, and what to expect
                </Link>
                <Link to="/training-guides/matterhorn-preparation-guide" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Matterhorn Preparation Guide — Full training and skills programme
                </Link>
                <Link to="/training-guides/mont-blanc-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Training Plan — The most important stepping stone
                </Link>
                <Link to="/can-i-climb/gran-paradiso" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb Gran Paradiso? — The right first alpine summit
                </Link>
              </div>
            </section>

            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Start the journey toward bigger summits</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                You could plot this progression yourself — but knowing when you're genuinely ready for each step, rather than just feeling optimistic, is where most people get into trouble. Summit Ready builds a personalised training plan that works toward your goal — wherever you're starting from.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Training Plan
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
