import React from 'react';
import { Home, Calendar, Map, Activity, User, Bell, ChevronRight, Mountain, Footprints, Wind, Sun, ArrowRight, Zap, Target } from 'lucide-react';

export default function AlpineLight() {
  return (
    <div className="flex justify-center items-center min-h-screen bg-neutral-200 font-sans p-4 sm:p-8">
      {/* Mobile Device Container */}
      <div className="w-[390px] h-[844px] bg-[#F5F0E8] overflow-hidden relative shadow-2xl rounded-[40px] border-[12px] border-gray-900 ring-4 ring-gray-300 text-gray-800 flex flex-col">
        
        {/* Status Bar Mock */}
        <div className="h-12 w-full flex items-center justify-between px-6 pt-2 z-20 relative">
          <span className="text-[14px] font-semibold text-gray-900">9:41</span>
          <div className="flex gap-1.5 items-center">
            <div className="w-4 h-3 bg-gray-900 rounded-sm"></div>
            <div className="w-4 h-3 bg-gray-900 rounded-sm"></div>
            <div className="w-5 h-3 bg-gray-900 rounded-sm"></div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
          
          {/* Header */}
          <div className="px-6 pt-4 pb-2 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#1A5C3A] flex items-center justify-center text-white font-bold text-sm">
                JD
              </div>
              <span className="font-medium text-gray-600 text-sm">Hi, Julian</span>
            </div>
            <button className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-600 relative">
              <Bell size={20} />
              <div className="absolute top-2 right-2.5 w-2 h-2 bg-[#C17E2B] rounded-full border border-white"></div>
            </button>
          </div>

          {/* Mountain Hero */}
          <div className="px-5 mt-4">
            <div className="rounded-3xl overflow-hidden relative h-48 shadow-md">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1A5C3A] to-[#128a8a]"></div>
              
              {/* Decorative Mountain Shapes */}
              <svg className="absolute bottom-0 w-full h-24 text-white/10" viewBox="0 0 100 100" preserveAspectRatio="none">
                <polygon fill="currentColor" points="0,100 30,30 60,100" />
                <polygon fill="currentColor" points="40,100 70,50 100,100" />
              </svg>
              
              <div className="absolute inset-0 p-5 flex flex-col justify-between">
                <div>
                  <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-medium uppercase tracking-wider mb-2">
                    <Target size={12} /> Goal
                  </div>
                  <h2 className="text-3xl text-white leading-tight font-['Georgia']">Ben Nevis</h2>
                  <p className="text-white/80 text-sm mt-1 flex items-center gap-1.5">
                    <Calendar size={14} /> 23 July 2025
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Readiness Score */}
          <div className="px-5 mt-6">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center gap-5">
              <div className="relative w-20 h-20 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="#f0f0f0" strokeWidth="8" fill="none" />
                  <circle cx="50" cy="50" r="40" stroke="#1A5C3A" strokeWidth="8" fill="none" strokeDasharray="251" strokeDashoffset="70" strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold text-[#1A5C3A]">72%</span>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 font-['Georgia']">Almost Ready</h3>
                <p className="text-sm text-gray-500 leading-snug mt-1">Your cardiovascular base is strong. Focus on elevation gain this week.</p>
              </div>
            </div>
          </div>

          {/* Today's Session */}
          <div className="px-5 mt-6">
            <div className="flex justify-between items-end mb-3">
              <h3 className="text-xl font-bold text-gray-900 font-['Georgia']">Today's Session</h3>
              <button className="text-[#C17E2B] text-sm font-semibold">View Plan</button>
            </div>
            
            <div className="bg-[#1A5C3A] rounded-3xl p-5 shadow-md relative overflow-hidden text-white">
              <div className="absolute right-0 top-0 opacity-10 transform translate-x-4 -translate-y-4">
                <Mountain size={120} />
              </div>
              
              <div className="inline-flex items-center gap-1.5 bg-[#C17E2B] px-3 py-1 rounded-full text-white text-xs font-bold uppercase tracking-wider mb-3">
                <Zap size={12} /> High Intensity
              </div>
              
              <h4 className="text-2xl font-bold font-['Georgia'] mb-1">Latrigg Hill Repeats</h4>
              <p className="text-[#e2ece7] text-sm mb-5">5km • 400m elevation • Est. 1h 15m</p>
              
              <div className="flex gap-2">
                <button className="bg-white text-[#1A5C3A] px-5 py-2.5 rounded-xl font-bold flex-1 flex items-center justify-center gap-2">
                  <Activity size={18} /> Start
                </button>
                <button className="bg-[#1A5C3A] border border-white/30 text-white px-4 py-2.5 rounded-xl flex items-center justify-center">
                  <Map size={18} />
                </button>
              </div>
            </div>
          </div>

          {/* Weekly Progress */}
          <div className="px-5 mt-6">
            <h3 className="text-xl font-bold text-gray-900 font-['Georgia'] mb-3">This Week</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="w-8 h-8 rounded-full bg-[#F5F0E8] flex items-center justify-center text-[#C17E2B] mb-2">
                  <Footprints size={16} />
                </div>
                <div className="text-2xl font-bold text-gray-900">24km</div>
                <div className="text-xs text-gray-500 font-medium">Distance</div>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="w-8 h-8 rounded-full bg-[#F5F0E8] flex items-center justify-center text-[#1A5C3A] mb-2">
                  <Mountain size={16} />
                </div>
                <div className="text-2xl font-bold text-gray-900">3/5</div>
                <div className="text-xs text-gray-500 font-medium">Sessions Done</div>
              </div>
            </div>
          </div>

          {/* AI Coach */}
          <div className="px-5 mt-6 mb-8">
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-[#e5dfd5] relative">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-[#F5F0E8] flex items-center justify-center text-[#C17E2B] flex-shrink-0">
                  <Wind size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm mb-1">Coach Tip</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Weather looks wet for tomorrow's long hike. Consider swapping with Sunday's rest day to stay dry and avoid slipping.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
        </div>

        {/* Bottom Tab Bar */}
        <div className="absolute bottom-0 w-full h-24 bg-white border-t border-gray-100 rounded-b-[28px] px-6 flex justify-between items-center pb-6 pt-2 z-20">
          <button className="flex flex-col items-center gap-1 w-12 text-[#1A5C3A]">
            <Home size={24} strokeWidth={2.5} />
            <span className="text-[10px] font-bold">Home</span>
          </button>
          <button className="flex flex-col items-center gap-1 w-12 text-gray-400 hover:text-gray-600 transition-colors">
            <Calendar size={24} strokeWidth={2} />
            <span className="text-[10px] font-semibold">Plan</span>
          </button>
          <button className="flex flex-col items-center gap-1 w-12 text-gray-400 hover:text-gray-600 transition-colors">
            <Map size={24} strokeWidth={2} />
            <span className="text-[10px] font-semibold">Trails</span>
          </button>
          <button className="flex flex-col items-center gap-1 w-12 text-gray-400 hover:text-gray-600 transition-colors">
            <Activity size={24} strokeWidth={2} />
            <span className="text-[10px] font-semibold">Log</span>
          </button>
          <button className="flex flex-col items-center gap-1 w-12 text-gray-400 hover:text-gray-600 transition-colors">
            <User size={24} strokeWidth={2} />
            <span className="text-[10px] font-semibold">Me</span>
          </button>
        </div>

        {/* Home Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1.5 bg-gray-900 rounded-full z-30"></div>
      </div>
    </div>
  );
}
