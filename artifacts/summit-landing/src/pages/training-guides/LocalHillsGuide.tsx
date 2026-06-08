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
        <p className="font-bold text-white text-lg mb-1">Ready to turn your local hills into a summit plan?</p>
        <p className="text-muted-foreground text-sm leading-relaxed">Summit Ready finds the hills near you, calculates your weekly elevation targets, and builds a structured training plan around your summit date — all based on terrain you can actually reach.</p>
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

export default function LocalHillsGuide() {
  usePageMeta({
    title: "Train for Mountains Using Local Hills | Hill Repeats for Big Summits | SummitReady",
    description: "How to use local hills and hill repeats to prepare for Kilimanjaro, Mont Blanc, and Everest Base Camp — with exact rep counts, UK hill equivalences, training examples, and common mistakes to avoid.",
    canonical: "https://summitready.uk/training-guides/train-for-mountains-using-local-hills/",
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Train for Mountains Using Local Hills",
      "description": "How to use local hills and hill repeats to prepare for Kilimanjaro, Mont Blanc, and Everest Base Camp — with exact rep counts, training examples, and common mistakes.",
      "url": "https://summitready.uk/training-guides/train-for-mountains-using-local-hills/",
      "author": { "@type": "Organization", "name": "SummitReady" },
      "publisher": { "@type": "Organization", "name": "SummitReady", "url": "https://summitready.uk/" },
      "mainEntityOfPage": "https://summitready.uk/training-guides/train-for-mountains-using-local-hills/",
    },
  });

  return (
    <SiteLayout>
      <div className="bg-background">
        {/* Hero */}
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
              <span className="text-white">Train Local, Climb Higher</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-primary bg-primary/10 border-primary/20">All Levels</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                12+ weeks
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                UK-focused, globally applicable
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Train Local. Climb Higher.
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              You don't need the Alps to prepare for the Alps. The hills near your home can simulate nearly every physiological demand of a major mountain — Kilimanjaro, Mont Blanc, Everest Base Camp — if you use them correctly. This guide shows you exactly how.
            </p>
          </div>
        </section>

        <article className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            {/* Section 1: Why local hills work */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Why local hills can prepare you for big mountains</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                The most common misconception in mountain training is that you need to be near mountains to train for them. You don't. The physiological demands of a major summit — the cardiovascular load, the muscle recruitment pattern, the metabolic cost — are all determined by gradient and elevation gain, not by geography.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Hiking uphill at a 15–20% gradient recruits the same muscles (glutes, quads, hip flexors, calves) in the same pattern whether you're on the Goûter route to Mont Blanc or on Kinder Scout above Edale. The cardiovascular stress at that gradient is the same. The load on your knees on the descent is the same. Your body cannot tell the difference.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                This is the principle of specificity: your body adapts to the precise demands you place on it. Train on steep terrain carrying a pack, and you'll become better at moving on steep terrain with a pack. The altitude difference — the one thing your local hills genuinely cannot replicate — is a real factor, but it's a much smaller one than most people assume.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                Above 4,000m, altitude does reduce your aerobic capacity. But the limiting factor for most climbers at altitude isn't their oxygen saturation — it's their aerobic base. A weak aerobic engine at sea level is a catastrophically weak aerobic engine at 5,000m. The solution is to build the strongest possible aerobic engine before you leave, using the terrain you have access to.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Elite alpinists who train in cities — running stairs, doing hill repeats in urban parks, treadmill incline work — consistently outperform underfit climbers with access to the Alps. The training methodology matters far more than the training location.
              </p>

              <div className="mt-7 p-5 bg-white/3 border border-white/8 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">The one thing local hills can't replicate:</span> Reduced oxygen partial pressure above 3,500m. Altitude acclimatisation must happen in the mountains themselves. But arriving with a world-class aerobic base dramatically reduces how badly altitude affects you — and gives you the reserves to push through when it does.</p>
              </div>
            </section>

            {/* Section 2: How Summit Ready uses your terrain */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How Summit Ready uses your local terrain</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Most training plans tell you to "do hill repeats" without telling you how many, on which hills, at what intensity, with what pack weight, in which week of your plan. Summit Ready is built around the principle that mountain training should be as specific as mountain guiding.
              </p>
              <ul className="space-y-4">
                {[
                  { title: "Finds hills within your radius", body: "Enter your location and Summit Ready identifies every suitable training hill within your chosen radius — elevation gain, distance, surface type, estimated time. You pick the ones you want to use regularly." },
                  { title: "Calculates your weekly elevation target", body: "Based on your goal mountain, summit date, and current fitness, the app calculates exactly how much elevation gain you need to accumulate each week. This number increases through Base, Build, and Peak phases, then drops in the Taper." },
                  { title: "Prescribes specific sessions", body: "Not 'do some hill repeats.' Specific sessions: '3 repeats of Pen y Fan, effort 4/5, pack 6kg, estimated 2hr 40min.' Each session has a purpose in the plan — you're not guessing at intensity or volume." },
                  { title: "Adapts week by week", body: "Missed a session? Had an exceptional week? The plan recalculates from where you actually are, not where the template assumed you'd be. You're never chasing an impossible block." },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-white">{item.title}: </span>
                      <span className="text-muted-foreground text-sm leading-relaxed">{item.body}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Section 3: UK hills */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How to simulate mountain elevation in the UK</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                The key insight is to work backwards from your mountain. Every major summit has a defined elevation gain on its main route — this is the number you need to simulate in training. Not the summit altitude, but the gain: the metres you climb in a single push.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Kilimanjaro's Machame route summit day: approximately 1,200m of gain. Mont Blanc via the Goûter route: approximately 2,400m from the Goûter hut. EBC's highest days: 700–900m of accumulated gain. These are your training targets.
              </p>

              <h3 className="text-lg font-bold text-white mb-4">UK training hills — ascent gain per round trip</h3>
              <div className="overflow-hidden border border-white/8 rounded-xl mb-8">
                {[
                  { hill: "Pen y Fan", gain: "296m", location: "Brecon Beacons", notes: "Consistent grade, well-surfaced, excellent for beginners" },
                  { hill: "Kinder Scout", gain: "300m", location: "Peak District", notes: "Good surface variety; boggy sections build stability" },
                  { hill: "Whernside", gain: "380m", location: "Yorkshire Dales", notes: "Three Peaks classic; exposed ridge good for weather prep" },
                  { hill: "Snowdon (Pyg Track)", gain: "730m", location: "Snowdonia", notes: "Best pre-alpine simulator in England & Wales" },
                  { hill: "Blencathra", gain: "640m", location: "Lake District", notes: "Sharper, more technical; superb descent training" },
                  { hill: "Helvellyn (Striding Edge)", gain: "800m", location: "Lake District", notes: "Long, varied, exposed; closest thing to an alpine approach" },
                  { hill: "Ben Macdui", gain: "700m", location: "Cairngorms", notes: "High plateau; genuine cold-weather and navigation training" },
                  { hill: "Ben Nevis", gain: "1,290m", location: "Scottish Highlands", notes: "The UK's best Kilimanjaro simulator; serious pack training" },
                ].map((row, i) => (
                  <div key={row.hill} className={`p-4 flex gap-4 ${i > 0 ? "border-t border-white/5" : ""}`}>
                    <div className="w-40 shrink-0">
                      <div className="text-sm font-bold text-white">{row.hill}</div>
                      <div className="text-xs text-primary font-semibold mt-0.5">{row.gain}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{row.location}</div>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{row.notes}</p>
                  </div>
                ))}
              </div>

              <div className="p-5 bg-white/3 border border-white/8 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">No hills nearby?</span> A treadmill at 10–15% incline for 60–90 minutes, or a stair machine, delivers similar cardiovascular and muscular stimulus. It's less effective for balance and descent training, but better than flat running. Summit Ready includes treadmill and stair sessions for users in flat areas.</p>
              </div>
            </section>

            {/* Section 4: The numbers */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">The numbers: how many repeats to simulate a summit</h2>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The table below shows how many ascents of common UK hills match the elevation gain of each mountain's most demanding single day. These are your peak-week training targets — where you want to be in weeks 10–14 of your plan, not week one.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Start at 50% of these numbers and add one repeat every two weeks. Most people misjudge how many repeats they need — doing one or two and feeling satisfied, then arriving at the mountain having never built the volume their summit day demands.
              </p>

              <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm border border-white/8 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/8">
                      <th className="text-left p-4 text-white font-bold">Hill</th>
                      <th className="text-center p-4 text-white font-bold">Gain</th>
                      <th className="text-center p-4 text-primary font-bold">Kilimanjaro<br/><span className="font-normal text-muted-foreground text-xs">1,200m summit day</span></th>
                      <th className="text-center p-4 text-orange-400 font-bold">Mont Blanc<br/><span className="font-normal text-muted-foreground text-xs">2,400m summit push</span></th>
                      <th className="text-center p-4 text-purple-400 font-bold">EBC<br/><span className="font-normal text-muted-foreground text-xs">~800m longest day</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { hill: "Pen y Fan", gain: "296m", kili: "4 reps", mb: "8 reps", ebc: "3 reps" },
                      { hill: "Kinder Scout", gain: "300m", kili: "4 reps", mb: "8 reps", ebc: "3 reps" },
                      { hill: "Whernside", gain: "380m", kili: "4 reps", mb: "7 reps", ebc: "3 reps" },
                      { hill: "Snowdon", gain: "730m", kili: "2 reps", mb: "4 reps", ebc: "2 reps" },
                      { hill: "Blencathra", gain: "640m", kili: "2 reps", mb: "4 reps", ebc: "2 reps" },
                      { hill: "Helvellyn", gain: "800m", kili: "2 reps", mb: "3 reps", ebc: "1 rep" },
                      { hill: "Ben Nevis", gain: "1,290m", kili: "1 rep", mb: "2 reps", ebc: "1 rep" },
                    ].map((row, i) => (
                      <tr key={row.hill} className={i > 0 ? "border-t border-white/5" : ""}>
                        <td className="p-4 font-semibold text-white">{row.hill}</td>
                        <td className="p-4 text-center text-muted-foreground">{row.gain}</td>
                        <td className="p-4 text-center text-primary font-bold">{row.kili}</td>
                        <td className="p-4 text-center text-orange-400 font-bold">{row.mb}</td>
                        <td className="p-4 text-center text-purple-400 font-bold">{row.ebc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-5 bg-primary/5 border border-primary/15 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Important:</span> These are summit-day simulation numbers. In most training weeks, you won't hit these totals in a single session — you'll spread elevation gain across 2–3 hill sessions. The goal is to ensure your total weekly elevation gain matches your mountain's demands, and that you complete at least one session that mimics the summit day effort.</p>
              </div>
            </section>

            <InternalCTA />

            {/* Section 5: Training by mountain */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Training examples: Kilimanjaro, Mont Blanc, and EBC</h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Each mountain makes different demands. Here's how a UK-based hill training programme looks for three of the most popular objectives — including the phase breakdown, key principles, and what your peak week should contain.
              </p>

              {/* Kilimanjaro */}
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-2 h-8 bg-primary rounded-full" />
                  <h3 className="text-xl font-bold text-white">Kilimanjaro — 5,895m · 12–16 weeks</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Kilimanjaro's primary demands are multi-day endurance and a strong cardiovascular engine. The summit day (Machame route) involves approximately 1,200m of gain, but you arrive having already spent five to six days at altitude. Your body's ability to function on consecutive days of effort — not just one big push — is what determines your summit.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-5">
                  <span className="text-white font-semibold">Key principle:</span> Back-to-back days. Train Saturday and Sunday from week 6 onwards. One long day alone is not enough preparation for seven consecutive days on your feet above 4,000m.
                </p>

                <div className="space-y-3 mb-5">
                  {[
                    { phase: "Weeks 1–4", label: "Base", color: "border-primary/30 bg-primary/5", labelColor: "text-primary", content: "2 hill sessions per week, 2 repeats of your chosen hill. 2 cardio sessions (run, cycle, swim — 45 min). No pack required yet. Focus: build aerobic base and get comfortable on steep terrain. Weekly elevation gain target: 600–800m." },
                    { phase: "Weeks 5–8", label: "Build", color: "border-blue-400/30 bg-blue-400/5", labelColor: "text-blue-400", content: "3 hill sessions per week, building to 3 repeats. Introduce back-to-back hill days on weekends from week 6. Add a 5kg pack from week 5. Weekly elevation gain target: 900–1,200m." },
                    { phase: "Weeks 9–12", label: "Peak", color: "border-orange-400/30 bg-orange-400/5", labelColor: "text-orange-400", content: "3 hill sessions per week, 4 repeats at peak. One long day (6–7 hours) each weekend. Pack weight 7–9kg. Three consecutive days (Fri/Sat/Sun) at least once in this phase. Weekly elevation target: 1,400–1,800m." },
                    { phase: "Weeks 13–14", label: "Taper", color: "border-white/20 bg-white/3", labelColor: "text-white", content: "Reduce volume by 40%. Two short sharp hill sessions. Maintain pack weight. No new fitness is built in the taper — you're arriving at the mountain fresh, not tired." },
                  ].map((phase) => (
                    <div key={phase.phase} className={`border rounded-xl p-5 ${phase.color}`}>
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

                <div className="p-5 bg-white/3 border border-white/8 rounded-xl">
                  <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Read more:</span> <Link to="/training-guides/kilimanjaro-training-plan" className="text-primary hover:underline">Kilimanjaro Training Plan</Link> · <Link to="/can-i-climb/kilimanjaro" className="text-primary hover:underline">Am I Ready for Kilimanjaro?</Link></p>
                </div>
              </div>

              {/* Mont Blanc */}
              <div className="mb-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-2 h-8 bg-orange-400 rounded-full" />
                  <h3 className="text-xl font-bold text-white">Mont Blanc — 4,808m · 16+ weeks</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Mont Blanc via the Goûter route involves approximately 2,400m of elevation gain from the Goûter hut in a single summit push — typically completed in 9–11 hours. Unlike Kilimanjaro, speed matters here. You're racing a weather window, carrying technical gear (crampons, ice axe, harness), and operating on a glaciated mountain where conditions deteriorate fast.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-5">
                  <span className="text-white font-semibold">Key principle:</span> Efficiency under load. You need to move uphill fast, for a very long time, with a heavy pack. Hill repeats for Mont Blanc should be done at a brisk but sustainable pace — not a plod. From week 8, carry 8–12kg to simulate the summit-day pack with technical equipment.
                </p>

                <div className="space-y-3 mb-5">
                  {[
                    { phase: "Weeks 1–5", label: "Base", color: "border-primary/30 bg-primary/5", labelColor: "text-primary", content: "2 hill sessions per week, 2–3 repeats. 3 cardio sessions with intensity variation. Build to a 3-hour continuous hill day by week 5. Weekly elevation target: 700–1,000m." },
                    { phase: "Weeks 6–10", label: "Build", color: "border-blue-400/30 bg-blue-400/5", labelColor: "text-blue-400", content: "3 hill sessions per week, building to 4 repeats. Add a weighted pack (5kg → 8kg) from week 6. Saturday long day: 5–7 hours with 1,000–1,500m gain. Weekend back-to-back from week 8. Weekly elevation target: 1,500–2,000m." },
                    { phase: "Weeks 11–14", label: "Peak", color: "border-orange-400/30 bg-orange-400/5", labelColor: "text-orange-400", content: "3 hill sessions per week, 4–8 repeats depending on hill height. One day that specifically simulates the summit push effort: 2,000–2,400m of gain in one session if using a small hill, or a full Snowdon day with repeats. Pack 10–12kg. Weekly elevation target: 2,000–2,500m." },
                    { phase: "Weeks 15–16", label: "Taper", color: "border-white/20 bg-white/3", labelColor: "text-white", content: "Reduce to 2 hill sessions. Maintain pack weight and intensity but halve the volume. Confirm all technical gear fits and is comfortable on the hill before you go." },
                  ].map((phase) => (
                    <div key={phase.phase} className={`border rounded-xl p-5 ${phase.color}`}>
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

                <div className="p-5 bg-white/3 border border-white/8 rounded-xl">
                  <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Read more:</span> <Link to="/training-guides/mont-blanc-training-plan" className="text-primary hover:underline">Mont Blanc Training Plan</Link> · <Link to="/can-i-climb/mont-blanc" className="text-primary hover:underline">Am I Ready for Mont Blanc?</Link></p>
                </div>
              </div>

              {/* EBC */}
              <div className="mb-2">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-2 h-8 bg-purple-400 rounded-full" />
                  <h3 className="text-xl font-bold text-white">Everest Base Camp — 5,364m · 16+ weeks</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  EBC is 130km over 12–14 days, with daily elevation profiles varying from 400m to 900m of gain. No single day is extreme — but the cumulative load across two weeks at altitude, carrying a 10–12kg pack, is significant. Your legs must function on day twelve as well as they did on day one.
                </p>
                <p className="text-muted-foreground leading-relaxed mb-5">
                  <span className="text-white font-semibold">Key principle:</span> Duration over intensity. EBC is not a sprint to altitude — it's a sustained, moderate-effort endurance event with a big pack. Train for consecutive days, not big single days. A 4-hour hill session with a 10kg pack on Saturday followed by another 4 hours on Sunday is perfect EBC preparation.
                </p>

                <div className="space-y-3 mb-5">
                  {[
                    { phase: "Weeks 1–5", label: "Base", color: "border-primary/30 bg-primary/5", labelColor: "text-primary", content: "2 hill sessions per week, 2 repeats. Focus on duration rather than speed — aim to be on your feet 2.5–3 hours by week 5. Add trekking poles from week 3 and practise the movement pattern. Weekly elevation target: 500–800m." },
                    { phase: "Weeks 6–10", label: "Build", color: "border-blue-400/30 bg-blue-400/5", labelColor: "text-blue-400", content: "3 hill sessions per week, building to 3 repeats. Weekend back-to-back days from week 6. Pack weight builds from 7kg to 10kg. Saturday sessions extend to 4–5 hours. Weekly elevation target: 1,000–1,400m." },
                    { phase: "Weeks 11–14", label: "Peak", color: "border-orange-400/30 bg-orange-400/5", labelColor: "text-orange-400", content: "3 hill sessions per week. One day of 6–8 hours continuous hiking with 10–12kg pack. Three consecutive training days (Fri/Sat/Sun) in week 13. This is your EBC simulation — tired legs carrying weight across varied terrain. Weekly elevation target: 1,400–1,800m." },
                    { phase: "Weeks 15–16", label: "Taper", color: "border-white/20 bg-white/3", labelColor: "text-white", content: "Shorten sessions by 40–50%, maintain frequency. Two short back-to-back days to keep the adaptation. Arrive in Nepal a day early if possible — Kathmandu sits at 1,400m, which helps begin acclimatisation." },
                  ].map((phase) => (
                    <div key={phase.phase} className={`border rounded-xl p-5 ${phase.color}`}>
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

                <div className="p-5 bg-white/3 border border-white/8 rounded-xl">
                  <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Read more:</span> <Link to="/training-guides/everest-base-camp-training-plan" className="text-primary hover:underline">EBC Training Plan</Link> · <Link to="/can-i-climb/everest-base-camp" className="text-primary hover:underline">Am I Ready for Everest Base Camp?</Link></p>
                </div>
              </div>
            </section>

            <InternalCTA />

            {/* Section 6: Common mistakes */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Common mistakes</h2>
              <div className="space-y-4">
                {[
                  { title: "Only doing flat cardio", body: "Running and cycling build cardiovascular fitness, but they don't train the specific muscles needed for steep ascent — particularly the glutes and hip flexors. A runner who has never done serious hill work will feel strong at altitude until they hit a sustained 30% gradient, at which point their pace drops catastrophically. Hills must be in the programme, not optional extras." },
                  { title: "Stopping at the summit", body: "Descent training is as important as ascent training — and far easier to skip because descending feels easier in the moment. But the eccentric muscle contractions required to descend steeply with a loaded pack are brutal on untrained legs. The 2,800m descent from Uhuru Peak, or the final 1,400m descent from Mont Blanc to Chamonix, comes after the hardest physical effort of your trip. Train the descent specifically from week 6 onwards." },
                  { title: "Skipping back-to-back days", body: "Single long training days, however impressive, don't prepare you for consecutive days on a mountain. Kilimanjaro is 7–8 consecutive days. EBC is 12–14. Even Mont Blanc requires performing on day two after an already hard day at altitude. Training Saturday and Sunday — tired legs, same pack, same hills — is the most mountain-specific thing most people never do. Start back-to-back training from week 6 of your programme." },
                  { title: "Training on paved paths only", body: "Smooth, consistent surfaces are comfortable but they don't train the stabiliser muscles around your ankles and knees. Mountain terrain is varied — loose rock, boggy ground, snow, scree. Including sessions on rough footpaths, off-trail moorland, and wet or muddy terrain from week 4 onwards reduces injury risk on the actual mountain significantly." },
                  { title: "Not carrying a pack early enough", body: "The weight you carry on the mountain — pack, water, food, layers, technical gear — must feature in training from the start. Introduce it gradually: 5kg in week one, building to your full summit-day weight by week 10. Climbers who train without a pack and then carry 10–12kg on the mountain develop knee problems on the descent almost without exception." },
                  { title: "Misjudging the number of repeats needed", body: "One or two ascents of a local hill in a session feels like a good workout. For the training to actually simulate your target mountain, you often need 3–5 repeats of a 300m hill, or 2–3 repeats of Snowdon. Most people never reach these numbers in training — and then discover on summit day that they haven't built the capacity they needed. Use the table in this guide and hit your weekly elevation targets consistently." },
                  { title: "Training too close to the trip", body: "The body adapts to training stress over weeks and months, not days. Starting a mountain training programme 4 weeks before your trip and doing enormous sessions in the final fortnight achieves almost nothing physiologically and guarantees you arrive fatigued. 12–16 weeks minimum, with a proper taper in the final 2 weeks, is the formula every experienced guide recommends." },
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

            {/* Section 7: Readiness indicators */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Readiness indicators</h2>
              <p className="text-muted-foreground leading-relaxed mb-7">
                If you're unsure whether your local hill training has actually prepared you for your mountain, these indicators are a more reliable measure than how a single session felt. They should all be in the green zone at least two weeks before you depart — not on departure day.
              </p>

              <div className="space-y-4">
                <div className="border border-primary/30 bg-primary/5 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                    <h3 className="font-bold text-primary">Green — you're ready</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      "Can complete your peak-week elevation target in a single session and recover normally within 48 hours",
                      "Comfortable on descent with a loaded pack after 4+ hours of ascent",
                      "Can complete three consecutive training days (Fri/Sat/Sun) without the third day being a disaster",
                      "Hitting your weekly elevation targets consistently for 4+ consecutive weeks",
                      "Can hike 6–7 hours at a moderate pace on varied terrain without stopping to rest",
                      "Your pack weight in training matches your expected summit-day pack weight",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border border-orange-400/30 bg-orange-400/5 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                    <h3 className="font-bold text-orange-400">Amber — keep training, reassess timing</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      "Completing sessions but needing 2+ full rest days to recover fully",
                      "Struggling on descents — knee discomfort, or dramatically reduced pace downhill",
                      "Missing more than one training session per week regularly",
                      "Weekly elevation targets consistently 20%+ below plan",
                      "Back-to-back days feel genuinely damaging, not just challenging",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-1.5" />
                        <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border border-red-400/30 bg-red-400/5 rounded-xl p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <h3 className="font-bold text-red-400">Red — not yet ready, consider postponing</h3>
                  </div>
                  <ul className="space-y-2.5">
                    {[
                      "Cannot complete two back-to-back hill days without one being abandoned early",
                      "Significant knee or ankle pain on descent with a loaded pack",
                      "Struggling to hit 50% of peak-week elevation targets",
                      "Fewer than 8 weeks of consistent training completed",
                      "Haven't carried your target pack weight in training yet",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5" />
                        <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-muted-foreground mt-4 pt-4 border-t border-white/8">If you're in the red zone with 4 weeks to go, consider whether postponing by 8–12 weeks is an option. Attempting a major summit significantly undertrained is dangerous — and expensive, if you need to abort. The mountain will still be there.</p>
                </div>
              </div>

              <div className="mt-5 p-5 bg-white/3 border border-white/8 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Not sure where you stand?</span> Use Summit Ready's <Link to="/readiness-check" className="text-primary hover:underline">mountain readiness assessment</Link> to get a personalised score across fitness, experience, strength, and mindset — benchmarked against your specific target mountain.</p>
              </div>
            </section>

            {/* Internal links */}
            <section className="mb-14 p-6 bg-white/3 border border-white/8 rounded-2xl">
              <h3 className="font-bold text-white mb-4">Related guides and mountain profiles</h3>
              <div className="space-y-3">
                <Link to="/training-guides/kilimanjaro-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Training Plan — Full 12–16 week programme for Africa's highest peak
                </Link>
                <Link to="/training-guides/mont-blanc-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Training Plan — 16-week programme for the Goûter route
                </Link>
                <Link to="/training-guides/everest-base-camp-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Everest Base Camp Training Plan — 16+ weeks for a 130km Himalayan trek
                </Link>
                <Link to="/mountains/kilimanjaro" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Mountain Profile — Routes, best season, and logistics
                </Link>
                <Link to="/mountains/mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Mountain Profile — Routes, conditions, and what to expect
                </Link>
                <Link to="/can-i-climb/kilimanjaro" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Am I Ready for Kilimanjaro? — Honest fitness and beginner suitability assessment
                </Link>
                <Link to="/can-i-climb/mont-blanc" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Am I Ready for Mont Blanc? — What you actually need before you book
                </Link>
                <Link to="/training-guides/beginner-mountain-fitness-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Beginner Mountain Fitness Plan — Build the foundation before mountain training
                </Link>
                <Link to="/readiness-check" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mountain Readiness Assessment — Get your personalised score
                </Link>
              </div>
            </section>

            {/* Final CTA */}
            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Build My Hill Training Plan</h2>
              <p className="text-muted-foreground mb-3 leading-relaxed">
                You now know the methodology. Summit Ready does the calculation: it finds the hills near you, sets your weekly elevation targets, and builds a structured week-by-week plan around your summit date and current fitness.
              </p>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                No generic templates. No guessing at intensity. A plan built around the terrain you actually have access to, getting you to the summit you're actually targeting.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Build My Hill Training Plan
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
