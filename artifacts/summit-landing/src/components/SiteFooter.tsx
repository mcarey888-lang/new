import React from "react";
import { Link } from "react-router-dom";
import logoPath from "../assets/logo.gif";

export function SiteFooter() {
  return (
    <footer className="bg-background border-t border-white/5">
      <div className="container mx-auto px-6 py-14">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img src={logoPath} alt="SummitReady" className="h-8 w-auto opacity-80" />
              <span className="font-display font-bold text-lg tracking-tight text-white/80">SummitReady</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Train for big mountains using the hills near you. personalised plans built around your summit goal, fitness, and local terrain.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-5">Training Guides</h4>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <Link to="/training-guides/mont-blanc-training-plan" className="hover:text-primary transition-colors">Mont Blanc Training Plan</Link>
              <Link to="/training-guides/kilimanjaro-training-plan" className="hover:text-primary transition-colors">Kilimanjaro Training Plan</Link>
              <Link to="/training-guides/matterhorn-preparation-guide" className="hover:text-primary transition-colors">Matterhorn Guide</Link>
              <Link to="/training-guides" className="hover:text-primary transition-colors text-primary/70">All Training Guides →</Link>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-5">Mountains</h4>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <Link to="/mountains/mont-blanc" className="hover:text-primary transition-colors">Mont Blanc</Link>
              <Link to="/mountains/kilimanjaro" className="hover:text-primary transition-colors">Kilimanjaro</Link>
              <Link to="/mountains/matterhorn" className="hover:text-primary transition-colors">Matterhorn</Link>
              <Link to="/can-i-climb" className="hover:text-primary transition-colors text-primary/70">Can I Climb? →</Link>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-5">Company</h4>
            <div className="flex flex-col gap-3 text-sm text-muted-foreground">
              <Link to="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link>
              <Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
              <a href="mailto:hello@summitready.uk" className="hover:text-primary transition-colors">Contact</a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} SummitReady. All rights reserved.</p>
          <p className="text-xs">Train where you live. Summit anywhere.</p>
        </div>
      </div>
    </footer>
  );
}
