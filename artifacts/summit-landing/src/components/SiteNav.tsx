import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import logoPath from "../assets/logo.gif";

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const isHome = pathname === "/" || pathname === "";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo(0, 0);
  }, [pathname]);

  const ctaHref = isHome ? "#get-started" : "/#get-started";

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled || !isHome || mobileOpen
        ? "bg-background/90 backdrop-blur-xl border-b border-white/5 py-4"
        : "bg-transparent py-6"
    }`}>
      <div className="container mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 shrink-0">
          <img src={logoPath} alt="SummitReady" className="h-10 w-auto" />
          <span className="font-display font-bold text-xl tracking-tight">SummitReady</span>
        </Link>

        <div className="hidden lg:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          {isHome && (
            <>
              <a href="#problem" className="hover:text-primary transition-colors min-h-[44px] inline-flex items-center">The Reality</a>
              <a href="#features" className="hover:text-primary transition-colors min-h-[44px] inline-flex items-center">Features</a>
              <a href="#how-it-works" className="hover:text-primary transition-colors min-h-[44px] inline-flex items-center">How it Works</a>
              <span className="text-white/15 select-none">|</span>
            </>
          )}
          <Link to="/training-guides" className={`px-3 py-1.5 rounded-full border transition-all min-h-[44px] inline-flex items-center text-sm font-semibold ${pathname.startsWith("/training-guides") ? "border-primary/50 text-primary bg-primary/10" : "border-white/15 text-white hover:border-primary/40 hover:text-primary hover:bg-white/5"}`}>Training Guides</Link>
          <Link to="/can-i-climb" className={`px-3 py-1.5 rounded-full border transition-all min-h-[44px] inline-flex items-center text-sm font-semibold ${pathname.startsWith("/can-i-climb") ? "border-primary/50 text-primary bg-primary/10" : "border-white/15 text-white hover:border-primary/40 hover:text-primary hover:bg-white/5"}`}>Can I Climb?</Link>
          <Link to="/mountains" className={`px-3 py-1.5 rounded-full border transition-all min-h-[44px] inline-flex items-center text-sm font-semibold ${pathname.startsWith("/mountains") ? "border-primary/50 text-primary bg-primary/10" : "border-white/15 text-white hover:border-primary/40 hover:text-primary hover:bg-white/5"}`}>Mountains</Link>
        </div>

        <div className="flex items-center gap-3">
          <a href={ctaHref} className="hidden sm:block">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold rounded-full px-6 transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(62,207,117,0.3)]">
              Get Started
            </Button>
          </a>
          <button
            className="lg:hidden p-2 text-muted-foreground hover:text-white transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl">
          <div className="container mx-auto px-6 py-5 flex flex-col gap-0.5">
            {isHome && (
              <>
                <a href="#problem" className="py-3 text-muted-foreground hover:text-primary transition-colors font-medium border-b border-white/5">The Reality</a>
                <a href="#features" className="py-3 text-muted-foreground hover:text-primary transition-colors font-medium border-b border-white/5">Features</a>
                <a href="#how-it-works" className="py-3 text-muted-foreground hover:text-primary transition-colors font-medium border-b border-white/5">How it Works</a>
              </>
            )}
            <Link to="/training-guides" className="py-3 text-muted-foreground hover:text-primary transition-colors font-medium border-b border-white/5">Training Guides</Link>
            <Link to="/can-i-climb" className="py-3 text-muted-foreground hover:text-primary transition-colors font-medium border-b border-white/5">Can I Climb?</Link>
            <Link to="/mountains" className="py-3 text-muted-foreground hover:text-primary transition-colors font-medium border-b border-white/5">Mountains</Link>
            <div className="pt-4">
              <a href={ctaHref} className="block">
                <Button className="w-full bg-primary text-primary-foreground font-semibold rounded-full">
                  Get Started
                </Button>
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
