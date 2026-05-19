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
        <p className="text-muted-foreground text-sm leading-relaxed">Summit Ready builds your personalised EBC training plan — based on your fitness, your trek date, and the hills near where you live.</p>
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

export default function EBCPlan() {
  usePageMeta({
    title: "Everest Base Camp Training Plan | How to Get Fit for EBC | SummitReady",
    description: "A practical Everest Base Camp training plan covering endurance, back-to-back trekking days, and altitude preparation. 16–20 week programme for the EBC trek.",
    canonical: "https://summitready.uk/training-guides/everest-base-camp-training-plan/",
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Everest Base Camp Training Plan",
      "description": "A practical Everest Base Camp training plan covering endurance, back-to-back trekking days, and altitude preparation.",
      "url": "https://summitready.uk/training-guides/everest-base-camp-training-plan/",
      "author": { "@type": "Organization", "name": "SummitReady" },
      "publisher": { "@type": "Organization", "name": "SummitReady", "url": "https://summitready.uk/" },
      "mainEntityOfPage": "https://summitready.uk/training-guides/everest-base-camp-training-plan/",
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
              <Link to="/training-guides" className="hover:text-primary transition-colors">Training Guides</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">Everest Base Camp</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-orange-400 bg-orange-400/10 border-orange-400/20">Hard</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                16–20 weeks recommended
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                5,364m · 12–16 days trekking
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Everest Base Camp Training Plan
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              EBC is not a summit — it's a two-week high-altitude trek that demands serious multi-day endurance. This plan covers what you actually need to do to arrive at 5,364m feeling strong, not destroyed.
            </p>
          </div>
        </section>

        <article className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">What EBC actually demands</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                Everest Base Camp sits at 5,364m — higher than any mountain in the Alps. But unlike a single summit push, you get there by trekking 6–7 hours a day for 12–16 consecutive days. The challenge isn't one brutal effort. It's relentless accumulation: waking up tired, trekking again, sleeping poorly at altitude, repeating.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The standard route runs from Lukla (2,840m) through Namche Bazaar (3,440m), Tengboche (3,870m), Dingboche (4,360m), Lobuche (4,940m), and finally Base Camp. You'll cover around 130km total, gain approximately 8,000m cumulatively, and carry a 10–15kg daypack every single day.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Most people who struggle on EBC are aerobically capable but haven't trained their bodies for back-to-back days. That's the single biggest thing this plan addresses.
              </p>

              <div className="mt-7 p-5 bg-white/3 border border-white/8 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Wondering if you're ready?</span> Read our honest assessment: <Link to="/can-i-climb/everest-base-camp" className="text-primary hover:underline">Can I do Everest Base Camp?</Link></p>
              </div>
            </section>

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How fit do you need to be?</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                EBC is achievable for people who don't consider themselves "mountaineers" — but not for people who don't train for it. The altitude alone will limit your performance regardless of fitness. What fitness does is determine how much in reserve you have when things get hard.
              </p>

              <h3 className="text-lg font-bold text-white mb-3">Minimum baseline before starting this plan</h3>
              <ul className="space-y-3 mb-7">
                {[
                  "Able to hike 4–5 hours continuously with moderate elevation gain (600m+)",
                  "Some experience with multi-day walking or hillwalking",
                  "Regular aerobic exercise — running, cycling, or swimming — 3× per week",
                  "Comfortable carrying a loaded daypack (8–10kg) for several hours",
                  "No untreated cardiovascular conditions or respiratory issues",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <h3 className="text-lg font-bold text-white mb-3">What you need to achieve by trek day one</h3>
              <ul className="space-y-3">
                {[
                  "Back-to-back hiking: 6 hours on Saturday, 4–5 hours on Sunday — every weekend for the final 8 weeks",
                  "Comfortable carrying a 12–15kg pack on a full day's walk",
                  "Able to hike uphill for sustained periods (90 minutes+) without stopping",
                  "Strong enough on descents — bad knees on day 3 will ruin a 16-day trek",
                  "No surprises with your boots: 60+ hours in your trekking footwear before day one",
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
                20 weeks is ideal if you're starting from a moderate base. 16 weeks works for people already doing regular aerobic training. Under 12 weeks is a short window — possible, but the back-to-back conditioning you need can't really be rushed.
              </p>

              <div className="space-y-4">
                {[
                  {
                    phase: "20+ weeks out",
                    label: "Foundation",
                    color: "border-primary/30 bg-primary/5",
                    labelColor: "text-primary",
                    content: "The most important thing in this phase is not missing sessions. Three to four aerobic sessions per week — runs, cycles, swims — and one longer weekend walk to build time on your feet. At this stage, nothing should feel like serious training. You're building the habit and the cardiovascular base that everything else depends on. The biggest mistake is skipping this phase to save time, jumping straight into back-to-back days, and then burning out at week 12 wondering why your body won't recover properly.",
                  },
                  {
                    phase: "16–20 weeks",
                    label: "Build",
                    color: "border-blue-400/30 bg-blue-400/5",
                    labelColor: "text-blue-400",
                    content: "Introduce your long weekend hike as a fixed weekly commitment. Aim for 800–1,000m elevation gain per week. Start carrying a pack on your long days — begin at 8kg and increase by 1kg every 2–3 weeks. This is where the base-to-base training starts.",
                  },
                  {
                    phase: "10–16 weeks",
                    label: "Peak",
                    color: "border-orange-400/30 bg-orange-400/5",
                    labelColor: "text-orange-400",
                    content: "Back-to-back weekends are now the priority. Hike 5–6 hours on Saturday, return for 3–4 hours on Sunday. This is non-negotiable for EBC prep. Weekly elevation gain reaches 1,500–2,000m. Pack weight hits 12–15kg on all long days. If possible, plan a 3–4 day multi-day route.",
                  },
                  {
                    phase: "6–10 weeks",
                    label: "Sharpen",
                    color: "border-purple-400/30 bg-purple-400/5",
                    labelColor: "text-purple-400",
                    content: "Maintain back-to-back weekends but increase duration slightly. Focus on maintaining consistent pace on tired legs — this mimics exactly what happens on the trek. Address any kit issues now, not at Lukla airport.",
                  },
                  {
                    phase: "Final 2 weeks",
                    label: "Taper",
                    color: "border-white/20 bg-white/3",
                    labelColor: "text-white",
                    content: "Cut volume by 40%. Keep two short aerobic sessions. Sleep well. Sort your kit, medications, and travel documents. If you're flying via Kathmandu, spend a night or two there to begin adjusting before you hit altitude at Lukla.",
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
              <p className="text-muted-foreground mb-6 text-sm">What a typical week looks like at weeks 10–14 of training.</p>

              <div className="overflow-hidden border border-white/8 rounded-xl">
                {[
                  { day: "Monday", type: "Strength", color: "text-blue-400", desc: "Leg and posterior chain — weighted step-ups, Romanian deadlifts, single-leg squats, calf raises. 45–60 minutes. Focus on movements that replicate uneven terrain: lunges on a slope if possible." },
                  { day: "Tuesday", type: "Cardio", color: "text-primary", desc: "Zone 2 run or cycle for 50–60 minutes. Easy conversation pace. You're building mitochondrial density and fat-burning efficiency — both critical at altitude where your aerobic capacity drops by 30–40%." },
                  { day: "Wednesday", type: "Recovery", color: "text-muted-foreground", desc: "Stretching, mobility, or a 30-minute flat walk. Prioritise sleep on Wednesday nights — recovery happens overnight, not during sessions." },
                  { day: "Thursday", type: "Hill reps", color: "text-orange-400", desc: "Weighted hill reps with a 12kg pack — 4–6 repetitions of a 150–200m climb. Walk hard uphill, descent at controlled pace. This is the closest simulation to the Khumbu trail in your local environment." },
                  { day: "Friday", type: "Rest", color: "text-muted-foreground", desc: "Complete rest. Prep your kit and food for the weekend. On EBC you'll trek 6 days a week — Friday rest mimics the minimal recovery time you'll have between big days." },
                  { day: "Saturday", type: "Long day", color: "text-primary", desc: "5–6 hour mountain or hill day with 1,200–1,500m elevation gain and a full 12–15kg pack. Maintain a sustainable pace — think 2.5–3km/h on ascent. Eat and drink to a schedule: don't wait until you're hungry or thirsty." },
                  { day: "Sunday", type: "Back-to-back", color: "text-primary/60", desc: "3–4 hours of hiking on tired legs. Not optional — this is the entire point of the week. On EBC you will feel exactly this: day six on the trek feels like Sunday here." },
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Common mistakes that make EBC harder than it needs to be</h2>

              <div className="space-y-4">
                {[
                  {
                    title: "Going too fast in the first three days",
                    body: "The trail from Lukla to Namche is steep and relentless. Many people push hard because they feel good at lower altitude. By Dingboche or Lobuche, the accumulated fatigue from going too fast early catches up badly. Slow down from day one — a sustainable pace on EBC is slower than you think.",
                  },
                  {
                    title: "Not training back-to-back days",
                    body: "One long Saturday walk is not EBC preparation. The most specific training you can do is consecutive day hiking — 5–6 hours Saturday, 3–4 hours Sunday. If you do nothing else from this plan, do this. It's the closest simulation to the real thing you have access to.",
                  },
                  {
                    title: "Underestimating the altitude",
                    body: "Above 4,000m, most trekkers slow significantly. Above 5,000m, even very fit people feel the effects. No amount of hill training at sea level fully prepares you for this — but the fitter you are, the more in reserve you have. Expect 30–40% performance reduction at EBC altitude.",
                  },
                  {
                    title: "New boots on a 16-day trek",
                    body: "This costs more trekkers their trip than almost anything else. Your feet will take a catastrophic beating if your boots aren't properly broken in. Get your trekking boots 3–4 months before departure and wear them on every training walk.",
                  },
                  {
                    title: "Skipping knee preparation",
                    body: "The descent from EBC — particularly the section from Lobuche back through Namche — is long, steep, and taken on tired legs. Eccentric quadricep training (slow, loaded step-downs) from week 8 onwards significantly reduces descent pain and risk of injury.",
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How Summit Ready builds your EBC plan</h2>
              <p className="text-muted-foreground leading-relaxed mb-5">
                You could piece this together yourself — but the most common pattern we see is people completing the long Saturday walks while skipping the Sunday back-to-backs because they feel optional. They're not. Summit Ready builds a week-by-week schedule personalised around your specific situation, with the back-to-backs built in as fixed:
              </p>
              <ul className="space-y-4 mb-7">
                {[
                  { title: "Your trek date", body: "We count backwards from your departure and build a plan that peaks your fitness at the right moment — not 4 weeks too early." },
                  { title: "Your current fitness", body: "A short onboarding questionnaire tells us where you're starting from. If you're already fit, we skip the early phases. If you're starting from scratch, we build you up properly." },
                  { title: "Your local hills", body: "The app finds hills and trails within reach of where you live and plugs them into your weekly schedule. Flat area? We adapt your sessions around what's available." },
                  { title: "Adaptive planning", body: "Missed a week due to illness or work? Your plan adjusts. You're never left chasing unachievable targets after a disrupted stretch." },
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
                <Link to="/can-i-climb/everest-base-camp" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Do Everest Base Camp? — Honest fitness assessment
                </Link>
                <Link to="/training-guides/kilimanjaro-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Training Plan — Another multi-day high-altitude objective
                </Link>
                <Link to="/training-guides/mont-blanc-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Training Plan — Single-day alpine summit at 4,808m
                </Link>
              </div>
            </section>

            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Build My EBC Training Plan</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Get a personalised week-by-week schedule built around your trek date, your fitness level, and the hills near you.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My EBC Plan
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
