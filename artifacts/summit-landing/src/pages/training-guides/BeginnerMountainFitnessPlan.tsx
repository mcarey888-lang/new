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
        <p className="font-bold text-white text-lg mb-1">Ready to start building?</p>
        <p className="text-muted-foreground text-sm leading-relaxed">Summit Ready builds your personalised training plan — based on your goal, your current fitness, and the hills near where you live.</p>
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

export default function BeginnerMountainFitnessPlan() {
  usePageMeta({
    title: "Beginner Mountain Fitness Plan | Build the Base for Any Summit | SummitReady",
    description: "An 8-week beginner mountain fitness plan covering leg strength, cardiovascular base, and pack-carrying capacity. The foundation before any mountain-specific training.",
    canonical: "https://summitready.uk/training-guides/beginner-mountain-fitness-plan/",
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Beginner Mountain Fitness Plan",
      "description": "An 8-week beginner mountain fitness plan covering leg strength, cardiovascular base, and pack-carrying capacity.",
      "url": "https://summitready.uk/training-guides/beginner-mountain-fitness-plan/",
      "author": { "@type": "Organization", "name": "SummitReady" },
      "publisher": { "@type": "Organization", "name": "SummitReady", "url": "https://summitready.uk/" },
      "mainEntityOfPage": "https://summitready.uk/training-guides/beginner-mountain-fitness-plan/",
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
              <span className="text-white">Beginner Mountain Fitness</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-green-400 bg-green-400/10 border-green-400/20">Beginner</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                8 weeks
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                Foundation for any mountain goal
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Beginner Mountain Fitness Plan
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              You can't skip the base. This 8-week plan builds the leg strength, cardiovascular fitness, and load-carrying capacity that every mountain objective requires — whether that's Snowdon next month or Kilimanjaro next year.
            </p>
          </div>
        </section>

        <article className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Why the base matters more than most people realise</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                Every training plan for a specific mountain — Kilimanjaro, Mont Blanc, Everest Base Camp — assumes you already have a base. They assume you can hike for several hours, carry a loaded pack, and recover between sessions. If you start a 16-week alpine programme without that base, you spend the first six weeks building what should already be there, and the whole plan falls short.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                This plan exists to fix that. Eight weeks of consistent, progressive work builds the three things that matter most on a mountain: legs that don't give out on descent, a cardiovascular system that doesn't panic when the trail gets steep, and the connective tissue conditioning to carry a pack all day without your body breaking down.
              </p>
              <p className="text-muted-foreground leading-relaxed">
                By the end of week 8, you'll be ready to walk into any mountain-specific training programme in proper shape — not starting from scratch and hoping it works out.
              </p>

              <div className="mt-7 p-5 bg-white/3 border border-white/8 rounded-xl">
                <p className="text-sm text-muted-foreground"><span className="text-white font-semibold">Already have some fitness?</span> You may be ready for a mountain-specific plan. See <Link to="/training-guides/6-week-hiking-training-plan" className="text-primary hover:underline">the 6-week hiking plan</Link> or check our <Link to="/training-guides" className="text-primary hover:underline">full guide library</Link>.</p>
              </div>
            </section>

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">What this plan builds</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Most beginner fitness programmes are generic. This one is built specifically around the demands of mountain terrain — which requires a different emphasis than running 5Ks or getting gym-fit.
              </p>

              <h3 className="text-lg font-bold text-white mb-3">The three pillars</h3>
              <ul className="space-y-4 mb-8">
                {[
                  {
                    title: "Cardiovascular base",
                    body: "The ability to sustain aerobic effort for hours at a time. Mountain hiking is not explosive — it's prolonged, moderate-intensity work. Zone 2 training (conversational pace) builds the mitochondrial density that lets you keep moving when others stop.",
                  },
                  {
                    title: "Leg and posterior chain strength",
                    body: "Quads, hamstrings, glutes, and calves all take enormous load on a mountain — particularly on descent. Weak legs going down a 1,000m drop is where knees give out and trips end early. Strength training here is not optional.",
                  },
                  {
                    title: "Load-carrying capacity",
                    body: "A 10–12kg pack changes everything. It shifts your centre of gravity, adds stress to your hips and knees, and fatigues your shoulders and upper back. You can't prepare for this by hiking without a pack and hoping it'll be fine on the day.",
                  },
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

              <h3 className="text-lg font-bold text-white mb-3">Minimum starting point</h3>
              <ul className="space-y-3">
                {[
                  "Able to walk continuously for 60+ minutes without stopping",
                  "No current injuries that limit lower body movement",
                  "Available for 3–4 sessions per week",
                  "Access to any hill or slope — even a small one",
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">The 8-week plan</h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                Each two-week block has a clear focus. The volume and intensity increase progressively — not randomly. The final week is a deliberate reduction to let your body consolidate before moving on to mountain-specific training.
              </p>

              <div className="space-y-4">
                {[
                  {
                    phase: "Weeks 1–2",
                    label: "Establish",
                    color: "border-primary/30 bg-primary/5",
                    labelColor: "text-primary",
                    content: "Three sessions per week: two 35–40 minute aerobic sessions (running, cycling, or brisk walking) and one longer weekend hike of 2–3 hours. Keep everything at an easy, conversational pace. The goal is establishing the habit and waking your aerobic system up — not impressing yourself. Most beginners go too hard here and pay for it in week four. Don't.",
                  },
                  {
                    phase: "Weeks 3–4",
                    label: "Load",
                    color: "border-blue-400/30 bg-blue-400/5",
                    labelColor: "text-blue-400",
                    content: "Add a strength session: step-ups, bodyweight squats, lunges, and calf raises. 30–35 minutes, twice a week. Introduce a pack on your weekend hike — start at 6kg and wear it for the full duration. The first time you do this, your hips and shoulders will notice. That's normal. By the end of week four, the pack should feel familiar. Aerobic sessions extend to 45–50 minutes each.",
                  },
                  {
                    phase: "Weeks 5–6",
                    label: "Elevation",
                    color: "border-orange-400/30 bg-orange-400/5",
                    labelColor: "text-orange-400",
                    content: "Replace one aerobic session with a hill repetition session: find a local slope with 80–120m of elevation and repeat it 3–4 times wearing a 6–8kg pack. Walk up hard, descend deliberately and controlled — the descent is training too. Weekend hike targets 4–5 hours with 500–700m elevation gain. Pack weight increases to 8–10kg. This is where everything starts feeling like genuine mountain preparation.",
                  },
                  {
                    phase: "Weeks 7–8",
                    label: "Peak & Consolidate",
                    color: "border-purple-400/30 bg-purple-400/5",
                    labelColor: "text-purple-400",
                    content: "Week 7 is your hardest week: long Saturday hike of 5–6 hours with 700–900m elevation gain and a 10–12kg pack, followed by a shorter Sunday walk of 1.5–2 hours on tired legs. This back-to-back element is the single most effective thing you can do to prepare for multi-day objectives. Week 8 reduces volume by 30–40% — keep two shorter sessions but let your body absorb the adaptation before starting your next programme.",
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">Example training week (weeks 5–6)</h2>
              <p className="text-muted-foreground mb-6 text-sm">What a typical mid-plan week looks like when everything is running together.</p>

              <div className="overflow-hidden border border-white/8 rounded-xl">
                {[
                  { day: "Monday", type: "Rest", color: "text-muted-foreground", desc: "Full recovery from the weekend. Don't add extra sessions here — adaptation happens during rest, not during training. Your body is rebuilding the muscle fibres you broke down on Saturday and Sunday." },
                  { day: "Tuesday", type: "Aerobic", color: "text-primary", desc: "45–50 minute run, cycle, or brisk walk at conversational pace. You should be able to speak in full sentences throughout. If you can't, slow down. Zone 2 is where aerobic base is built — not in the red zone." },
                  { day: "Wednesday", type: "Strength", color: "text-blue-400", desc: "35 minutes of lower body work: step-ups onto a box or park bench, bodyweight squats, reverse lunges, single-leg calf raises. Focus on the eccentric (slow lowering) phase — this is what protects your knees on descent. Finish with 5 minutes of hip flexor stretching." },
                  { day: "Thursday", type: "Hill reps", color: "text-orange-400", desc: "Find a local slope (any gradient, 80–120m high) and repeat it 3–4 times with a 7–8kg pack. Walk the uphill hard — no stopping. Control the descent carefully, focusing on foot placement. This is your most mountain-specific session of the week." },
                  { day: "Friday", type: "Rest", color: "text-muted-foreground", desc: "Complete rest. Prepare your kit and food for Saturday. Check the weather and your route. Getting this right on a training day builds the habits you'll need on an actual mountain." },
                  { day: "Saturday", type: "Long hike", color: "text-primary", desc: "4–5 hours on any trail with 500–700m elevation gain. Carry a 9–10kg pack the whole time. Eat something every 45–60 minutes and drink consistently — don't wait until you're thirsty. Aim for steady, sustainable pace: you should finish feeling tired but not completely destroyed." },
                  { day: "Sunday", type: "Optional walk", color: "text-primary/60", desc: "1.5–2 hour easy walk on tired legs. Optional in weeks 1–5, but start treating it as compulsory from week 6 onwards. This is your introduction to back-to-back training — exactly the pattern you'll face on any multi-day objective." },
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Mistakes that derail beginners before they get started</h2>

              <div className="space-y-4">
                {[
                  {
                    title: "Trying to do too much in week one",
                    body: "Eight weeks feels short, so the instinct is to push hard from day one. This almost always causes a minor injury — a strained Achilles, a sore knee — that costs two weeks of training. The first two weeks should feel almost too easy. If they don't, you're going too hard.",
                  },
                  {
                    title: "Only training on flat ground",
                    body: "Flat fitness does not translate to mountain fitness. Your cardiovascular system adapts reasonably quickly, but the specific muscle groups used for uphill hiking — glutes, hip flexors, tibialis anterior — only adapt when they're used. Even a small local hill, repeated, is more useful than hours on a flat treadmill.",
                  },
                  {
                    title: "Ignoring strength training",
                    body: "Most people skip the strength sessions because they feel less like 'training' than a long hike. This is a mistake. The step-ups and eccentric squats in this plan are specifically designed to protect your knees and hips on descent — the part of the mountain where most injuries happen and most people feel most wrecked.",
                  },
                  {
                    title: "Not wearing the actual kit",
                    body: "Eight weeks is long enough to break in boots, identify a pack that fits, and work out what you wear on a long day. Use this time for that. Arriving at a mountain in brand-new footwear is one of the most predictable ways to ruin the experience.",
                  },
                  {
                    title: "Treating the plan as complete",
                    body: "Eight weeks of beginner conditioning makes you ready to train — not ready for a major summit. When you finish this plan, move directly into a mountain-specific programme with a clear objective and timeline. The momentum from 8 consistent weeks is worth more than the fitness itself.",
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">What comes after 8 weeks</h2>
              <p className="text-muted-foreground leading-relaxed mb-5">
                The end of this plan is not the end of training — it's the start of the real thing. By week 8, you'll have a genuine aerobic base, functional leg strength, and experience carrying a loaded pack on real terrain. That's the foundation every mountain-specific programme assumes you have.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-7">
                The question to ask at this point is: what's the objective? Your answer determines which programme comes next and how much time you need.
              </p>
              <ul className="space-y-4 mb-7">
                {[
                  { title: "UK hills (Ben Nevis, Snowdon, Scafell Pike)", body: "You're likely ready now. A couple more weeks of progressively longer hikes and you'll be well-prepared." },
                  { title: "First alpine season (Gran Paradiso, Mont Blanc Normal Route)", body: "Move into a 12–16 week alpine programme. Your base means you'll use every week of that programme properly." },
                  { title: "Kilimanjaro or Everest Base Camp", body: "Start a dedicated 16–20 week programme. The specific demands of altitude and multi-day trekking need dedicated preparation — but you now have the base to absorb that training." },
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

            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">How Summit Ready takes you from here</h2>
              <p className="text-muted-foreground leading-relaxed mb-5">
                Once you have a specific objective, Summit Ready builds you a week-by-week schedule from where you are now — not from a theoretical baseline. Tell us your mountain, your target date, and your current fitness, and we build the plan that bridges the gap:
              </p>
              <ul className="space-y-4 mb-7">
                {[
                  { title: "Your summit goal", body: "Every objective has a different fitness profile. We build around what your specific mountain actually demands — not a generic template." },
                  { title: "Your current fitness", body: "Coming off 8 weeks of beginner conditioning means you skip the foundation phases and start where you actually are." },
                  { title: "Your local hills", body: "The app finds hills and trails near you and builds them into your schedule every week — specific sessions, specific routes, specific elevation targets." },
                  { title: "Adaptive progression", body: "Missed a week? Feeling stronger than expected? The plan adjusts. You're never chasing a schedule that no longer matches your situation." },
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
                <Link to="/training-guides/6-week-hiking-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  6-Week Hiking Training Plan — Your next step after this foundation
                </Link>
                <Link to="/training-guides/kilimanjaro-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Training Plan — 12–16 week programme for Africa's highest peak
                </Link>
                <Link to="/training-guides/gran-paradiso-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Gran Paradiso Training Plan — A great first alpine 4,000m summit
                </Link>
                <Link to="/training-guides/train-for-mountains-using-local-hills" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors group">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Train for Mountains Using Local Hills — UK hill repeats for big summits
                </Link>
              </div>
            </section>

            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Build My Training Plan</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Tell us your summit goal and where you're starting from. Summit Ready builds the exact week-by-week schedule you need — from your first hike to your target peak.
              </p>
              <a href="/#get-started">
                <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                  Get Started Free
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
