import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import heroBgPath from "./assets/hero-bg.jpeg";
import featureMapPath from "./assets/feature-map.jpg";
import featureClimbPath from "./assets/feature-climb.jpg";
import {
  ChevronRight, Target, Activity, Map, ArrowRight, Mountain, CheckCircle2,
  TrendingUp, Compass, Calendar, ShieldCheck, Smartphone, MapPin,
  ArrowRight as ArrowRightIcon, Footprints, BookOpen, HelpCircle,
  Bug, Users, Zap,
} from "lucide-react";

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-32 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={heroBgPath} alt="Alpine Peak at Dawn" className="w-full h-full object-cover opacity-70 object-top" />
        <div className="hero-overlay-v absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        <div className="hero-overlay-h absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/50" />
      </div>

      <div className="relative z-10 container mx-auto px-4 flex flex-col items-center text-center max-w-5xl mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-bold text-primary mb-8 backdrop-blur-md uppercase tracking-widest shadow-[0_0_15px_rgba(62,207,117,0.15)]">
          <MapPin className="w-4 h-4" />
          <span>Train Local. Climb Higher.</span>
        </div>

        <h1 className="text-6xl md:text-8xl lg:text-[7rem] font-display font-bold text-white mb-6 leading-[0.9] tracking-tighter drop-shadow-2xl">
          Big mountains.<br/>
          <span className="text-primary italic">Trained on hills near you.</span>
        </h1>

        <p className="text-lg md:text-2xl text-muted-foreground mb-12 max-w-3xl leading-relaxed drop-shadow-lg font-light">
          Tell us your target summit. SummitReady finds the hills near you and builds a week-by-week plan that uses your local terrain to simulate exactly what your mountain demands. Train where you live. Summit anywhere.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 mb-12">
          <a href="https://testflight.apple.com/join/PbT6NbZn" target="_blank" rel="noopener noreferrer" className="transition-all hover:scale-105 active:scale-95">
            <div className="flex items-center gap-3 bg-black border border-white/20 text-white font-semibold rounded-2xl px-6 py-4 shadow-[0_0_25px_rgba(0,0,0,0.5)] min-w-[200px] justify-center">
              <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <div className="text-left">
                <div className="text-xs leading-none mb-0.5 text-white/70">Download on the</div>
                <div className="text-base leading-none">App Store</div>
              </div>
            </div>
          </a>

          <div className="relative transition-all hover:scale-105">
            <div className="flex items-center gap-3 bg-black border border-white/20 text-white/50 font-semibold rounded-2xl px-6 py-4 shadow-[0_0_25px_rgba(0,0,0,0.5)] min-w-[200px] justify-center cursor-not-allowed select-none">
              <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.18 23.76c.3.17.64.22.98.16L15.5 12 11.34 7.84 3.18 23.76zm16.4-11.02L16.7 11.2 12.5 12l4.2.8 2.88-1.54c.82-.46.82-1.6 0-2.06zM3.54.24C3.2.18 2.86.23 2.56.4c-.6.34-.6 1.2 0 1.54l8.16 15.92L15.5 12 3.54.24zm12.86 8.34l-2.9-1.6-4.2.8 4.2.8 2.9-1.6z"/>
              </svg>
              <div className="text-left">
                <div className="text-xs leading-none mb-0.5 text-white/40">Get it on</div>
                <div className="text-base leading-none">Google Play</div>
              </div>
            </div>
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap">
              Coming soon
            </span>
          </div>
        </div>

        <div className="w-full max-w-2xl">
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-4 font-semibold">Free summit guides</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/training-guides" className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white hover:bg-white/10 hover:border-primary/40 hover:text-primary transition-all backdrop-blur-md">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              Training Guides
            </Link>
            <Link to="/can-i-climb" className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white hover:bg-white/10 hover:border-primary/40 hover:text-primary transition-all backdrop-blur-md">
              <HelpCircle className="w-3.5 h-3.5 text-primary" />
              Can I Climb?
            </Link>
            <Link to="/mountains" className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-white hover:bg-white/10 hover:border-primary/40 hover:text-primary transition-all backdrop-blur-md">
              <Mountain className="w-3.5 h-3.5 text-primary" />
              Mountain Profiles
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center animate-pulse opacity-50">
        <span className="text-xs uppercase tracking-widest mb-2 font-semibold">Scroll</span>
        <ChevronRight className="w-5 h-5 rotate-90" />
      </div>
    </section>
  );
}

function ProblemStatement() {
  return (
    <section id="problem" className="py-32 bg-background relative border-t border-white/5">
      <div className="container mx-auto px-4 max-w-4xl text-center">
        <h2 className="text-3xl md:text-5xl font-display font-bold mb-8 text-white">You don't need to live near mountains to train for them.</h2>
        <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed mb-16">
          Most people think serious mountain training is only possible if you're already in the Alps or Rockies. SummitReady uses the hills right on your doorstep to build the vertical endurance, leg strength, and pack-carrying capacity your summit actually demands.
        </p>

        <div className="grid sm:grid-cols-3 gap-8">
          <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm text-left">
            <MapPin className="w-10 h-10 text-primary mb-6" />
            <h3 className="text-xl font-bold mb-3">Hills Near You</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">The app finds hills within reach of where you live and maps their elevation data into your weekly training sessions.</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm text-left">
            <TrendingUp className="w-10 h-10 text-primary mb-6" />
            <h3 className="text-xl font-bold mb-3">Summit-Matched Workouts</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Every session is reverse-engineered from your target mountain's elevation profile, distance, and technical demands.</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm text-left">
            <Compass className="w-10 h-10 text-primary mb-6" />
            <h3 className="text-xl font-bold mb-3">No Generic Plans</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">A plan for Ben Nevis looks nothing like a plan for Kilimanjaro. We build specifically for your route, your hills, your timeline.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-32 bg-section-alt relative z-10 border-y border-border">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div className="order-2 lg:order-1 relative">
            <div className="absolute -inset-10 bg-gradient-to-tr from-primary/20 to-transparent blur-3xl rounded-full z-0" />
            <img src={featureMapPath} alt="Trail map" loading="lazy" className="relative z-10 w-full rounded-2xl border border-white/10 shadow-2xl" />

            <div className="absolute -right-8 -bottom-8 bg-background/90 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-2xl z-20 hidden md:block">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-sm text-muted-foreground uppercase font-bold">Today's Workout</div>
                  <div className="font-bold">Weighted Hill Climb</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Elevation</span>
                  <span className="font-bold">2,500 ft</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pack Weight</span>
                  <span className="font-bold">35 lbs</span>
                </div>
              </div>
            </div>
          </div>

          <div className="order-1 lg:order-2">
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Your local hills.<br/>Your mountain's demands.</h2>
            <p className="text-muted-foreground mb-12 text-xl leading-relaxed">
              SummitReady analyses your target summit's full elevation profile and plots equivalent workouts on the hills closest to you — so every training day counts toward the real thing.
            </p>

            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2 text-white">Local Hill Discovery</h3>
                  <p className="text-muted-foreground leading-relaxed">Enter your location and we surface the hills within your reach — matched to your fitness level and scheduled into your weekly plan.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2 text-white">Adaptive Scheduling</h3>
                  <p className="text-muted-foreground leading-relaxed">Missed a weekend hill session? Sick on a Tuesday? The AI coach automatically adjusts your upcoming week to keep you on track safely.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2 text-white">Progressive Overload</h3>
                  <p className="text-muted-foreground leading-relaxed">Week by week, your local hill sessions get harder — more elevation, heavier pack, longer time on feet — mirroring exactly what summit day will ask of you.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Readiness() {
  return (
    <section id="readiness" className="py-32 bg-background relative">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-bold text-primary mb-6 uppercase tracking-widest">
              The Algorithm
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-white">Know exactly when you're ready.</h2>
            <p className="text-muted-foreground mb-8 text-xl leading-relaxed">
              Stop guessing if you're fit enough. Your Readiness Score synthesizes your aerobic capacity, muscular endurance, and altitude acclimatization into a single number.
            </p>
            <p className="text-muted-foreground mb-10 text-lg leading-relaxed">
              As you complete workouts, your score climbs. If you skip critical conditioning, it falls. The math is brutal, but the mountain is worse. We tell you the truth before you hit the trail.
            </p>
            <a href="#get-started">
              <Button variant="outline" className="rounded-full h-14 px-8 border-white/20 hover:bg-white/5 text-lg shadow-lg">
                Start Tracking Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-bl from-primary/10 to-transparent blur-3xl rounded-full z-0" />
            <img src={featureClimbPath} alt="Climber silhouette" loading="lazy" className="relative z-10 w-full rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" />

            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col items-center justify-center z-20 min-w-[280px]">
              <div className="relative w-40 h-40 mb-6">
                <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_0_10px_rgba(62,207,117,0.5)]" viewBox="0 0 36 36">
                  <path strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
                  <path strokeDasharray="85, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" className="animate-[dash_2s_ease-out_forwards]" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-display font-bold text-white tracking-tighter">85</span>
                  <span className="text-sm text-primary font-bold tracking-widest uppercase mt-1">Ready</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground uppercase tracking-widest font-bold mb-1">Target: Mt. Rainier</div>
                <div className="text-sm font-medium text-white bg-white/5 border border-white/10 px-3 py-1 rounded-full inline-block mt-2">Zone 3 Conditioning</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-32 bg-section-alt relative border-y border-border">
      <div className="container mx-auto px-4 text-center max-w-5xl">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-white">From your front door to the summit.</h2>
        <p className="text-xl text-muted-foreground mb-20 max-w-2xl mx-auto">
          Three steps. Your target mountain. The hills near you. No gym required.
        </p>

        <div className="grid md:grid-cols-3 gap-12 relative">
          <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent z-0" />

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-background border-2 border-white/10 flex items-center justify-center text-3xl font-display font-bold text-primary mb-8 shadow-xl">1</div>
            <h3 className="text-2xl font-bold mb-4 text-white">Pick Your Peak</h3>
            <p className="text-muted-foreground leading-relaxed">Search our database of global summits. We pull the full elevation profile, route distance, and technical demands of your chosen mountain.</p>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-background border-2 border-white/10 flex items-center justify-center text-3xl font-display font-bold text-primary mb-8 shadow-xl">2</div>
            <h3 className="text-2xl font-bold mb-4 text-white">Find Your Hills</h3>
            <p className="text-muted-foreground leading-relaxed">Tell us where you are. We find climbable hills near you and match their elevation data to your summit's demands — your local terrain becomes your training ground.</p>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-background border-2 border-primary/50 flex items-center justify-center text-3xl font-display font-bold text-primary mb-8 shadow-[0_0_30px_rgba(62,207,117,0.2)]">3</div>
            <h3 className="text-2xl font-bold mb-4 text-white">Train & Track</h3>
            <p className="text-muted-foreground leading-relaxed">Get a weekly schedule of hill sessions, rucks, and recovery built around your local terrain. Log each session and watch your Readiness Score climb toward 100.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ContentSection() {
  return (
    <section className="py-28 bg-background relative border-t border-white/5">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary mb-6 uppercase tracking-widest">
            <Mountain className="w-3.5 h-3.5" />
            Summit Resources
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-5 tracking-tight">Preparing for a real summit?</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Summit Ready is built for people training for real mountain goals — from Kilimanjaro and Mont Blanc to local hill challenges. Explore our free guides.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: BookOpen,
              label: "Training Guide",
              title: "Mont Blanc Training Plan",
              desc: "A complete 12–16 week programme for Western Europe's highest peak. Covers endurance, strength, altitude prep, and common mistakes.",
              href: "/training-guides/mont-blanc-training-plan",
              cta: "Read the guide",
              color: "text-orange-400",
              badge: "Hard · 4,808m",
            },
            {
              icon: BookOpen,
              label: "Training Guide",
              title: "Kilimanjaro Training Plan",
              desc: "Build the cardiovascular base and back-to-back endurance needed for Africa's highest peak. Beginner-friendly with proper prep.",
              href: "/training-guides/kilimanjaro-training-plan",
              cta: "Read the guide",
              color: "text-blue-400",
              badge: "Moderate · 5,895m",
            },
            {
              icon: HelpCircle,
              label: "Can I Climb?",
              title: "Can I Climb Mont Blanc?",
              desc: "An honest assessment of the fitness, experience, and preparation required before you book your Chamonix trip.",
              href: "/can-i-climb/mont-blanc",
              cta: "Find out",
              color: "text-primary",
              badge: "Assessment guide",
            },
          ].map((card) => (
            <div key={card.title} className="bg-white/3 border border-white/8 rounded-2xl p-7 flex flex-col gap-4 hover:border-white/15 transition-all duration-200 group">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-bold uppercase tracking-widest ${card.color}`}>{card.label}</span>
                <span className="text-xs text-muted-foreground bg-white/5 border border-white/8 px-2.5 py-1 rounded-full">{card.badge}</span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-2 leading-snug">{card.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{card.desc}</p>
              </div>
              <div className="mt-auto pt-2">
                <Link to={card.href}>
                  <Button variant="outline" size="sm" className="rounded-full border-white/15 hover:bg-white/5 hover:border-primary/40 hover:text-primary transition-all group-hover:border-white/20">
                    {card.cta}
                    <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-10">
          <Link to="/training-guides" className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5">
            View all training guides
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function GetStarted() {
  return (
    <section id="get-started" className="py-32 bg-section-alt relative border-t border-border">
      <div className="container mx-auto px-4 text-center max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-sm font-bold text-primary mb-6 uppercase tracking-widest">
          <Smartphone className="w-4 h-4" />
          Download the App
        </div>
        <h2 className="text-4xl md:text-5xl font-display font-bold text-white mb-6 tracking-tighter">
          Start your training today.
        </h2>
        <p className="text-xl text-muted-foreground mb-12 max-w-xl mx-auto">
          SummitReady is available on iOS and Android. Download the app, complete the 2-minute questionnaire, and get your personalised plan instantly.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <div className="relative">
            <div
              aria-disabled="true"
              className="flex items-center gap-3 bg-white/40 text-black/50 font-semibold rounded-2xl px-6 py-4 shadow-lg min-w-[200px] justify-center cursor-not-allowed select-none"
            >
              <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <div className="text-left">
                <div className="text-xs leading-none mb-0.5 opacity-70">Download on the</div>
                <div className="text-base leading-none">App Store</div>
              </div>
            </div>
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap">
              Coming soon
            </span>
          </div>

          <div className="relative">
            <div
              aria-disabled="true"
              className="flex items-center gap-3 bg-white/40 text-black/50 font-semibold rounded-2xl px-6 py-4 shadow-lg min-w-[200px] justify-center cursor-not-allowed select-none"
            >
              <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.18 23.76c.3.17.64.22.98.16L15.5 12 11.34 7.84 3.18 23.76zm16.4-11.02L16.7 11.2 12.5 12l4.2.8 2.88-1.54c.82-.46.82-1.6 0-2.06zM3.54.24C3.2.18 2.86.23 2.56.4c-.6.34-.6 1.2 0 1.54l8.16 15.92L15.5 12 3.54.24zm12.86 8.34l-2.9-1.6-4.2.8 4.2.8 2.9-1.6z"/>
              </svg>
              <div className="text-left">
                <div className="text-xs leading-none mb-0.5 opacity-70">Get it on</div>
                <div className="text-base leading-none">Google Play</div>
              </div>
            </div>
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full whitespace-nowrap">
              Coming soon
            </span>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">Free to download · Premium plan available</p>
      </div>
    </section>
  );
}

const BETA_TEST_URL = "https://testflight.apple.com/join/PbT6NbZn";

function BetaTesters() {
  return (
    <section id="beta" className="py-28 bg-background relative border-t border-white/5 overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 max-w-5xl relative z-10">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary mb-6 uppercase tracking-widest">
            <Bug className="w-3.5 h-3.5" />
            Early Access · Beta Testing
          </div>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-5 tracking-tight">
            Help shape SummitReady.
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            SummitReady is in active beta on iOS and Android. We're looking for hikers and mountain enthusiasts to test the app and report bugs — your feedback directly shapes the product.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/3 border border-white/8 rounded-2xl p-7 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-white text-lg">iOS &amp; Android</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">Install directly from TestFlight (iOS) or Google Play closed testing (Android). No sideloading needed.</p>
          </div>
          <div className="bg-white/3 border border-white/8 rounded-2xl p-7 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-white text-lg">Quick to get started</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">Takes 5–60 minutes. Explore the app, try out hill finding and GPS tracking, and submit any bugs you find.</p>
          </div>
          <div className="bg-white/3 border border-white/8 rounded-2xl p-7 flex flex-col gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-white text-lg">Shape the product</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">Beta testers get early access to premium features and their feedback directly influences what we build next.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href={BETA_TEST_URL} target="_blank" rel="noopener noreferrer">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full px-10 h-14 text-base transition-all hover:scale-105 active:scale-95 shadow-[0_0_25px_rgba(62,207,117,0.3)]">
              Apply to Beta Test
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </a>
          <p className="text-sm text-muted-foreground">iOS via TestFlight · Android via Google Play · Free to join</p>
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="py-32 bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 opacity-20 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
      <div className="container mx-auto px-4 text-center relative z-10 max-w-4xl">
        <h2 className="text-5xl md:text-7xl font-display font-bold text-white mb-8 tracking-tighter drop-shadow-lg">
          Your summit starts on the hill outside your door.
        </h2>
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
          The mountain won't lower its standards. But you don't need to travel to mountains to meet them. Start training on the hills near you, today.
        </p>
        <a href="#get-started">
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-12 h-16 text-xl shadow-[0_0_40px_rgba(62,207,117,0.4)] transition-all hover:scale-105 active:scale-95">
            Get SummitReady Free
          </Button>
        </a>
      </div>
    </section>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 scroll-smooth">
      <SiteNav />
      <Hero />
      <ContentSection />
      <ProblemStatement />
      <Features />
      <HowItWorks />
      <Readiness />
      <BetaTesters />
      <CTA />
      <GetStarted />
      <SiteFooter />
    </div>
  );
}
