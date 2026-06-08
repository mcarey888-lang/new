import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import heroBg from "../../assets/hero-mont-blanc.jpg";

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
          <div className="absolute inset-0">
            <img src={heroBg} alt="" aria-hidden="true" className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(62,207,117,0.07),transparent_60%)]" />
          </div>
          <div className="container mx-auto px-6 max-w-4xl relative z-10">
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Mont Blanc is achievable — but most people underestimate what it takes</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                At 4,808m, Mont Blanc is the highest peak in the Alps. The standard Goûter route involves no technical rock climbing — but summit day is 10–13 hours of continuous effort at serious altitude, in conditions that can turn hostile in minutes, on terrain that will destroy under-prepared legs on the 1,500m descent. People underestimate this every single season.
              </p>
              <p className="text-xl font-semibold text-white mb-4 leading-snug">
                Most people don't fail on Mont Blanc because they're unfit — they fail because they train for the wrong thing.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Thousands summit every summer. Many more don't make it. The failures are rarely people who weren't fit — they're people who weren't prepared for the <em>specific</em> demands: the physiological stress above 4,000m, the accumulated fatigue from the Goûter hut approach day, the 3am start on minimal sleep, the quads giving out two hours into the descent. None of these are mysteries. All of them are trainable.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                If you can hike 5–6 hours with 800m of elevation gain and you have 12 weeks or more, you're in a realistic position. Follow this plan with honesty — do the sessions you find uncomfortable, not just the ones you enjoy — and you'll arrive at the Goûter hut with something in reserve.
              </p>

              <div className="mt-7 p-5 bg-white/3 border border-white/8 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Not sure if you're ready for Mont Blanc?</span> Read our full assessment: <Link to="/can-i-climb/mont-blanc" className="text-primary hover:underline">Can I Climb Mont Blanc?</Link></p>
              </div>
            </section>

            {/* Section 2: Fitness level */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How fit do you need to be?</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Where most people struggle is the gap between general fitness and mountain-specific fitness. You might run 5km three times a week and feel fit — but that won't prepare you for carrying 13kg up a steep snow slope at 4,400m after five hours already on your feet. The baseline below is the honest minimum before starting this plan. If you're below it, spend 4–6 weeks building that base first.
              </p>

              <h3 className="text-lg font-bold text-white mb-3">Self-test: can you start this plan now?</h3>
              <ul className="space-y-3 mb-5">
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

              <div className="mb-7 p-4 bg-orange-400/5 border border-orange-400/20 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-orange-400 font-semibold">If you can't meet most of these yet, you're not ready — but you can get there.</span> Spend 4–6 weeks on general fitness first. Your tendons and cardiovascular system need time to adapt that simply can't be compressed. Rushing this is the most common cause of injury.</p>
              </div>

              <h3 className="text-lg font-bold text-white mb-3">Where you need to be by summit day</h3>
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
                    content: "This phase feels deceptively easy at first — that's the point. Most people skip it to save time and then struggle in week 9 wondering why. Build your aerobic base: run, cycle, or hike 4–5 days per week, one hill session per week minimum. Focus on time on feet, not intensity. Cardiovascular adaptation is slow and cannot be compressed — there is no way to make it up later.",
                  },
                  {
                    phase: "12–16 weeks",
                    label: "Build",
                    color: "border-blue-400/30 bg-blue-400/5",
                    labelColor: "text-blue-400",
                    content: "This is where training starts to feel like real work. Increase weekly long hike elevation gain to 1,000m+. Add a second hill session mid-week. Begin weighted hill reps — 10kg pack up your local hill 4–5 times per session. Introduce back-to-back weekend days: 5–6 hours Saturday, 2–3 hours Sunday. The back-to-back combination is what most people skip and what matters most — the mountain doesn't give you a rest day between approach and summit.",
                  },
                  {
                    phase: "8–12 weeks",
                    label: "Peak",
                    color: "border-orange-400/30 bg-orange-400/5",
                    labelColor: "text-orange-400",
                    content: "This is the closest your training will get to how the mountain actually feels. Push hardest here — but most people either overtrain and get injured, or back off and arrive underprepared. Weekly elevation gain should reach 2,000–3,000m. Pack weight increases to 12–15kg on all long days. Plan at least one multi-day mountain route if accessible. If you find yourself dreading every session, cut volume by 15% for a week: sustained training at 85% beats burning out completely.",
                  },
                  {
                    phase: "4–8 weeks",
                    label: "Sharpen",
                    color: "border-purple-400/30 bg-purple-400/5",
                    labelColor: "text-purple-400",
                    content: "This phase is about closing gaps, not adding fitness. Maintain volume, sharpen intensity. If your long days still feel gruelling here, that's useful information — you may need another week of peak before you taper. Use this phase for technical work: crampon practice, moving in mountain boots on steep ground, navigation in poor conditions. Every item of kit should be decided and tested before the final two weeks.",
                  },
                  {
                    phase: "Final 2 weeks",
                    label: "Taper",
                    color: "border-white/20 bg-white/3",
                    labelColor: "text-white",
                    content: "The urge to cram in extra training here is strong — ignore it. The fitness is already built. Reduce volume significantly but keep a little intensity: two short, sharp hill sessions in the final week. Rest, sleep, and eat well. Arriving in Chamonix fresh matters far more than any last-minute gains. Get out at least 2–3 days before your summit attempt to begin acclimatising.",
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
              <p className="text-muted-foreground mb-2 text-sm">This is what a typical week looks like at weeks 8–12 of training.</p>
              <p className="text-muted-foreground mb-1 text-sm">By the end of this week, you should feel tired but not broken. If you're drained by Thursday, your Saturday volume is too high or your recovery is off — both are fixable. Most people go out too hard in week 8 and accumulate fatigue they can't shed before the taper.</p>
              <p className="text-muted-foreground mb-6 text-sm">Pace yourself across the full training block, not just individual sessions. Consistency over 12 weeks beats heroics in week 3.</p>

              <div className="overflow-hidden border border-white/8 rounded-xl">
                {[
                  { day: "Monday", type: "Strength", color: "text-blue-400", desc: "Leg strength circuit — weighted step-ups, Bulgarian split squats, single-leg deadlifts, calf raises. 45–60 minutes. Focus on unilateral movements that mirror the mechanics of mountain terrain." },
                  { day: "Tuesday", type: "Cardio", color: "text-primary", desc: "Zone 2 aerobic run or cycle, 50–60 minutes. Easy effort — you should be able to hold a full conversation. This builds your fat-burning base and aerobic engine without taxing recovery." },
                  { day: "Wednesday", type: "Recovery", color: "text-muted-foreground", desc: "Active recovery — yoga, mobility work, or a flat 30-minute walk. Do not train hard. Sleep and nutrition on Wednesday are as important as Monday's session." },
                  { day: "Thursday", type: "Hill reps", color: "text-orange-400", desc: "Weighted hill session — find a hill with 100–200m of elevation and repeat it 4–6 times with a 12kg pack. Walk the ascents hard, walk the descents controlled. This is the most direct Mont Blanc simulation in your plan." },
                  { day: "Friday", type: "Rest", color: "text-muted-foreground", desc: "Complete rest. Prepare your kit for the weekend. Eat and sleep well. Rest is where adaptation happens — don't skip it." },
                  { day: "Saturday", type: "Long mountain day", color: "text-primary", desc: "Full mountain day — 1,200–1,800m elevation gain with a 12–15kg pack. The target pace is whatever you could sustain for 10 hours straight — most people misjudge this badly and blow up at hour 4. Eat 60–80g of carbohydrate per hour from the start, not when you're already hungry. Descend deliberately: this is training, not a recovery walk." },
                  { day: "Sunday", type: "Back-to-back", color: "text-primary/60", desc: "60–90 minute easy hike on tired legs. Not optional — this is one of the most specific things you can do for Mont Blanc. The Goûter hut approach day and summit day are back-to-back. Sunday tells you exactly how prepared you are." },
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
                    body: "4,808m is serious altitude. Above 4,000m, your body is under genuine physiological stress regardless of fitness — AMS doesn't just mean a headache, it means nausea, poor decision-making, inability to regulate temperature, and a rapidly deteriorating ability to keep moving. You cannot train your way out of altitude entirely. Acclimatise in Chamonix: spend at least 2–3 days hiking to 3,000m+ before your summit attempt. People who fly in Friday and attempt the summit Saturday have a dramatically higher failure rate.",
                  },
                  {
                    title: "Never training with a pack",
                    body: "People turn up with a 12kg pack on summit day having never trained with weight — and it completely changes how everything feels. Your pace drops, your hip flexors fatigue in unfamiliar ways, and shoulder discomfort starts dominating your attention before you've even reached the Goûter hut. Introduce pack weight from week four and increase it gradually. By week 12, every long day should be done at full summit weight.",
                  },
                  {
                    title: "Ignoring descents",
                    body: "Most people train going up and treat the descent as recovery. On Mont Blanc, the 1,500m descent from the summit ridge is taken on legs that have already been working for 7–8 hours, on steep snow, often in deteriorating afternoon conditions. This is where falls, twisted ankles, and blown quads happen. Build controlled downhill sessions into every training week from month two. Slow, loaded step-downs and eccentric split squats are the most targeted exercises — boring, but they directly replicate the stress of descent.",
                  },
                  {
                    title: "Too much gym, not enough hills",
                    body: "Most people think if they can squat well and run a decent pace they'll handle the mountain fine. They won't — not on day 2 of back-to-back alpine terrain. Gym strength builds resilience, but it doesn't replicate 12 hours of uneven ground, loaded descents, and the proprioceptive demands of mountain terrain. Prioritise outdoor hill time above everything else. A 200m local hill, repeated, trains the specific movement patterns and mental endurance that no gym session touches.",
                  },
                  {
                    title: "Starting too late",
                    body: "12 weeks is the realistic minimum — and only if you're already at the fitness baseline. The most common pattern we see: someone books Mont Blanc 8 weeks out, panics, trains too hard too fast, picks up a knee injury at week 5, arrives at the Goûter hut underprepared and over-fatigued. Book your trip first, then count backwards. If you have less than 10 weeks, seriously consider shifting your booking date.",
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How Summit Ready turns this into your actual training plan</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Most people who train without a structured plan make the same mistakes: they do too much in weeks 2–4, train the things they're good at (usually cardio), avoid the things they find hard (usually loaded descents and back-to-back days), and arrive peaking at week 8 instead of week 16. A generic plan doesn't know your summit date, your local hills, or where you're actually starting from.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-5">
                Summit Ready closes that gap:
              </p>
              <ul className="space-y-4 mb-7">
                {[
                  { title: "Works backwards from your summit date", body: "Enter your climb date and Summit Ready builds a week-by-week plan that peaks your fitness at exactly the right moment. Not 3 weeks too early, not still ramping up when you land in Chamonix." },
                  { title: "Starts from where you actually are", body: "A short onboarding assessment (takes about 2 minutes) establishes your real fitness baseline. If you're already doing regular mountain days, it skips the foundation phase. If you're starting from scratch, it builds you up properly from week one." },
                  { title: "Uses the hills near you", body: "Most people aren't based next to the Alps. Summit Ready finds the hills within reach of where you live and builds them into your weekly schedule — specific sessions on specific terrain, not generic instructions." },
                  { title: "Adjusts when life gets in the way", body: "Missed a week? Had a bad hill session? The plan recalculates. You're never left chasing a training block that's already impossible to complete." },
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
              <h3 className="font-bold text-white mb-1">Not sure if Mont Blanc is the right next step?</h3>
              <p className="text-sm text-muted-foreground mb-4">These guides will help you figure out where you stand and what to target next.</p>
              <div className="space-y-3">
                <Link to="/can-i-climb/mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb Mont Blanc? — Honest fitness assessment before you book
                </Link>
                <Link to="/training-guides/gran-paradiso-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Gran Paradiso Training Plan — The ideal first 4,000m peak before Mont Blanc
                </Link>
                <Link to="/mountains/mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Mountain Profile — Routes, conditions, and logistics
                </Link>
                <Link to="/can-i-climb/mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb Mont Blanc? — Honest fitness assessment
                </Link>
                <Link to="/training-guides/kilimanjaro-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Training Plan — Africa's highest peak, 5,895m
                </Link>
                <Link to="/training-guides/matterhorn-preparation-guide" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Matterhorn Preparation Guide — The next level after Mont Blanc
                </Link>
              </div>
            </section>

            {/* Final CTA */}
            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Get your personalised Mont Blanc training plan</h2>
              <p className="text-muted-foreground mb-3 leading-relaxed">
                You could piece this together yourself — but most people either under-train the things that actually matter or burn out before they peak.
              </p>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Summit Ready removes the guesswork. Tell it your summit date, your current fitness, and where you're based — it builds a week-by-week plan around the hills near you, starting from where you actually are. No generic schedules. No chasing a plan designed for someone else.
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
