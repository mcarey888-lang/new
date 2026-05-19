import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, XCircle, AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

export default function EBCCIC() {
  usePageMeta({
    title: "Can I Do Everest Base Camp? | Fitness & Preparation Guide | SummitReady",
    description: "Find out if you're ready for the Everest Base Camp trek. An honest guide to the fitness, altitude, and back-to-back endurance the EBC trek actually demands.",
    canonical: "https://summitready.uk/can-i-climb/everest-base-camp/",
    schema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can an unfit person do Everest Base Camp?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "The EBC trek requires genuine cardiovascular fitness and the ability to hike 5–7 hours per day for 12–16 consecutive days at altitude. An unfit person who does not train specifically for it will struggle significantly, particularly above 4,000m where altitude compounds fatigue. With 16–20 weeks of preparation, people from a wide range of starting fitness levels can complete it."
          }
        },
        {
          "@type": "Question",
          "name": "How hard is the Everest Base Camp trek physically?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "EBC is physically demanding primarily due to its length and altitude. You hike 5–7 hours per day for 12–16 consecutive days, reaching 5,364m at Base Camp. The altitude alone reduces aerobic capacity by 30–40% compared to sea level, making even moderate effort feel much harder. The physical demands are very different from a single summit push — it's sustained, multi-day endurance."
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
              <span className="text-white">Everest Base Camp</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-orange-400 bg-orange-400/10 border-orange-400/20">Hard</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> 16–20 weeks training
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" /> 5,364m · 12–16 days trekking
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Can I Do Everest Base Camp?
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              EBC is achievable for determined, well-prepared people — but it's not a casual holiday. Here's an honest look at what you need physically and mentally before booking your flights.
            </p>
          </div>
        </section>

        <div className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            <section className="mb-12">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">The honest answer</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                Yes — if you prepare properly. Everest Base Camp is not a summit attempt. There's no technical climbing, no glacier travel, and no ropes. But at 5,364m over 12–16 consecutive days of hiking, it's one of the most demanding multi-day treks in the world. Altitude will affect everyone. Back-to-back days will wear down the underprepared.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The difference between people who love EBC and people who suffer through it usually comes down to one thing: back-to-back training. A long Saturday walk doesn't prepare you for day 10 on the trail. Consecutive days of hiking in training does.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                With 16–20 weeks of honest preparation and a sensible pacing strategy on the trek itself, EBC is achievable for most fit adults.
              </p>
            </section>

            <section className="mb-12">
              <div className="grid sm:grid-cols-3 gap-4 mb-8">
                {[
                  { label: "Technical climbing?", value: "None required", ok: true },
                  { label: "Training needed", value: "16–20 weeks", ok: true },
                  { label: "Altitude challenge?", value: "Significant — 5,364m", ok: false },
                ].map((item) => (
                  <div key={item.label} className="bg-white/3 border border-white/8 rounded-xl p-5 text-center">
                    <div className="text-2xl mb-2">{item.ok ? "✓" : "⚠"}</div>
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className={`text-sm font-semibold ${item.ok ? "text-primary" : "text-orange-400"}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">You're a good candidate if</h2>
              <ul className="space-y-3 mb-8">
                {[
                  "You can hike 4–5 hours continuously with moderate elevation gain",
                  "You're willing to train 4–5 days per week for 16–20 weeks",
                  "You can commit to back-to-back hiking days on weekends throughout your training",
                  "You don't have untreated cardiovascular or respiratory conditions",
                  "You understand that altitude will slow everyone down and are prepared to accept a slower pace",
                  "You have the time to complete the trek — rushing the itinerary to save days is the most common reason people fail",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <h2 className="text-2xl font-display font-bold text-white mb-5">EBC is not right for you if</h2>
              <ul className="space-y-3">
                {[
                  "You're planning to go without any specific training",
                  "You have a heart or lung condition that hasn't been assessed for high-altitude activity",
                  "You're booking a 10-day itinerary to save money — acclimatisation days are not optional extras",
                  "You've never hiked for more than 3 hours continuously",
                  "You're expecting to rely on porters for everything and do no physical effort yourself",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">What the trek actually feels like</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Day 1 from Lukla is steep and relentless — many people push too hard because they feel fresh. By day 6 or 7 (around Dingboche or Lobuche), the altitude and accumulated fatigue start to bite. The final push to Base Camp and Kala Patthar (5,545m) is the hardest day on tired legs, at maximum altitude, with the least oxygen.
              </p>
              <div className="space-y-3">
                {[
                  { time: "Days 1–3", label: "Lukla to Namche Bazaar — steep, demanding, beautiful. Everyone feels strong here. Pace yourself." },
                  { time: "Days 4–7", label: "Namche to Dingboche via Tengboche — altitude starts to affect sleep and appetite. Acclimatisation days are earned rest, not wasted time." },
                  { time: "Days 8–10", label: "Lobuche and Gorak Shep — above 5,000m, effort feels disproportionately hard. Short steep sections feel like long ones." },
                  { time: "Days 11–12", label: "Base Camp and Kala Patthar — the hardest days physically. Most people find Kala Patthar (5,545m) harder than EBC." },
                  { time: "Days 13–16", label: "The return — descending fast, body recovering, energy returning. Most trekkers feel dramatically better below 3,500m." },
                ].map((step) => (
                  <div key={step.time} className="flex gap-4 bg-white/3 border border-white/8 rounded-xl p-4">
                    <div className="text-xs font-bold text-primary shrink-0 w-20 pt-0.5">{step.time}</div>
                    <p className="text-sm text-muted-foreground">{step.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">The real risks on EBC</h2>
              <div className="space-y-4">
                {[
                  { title: "Acute Mountain Sickness (AMS)", body: "Above 3,500m, a significant proportion of trekkers experience AMS symptoms: headache, nausea, dizziness, poor sleep. It's manageable with proper acclimatisation, rest days, and not ascending too fast. The rule is: if symptoms are getting worse, you go down. There's no debating this on EBC." },
                  { title: "Going too fast", body: "This causes more EBC failures than poor fitness. The standard guideline is not to ascend more than 300–500m per day above 3,500m. Commercial itineraries sometimes push beyond this. If you feel unwell at altitude, a rest day is non-negotiable — not a sign of weakness." },
                  { title: "Cumulative fatigue and injury", body: "Knees, hips, and feet that are never tested in training over multiple consecutive days often fail on long treks. Blisters turn septic at altitude. Knee pain on the descent from Namche is agonising and incredibly common among under-prepared trekkers." },
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
              <h3 className="font-bold text-white mb-4">Plan your EBC preparation</h3>
              <div className="space-y-3">
                <Link to="/training-guides/everest-base-camp-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Everest Base Camp Training Plan — Full 16–20 week programme
                </Link>
                <Link to="/training-guides/kilimanjaro-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Training Plan — Another high-altitude multi-day objective
                </Link>
                <Link to="/can-i-climb/kilimanjaro" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb Kilimanjaro? — Compare EBC vs Kilimanjaro
                </Link>
              </div>
            </section>

            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Ready to prepare for EBC?</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Summit Ready builds a personalised training plan based on your current fitness, your trek date, and the hills near you.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My EBC Plan
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
