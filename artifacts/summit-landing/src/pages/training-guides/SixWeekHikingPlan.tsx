import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import heroBg from "../../assets/hero-bg.jpeg";

function InternalCTA() {
  return (
    <div className="my-10 bg-primary/8 border border-primary/20 rounded-2xl p-7 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
      <div className="flex-1">
        <p className="font-bold text-white text-lg mb-1">Ready to build your plan?</p>
        <p className="text-muted-foreground text-sm leading-relaxed">Summit Ready builds a personalised training plan based on your summit goal, your fitness, and the hills near where you live.</p>
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

export default function SixWeekHikingPlan() {
  usePageMeta({
    title: "6-Week Hiking Training Plan | Build Fitness for Mountain Walking | SummitReady",
    description: "A practical 6-week hiking training plan to build trail fitness fast. Designed for Ben Nevis, Snowdon, and similar objectives — or as a base for bigger mountain goals.",
    canonical: "https://summitready.uk/training-guides/6-week-hiking-training-plan/",
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "6-Week Hiking Training Plan",
      "description": "A practical 6-week hiking training plan to build trail fitness fast.",
      "url": "https://summitready.uk/training-guides/6-week-hiking-training-plan/",
      "author": { "@type": "Organization", "name": "SummitReady" },
      "publisher": { "@type": "Organization", "name": "SummitReady", "url": "https://summitready.uk/" },
      "mainEntityOfPage": "https://summitready.uk/training-guides/6-week-hiking-training-plan/",
    },
  });

  return (
    <SiteLayout>
      <div className="bg-background">
        <section className="py-16 md:py-24 border-b border-white/5 relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={heroBg} alt="" aria-hidden="true" className="w-full h-full object-cover object-top opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(62,207,117,0.07),transparent_60%)]" />
          </div>
          <div className="container mx-auto px-6 max-w-4xl relative z-10">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/training-guides" className="hover:text-primary transition-colors">Training Guides</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">6-Week Hiking Plan</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-primary bg-primary/10 border-primary/20">Beginner–Moderate</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                6 weeks
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                For UK hills, European treks & base conditioning
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              6-Week Hiking Training Plan
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              Six weeks isn't long — but it's enough to make a real difference if you use it well. This plan is for people with a specific hike coming up, or those building the base fitness needed for bigger alpine goals.
            </p>
          </div>
        </section>

        <article className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">What 6 weeks can and can't do</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                Let's be honest first. Six weeks of training will not get you ready for Mont Blanc or Kilimanjaro. It will, however, meaningfully improve your fitness for objectives like Ben Nevis (1,345m), Snowdon (1,085m), Scafell Pike (978m), or the Tour du Mont Blanc as a walking route. It will also build the foundation you need before starting a longer alpine programme.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The key constraint with 6 weeks is adaptation time. Your cardiovascular system improves relatively quickly — 3–4 weeks. Your tendons, ligaments, and connective tissue take 8–12 weeks to adapt to load. This means a 6-week plan has to be honest about training volume: we can get you fitter, but we can't fully condition your joints if you've been sedentary.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                If you have a bigger objective — Kilimanjaro, the Alps, the Himalayas — treat this plan as the launching pad for a longer programme. Complete these 6 weeks, then move to a 12–16 week mountain-specific plan with the fitness base already in place.
              </p>

              <div className="mt-7 p-5 bg-white/3 border border-white/8 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Aiming for something bigger?</span> Check the guides most relevant to your goal: <Link to="/training-guides/mont-blanc-training-plan" className="text-primary hover:underline">Mont Blanc Training Plan</Link> or <Link to="/training-guides/kilimanjaro-training-plan" className="text-primary hover:underline">Kilimanjaro Training Plan</Link>.</p>
              </div>
            </section>

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Who this plan is for</h2>

              <h3 className="text-lg font-bold text-white mb-3">Good fit if you are</h3>
              <ul className="space-y-3 mb-7">
                {[
                  "Reasonably active but haven't specifically trained for hiking",
                  "Preparing for a UK three peaks challenge, Snowdon, or similar",
                  "Building a base before starting a longer alpine training programme",
                  "Returning to hiking after time off (injury, busy period, etc.)",
                  "Already hiking occasionally but want a structured progression",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <div className="p-5 bg-orange-400/5 border border-orange-400/20 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-orange-400 font-semibold">Not enough time for bigger goals.</span> If you're targeting a high-altitude objective like Kilimanjaro or Mont Blanc and have only 6 weeks, we'd strongly recommend delaying your booking to give yourself adequate preparation time.</p>
              </div>
            </section>

            <InternalCTA />

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">The 6-week plan, week by week</h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Each week has three compulsory sessions and one optional session. The compulsory sessions are non-negotiable — missing more than one per week will compromise the programme significantly.
              </p>

              <div className="space-y-4">
                {[
                  {
                    phase: "Week 1",
                    label: "Get Moving",
                    color: "border-primary/30 bg-primary/5",
                    labelColor: "text-primary",
                    content: "Three sessions: two 30–45 minute aerobic sessions (run, cycle, or brisk walk), and one longer hike of 2–3 hours with whatever elevation is local to you. If you're currently doing very little exercise, every session should feel comfortable — you're not trying to shock your body yet.",
                  },
                  {
                    phase: "Week 2",
                    label: "Load Up",
                    color: "border-blue-400/30 bg-blue-400/5",
                    labelColor: "text-blue-400",
                    content: "Introduce a pack. Carry 6–8kg on your long weekend hike. The aerobic sessions extend to 45–50 minutes each. Your long hike target is 3–4 hours with at least 400–500m elevation gain. If you don't have a suitable hill, add weight to a flat walk and increase pace.",
                  },
                  {
                    phase: "Week 3",
                    label: "First Hill Work",
                    color: "border-orange-400/30 bg-orange-400/5",
                    labelColor: "text-orange-400",
                    content: "Replace one aerobic session with a hill reps session: find any hill with 100–150m of elevation and repeat it 3–4 times. Start carrying the pack on these reps too. Long weekend hike reaches 4–5 hours with 600–800m elevation gain. This is where it starts to feel like training.",
                  },
                  {
                    phase: "Week 4",
                    label: "Build",
                    color: "border-purple-400/30 bg-purple-400/5",
                    labelColor: "text-purple-400",
                    content: "Increase pack weight to 8–10kg on all long sessions. Hill reps session: 4–5 repetitions. Long hike: 5–6 hours with 700–900m elevation gain. Optional: add a second short hike (1.5–2 hours) on Sunday after Saturday's long hike. This back-to-back element makes a significant difference.",
                  },
                  {
                    phase: "Week 5",
                    label: "Peak Week",
                    color: "border-orange-400/30 bg-orange-400/5",
                    labelColor: "text-orange-400",
                    content: "Your hardest week. Long hike on Saturday: 6–7 hours, 900–1,200m elevation gain, 10kg pack. Follow with at least a short 1.5-hour walk on Sunday. Midweek hill session: 5 reps with a loaded pack. This is where your fitness genuinely steps up.",
                  },
                  {
                    phase: "Week 6",
                    label: "Taper",
                    color: "border-white/20 bg-white/3",
                    labelColor: "text-white",
                    content: "If your hike is at the end of this week: reduce volume by 50%, keep one short aerobic session, rest well. If you're using this plan as a base for longer training: continue with a modified version of week 5 and begin a structured 12-week alpine programme.",
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">Example training week (week 4)</h2>
              <p className="text-muted-foreground mb-6 text-sm">A representative mid-plan week showing the full session structure.</p>

              <div className="overflow-hidden border border-white/8 rounded-xl">
                {[
                  { day: "Monday", type: "Rest", color: "text-muted-foreground", desc: "Full rest from the weekend. Eat well. If week 3 was physically demanding, Monday rest is important — don't add extra sessions here at the expense of recovery." },
                  { day: "Tuesday", type: "Aerobic", color: "text-primary", desc: "40–50 minute run or cycle at comfortable pace. Zone 2 — you should be able to hold a conversation. If you're not running, a brisk uphill walk counts." },
                  { day: "Wednesday", type: "Strength", color: "text-blue-400", desc: "30–40 minutes of leg strength: step-ups, squats, lunges, calf raises. Bodyweight or light dumbbells is fine. This is not heavy gym training — it's conditioning the muscles you'll use on descent." },
                  { day: "Thursday", type: "Hill reps", color: "text-orange-400", desc: "Find your local hill and repeat it 4 times with a 8–10kg pack. Walk up hard, descend carefully and controlled. This is your most specific hiking session of the week." },
                  { day: "Friday", type: "Rest", color: "text-muted-foreground", desc: "Rest. Prepare kit, food, and navigation for the weekend hike. Check the forecast." },
                  { day: "Saturday", type: "Long hike", color: "text-primary", desc: "5–6 hours with 700–900m elevation gain, 10kg pack. Eat and drink on a schedule — 60g carbohydrates per hour, 500ml water per hour minimum. Focus on pacing: consistent effort, not fast start followed by collapse." },
                  { day: "Sunday", type: "Optional", color: "text-primary/60", desc: "Optional 1.5–2 hour easy walk. Highly recommended if you're targeting multi-day objectives. If you're genuinely fatigued, skip it — quality rest beats junk miles." },
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Things people get wrong in short training windows</h2>

              <div className="space-y-4">
                {[
                  {
                    title: "Doing too much in week one",
                    body: "The temptation when you only have 6 weeks is to go hard from day one. This leads to injury or burnout by week three. The first week is about establishing the habit and waking your cardiovascular system up — not shocking it into submission.",
                  },
                  {
                    title: "Skipping the long hike",
                    body: "The weekend long hike is the most important session in this plan. Everything else supports it. If you only have time for one session per week, it's the long hike. Treadmill inclines and gym sessions don't replicate what 5 hours on uneven ground actually demands of your body.",
                  },
                  {
                    title: "Ignoring descents",
                    body: "Most people train going up. The descent on a mountain — particularly Ben Nevis or any route with significant elevation — is where sore knees, rolled ankles, and blown quads come from. Do the eccentric leg work mid-week and train your downhills deliberately.",
                  },
                  {
                    title: "Not wearing your actual hiking kit",
                    body: "Train in the boots, socks, and pack you'll use on the day. 6 weeks is long enough to break in boots and identify any kit issues — but only if you actually use the kit during training.",
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How Summit Ready adapts this for your goal</h2>
              <p className="text-muted-foreground leading-relaxed mb-5">
                You could piece this together yourself — but with only 6 weeks, the timing and progression have to be right from week one. Most people go too hard in weeks one and two, pick up a niggle, and lose 10 days they can't afford to lose. Summit Ready builds the sessions around what's actually near you, at the right intensity for where you actually are:
              </p>
              <ul className="space-y-4 mb-7">
                {[
                  { title: "Your summit date", body: "Every session is structured so your fitness peaks the week you need it — not before, not after." },
                  { title: "Your current fitness", body: "Starting from scratch? Already doing regular aerobic training? The plan adjusts to where you actually are." },
                  { title: "Your local hills", body: "The app finds hills near you and builds them into your hill rep sessions and long hike days — no guessing required." },
                  { title: "What comes next", body: "If 6 weeks is the start of a longer journey toward the Alps or Kilimanjaro, Summit Ready transitions you into the right longer programme automatically." },
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
                <Link to="/training-guides/kilimanjaro-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Training Plan — 12–16 week programme for Africa's highest peak
                </Link>
                <Link to="/training-guides/mont-blanc-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Training Plan — The natural step up after your first alpine season
                </Link>
                <Link to="/training-guides/gran-paradiso-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Gran Paradiso Training Plan — A great first 4,000m summit
                </Link>
                <Link to="/training-guides/train-for-mountains-using-local-hills" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Train for Mountains Using Local Hills — UK hill repeats for big summits
                </Link>
              </div>
            </section>

            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Build a Plan Around Your Goal</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Whether you have 6 weeks or 6 months, Summit Ready builds a personalised schedule around your summit date, fitness level, and the hills near you.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Training Plan
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
