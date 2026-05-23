import React from 'react';
import { 
  Home, 
  Map, 
  MapPin, 
  PlusCircle, 
  User, 
  ChevronRight, 
  Bell, 
  TrendingUp, 
  Clock, 
  Mountain,
  Flame,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function SummitRefined() {
  return (
    <div className="min-h-screen bg-[#060D1B] flex items-center justify-center p-4 font-sans sm:bg-black/90 text-[#F0F8FF]">
      {/* Mobile Device Frame */}
      <div className="w-full max-w-[390px] h-[844px] bg-gradient-to-b from-[#0A1525] to-[#060D1B] rounded-[40px] shadow-2xl overflow-hidden relative border border-[#1A2C45] flex flex-col">
        
        {/* Status Bar Spacer */}
        <div className="h-12 w-full flex justify-between items-end px-6 pb-2 text-xs font-medium text-white/80">
          <span>9:41</span>
          <div className="flex gap-1.5 items-center">
            <div className="w-4 h-3 rounded-sm border border-white/80" />
            <div className="w-3 h-3 rounded-full bg-white/80" />
            <div className="w-5 h-3 rounded-sm bg-white/80" />
          </div>
        </div>

        {/* Header */}
        <header className="px-6 py-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#3ECF75] to-[#2B9A55] flex items-center justify-center shadow-[0_0_15px_rgba(62,207,117,0.3)]">
              <Mountain className="w-5 h-5 text-[#060D1B]" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-lg tracking-tight">SummitReady</span>
          </div>
          <button className="w-10 h-10 rounded-full bg-[#142236]/80 backdrop-blur-md border border-white/5 flex items-center justify-center relative">
            <Bell className="w-5 h-5 text-[#7A9BB5]" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#FF9030] shadow-[0_0_8px_rgba(255,144,48,0.8)]" />
          </button>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto pb-24 no-scrollbar">
          
          {/* Hero Section */}
          <div className="relative px-6 pt-2 pb-6">
            {/* Background Mountain Gradient Silhouette */}
            <div className="absolute inset-0 top-[-60px] z-0 overflow-hidden pointer-events-none">
              <div className="absolute bottom-0 w-full h-[200px] bg-gradient-to-t from-[#0A1525] to-transparent z-10" />
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute bottom-0 w-full h-full opacity-40">
                <path d="M0,100 L0,60 L20,40 L40,70 L70,20 L100,60 L100,100 Z" fill="url(#mountain-grad)" />
                <path d="M0,100 L0,70 L30,45 L50,80 L80,30 L100,65 L100,100 Z" fill="url(#mountain-grad-2)" className="opacity-60" />
                <defs>
                  <linearGradient id="mountain-grad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#3ECF75" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#0A1525" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="mountain-grad-2" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4A9FF5" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#0A1525" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="relative z-10 flex justify-between items-end">
              <div>
                <div className="text-[#3ECF75] font-semibold text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Flame className="w-3 h-3" /> Training for
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight mb-1" style={{ textShadow: '0 0 30px rgba(240,248,255,0.1)' }}>Ben Nevis</h1>
                <p className="text-[#7A9BB5] text-sm font-medium">23 July 2025 • 1,345m</p>
              </div>

              {/* Progress Ring */}
              <div className="relative w-20 h-20">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="16" fill="none" className="stroke-[#1A2C45]" strokeWidth="3" />
                  <circle 
                    cx="18" cy="18" r="16" 
                    fill="none" 
                    className="stroke-[#3ECF75]" 
                    strokeWidth="3" 
                    strokeDasharray="100" 
                    strokeDashoffset="28" 
                    strokeLinecap="round" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-white">72%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 space-y-5">
            
            {/* Today's Session Card */}
            <div className="relative overflow-hidden rounded-[24px] bg-[#0F1D30]/80 border border-white/10 backdrop-blur-xl group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#103A24] via-[#0F1D30] to-[#0A1525] opacity-50 mix-blend-overlay" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#3ECF75]/10 rounded-full blur-3xl" />
              
              <div className="relative p-5">
                <div className="flex justify-between items-start mb-6">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/5 text-xs font-medium text-white/90">
                    <Clock className="w-3 h-3 text-[#3ECF75]" /> Today's Session
                  </div>
                  <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/5">
                    <ChevronRight className="w-4 h-4 text-white" />
                  </button>
                </div>
                
                <h3 className="text-2xl font-bold mb-1">Hill Repeat</h3>
                <p className="text-[#7A9BB5] font-medium mb-5">Latrigg • 5km • 400m ascent</p>
                
                <div className="flex gap-3">
                  <button className="flex-1 bg-[#3ECF75] hover:bg-[#34B866] text-[#060D1B] font-bold py-3.5 rounded-xl shadow-[0_4px_20px_rgba(62,207,117,0.3)] transition-colors">
                    Start Workout
                  </button>
                </div>
              </div>
            </div>

            {/* Weekly Progress */}
            <div className="bg-[#0F1D30]/60 border border-white/5 rounded-[24px] p-5 backdrop-blur-sm">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold text-lg">Weekly Progress</h4>
                <span className="text-[#3ECF75] font-bold">3/5 done</span>
              </div>
              
              <div className="flex gap-2 mb-5">
                {[1, 2, 3, 4, 5].map((day) => (
                  <div key={day} className="flex-1 h-2 rounded-full overflow-hidden bg-[#1A2C45]">
                    {day <= 3 && (
                      <div className="h-full bg-gradient-to-r from-[#3ECF75] to-[#4A9FF5]" />
                    )}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#142236] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 text-[#7A9BB5] mb-1">
                    <TrendingUp className="w-4 h-4" /> Distance
                  </div>
                  <div className="text-xl font-bold">24.2 <span className="text-sm font-medium text-[#7A9BB5]">km</span></div>
                </div>
                <div className="bg-[#142236] rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-2 text-[#7A9BB5] mb-1">
                    <Mountain className="w-4 h-4" /> Elevation
                  </div>
                  <div className="text-xl font-bold">1,840 <span className="text-sm font-medium text-[#7A9BB5]">m</span></div>
                </div>
              </div>
            </div>

            {/* AI Coach Tip */}
            <div className="relative overflow-hidden bg-[#9B7FD4]/10 border border-[#9B7FD4]/20 rounded-[24px] p-5">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#9B7FD4]/20 rounded-full blur-2xl pointer-events-none" />
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#9B7FD4] to-[#7B5CC4] flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(155,127,212,0.3)]">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="font-semibold text-white mb-1">Coach Tip</h4>
                  <p className="text-sm text-[#F0F8FF]/80 leading-relaxed">
                    You've been pushing hard on ascents. Focus on maintaining a steady Zone 2 heart rate during today's Latrigg repeats.
                  </p>
                </div>
              </div>
            </div>
            
          </div>
        </main>

        {/* Bottom Tab Bar */}
        <div className="absolute bottom-0 w-full px-6 pb-8 pt-4 bg-gradient-to-t from-[#060D1B] via-[#060D1B]/95 to-transparent backdrop-blur-xl border-t border-white/5">
          <div className="flex justify-between items-center">
            
            <button className="flex flex-col items-center gap-1 text-[#3ECF75]">
              <div className="w-12 h-8 rounded-full bg-[#3ECF75]/15 flex items-center justify-center">
                <Home className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-semibold">Home</span>
            </button>
            
            <button className="flex flex-col items-center gap-1 text-[#7A9BB5] hover:text-white transition-colors">
              <div className="w-12 h-8 rounded-full flex items-center justify-center">
                <Map className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium">Plan</span>
            </button>
            
            <button className="flex flex-col items-center justify-center relative -top-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#3ECF75] to-[#2B9A55] shadow-[0_8px_25px_rgba(62,207,117,0.4)] flex items-center justify-center text-[#060D1B]">
                <PlusCircle className="w-7 h-7" strokeWidth={2} />
              </div>
            </button>
            
            <button className="flex flex-col items-center gap-1 text-[#7A9BB5] hover:text-white transition-colors">
              <div className="w-12 h-8 rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium">Trails</span>
            </button>
            
            <button className="flex flex-col items-center gap-1 text-[#7A9BB5] hover:text-white transition-colors">
              <div className="w-12 h-8 rounded-full flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-medium">Me</span>
            </button>
            
          </div>
        </div>

      </div>
    </div>
  );
}
