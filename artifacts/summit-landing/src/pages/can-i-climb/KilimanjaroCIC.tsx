import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, XCircle, AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

export default function KilimanjaroCIC() {
  usePageMeta({
    title: "Am I Ready for Kilimanjaro? | Fitness & Preparation Guide | SummitReady",
    description: "Find out if you're ready to climb Kilimanjaro. Honest assessment covering altitude, multi-day endurance, and whether beginners can summit Africa's highest peak.",
    canonical: "https://summitready.uk/can-i-climb/kilimanjaro/",
    schema: {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": "Can a beginner climb Kilimanjaro?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Yes — Kilimanjaro is achievable for determined beginners with proper preparation. No technical climbing skills are needed. The challenge is altitude and multi-day endurance. With 12–16 weeks of focused training, most motivated people can summit."
          }
        },
        {
          "@type": "Question",
          "name": "How hard is Kilimanjaro to climb?",
          "acceptedAnswer": {
            "@type": "Answer",
            "text": "Kilimanjaro is rated moderate in difficulty. There is no technical climbing required. The main challenges are altitude (5,895m) and the need to hike 6–9 hours per day for 5–8 consecutive days. Around 65% of climbers on the popular Marangu route reach the summit; this rises to 85%+ on the longer Machame route."
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
              <Link to="/can-i-climb" className="hover:text-primary transition-colors">Am I Ready?</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">Kilimanjaro</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-blue-400 bg-blue-400/10 border-blue-400/20">Moderate</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" /> 12–16 weeks training
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" /> 5,895m · Tanzania
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Am I Ready for Kilimanjaro?
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              An honest guide to what it takes to summit Africa's highest peak — including whether beginners can do it, and what you'll actually encounter on the mountain.
            </p>
          </div>
        </section>

        <div className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            <section className="mb-12">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">The short answer: yes — with preparation</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                Kilimanjaro is the most accessible of the Seven Summits. It requires no technical climbing ability, no ropes, no crampons, and no prior mountaineering experience. What it demands is cardiovascular fitness, multi-day endurance, and the mental resilience to keep moving when altitude and fatigue are working against you.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Summit success rates vary dramatically by route and preparation. The 5-day Marangu route has a success rate around 65%. The 7-day Machame route — which most guides recommend — reaches 85%+ because the extra days allow proper acclimatisation.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                If you are willing to train for 12–16 weeks and choose the right route, Kilimanjaro is a realistic goal for most motivated adults.
              </p>
            </section>

            {/* Stats */}
            <section className="mb-12">
              <div className="grid sm:grid-cols-3 gap-4">
                {[
                  { label: "Beginner friendly?", value: "Yes — with training", ok: true },
                  { label: "Training needed", value: "12–16 weeks", ok: true },
                  { label: "Technical skills?", value: "None required", ok: true },
                ].map((item) => (
                  <div key={item.label} className="bg-white/3 border border-white/8 rounded-xl p-5 text-center">
                    <div className="text-2xl mb-2">{item.ok ? "✓" : "✗"}</div>
                    <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                    <div className="text-sm font-semibold text-primary">{item.value}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">You're well placed to attempt Kilimanjaro if…</h2>
              <ul className="space-y-3 mb-8">
                {[
                  "You can hike for 5–6 hours without feeling utterly destroyed",
                  "You exercise regularly — running, cycling, gym, swimming — at least 3× a week",
                  "You're mentally prepared for multiple days of sustained effort",
                  "You can commit to 12+ weeks of dedicated training before departure",
                  "You're willing to choose a 7-day route (Machame or Lemosho) over shorter alternatives",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <h2 className="text-2xl font-display font-bold text-white mb-5">You should wait and train longer if…</h2>
              <ul className="space-y-3">
                {[
                  "You currently do little to no regular aerobic exercise",
                  "You have less than 10 weeks before departure",
                  "You're planning the 5-day Marangu route to save money — choose longer routes",
                  "You have a known cardiovascular condition that hasn't been assessed by a doctor",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">The altitude reality</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Kilimanjaro's summit is at 5,895m — higher than every peak in the Alps and the Rockies. At that altitude, you're operating on roughly half the available oxygen compared to sea level. No amount of cardiovascular fitness fully compensates for this. Acclimatisation — sleeping at progressively higher altitudes over multiple days — is what determines success.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Summit night is the hardest part of the climb, and most people underestimate it. You leave Barafu camp (4,673m) at midnight having slept poorly at altitude, hike through temperatures of –15°C or colder for 5–7 hours, and reach Uhuru Peak at dawn — if you make it. Nausea, severe headaches, and tunnel-vision fatigue are completely normal at this altitude. The pace is genuinely slow — slower than feels right — but going faster is how people get turned around 200 metres from the summit.
              </p>

              <div className="p-5 bg-blue-400/5 border border-blue-400/20 rounded-xl">
                <p className="text-sm text-blue-300 font-semibold mb-1">The most important decision you'll make</p>
                <p className="text-sm text-muted-foreground leading-relaxed">Choose the Machame (7 days) or Lemosho (8 days) route. The extra acclimatisation days significantly improve your summit chances and your safety. Book with a reputable operator — not the cheapest option you can find.</p>
              </div>
            </section>

            <section className="mb-12">
              <h2 className="text-2xl font-display font-bold text-white mb-5">Key risks</h2>
              <div className="space-y-4">
                {[
                  { title: "Acute mountain sickness", body: "AMS is the primary risk on Kilimanjaro. Symptoms include headache, nausea, dizziness, and in severe cases, HACE or HAPE. If your symptoms worsen overnight rather than improving, descent is the only treatment. Know the symptoms before you go." },
                  { title: "Exhaustion and attrition", body: "Kilimanjaro climbers who fail almost always turn back through exhaustion rather than injury. Multiple consecutive days of 6–9 hours of hiking accumulates relentlessly. Build back-to-back endurance in training." },
                  { title: "Cold on summit night", body: "Temperatures at the summit can reach –15°C to –25°C with wind chill. Underestimating the cold is a serious mistake. Layering, waterproofs, and proper gloves are not optional." },
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
              <h3 className="font-bold text-white mb-4">Plan your Kilimanjaro preparation</h3>
              <div className="space-y-3">
                <Link to="/training-guides/kilimanjaro-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Training Plan — Full 12–16 week programme
                </Link>
                <Link to="/mountains/kilimanjaro" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Mountain Profile — Routes, best time, and logistics
                </Link>
                <Link to="/can-i-climb/mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Am I Ready for Mont Blanc? — Compare with Western Europe's highest peak
                </Link>
              </div>
            </section>

            {/* Readiness assessment inline CTA */}
            <section className="mb-8 bg-white/3 border border-white/8 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
              <div className="flex-1">
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Free Assessment</div>
                <h3 className="font-bold text-white mb-1">Check your personal readiness score</h3>
                <p className="text-sm text-muted-foreground">Answer 17 questions and get an instant result — including what to focus on and how long you need to prepare for Kilimanjaro.</p>
              </div>
              <Link to="/readiness-check?mountain=kilimanjaro" className="shrink-0">
                <Button size="sm" className="rounded-full bg-primary/15 text-primary hover:bg-primary/25 border border-primary/25 transition-all text-xs whitespace-nowrap font-semibold">
                  Take the assessment →
                </Button>
              </Link>
            </section>

            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Build My Kilimanjaro Training Plan</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                You could figure this out yourself — but the specific combination of back-to-back training, progressive pack weight, and cardiovascular base that Kilimanjaro demands is easy to get wrong. Summit Ready builds your personalised plan based on your route choice, departure date, and current fitness — then adapts week by week as you progress.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Kilimanjaro Plan
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
