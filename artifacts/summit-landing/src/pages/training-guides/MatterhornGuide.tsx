import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, AlertTriangle, Clock, TrendingUp, ChevronRight, ShieldAlert } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import heroBg from "../../assets/hero-matterhorn.jpg";

function InternalCTA() {
  return (
    <div className="my-10 bg-primary/8 border border-primary/20 rounded-2xl p-7 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
      <div className="flex-1">
        <p className="font-bold text-white text-lg mb-1">Building toward the Matterhorn?</p>
        <p className="text-muted-foreground text-sm leading-relaxed">You could research this path yourself — but most people either underestimate how long the progression takes, or try to skip steps and arrive at the Hörnli hut technically underprepared. Summit Ready builds your training plan around your current level and the hills near you, working toward the Matterhorn progressively.</p>
      </div>
      <a href="/#get-started" className="shrink-0">
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-7 h-12 shadow-[0_0_20px_rgba(62,207,117,0.3)] transition-all hover:scale-105 whitespace-nowrap">
          Start My Plan
          <ArrowRight className="ml-2 w-4 h-4" />
        </Button>
      </a>
    </div>
  );
}

export default function MatterhornGuide() {
  usePageMeta({
    title: "Matterhorn Preparation Guide | How to Train for the Matterhorn | SummitReady",
    description: "A realistic preparation guide for the Matterhorn — covering the technical skills, fitness requirements, and training timeline needed before attempting the Hörnli Ridge.",
    canonical: "https://summitready.uk/training-guides/matterhorn-preparation-guide/",
    schema: {
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": "Matterhorn Preparation Guide",
      "description": "A realistic preparation guide for the Matterhorn — covering the technical skills, fitness requirements, and training timeline.",
      "url": "https://summitready.uk/training-guides/matterhorn-preparation-guide/",
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
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.05),transparent_60%)]" />
          </div>
          <div className="container mx-auto px-6 max-w-4xl relative z-10">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8" aria-label="Breadcrumb">
              <Link to="/" className="hover:text-primary transition-colors">Home</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <Link to="/training-guides" className="hover:text-primary transition-colors">Training Guides</Link>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-white">Matterhorn</span>
            </nav>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border text-red-400 bg-red-400/10 border-red-400/20">Expert</span>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                6–12 months minimum
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <TrendingUp className="w-3.5 h-3.5" />
                4,478m summit
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Matterhorn Preparation Guide
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
              The Matterhorn is one of the most iconic peaks in the Alps — and one of the most demanding. This guide covers the fitness, technical skills, and progressive alpine experience you need before you attempt the Hörnli Ridge.
            </p>
          </div>
        </section>

        <article className="py-14 md:py-20">
          <div className="container mx-auto px-6 max-w-3xl">

            {/* Section 1: Honest intro */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">The honest reality of the Matterhorn</h2>
              <p className="text-muted-foreground leading-relaxed mb-4 text-lg">
                At 4,478m, the Matterhorn is lower than Mont Blanc. What makes it so demanding isn't height — it's the technical nature of the ascent. The standard Hörnli Ridge involves over 1,200m of mixed rock and ice climbing, sections of fixed rope on vertical terrain, glacier travel, and conditions that change rapidly and severely.
              </p>
              <p className="text-muted-foreground leading-relaxed mb-4">
                The Matterhorn has one of the highest fatality rates of any major alpine peak. Approximately 500 people have died on it. This is not meant to discourage — it's meant to ensure you approach it with the respect it demands. Thousands of people summit each season. They do so because they are properly prepared.
              </p>

              {/* Warning box */}
              <div className="my-7 flex gap-4 p-6 bg-red-500/8 border border-red-500/25 rounded-xl">
                <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-white mb-2">This is not a beginner mountain</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">If you have not previously completed technical alpine routes, climbed on fixed ropes, or used crampons and an ice axe in genuine conditions, the Matterhorn is not your next step. Gain that experience first — on peaks like Gran Paradiso, Mont Blanc, or the Aiguilles Rouges.</p>
                </div>
              </div>
            </section>

            {/* Section 2: Prerequisites */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Prerequisites before you start Matterhorn preparation</h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                These are not goals to reach — they're the starting point. If you haven't done these things, address them before beginning a Matterhorn-specific programme.
              </p>

              <h3 className="text-lg font-bold text-white mb-3">Technical prerequisites</h3>
              <ul className="space-y-3 mb-7">
                {[
                  "Confident rock scrambling on Grade 3+ terrain — moving quickly and securely on steep, loose rock",
                  "Experience using crampons and ice axe in real conditions (not just on a course)",
                  "Comfortable moving on fixed ropes — ascending and descending with ascenders and figure-of-eight",
                  "Prior glacier travel: rope team travel, crevasse awareness",
                  "At least two prior ascents of alpine peaks above 4,000m",
                  "Experience with early alpine starts: moving in the dark, cold, and at altitude",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground text-sm leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>

              <h3 className="text-lg font-bold text-white mb-3">Fitness prerequisites</h3>
              <ul className="space-y-3">
                {[
                  "Able to sustain 10–12 hours of physical effort in a single day",
                  "Comfortable with 1,500m+ elevation gain per day carrying a 12kg pack",
                  "Excellent aerobic base — you should be able to hold a conversation at 4,000m",
                  "Leg strength sufficient for hundreds of metres of vertical climbing on steep rock",
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Preparation timeline</h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                For most people, the journey to the Matterhorn takes 12–24 months from a strong hiking background. For those starting with no alpine experience, allow 2–3 years. The mountain will still be there.
              </p>

              <div className="space-y-4">
                {[
                  {
                    phase: "Months 1–3",
                    label: "Fitness Foundation",
                    color: "border-primary/30 bg-primary/5",
                    labelColor: "text-primary",
                    content: "Build the same fitness base as any serious alpine objective. 4–5 days of training per week, including weekly hill sessions, strength work, and progressive long days. Treat this exactly like a Mont Blanc preparation. Aim to complete a challenging non-technical alpine peak (Breithorn, Gran Paradiso) during this phase.",
                  },
                  {
                    phase: "Months 3–6",
                    label: "Technical Skills",
                    color: "border-blue-400/30 bg-blue-400/5",
                    labelColor: "text-blue-400",
                    content: "Enrol in a recognised mountaineering course: crampon technique, ice axe arrest, crevasse rescue, rope technique on rock and ice. UK-based climbers should consider an IFMGA-certified guide course or an Alpine Skills Course in the Alps. Complete at least two glacier peaks — Gran Paradiso and Mont Blanc are ideal sequentially.",
                  },
                  {
                    phase: "Months 6–9",
                    label: "Alpine Progression",
                    color: "border-orange-400/30 bg-orange-400/5",
                    labelColor: "text-orange-400",
                    content: "Progress to harder technical routes in the Alps. The Aiguilles Rouges near Chamonix offer excellent mixed climbing progression. Complete Mont Blanc. Attempt at least one other 4,000m peak with genuine technical character — the Weisshorn, Dent Blanche, or Dufourspitze. Hire a guide for these if you're not yet leading.",
                  },
                  {
                    phase: "Months 9–12",
                    label: "Matterhorn-Specific",
                    color: "border-purple-400/30 bg-purple-400/5",
                    labelColor: "text-purple-400",
                    content: "Spend time in Zermatt acclimatising and practising on the Matterhorn's lower sections. Many climbers do a reconnaissance hike to the Hörnli hut (3,260m) before their summit attempt. Peak fitness maintained. A competent guide for your summit attempt is strongly recommended, even for experienced alpinists.",
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

            {/* Section 4: Training week */}
            <section className="mb-14">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-2">Example training week (peak phase)</h2>
              <p className="text-muted-foreground mb-6 text-sm">What a strong weekly training block looks like in the final 3 months of preparation.</p>

              <div className="overflow-hidden border border-white/8 rounded-xl">
                {[
                  { day: "Monday", type: "Climbing", color: "text-red-400", desc: "Indoor or outdoor rock climbing. Focus on technical footwork, body positioning on steep terrain, and comfort on routes that require precise movement. Grade 5+ climbing ability is necessary for the Hörnli Ridge." },
                  { day: "Tuesday", type: "Strength", color: "text-blue-400", desc: "Full body strength session with emphasis on pulling movements (for rope climbing) and explosive leg power (stepping up and over rock). Weighted pull-ups, deadlifts, step-ups, and core stability." },
                  { day: "Wednesday", type: "Cardio", color: "text-primary", desc: "Zone 2 run or bike, 60 minutes. Your aerobic base must be bulletproof for 10+ hours at altitude. This session maintains that base throughout the technical training block." },
                  { day: "Thursday", type: "Hill session", color: "text-orange-400", desc: "Weighted hill repeats — 12–15kg pack, steep gradient, 5–8 repeats. Includes deliberate scrambling sections where available. Moving uphill continuously for 90+ minutes." },
                  { day: "Friday", type: "Rest", color: "text-muted-foreground", desc: "Full rest. Review weather, study the route, mental preparation. The Matterhorn requires significant concentration and decision-making on the mountain." },
                  { day: "Sat–Sun", type: "Mountain days", color: "text-primary", desc: "Weekend mountain pair — Saturday: a technical scramble or mixed terrain route with pack, 8–10 hours. Sunday: 4–6 hours on technical terrain or recovery hike. These are your most important weekly sessions." },
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
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white mb-5">Critical mistakes to avoid</h2>
              <div className="space-y-4">
                {[
                  { title: "Attempting without a guide if inexperienced", body: "The Matterhorn's route-finding is not trivial. Poor weather, rockfall, and crowded fixed ropes create genuinely dangerous situations. For your first attempt, climbing with a certified IFMGA mountain guide is the decision that most often determines whether you summit or survive." },
                  { title: "Rushing the progression", body: "The mountain will still be there in two years. Skipping intermediate alpine peaks to jump straight to the Matterhorn is a common and sometimes fatal mistake. Each step builds judgment, not just fitness." },
                  { title: "Underestimating rockfall", body: "The Hörnli Ridge sees significant rockfall — both natural and from other parties above you. A helmet is essential. An early start (3–4am from the Hörnli hut) gets you above slower parties before the rockfall risk increases with the day." },
                  { title: "Poor conditioning for technical descents", body: "Coming down the Hörnli Ridge on tired legs, in potentially deteriorating weather, is where most accidents happen. Descend with more caution than you ascended. Technical descent skills must be as practised as ascent." },
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
              <h3 className="font-bold text-white mb-4">Build your way to the Matterhorn</h3>
              <div className="space-y-3">
                <Link to="/training-guides/mont-blanc-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Mont Blanc Training Plan — Complete this first
                </Link>
                <Link to="/mountains/matterhorn" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Matterhorn Mountain Profile — Routes, conditions, and what to expect
                </Link>
                <Link to="/can-i-climb/matterhorn" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Can I Climb the Matterhorn? — Honest skills and fitness assessment
                </Link>
                <Link to="/training-guides/kilimanjaro-training-plan" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Kilimanjaro Training Plan — Build your multi-day endurance base
                </Link>
                <Link to="/training-guides" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  All Training Guides — Full guide library
                </Link>
                <Link to="/training-guides/train-for-mountains-using-local-hills" className="flex items-center gap-3 text-sm text-muted-foreground hover:text-primary transition-colors">
                  <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                  Train for Mountains Using Local Hills — UK hill repeats for big summits
                </Link>
              </div>
            </section>

            {/* Final CTA */}
            <section className="bg-primary/8 border border-primary/25 rounded-2xl p-8 text-center">
              <h2 className="text-2xl font-display font-bold text-white mb-3">Start Building Toward the Matterhorn</h2>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                The journey starts with a strong fitness base. Summit Ready builds your week-by-week training plan — wherever you are in that journey.
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
