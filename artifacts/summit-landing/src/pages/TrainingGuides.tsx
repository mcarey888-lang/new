import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock, TrendingUp, ChevronRight } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import climberBg from "../assets/hero-bg.jpeg";
import montBlancImg from "../assets/hero-mont-blanc.jpg";
import kilimanjaroImg from "../assets/hero-kilimanjaro.jpg";
import matterhornImg from "../assets/hero-matterhorn.jpg";
import ebcImg from "../assets/hero-ebc.jpg";

const GUIDES = [
  {
    title: "Mont Blanc Training Plan",
    href: "/training-guides/mont-blanc-training-plan",
    difficulty: "Hard",
    diffColor: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    weeks: "12–16 weeks",
    description: "The standard Goûter route demands real aerobic fitness, altitude tolerance, and the ability to carry a pack for 12+ hours. This plan builds all three.",
    available: true,
    image: montBlancImg,
    imageAlt: "Mont Blanc snow peak in the French Alps",
  },
  {
    title: "Kilimanjaro Training Plan",
    href: "/training-guides/kilimanjaro-training-plan",
    difficulty: "Moderate",
    diffColor: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    weeks: "12–16 weeks",
    description: "Kilimanjaro's challenge is almost entirely altitude. This plan builds the cardiovascular base and back-to-back endurance you need for five to eight days on your feet above 4,000m.",
    available: true,
    image: kilimanjaroImg,
    imageAlt: "Uhuru Peak summit sign on Kilimanjaro",
  },
  {
    title: "Matterhorn Preparation Guide",
    href: "/training-guides/matterhorn-preparation-guide",
    difficulty: "Expert",
    diffColor: "text-red-400 bg-red-400/10 border-red-400/20",
    weeks: "6–12 months",
    description: "The Matterhorn is not a beginner mountain. This guide covers the fitness, technical skills, and progressive alpine experience required before you set foot on its ridges.",
    available: true,
    image: matterhornImg,
    imageAlt: "The Matterhorn pyramid at twilight above Zermatt",
  },
  {
    title: "Everest Base Camp Training Plan",
    href: "/training-guides",
    difficulty: "Challenging",
    diffColor: "text-purple-400 bg-purple-400/10 border-purple-400/20",
    weeks: "16+ weeks",
    description: "EBC is a 130km trek reaching 5,364m. This plan focuses on multi-day endurance, altitude preparation, and carrying a loaded pack across varied terrain.",
    available: false,
    image: ebcImg,
    imageAlt: "High Himalayan mountains on the Everest Base Camp trek",
  },
  {
    title: "6 Week Hiking Training Plan",
    href: "/training-guides",
    difficulty: "Beginner",
    diffColor: "text-green-400 bg-green-400/10 border-green-400/20",
    weeks: "6 weeks",
    description: "New to hiking? This six-week plan takes you from the sofa to confidently completing your first full-day mountain walk with elevation gain.",
    available: false,
    image: null,
    imageAlt: "",
  },
  {
    title: "Beginner Mountain Fitness Plan",
    href: "/training-guides",
    difficulty: "Beginner",
    diffColor: "text-green-400 bg-green-400/10 border-green-400/20",
    weeks: "8 weeks",
    description: "Build the foundational leg strength, cardiovascular fitness, and pack-carrying capacity needed before starting any mountain-specific training programme.",
    available: false,
    image: null,
    imageAlt: "",
  },
];

export default function TrainingGuides() {
  usePageMeta({
    title: "Mountain Training Guides | SummitReady",
    description: "Training plans and preparation advice for Mont Blanc, Kilimanjaro, the Matterhorn and more. Built for people training for real summit goals.",
    canonical: "https://summitready.uk/training-guides/",
    schema: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Mountain Training Guides",
      "description": "Training plans and preparation advice for real summit goals.",
      "url": "https://summitready.uk/training-guides/",
      "publisher": { "@type": "Organization", "name": "SummitReady", "url": "https://summitready.uk/" },
    },
  });

  return (
    <SiteLayout>
      <div className="bg-background min-h-screen">
        {/* Hero */}
        <section className="py-12 md:py-16 border-b border-white/5 relative overflow-hidden">
          <div className="absolute inset-0">
            <img src={climberBg} alt="" aria-hidden="true" className="w-full h-full object-cover object-top opacity-60" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(62,207,117,0.07),transparent_60%)]" />
          </div>
          <div className="container mx-auto px-6 max-w-4xl relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary mb-6 uppercase tracking-widest">
              <TrendingUp className="w-3 h-3" />
              Training Guides
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-6 tracking-tight leading-[1.05]">
              Mountain Training Guides
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mb-4">
              Training plans and preparation advice for real summit goals.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed max-w-3xl">
              SummitReady helps you prepare for mountains using personalised training plans built around your fitness level, summit date, and the hills near where you live. These guides explain exactly what each mountain demands — and how to get ready for it.
            </p>
          </div>
        </section>

        {/* Guides grid */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {GUIDES.map((guide) => (
                <div
                  key={guide.title}
                  className={`bg-white/3 border border-white/8 rounded-2xl overflow-hidden flex flex-col hover:border-white/15 transition-all duration-200 ${!guide.available ? "opacity-70" : ""}`}
                >
                  {guide.image && (
                    <div className="h-40 relative overflow-hidden shrink-0">
                      <img
                        src={guide.image}
                        alt={guide.imageAlt}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent" />
                    </div>
                  )}

                  <div className="p-6 flex flex-col gap-4 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${guide.diffColor}`}>
                        {guide.difficulty}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {guide.weeks}
                      </div>
                    </div>

                    <div>
                      <h2 className="text-lg font-bold text-white mb-2 leading-snug">{guide.title}</h2>
                      <p className="text-sm text-muted-foreground leading-relaxed">{guide.description}</p>
                    </div>

                    <div className="mt-auto pt-2">
                      {guide.available ? (
                        <Link to={guide.href}>
                          <Button variant="outline" size="sm" className="rounded-full border-white/15 hover:bg-white/5 hover:border-primary/40 hover:text-primary transition-all group">
                            Read guide
                            <ChevronRight className="w-3.5 h-3.5 ml-1 group-hover:translate-x-0.5 transition-transform" />
                          </Button>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground bg-white/5 border border-white/8 px-3 py-1.5 rounded-full inline-block">Coming soon</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 bg-[#081021] border-t border-white/5">
          <div className="container mx-auto px-6 max-w-3xl text-center">
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-5 tracking-tight">
              Want a plan built around your summit date?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              These guides give you the framework. Summit Ready builds your exact training schedule — based on your current fitness, your local hills, and the date you're planning to climb.
            </p>
            <a href="/#get-started">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-10 h-14 text-base shadow-[0_0_30px_rgba(62,207,117,0.35)] transition-all hover:scale-105 active:scale-95">
                Try Summit Ready Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
          </div>
        </section>
      </div>
    </SiteLayout>
  );
}
