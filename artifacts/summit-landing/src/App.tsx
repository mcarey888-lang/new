import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import logoPath from "../../summit-ready/assets/images/logo.gif";
import heroBgPath from "./assets/hero-bg.png";
import featureMapPath from "./assets/feature-map.png";
import featureClimbPath from "./assets/feature-climb.png";
import { ChevronRight, Target, Activity, Map, ArrowRight, Mountain, CheckCircle2, TrendingUp, Compass, Calendar, ShieldCheck } from "lucide-react";

function Navigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-background/80 backdrop-blur-xl border-b border-white/5 py-4" : "bg-transparent py-6"}`}>
      <div className="container mx-auto px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src={logoPath} alt="SummitReady Logo" className="h-10 w-auto" />
          <span className="font-display font-bold text-xl tracking-tight">SummitReady</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#problem" className="hover:text-primary transition-colors">The Reality</a>
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-primary transition-colors">How it Works</a>
        </div>
        <div>
          <a href="#">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full px-6 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(62,207,117,0.3)]">
              Get Started
            </Button>
          </a>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-32 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={heroBgPath} alt="Alpine Peak at Dawn" className="w-full h-full object-cover opacity-50 object-top" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 via-transparent to-background/50" />
      </div>
      
      <div className="relative z-10 container mx-auto px-4 flex flex-col items-center text-center max-w-5xl mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-primary mb-8 backdrop-blur-md uppercase tracking-widest shadow-[0_0_15px_rgba(62,207,117,0.15)]">
          <Activity className="w-4 h-4" />
          <span>AI-Powered Alpine Training</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl lg:text-[7rem] font-display font-bold text-white mb-6 leading-[0.9] tracking-tighter drop-shadow-2xl">
          The mountain doesn't care if you're ready. <br/>
          <span className="text-primary italic">We do.</span>
        </h1>
        
        <p className="text-lg md:text-2xl text-muted-foreground mb-12 max-w-3xl leading-relaxed drop-shadow-lg font-light">
          Pick your summit. Tell us your baseline. Get a week-by-week training plan that tracks your readiness score from 0 to 100. It's like having a coach who knows the mountain and your body.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <a href="#" className="w-full sm:w-auto">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full px-10 h-16 text-lg w-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(62,207,117,0.4)]">
              Start Your Plan
              <ChevronRight className="ml-2 w-5 h-5" />
            </Button>
          </a>
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
        <h2 className="text-3xl md:text-5xl font-display font-bold mb-8 text-white">Running won't get you to 14,000 feet.</h2>
        <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed mb-16">
          Generic fitness plans prepare you for flat ground. Alpine ascents require vertical endurance, pack-weight progression, and altitude adaptation. We throw out the cookie-cutter templates and build a plan for your specific objective.
        </p>

        <div className="grid sm:grid-cols-3 gap-8">
          <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm text-left">
            <Mountain className="w-10 h-10 text-destructive mb-6" />
            <h3 className="text-xl font-bold mb-3">Wrong Terrain</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Most plans focus on mileage. We focus on elevation gain and terrain specificity.</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm text-left">
            <TrendingUp className="w-10 h-10 text-destructive mb-6" />
            <h3 className="text-xl font-bold mb-3">Linear Progression</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">Your body doesn't adapt linearly. We periodize your load based on fatigue data.</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-8 rounded-2xl backdrop-blur-sm text-left">
            <Compass className="w-10 h-10 text-destructive mb-6" />
            <h3 className="text-xl font-bold mb-3">One Size Fits All</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">A plan for Mt. Hood is useless for the Matterhorn. We build for the exact route.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-32 bg-[#081021] relative z-10 border-y border-white/5">
      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-2 gap-20 items-center">
          <div className="order-2 lg:order-1 relative">
            <div className="absolute -inset-10 bg-gradient-to-tr from-primary/20 to-transparent blur-3xl rounded-full z-0" />
            <img src={featureMapPath} alt="Trail map" className="relative z-10 w-full rounded-2xl border border-white/10 shadow-2xl" />
            
            <div className="absolute -right-8 -bottom-8 bg-background/90 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-2xl z-20 hidden md:block">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground uppercase font-bold">Today's Workout</div>
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
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6">Built for the climb, <br/>tailored to you.</h2>
            <p className="text-muted-foreground mb-12 text-xl leading-relaxed">
              Every mountain has a profile. We analyze the specific route's distance, elevation gain, and technical difficulty to reverse-engineer your success.
            </p>
            
            <div className="space-y-8">
              <div className="flex gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2 text-white">Mountain-Specific Logic</h3>
                  <p className="text-muted-foreground leading-relaxed">We extract topographic data from your chosen route and build a training load that perfectly mirrors summit day demands.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                  <Calendar className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2 text-white">Adaptive Scheduling</h3>
                  <p className="text-muted-foreground leading-relaxed">Missed a weekend long hike? Sick on a Tuesday? The AI coach automatically adjusts your upcoming week to keep you on track safely.</p>
                </div>
              </div>
              <div className="flex gap-6">
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-lg">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2 text-white">Injury Prevention</h3>
                  <p className="text-muted-foreground leading-relaxed">Built-in deload weeks, mobility routines, and fatigue monitoring to ensure you reach the trailhead healthy.</p>
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
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary mb-6 uppercase tracking-widest">
              The Algorithm
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-white">Know exactly when you're ready.</h2>
            <p className="text-muted-foreground mb-8 text-xl leading-relaxed">
              Stop guessing if you're fit enough. Your Readiness Score synthesizes your aerobic capacity, muscular endurance, and altitude acclimatization into a single number.
            </p>
            <p className="text-muted-foreground mb-10 text-lg leading-relaxed">
              As you complete workouts, your score climbs. If you skip critical conditioning, it falls. The math is brutal, but the mountain is worse. We tell you the truth before you hit the trail.
            </p>
            <a href="#">
              <Button variant="outline" className="rounded-full h-14 px-8 border-white/20 hover:bg-white/5 text-lg shadow-lg">
                Start Tracking Free
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
          </div>

          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-bl from-primary/10 to-transparent blur-3xl rounded-full z-0" />
            <img src={featureClimbPath} alt="Climber silhouette" className="relative z-10 w-full rounded-2xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" />
            
            {/* Readiness Dial UI Element */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col items-center justify-center z-20 min-w-[280px]">
              <div className="relative w-40 h-40 mb-6">
                <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_0_10px_rgba(62,207,117,0.5)]" viewBox="0 0 36 36">
                  {/* Background Circle */}
                  <path strokeDasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2.5" />
                  {/* Progress Circle */}
                  <path strokeDasharray="85, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" className="animate-[dash_2s_ease-out_forwards]" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-display font-bold text-white tracking-tighter">85</span>
                  <span className="text-xs text-primary font-bold tracking-widest uppercase mt-1">Ready</span>
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground uppercase tracking-widest font-bold mb-1">Target: Mt. Rainier</div>
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
    <section id="how-it-works" className="py-32 bg-[#081021] relative border-y border-white/5">
      <div className="container mx-auto px-4 text-center max-w-5xl">
        <h2 className="text-4xl md:text-5xl font-display font-bold mb-6 text-white">Three steps to the summit.</h2>
        <p className="text-xl text-muted-foreground mb-20 max-w-2xl mx-auto">
          We removed the guesswork. You just have to put in the work.
        </p>

        <div className="grid md:grid-cols-3 gap-12 relative">
          <div className="hidden md:block absolute top-12 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-transparent via-white/10 to-transparent z-0" />
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-background border-2 border-white/10 flex items-center justify-center text-3xl font-display font-bold text-primary mb-8 shadow-xl">
              1
            </div>
            <h3 className="text-2xl font-bold mb-4 text-white">Pick Your Peak</h3>
            <p className="text-muted-foreground leading-relaxed">Search our database of global summits. We instantly pull the route data, elevation profile, and technical demands.</p>
          </div>
          
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-background border-2 border-white/10 flex items-center justify-center text-3xl font-display font-bold text-primary mb-8 shadow-xl">
              2
            </div>
            <h3 className="text-2xl font-bold mb-4 text-white">Assess Fitness</h3>
            <p className="text-muted-foreground leading-relaxed">Take a 2-minute assessment. We gauge your current cardiovascular base, strength, and past alpine experience.</p>
          </div>

          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-background border-2 border-primary/50 flex items-center justify-center text-3xl font-display font-bold text-primary mb-8 shadow-[0_0_30px_rgba(62,207,117,0.2)]">
              3
            </div>
            <h3 className="text-2xl font-bold mb-4 text-white">Execute Plan</h3>
            <p className="text-muted-foreground leading-relaxed">Receive a dynamic weekly schedule of runs, rucks, climbs, and recovery. Log data and watch your readiness rise.</p>
          </div>
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
          Your summit awaits.
        </h2>
        <p className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
          The mountain won't lower its standards. Raise yours. Join thousands of climbers training smarter with SummitReady.
        </p>
        <a href="#">
          <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-full px-12 h-16 text-xl shadow-[0_0_40px_rgba(62,207,117,0.4)] transition-all hover:scale-105 active:scale-95">
            Get SummitReady Free
          </Button>
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="py-12 bg-background border-t border-white/5 text-center">
      <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <img src={logoPath} alt="SummitReady Logo" className="h-8 w-auto opacity-80" />
          <span className="font-display font-bold text-lg tracking-tight text-white/80">SummitReady</span>
        </div>
        
        <div className="flex gap-8 text-sm text-muted-foreground">
          <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-primary transition-colors">Contact</a>
        </div>
        
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} SummitReady. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export default function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 scroll-smooth">
      <Navigation />
      <Hero />
      <ProblemStatement />
      <Features />
      <HowItWorks />
      <Readiness />
      <CTA />
      <Footer />
    </div>
  );
}