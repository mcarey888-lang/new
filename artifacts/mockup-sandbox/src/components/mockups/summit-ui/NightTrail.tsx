import React from 'react';
import { Home, Calendar, Map, Activity, User, Bell, ChevronRight, Zap, Target, TrendingUp, Trophy } from 'lucide-react';

export default function NightTrail() {
  return (
    <div className="min-h-screen bg-black text-white font-sans overflow-x-hidden flex justify-center">
      <div className="w-full max-w-[390px] min-h-[844px] bg-[#000000] relative pb-20 shadow-2xl overflow-hidden flex flex-col">
        
        {/* App Header */}
        <header className="flex justify-between items-center px-6 pt-12 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#111111] flex items-center justify-center border border-[#39FF14]/20">
              <Zap size={16} className="text-[#39FF14]" />
            </div>
            <span className="font-bold text-lg tracking-widest uppercase text-white/90">Summit<span className="text-[#39FF14]">Ready</span></span>
          </div>
          <button className="w-10 h-10 rounded-full bg-[#111111] flex items-center justify-center relative">
            <Bell size={20} className="text-white/70" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[#39FF14] rounded-full"></span>
          </button>
        </header>

        <main className="flex-1 overflow-y-auto px-5 pb-6 space-y-8 no-scrollbar">
          
          {/* Mountain Hero */}
          <section className="relative rounded-2xl overflow-hidden mt-2 p-6 border border-[#111111]">
            <div className="absolute inset-0 bg-gradient-to-b from-[#39FF14]/10 to-transparent opacity-50"></div>
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-black to-transparent z-10"></div>
            
            {/* SVG Mountain abstract */}
            <div className="absolute inset-0 z-0 opacity-40">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full stroke-[#39FF14] fill-transparent stroke-[0.5]">
                <path d="M0,100 L30,40 L45,60 L75,20 L100,60 L100,100 Z" />
              </svg>
            </div>

            <div className="relative z-20 flex flex-col gap-1 mt-6">
              <span className="text-[#00D4FF] text-xs font-bold tracking-[0.2em] uppercase">Target Summit</span>
              <h1 className="text-4xl font-black text-[#39FF14] tracking-tight uppercase leading-none mt-1">Ben Nevis</h1>
              <div className="flex items-center gap-2 mt-3 text-white/60 text-sm font-medium">
                <Calendar size={14} className="text-[#00D4FF]" />
                <span>23 JULY 2025</span>
                <span className="text-[#39FF14]/50 ml-2 border border-[#39FF14]/30 px-2 py-0.5 rounded text-xs bg-[#39FF14]/10">114 DAYS</span>
              </div>
            </div>
          </section>

          {/* Readiness Score */}
          <section className="flex items-center justify-between bg-[#0A0A0A] rounded-2xl p-6 border border-[#111111]">
            <div>
              <h2 className="text-white/50 text-xs font-bold tracking-widest uppercase mb-1">Readiness</h2>
              <div className="flex items-baseline gap-1">
                <span className="text-5xl font-black text-white">72</span>
                <span className="text-2xl font-bold text-[#39FF14]">%</span>
              </div>
              <p className="text-[#00D4FF] text-sm mt-1 flex items-center gap-1 font-medium">
                <TrendingUp size={14} />
                +3% this week
              </p>
            </div>
            
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <path
                  className="stroke-[#111111]"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeWidth="3"
                />
                <path
                  className="stroke-[#39FF14]"
                  strokeDasharray="72, 100"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              <Target size={24} className="absolute text-[#39FF14]" />
            </div>
          </section>

          {/* Today's Session */}
          <section>
            <div className="flex justify-between items-end mb-4">
              <h2 className="text-white/50 text-xs font-bold tracking-widest uppercase">Today's Protocol</h2>
            </div>
            
            <div className="bg-[#111111] rounded-xl overflow-hidden relative group cursor-pointer">
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#39FF14]"></div>
              <div className="p-5 pl-6">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="inline-block px-2 py-1 bg-[#39FF14]/10 text-[#39FF14] text-[10px] font-bold uppercase tracking-wider rounded mb-2">
                      High Intensity
                    </span>
                    <h3 className="text-xl font-bold text-white mb-1">Hill Repeats</h3>
                    <p className="text-white/60 text-sm font-medium">Latrigg • 5km • 400m ▲</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#1A1A1A] flex items-center justify-center border border-white/5">
                    <ChevronRight size={20} className="text-[#39FF14]" />
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Weekly Stats */}
          <section className="grid grid-cols-2 gap-4">
            <div className="bg-[#0A0A0A] rounded-xl p-5 border border-[#111111] flex flex-col justify-between">
              <span className="text-white/50 text-[10px] font-bold tracking-widest uppercase">Sessions</span>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">3</span>
                <span className="text-lg font-bold text-white/30">/5</span>
              </div>
              <div className="w-full h-1 bg-[#111111] rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-[#00D4FF] w-[60%]"></div>
              </div>
            </div>
            
            <div className="bg-[#0A0A0A] rounded-xl p-5 border border-[#111111] flex flex-col justify-between">
              <span className="text-white/50 text-[10px] font-bold tracking-widest uppercase">Distance</span>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-black text-white">24</span>
                <span className="text-sm font-bold text-white/50">km</span>
              </div>
              <p className="text-[#39FF14] text-[10px] font-bold uppercase tracking-wider mt-3">On Track</p>
            </div>
          </section>

          {/* AI Coach */}
          <section className="bg-[#0A0A0A] rounded-xl p-5 border border-[#111111] relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-[#39FF14]/5">
              <Activity size={80} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <Zap size={16} className="text-[#00D4FF]" />
                <h2 className="text-[#00D4FF] text-xs font-bold tracking-widest uppercase">Coach Tip</h2>
              </div>
              <p className="text-white/80 text-sm leading-relaxed font-medium">
                Your heart rate recovery improved by 12% on your last ascent. Push harder on the Latrigg repeats today.
              </p>
            </div>
          </section>

        </main>

        {/* Tab Bar */}
        <nav className="absolute bottom-0 left-0 right-0 h-20 bg-black border-t border-[#111111] flex justify-around items-center px-2 pb-4 pt-2">
          <button className="flex flex-col items-center justify-center w-16 gap-1 group">
            <Home size={22} className="text-[#39FF14]" />
            <span className="text-[10px] font-bold text-[#39FF14]">Home</span>
          </button>
          <button className="flex flex-col items-center justify-center w-16 gap-1 group">
            <Calendar size={22} className="text-white/40" />
            <span className="text-[10px] font-medium text-white/40">Plan</span>
          </button>
          <button className="flex flex-col items-center justify-center w-16 gap-1 group">
            <Map size={22} className="text-white/40" />
            <span className="text-[10px] font-medium text-white/40">Trails</span>
          </button>
          <button className="flex flex-col items-center justify-center w-16 gap-1 group">
            <Trophy size={22} className="text-white/40" />
            <span className="text-[10px] font-medium text-white/40">Log</span>
          </button>
          <button className="flex flex-col items-center justify-center w-16 gap-1 group">
            <User size={22} className="text-white/40" />
            <span className="text-[10px] font-medium text-white/40">Me</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
