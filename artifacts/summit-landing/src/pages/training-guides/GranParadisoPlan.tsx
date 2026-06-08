import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import heroBg from "../../assets/hero-gran-paradiso.jpg";

function InternalCTA() {
  return (
    <div className="my-10 bg-primary/8 border border-primary/20 rounded-2xl p-7 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
      <div className="flex-1">
        <p className="font-bold text-white text-lg mb-1">Ready to start training?</p>
        <p className="text-muted-foreground text-sm leading-relaxed">Summit Ready builds your personalised Gran Paradiso training plan — based on your fitness, your summit date, and the hills near where you live.</p>
      </div>
      <a href="/#get-started" className="shrink-0">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-7 h-12 shadow-[0_0_20px_rgba(62,207,117,0.3)] transition-all hover:scale-105 whitespace-nowrap">
          Build My Plan
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </a>
    </div>
  );
}

export default function GranParadisoPlan() {
  usePageMeta({
    title: "Gran Paradiso Training Plan | How to Get Fit for Gran Paradiso | SummitReady",
    description: "A practical Gran Paradiso training plan for Italy's highest peak. 10–14 week programme covering endurance, glacier travel, and alpine fitness for the 4,061m summit.",
    canonical: "https://summitready.uk/training-guides/gran-paradiso-training-plan/",
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Gran Paradiso Training Plan",
      "description": "A practical Gran Paradiso training plan for Italy's highest peak at 4,061m.",
      "url": "https://summitready.uk/training-guides/gran-paradiso-training-plan/",
      "author": { "@type": "Organization", "name": "SummitReady" },
      "publisher": { "@type": "Organization", "name": "SummitReady", "url": "https://summitready.uk/" },
      "mainEntityOfPage": "https://summitready.uk/training-guides/gran-paradiso-training-plan/",
    },
  });

  return (
    <SiteLayout>
      <div className="bg-background">
        <section className="py-16 md:py-24 border-b border-white/5 relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={heroBg} alt="" aria-hidden="true" className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(62,207,117,0.07),transparent_60%)]" />
          </div>
          <div className="container mx-auto px-6 max-w-4xl relative z-10">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/training-guides" className="hover:text-primary transition-colors">Training Guides</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">Gran Paradiso</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-blue-400 bg-blue-400/10 border-blue-400/20">Moderate–Hard</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                10–14 weeks recommended
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                4,061m · Italy
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Gran Paradiso Training Plan
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              Italy's highest peak is one of the best entry points into serious alpine mountaineering. Here's how to train for it — and what most people get wrong on the approach.
            </p>
          </div>
        </section>

        <article className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Why Gran Paradiso is a great first 4,000m peak</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                At 4,061m, Gran Paradiso is the highest peak located entirely within Italy. The standard route from the Vittorio Emanuele II hut is non-technical by alpine standards — no rock climbing required, straightforward glacier travel, no serious objective hazard in good conditions. Summit day is a long, hard 6–8 hours from the hut with 1,400m of elevation gain.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                For many people, Gran Paradiso is their first experience on a glaciated alpine summit. That makes the preparation both important and achievable — it doesn't require the volume of training that Mont Blanc demands, but it does require genuine mountain fitness and the right kit.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The mistake people make is treating it as just a long hike. It's not. You'll be on a glacier, wearing crampons, roped to a guide, at 4,000m. Your body needs to be ready for that before you arrive.
              </p>

              <div className="mt-7 p-5 bg-white/3 border border-white/8 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Not sure if you're ready?</span> Read our honest assessment: <Link to="/can-i-climb/gran-paradiso" className="text-primary hover:underline">Can I Climb Gran Paradiso?</Link></p>
              </div>
            </section>

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How fit do you need to be?</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Gran Paradiso is achievable for people who hike regularly and are willing to commit to 10–14 weeks of specific preparation. If you're already doing regular mountain days, you're closer than you think. If you're sedentary, start with the foundation phase immediately.
              </p>

              <h3 className="text-lg font-bold text-white mb-3">Minimum baseline before starting this plan</h3>
              <ul className="space-y-3 mb-7">
                {[
                  "Comfortable hiking for 5–6 hours with 700m+ elevation gain",
                  "Some experience on mountain terrain (not just footpaths)",
                  "Regular aerobic exercise at least 3× per week",
                  "Able to carry a 10kg pack for a full day without discomfort",
                  "No significant fear of heights or exposure on steep slopes",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <h3 className="text-lg font-bold text-white mb-3">What you need to achieve by summit day</h3>
              <ul className="space-y-3">
                {[
                  "Hike 8+ hours with 1,400m elevation gain at altitude, carrying 10–12kg",
                  "Comfortable moving on steep snow and ice with crampons",
                  "Back-to-back mountain days: hut approach day followed by summit day",
                  "Physically able to descend 1,400m on tired legs at pace — guides move fast on the way down",
                  "Genuine aerobic base — not just muscular strength",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <InternalCTA />

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Training timeline</h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                14 weeks is the comfortable window for most people. 10 weeks works if you're already doing regular mountain hiking. Don't attempt this with less than 8 weeks of specific prep — you'll be able to reach the hut, but summit day will be very hard.
              </p>

              <div className="space-y-4">
                {[
                  {
                    phase: "14+ weeks out",
                    label: "Foundation",
                    color: "border-primary/30 bg-primary/5",
                    labelColor: "text-primary",
                    content: "Build your aerobic base with 4 sessions per week. One long walk on the weekend with 500–700m elevation gain. Start building time on your feet: Gran Paradiso is a long day, and your cardiovascular system needs time to adapt. Don't rush this phase.",
                  },
                  {
                    phase: "10–14 weeks",
                    label: "Build",
                    color: "border-blue-400/30 bg-blue-400/5",
                    labelColor: "text-blue-400",
                    content: "Increase weekend hike elevation gain to 900–1,200m. Introduce a midweek hill session. Begin carrying a pack (8–10kg) on all hikes. This is when you start to build the specific leg endurance for summit day. Back-to-back weekend days become increasingly important.",
                  },
                  {
                    phase: "6–10 weeks",
                    label: "Peak",
                    color: "border-orange-400/30 bg-orange-400/5",
                    labelColor: "text-orange-400",
                    content: "Your hardest training phase. By week 8, you should be tired — that's correct, not a problem. Weekly elevation gain reaches 1,500–2,000m. Pack weight increases to 12kg on long days. Weekend back-to-back days are now standard: long day Saturday (5–6 hours), shorter day Sunday (3 hours). By the end of Sunday, you should feel exactly how you'll feel on Gran Paradiso's hut approach day — functional but depleted. If Sunday feels impossible, your Saturday pace was too aggressive. If possible, plan one multi-day mountain route with hut accommodation before this phase ends.",
                  },
                  {
                    phase: "4–6 weeks",
                    label: "Sharpen",
                    color: "border-purple-400/30 bg-purple-400/5",
                    labelColor: "text-purple-400",
                    content: "Maintain volume, clean up any weaknesses. If you haven't worn crampons before, hire a pair and practice on a snow slope — or find an indoor dry tooling session. Sort your kit: mountain boots, crampons, harness, ice axe. Don't leave equipment decisions until the week before.",
                  },
                  {
                    phase: "Final 2 weeks",
                    label: "Taper",
                    color: "border-white/20 bg-white/3",
                    labelColor: "text-white",
                    content: "Reduce volume by 40–50%. Two short sessions, lots of rest. Arrive in the Aosta Valley a day early if possible — the valley sits at 1,600–2,000m, which begins the acclimatisation process naturally. The hut approach on day one takes you to 2,732m.",
                  },
                ].map((phase) => (
                  <div key={phase.phase} className={`border rounded-xl p-6 ${phase.color}`}>
                    <div className="flex items-start gap-4">
                      <div className="shrink-0">
                        <div className={`text-xs font-bold uppercase tracking-widest mb-1 ${phase.labelColor}`}>{phase.label}</div>
                        <div className="text-sm font-semibold text-white">{phase.phase}</div>
                      </div>
                      <div className="w-px bg-white/10 self-stretch hidden sm:block" />
                      <p className="text-sm text-muted-foreground leading-relaxed">{phase.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">Example training week (peak phase)</h2>
              <p className="text-muted-foreground mb-6 text-sm">A typical week at weeks 7–9 of training.</p>

              <div className="overflow-hidden border border-white/8 rounded-xl">
                {[
                  { day: "Monday", type: "Strength", color: "text-blue-400", desc: "Unilateral leg work — step-ups with weight, Bulgarian split squats, single-leg calf raises. 45 minutes. Prioritise left-right balance: crampons and glacier terrain punish any muscle imbalance ruthlessly." },
                  { day: "Tuesday", type: "Cardio", color: "text-primary", desc: "Zone 2 run or cycle for 45–60 minutes. Comfortable aerobic effort. This is the base that keeps your engine efficient when your body is under altitude stress." },
                  { day: "Wednesday", type: "Recovery", color: "text-muted-foreground", desc: "Full rest or mobility. At this stage of the plan you're accumulating meaningful training load — recovery quality matters. Prioritise sleep and food." },
                  { day: "Thursday", type: "Hill reps", color: "text-orange-400", desc: "4–5 weighted hill repetitions on the steepest hill near you, with a 10–12kg pack. Walk the ascents; descend at a controlled tempo. The descent is as important as the climb — train it." },
                  { day: "Friday", type: "Rest", color: "text-muted-foreground", desc: "Rest. Prepare kit for the weekend. If you have crampon practice scheduled, this is a good evening to check your equipment fits correctly." },
                  { day: "Saturday", type: "Long hike", color: "text-primary", desc: "5–6 hours with 1,200–1,500m elevation gain and a 12kg pack. Maintain a consistent pace throughout — aim to finish at 70–75% effort, not exhausted. Eat 60–90g of carbohydrates per hour." },
                  { day: "Sunday", type: "Back-to-back", color: "text-primary/60", desc: "2.5–3.5 hours easy hiking on tired legs. The hut approach to the Vittorio Emanuele hut is 3 hours — Sunday mimics this. How you feel on Sunday tells you exactly how prepared you are." },
                ].map((item, i) => (
                  <div key={item.day} className={`p-5 flex gap-4 ${i > 0 ? "border-t border-white/5" : ""}`}>
                    <div className="w-20 shrink-0">
                      <div className="text-xs font-bold text-white">{item.day}</div>
                      <div className={`text-xs font-semibold mt-0.5 ${item.color}`}>{item.type}</div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Common mistakes on Gran Paradiso</h2>

              <div className="space-y-4">
                {[
                  {
                    title: "Treating it as a hiking objective",
                    body: "Gran Paradiso is not a hard hike. It's a glacier ascent at 4,000m with crampons, a rope, and an ice axe. The normal route is straightforward in good conditions, but the summit ridge is steep snow, and the glacier has crevasse zones. Come prepared for alpine conditions.",
                  },
                  {
                    title: "Arriving with new boots",
                    body: "Mountain boots for glacier travel are stiff and unforgiving. Blisters at 3,500m, six hours from the trailhead, are not a minor inconvenience — they can end your climb. Start wearing your summit boots on every long hike from week 6 onwards.",
                  },
                  {
                    title: "Skipping the crampon practice",
                    body: "If you've never worn crampons, going up and down a glacier for the first time on summit day is genuinely dangerous. Find a snow slope near you and practice beforehand — or book a guiding day in the Alps before your Gran Paradiso attempt.",
                  },
                  {
                    title: "Not acclimatising on the approach",
                    body: "The Vittorio Emanuele hut sits at 2,732m. You'll likely sleep there the night before summit day. Many people arrive in the Aosta Valley, go straight up to the hut, sleep poorly at altitude, and attempt the summit in worse shape than they'd have been after a night in the valley. Spend at least one night lower before the hut.",
                  },
                  {
                    title: "Weak aerobic base, strong gym numbers",
                    body: "Gran Paradiso is 6–8 hours of sustained aerobic effort. A strong deadlift doesn't help you at hour five. Prioritise your weekly zone 2 cardio and long hike — this is not a mountain you can muscle up.",
                  },
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

            <InternalCTA />

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How Summit Ready builds your Gran Paradiso plan</h2>
              <p className="text-muted-foreground leading-relaxed mb-5">
                You could build this plan yourself — but Gran Paradiso's specific demands (back-to-back days, crampon practice timing, peaking at altitude) are easy to miss without a structured programme. Gran Paradiso prep is highly specific to where you are in the world and what hills you have access to. Summit Ready builds around your real situation:
              </p>
              <ul className="space-y-4 mb-7">
                {[
                  { title: "Your summit date", body: "We build backwards from your climb date so your fitness peaks at exactly the right time — not two weeks before or three weeks after." },
                  { title: "Your current fitness", body: "Whether you're starting from recreational hiking or already doing regular mountain days, your plan adapts to your real starting point." },
                  { title: "Your local hills", body: "Gran Paradiso prep works just as well in the Lake District or Scottish Highlands as it does next to the Alps. We find what's near you and build it into your schedule." },
                  { title: "Adaptive scheduling", body: "Life interrupts training. Summit Ready adjusts your plan when sessions get missed — keeping you on track without panic." },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white">{item.title}: </span>
                      <span className="text-muted-foreground text-sm">{item.body}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mb-14 p-6 bg-white/3 border border-white/8 rounded-2xl">
              <h3 className="font-bold text-white mb-4">Related guides</h3>
              <div className="space-y-3">
                <Link to="/can-i-climb/gran-paradiso" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb Gran Paradiso? — Honest fitness and readiness assessment
                </Link>
                <Link to="/training-guides/mont-blanc-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Training Plan — The next step after Gran Paradiso
                </Link>
                <Link to="/can-i-climb/mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb Mont Blanc? — Comparing both objectives
                </Link>
                <Link to="/training-guides/train-for-mountains-using-local-hills" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Train for Mountains Using Local Hills — UK hill repeats for big summits
                </Link>
              </div>
            </section>

            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Build My Gran Paradiso Plan</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Get a personalised training schedule built around your summit date, fitness level, and the hills near you.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Gran Paradiso Plan
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </a>
            </section>

          </div>
        </article>
      </div>
    </SiteLayout>
  );
}
