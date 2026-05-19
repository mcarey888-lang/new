import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, AlertTriangle, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import heroBg from "../../assets/hero-kilimanjaro.jpg";

function InternalCTA() {
  return (
    <div className="my-10 bg-primary/8 border border-primary/20 rounded-2xl p-7 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
      <div className="flex-1">
        <p className="font-bold text-white text-lg mb-1">Ready to start training?</p>
        <p className="text-muted-foreground text-sm leading-relaxed">Summit Ready builds your personalised Kilimanjaro training plan — based on your fitness, your route choice, and the hills near where you live.</p>
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

export default function KilimanjaroPlan() {
  usePageMeta({
    title: "Kilimanjaro Training Plan | How to Prepare for Kilimanjaro | SummitReady",
    description: "A complete Kilimanjaro training plan covering altitude preparation, multi-day endurance, and the fitness levels you need to reach the Roof of Africa.",
    canonical: "https://summitready.uk/training-guides/kilimanjaro-training-plan/",
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Kilimanjaro Training Plan",
      "description": "A complete Kilimanjaro training plan covering altitude preparation, multi-day endurance, and the fitness levels needed.",
      "url": "https://summitready.uk/training-guides/kilimanjaro-training-plan/",
      "author": { "@type": "Organization", "name": "SummitReady" },
      "publisher": { "@type": "Organization", "name": "SummitReady", "url": "https://summitready.uk/" },
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
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/training-guides" className="hover:text-primary transition-colors">Training Guides</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">Kilimanjaro</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-blue-400 bg-blue-400/10 border-blue-400/20">Moderate</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                12–16 weeks recommended
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                5,895m summit
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Kilimanjaro Training Plan
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              Africa's highest peak demands cardiovascular fitness, back-to-back endurance, and serious altitude preparation. This plan gets you ready for five to eight days above 4,000m.
            </p>
          </div>
        </section>

        <article className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            {/* Section 1 */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Kilimanjaro: the altitude mountain</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                At 5,895m, Kilimanjaro is the highest peak in Africa and one of the world's Seven Summits. What makes it unusual — and what catches many climbers off guard — is that it requires no technical climbing whatsoever. You walk up. But at nearly 6,000m, the altitude is as high as any peak in the Alps, and the mountain extracts a heavy physical toll.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Most Kilimanjaro routes take 5–8 days. You're on your feet for 6–9 hours per day, gaining and losing thousands of metres of altitude, through climate zones that change from jungle to arctic. Your cardiovascular system, not your technical skill, determines your summit.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                The Machame route (7 days) gives the best acclimatisation profile and is recommended for most climbers. This plan is built around it — though the fitness base applies to all routes.
              </p>

              <div className="mt-7 p-5 bg-white/3 border border-white/8 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Unsure whether Kilimanjaro is the right mountain for you?</span> Read: <Link to="/can-i-climb/kilimanjaro" className="text-primary hover:underline">Can I Climb Kilimanjaro?</Link></p>
              </div>
            </section>

            {/* Section 2 */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How fit do you need to be?</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Kilimanjaro is often marketed as achievable for beginners — and it is, with preparation. But "no technical skill required" doesn't mean it's easy. The multi-day endurance demands, combined with altitude, mean your fitness must be genuinely solid before you arrive.
              </p>

              <h3 className="text-lg font-bold text-white mb-3">Minimum baseline</h3>
              <ul className="space-y-3 mb-7">
                {[
                  "Comfortable hiking 4–5 hours continuously at a moderate pace",
                  "Some experience on hilly terrain — not necessarily mountains",
                  "Regular aerobic exercise: running, cycling, swimming, or hiking 3–4×/week",
                  "Able to carry a 5–8kg daypack without discomfort",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <h3 className="text-lg font-bold text-white mb-3">What you need by departure day</h3>
              <ul className="space-y-3">
                {[
                  "Hike 6–8 hours per day, multiple days in a row, without significant discomfort",
                  "Strong cardiovascular engine — your body needs to function under oxygen deprivation",
                  "Mental endurance: summit night involves 5–7 hours of hiking from midnight to dawn at –15°C or colder",
                  "Healthy legs on descent — the knee-punishing descent from Uhuru Peak is often harder than the ascent",
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
                12–16 weeks is the standard recommendation. The key difference from an alpine plan is that you're building multi-day endurance above all else — consecutive days on your feet — rather than one huge summit day.
              </p>

              <div className="space-y-4">
                {[
                  {
                    phase: "16+ weeks out",
                    label: "Foundation",
                    color: "border-primary/30 bg-primary/5",
                    labelColor: "text-primary",
                    content: "Most people underestimate how much this phase matters. Four to five aerobic sessions per week — runs, cycles, or walks — with at least 400–600m of elevation gain on your weekend long day. Your long weekend hike should reach 3–4 hours by the end of this phase. At altitude above 4,000m, your aerobic engine determines how much you have left on summit night, not your willpower. Skipping this phase to save time and jumping straight into harder training is the most common reason people struggle in the final two days.",
                  },
                  {
                    phase: "12–16 weeks",
                    label: "Build",
                    color: "border-blue-400/30 bg-blue-400/5",
                    labelColor: "text-blue-400",
                    content: "Introduce back-to-back hiking days. Weekend plan: a long hike Saturday (4–6 hours), a shorter hike Sunday (2–3 hours). This specifically trains the multi-day endurance that Kilimanjaro demands. Add hill work to mid-week sessions.",
                  },
                  {
                    phase: "8–12 weeks",
                    label: "Peak",
                    color: "border-orange-400/30 bg-orange-400/5",
                    labelColor: "text-orange-400",
                    content: "Three consecutive hiking days is ideal if you can arrange it. Daily hiking duration builds to 7–8 hours. Pack weight builds to 8–10kg. Altitude simulation breathing exercises may help but are not essential. Focus heavily on cardiovascular fitness.",
                  },
                  {
                    phase: "4–8 weeks",
                    label: "Sharpen",
                    color: "border-purple-400/30 bg-purple-400/5",
                    labelColor: "text-purple-400",
                    content: "Maintain volume, begin introducing rest days to practise recovery between efforts. Confirm all kit is worn in and comfortable. Hike in summit boots — blisters on day three of Kilimanjaro are trip-ending.",
                  },
                  {
                    phase: "Final 2 weeks",
                    label: "Taper",
                    color: "border-white/20 bg-white/3",
                    labelColor: "text-white",
                    content: "Cut volume by 50%. Short hikes only. Sleep, nutrition, and hydration become the priority. Arrive in Tanzania a day early. Acclimatisation on the mountain itself is built into the Machame route — trust the process.",
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
              <p className="text-muted-foreground mb-6 text-sm">Weeks 8–12 of preparation.</p>

              <div className="overflow-hidden border border-white/8 rounded-xl">
                {[
                  { day: "Monday", type: "Strength", color: "text-blue-400", desc: "Lower body and core — step-ups, goblet squats, lunges, plank variations. 40 minutes. Kilimanjaro is a walking mountain, not a technical climb, but strong legs protect your knees on long descents." },
                  { day: "Tuesday", type: "Cardio", color: "text-primary", desc: "Zone 2 run or cycle, 50–60 minutes. Easy conversation pace. Builds mitochondrial density — exactly what your body needs for sustained, multi-hour effort at altitude." },
                  { day: "Wednesday", type: "Hike", color: "text-primary", desc: "Moderate hike, 3–4 hours with pack. Or if no hills nearby: incline treadmill walk at 8–12% gradient for 90 minutes with pack weight. Mid-week mountain miles accumulate." },
                  { day: "Thursday", type: "Hill reps", color: "text-orange-400", desc: "Hill endurance session — 4–6 extended hill climbs at your local hill, no pack initially, adding weight as weeks progress. Focus on sustainable pace: the pace you could hold for hours." },
                  { day: "Friday", type: "Rest", color: "text-muted-foreground", desc: "Full rest. This is preparation for the weekend double. Eat carbohydrate-rich food, hydrate well, sleep at least 8 hours." },
                  { day: "Saturday", type: "Long hike", color: "text-primary", desc: "Long mountain day — 6–8 hours, 800–1,200m elevation gain, 8–10kg pack. Simulate a Kilimanjaro day: sustained effort, minimal stops, consistent pacing from start to finish." },
                  { day: "Sunday", type: "Back-to-back", color: "text-primary/70", desc: "3–4 hours hiking on tired legs. This is the most Kilimanjaro-specific training you can do. Day two of a mountain trek always hurts — conditioning your body to perform on fatigued legs is the goal." },
                ].map((item, i) => (
                  <div key={item.day} className={`p-5 flex gap-4 ${i > 0 ? "border-t border-white/5" : ""}`}>
                    <div className="w-24 shrink-0">
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Common mistakes</h2>
              <div className="space-y-4">
                {[
                  { title: "Training for one big day, not many consecutive days", body: "Kilimanjaro is a multi-day endurance event. Training for a single long hike — however impressive — won't prepare you for days five and six when you're exhausted and approaching 5,000m. Back-to-back training days are non-negotiable." },
                  { title: "Choosing too short a route", body: "The 5-day Marangu route has a summit success rate around 65% compared to 85%+ on the 7-day Machame. The extra days aren't padding — they're the acclimatisation time your body needs and cannot shortcut. People book shorter routes to save a few hundred pounds and then spend it on a second trip, or they summit feeling genuinely awful and spend the entire descent regretting the decision. Choose seven days minimum." },
                  { title: "Ignoring the descent", body: "The 2,800m descent from Uhuru Peak back to base camp comes after summit night — five to seven hours of cold, dark hiking on near-zero sleep. Many trekkers who reach the summit confidently are limping or stopping on the way down. Eccentric step-downs and loaded downhill training from week 6 are the best protection against this, not ibuprofen taken in advance." },
                  { title: "Undertrained cardiovascular system", body: "Fitness for Kilimanjaro is 80% cardiovascular. Above 4,000m, your aerobic capacity is limited by oxygen availability — and a well-developed aerobic engine is what gives you reserves when that happens. People who arrive strong from the gym but without a proper running or hiking base typically manage the lower days fine and then fall apart on summit night at 5,000m. Build the engine first, with real time on your feet." },
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

            {/* Internal links */}
            <section className="mb-14 p-6 bg-white/3 border border-white/8 rounded-2xl">
              <h3 className="font-bold text-white mb-4">Related guides</h3>
              <div className="space-y-3">
                <Link to="/can-i-climb/kilimanjaro" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb Kilimanjaro? — Honest fitness assessment and beginner suitability
                </Link>
                <Link to="/training-guides/mont-blanc-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Training Plan — Western Europe's highest peak
                </Link>
                <Link to="/training-guides/matterhorn-preparation-guide" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Matterhorn Preparation Guide — The Alps' most technical classic
                </Link>
              </div>
            </section>

            {/* Final CTA */}
            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Build My Kilimanjaro Plan</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Get a personalised week-by-week training schedule built around your summit date, your fitness level, and the hills near you.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Kilimanjaro Plan
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
