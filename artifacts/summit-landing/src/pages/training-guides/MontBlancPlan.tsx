import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";

function InternalCTA() {
  return (
    <div className="my-10 bg-primary/8 border border-primary/20 rounded-2xl p-7 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
      <div className="flex-1">
        <p className="font-bold text-white text-lg mb-1">Ready to start training?</p>
        <p className="text-muted-foreground text-sm leading-relaxed">Summit Ready builds your personalised Mont Blanc training plan — based on your fitness, your summit date, and the hills near where you live.</p>
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

export default function MontBlancPlan() {
  usePageMeta({
    title: "Mont Blanc Training Plan | How to Get Fit for Mont Blanc | SummitReady",
    description: "A practical Mont Blanc training plan covering endurance, strength, altitude preparation and common mistakes. 12–16 week programme for the Goûter route.",
    canonical: "https://summitready.uk/training-guides/mont-blanc-training-plan/",
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Mont Blanc Training Plan",
      "description": "A practical Mont Blanc training plan covering endurance, strength, altitude preparation and common mistakes.",
      "url": "https://summitready.uk/training-guides/mont-blanc-training-plan/",
      "author": { "@type": "Organization", "name": "SummitReady" },
      "publisher": { "@type": "Organization", "name": "SummitReady", "url": "https://summitready.uk/" },
      "mainEntityOfPage": "https://summitready.uk/training-guides/mont-blanc-training-plan/",
    },
  });

  return (
    <SiteLayout>
      <div className="bg-background">
        {/* Hero */}
        <section className="py-16 md:py-24 border-b border-white/5 relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(62,207,117,0.06),transparent_60%)]" />
          <div className="container mx-auto px-6 max-w-4xl relative">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/training-guides" className="hover:text-primary transition-colors">Training Guides</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">Mont Blanc</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-orange-400 bg-orange-400/10 border-orange-400/20">Hard</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                12–16 weeks recommended
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                4,808m summit
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Mont Blanc Training Plan
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              A practical training plan for the Goûter route — covering endurance, strength, altitude preparation, and the most common mistakes that stop people from summiting.
            </p>
          </div>
        </section>

        {/* Article body */}
        <article className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            {/* Section 1: Introduction */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Mont Blanc is achievable — if you prepare properly</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                At 4,808m, Mont Blanc is the highest peak in the Alps and Western Europe. The standard Goûter route doesn't require technical rock climbing, but don't mistake that for easy. Summit day involves 10–13 hours of effort, serious altitude, unpredictable weather, and terrain that will punish under-prepared legs on the descent.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The good news: this is an entirely realistic goal for a fit person who commits to proper preparation. Thousands of people summit Mont Blanc every season. The ones who fail — and many do — usually went underprepared, underestimating the altitude or the length of the day.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                This training plan is built around the real demands of the mountain. Follow it honestly and you'll arrive at the Goûter hut with the fitness to push for the summit.
              </p>

              <div className="mt-7 p-5 bg-white/3 border border-white/8 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Not sure if you're ready for Mont Blanc?</span> Read our full assessment: <Link to="/can-i-climb/mont-blanc" className="text-primary hover:underline">Can I Climb Mont Blanc?</Link></p>
              </div>
            </section>

            {/* Section 2: Fitness level */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How fit do you need to be?</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Before starting a Mont Blanc-specific training plan, you should already be at a baseline level of fitness. If you're starting from scratch, build a general base first, then transition to this programme.
              </p>

              <h3 className="text-lg font-bold text-white mb-3">Minimum baseline before starting this plan</h3>
              <ul className="space-y-3 mb-7">
                {[
                  "Able to hike for 5–6 hours with 800m+ elevation gain without feeling wrecked",
                  "Comfortable carrying a 10kg pack on a full-day mountain walk",
                  "Running, cycling, or some form of regular aerobic exercise 3×/week",
                  "At least one multi-day mountain hike in the past 12 months",
                  "No serious injuries or untreated cardiovascular conditions",
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
                  "Hike 20km+ with 1,500m elevation gain in a single day comfortably",
                  "Carry a 12–15kg pack for 8–12 hours across steep terrain",
                  "Back-to-back mountain days: two long days with significant elevation gain",
                  "Strong legs on descent — the down from the summit ridge will test your quads heavily",
                  "Confidence in crampons and basic alpine kit",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <InternalCTA />

            {/* Section 3: Timeline */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Training timeline</h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                16 weeks is the sweet spot for most people. 12 weeks works if you're already fit. Anything less than 10 weeks is a gamble — possible, but not recommended for your first attempt.
              </p>

              <div className="space-y-4">
                {[
                  {
                    phase: "16+ weeks out",
                    label: "Foundation",
                    color: "border-primary/30 bg-primary/5",
                    labelColor: "text-primary",
                    content: "Build your aerobic base. This is the most important phase. Run, cycle, or hike 4–5 days per week. Start adding one hill session per week. Focus on time on feet rather than intensity. If you're not already doing regular long walks, this is when you start.",
                  },
                  {
                    phase: "12–16 weeks",
                    label: "Build",
                    color: "border-blue-400/30 bg-blue-400/5",
                    labelColor: "text-blue-400",
                    content: "Increase elevation gain in your weekly long hike to 1,000m+. Add a second hill session per week. Begin weighted hill reps — carrying a pack up your local hill repeatedly. Start introducing back-to-back weekend days: a long hike Saturday, another on Sunday.",
                  },
                  {
                    phase: "8–12 weeks",
                    label: "Peak",
                    color: "border-orange-400/30 bg-orange-400/5",
                    labelColor: "text-orange-400",
                    content: "This is where you push hardest. Weekly elevation gain in training should reach 2,000–3,000m. Pack weight increases to 12–15kg on long days. Plan one or two multi-day mountain routes — ideally alpine or sub-alpine terrain if accessible. Descents become as important as ascents: train your quads eccentrically.",
                  },
                  {
                    phase: "4–8 weeks",
                    label: "Sharpen",
                    color: "border-purple-400/30 bg-purple-400/5",
                    labelColor: "text-purple-400",
                    content: "Maintain volume but sharpen intensity. Long days should now feel manageable rather than gruelling — a sign your body has adapted. Work on any technical gaps: crampon practice, moving in mountain boots, navigation in poor weather. Sort your kit and know exactly what you'll carry.",
                  },
                  {
                    phase: "Final 2 weeks",
                    label: "Taper",
                    color: "border-white/20 bg-white/3",
                    labelColor: "text-white",
                    content: "Reduce volume significantly but keep intensity. Two short, sharp hill sessions in the final week. Rest, sleep, eat well. Arriving fresh matters more than any last-minute fitness gains. Travel out to Chamonix at least 2–3 days before your summit attempt to begin acclimatising.",
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

            {/* Section 4: Weekly example */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">Example training week (peak phase)</h2>
              <p className="text-muted-foreground mb-6 text-sm">This is what a typical week looks like at weeks 8–12 of training.</p>

              <div className="overflow-hidden border border-white/8 rounded-xl">
                {[
                  { day: "Monday", type: "Strength", color: "text-blue-400", desc: "Leg strength circuit — weighted step-ups, Bulgarian split squats, single-leg deadlifts, calf raises. 45–60 minutes. Focus on unilateral movements that mirror the mechanics of mountain terrain." },
                  { day: "Tuesday", type: "Cardio", color: "text-primary", desc: "Zone 2 aerobic run or cycle, 50–60 minutes. Easy effort — you should be able to hold a full conversation. This builds your fat-burning base and aerobic engine without taxing recovery." },
                  { day: "Wednesday", type: "Recovery", color: "text-muted-foreground", desc: "Active recovery — yoga, mobility work, or a flat 30-minute walk. Do not train hard. Sleep and nutrition on Wednesday are as important as Monday's session." },
                  { day: "Thursday", type: "Hill reps", color: "text-orange-400", desc: "Weighted hill session — find a hill with 100–200m of elevation and repeat it 4–6 times with a 12kg pack. Walk the ascents hard, walk the descents controlled. This is the most direct Mont Blanc simulation in your plan." },
                  { day: "Friday", type: "Rest", color: "text-muted-foreground", desc: "Complete rest. Prepare your kit for the weekend. Eat and sleep well. Rest is where adaptation happens — don't skip it." },
                  { day: "Saturday", type: "Long mountain day", color: "text-primary", desc: "Full mountain day — aim for 1,200–1,800m elevation gain with a 12–15kg pack. Move continuously. Focus on pacing: a pace you can sustain for 10 hours, not 3. Descend carefully and train your legs on the way down." },
                  { day: "Sunday", type: "Short hike", color: "text-primary/60", desc: "30–60 minute easy hike or walk on tired legs. This mimics what day two of a mountain trip feels like. Nutritional recovery focus — protein and carbohydrates immediately after Saturday's effort." },
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

            {/* Section 5: Mistakes */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Common mistakes that cost people the summit</h2>

              <div className="space-y-4">
                {[
                  {
                    title: "Underestimating altitude",
                    body: "4,808m is serious altitude. Above 4,000m your body is under real physiological stress regardless of your fitness. You cannot train your way out of altitude entirely — acclimatisation in Chamonix before your summit attempt is non-negotiable. Spend at least 2–3 days hiking to 3,000m+ before summit day.",
                  },
                  {
                    title: "Never training with a pack",
                    body: "You'll carry 12–15kg on summit day. If you've trained entirely without a pack, your hips, back, and shoulders won't be ready. Introduce pack weight at week four and increase it gradually. By week 12, all long days should be done at full summit weight.",
                  },
                  {
                    title: "Ignoring descents",
                    body: "Most people train for going up. Coming down from Mont Blanc is where tired legs give out, ankles roll, and accidents happen. Include specific downhill training — controlled descent on steep terrain — every week. Eccentric leg exercises (slow, loaded squats and step-downs) directly address this.",
                  },
                  {
                    title: "Too much gym, not enough hills",
                    body: "Gym strength is useful for building resilience. But treadmill inclines and leg press don't replicate moving over uneven mountain terrain for 12 hours. Prioritise outdoor hill time — even if your nearest hill is 200m of ascent, repeating it builds the specific muscles and movement patterns that matter.",
                  },
                  {
                    title: "Starting too late",
                    body: "12 weeks is the realistic minimum. Most failed summit attempts we see in training programmes started 6–8 weeks out. Book your trip, set your summit date, and count backwards. If you have less than 10 weeks, consider delaying your booking.",
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

            {/* Section 6: How Summit Ready helps */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How Summit Ready builds your Mont Blanc plan</h2>
              <p className="text-muted-foreground leading-relaxed mb-5">
                The plan outlined above is a framework. What Summit Ready does is take that framework and personalise it around your specific situation:
              </p>
              <ul className="space-y-4 mb-7">
                {[
                  { title: "Your summit date", body: "We work backwards from your planned climb date and build a week-by-week schedule that peaks you at exactly the right time." },
                  { title: "Your current fitness", body: "A 2-minute onboarding questionnaire establishes where you're starting from. Your plan adjusts to where you actually are — not where you'd like to be." },
                  { title: "Your local hills", body: "We find the hills within reach of where you live and map them into your weekly sessions. No mountains nearby? We find what's closest and optimise around it." },
                  { title: "Adaptive scheduling", body: "Missed a session? Struggled with a hill day? The plan adjusts automatically. You're never chasing an impossible target after a bad week." },
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

            {/* Internal links */}
            <section className="mb-14 p-6 bg-white/3 border border-white/8 rounded-2xl">
              <h3 className="font-bold text-white mb-4">Related guides</h3>
              <div className="space-y-3">
                <Link to="/can-i-climb/mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb Mont Blanc? — Fitness assessment and honest expectations
                </Link>
                <Link to="/training-guides/kilimanjaro-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Training Plan — Africa's highest peak, 5,895m
                </Link>
                <Link to="/training-guides/matterhorn-preparation-guide" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Matterhorn Preparation Guide — The Alps' most iconic technical peak
                </Link>
              </div>
            </section>

            {/* Final CTA */}
            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Build My Mont Blanc Plan</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Get a personalised week-by-week training schedule built around your summit date, your fitness level, and the hills near you. Free to download.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Mont Blanc Plan
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
