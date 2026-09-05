import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import logoPath from "../assets/logo.gif";

/** Editorial nav link — plain type, hairline underline on active/hover. */
function NavLink({
  to, href, active, children,
}: {
  to?: string; href?: string; active?: boolean; children: React.ReactNode;
}) {
  const cls = [
    "relative inline-flex items-center min-h-[44px] text-[0.9375rem] font-medium transition-colors duration-200",
    "after:absolute after:left-0 after:right-0 after:bottom-[10px] after:h-px after:origin-left after:transition-transform after:duration-300",
    active
      ? "text-foreground after:bg-primary after:scale-x-100"
      : "text-muted-foreground hover:text-foreground after:bg-foreground/40 after:scale-x-0 hover:after:scale-x-100",
  ].join(" ");

  if (to) return <Link to={to} className={cls}>{children}</Link>;
  return <a href={href} className={cls}>{children}</a>;
}

export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();
  const isHome = pathname === "/" || pathname === "";
  const { theme, toggle } = useTheme();

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
  const solid = scrolled || !isHome || mobileOpen;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-[background-color,border-color,padding] duration-300 ${
        solid
          ? "bg-background/92 backdrop-blur-xl border-b sr-hairline py-4"
          : "bg-transparent border-b border-transparent py-6"
      }`}
    >
      <div className="sr-shell flex items-center justify-between gap-8">
        {/* Wordmark */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <img src={logoPath} alt="" aria-hidden="true" className="h-8 w-auto" />
          <span className="font-display font-semibold text-[1.0625rem] tracking-[-0.01em] text-foreground">
            SummitReady
          </span>
        </Link>

        {/* Primary navigation */}
        <div className="hidden lg:flex items-center gap-9">
          {isHome && (
            <>
              <NavLink href="#problem">The Reality</NavLink>
              <NavLink href="#features">Features</NavLink>
              <NavLink href="#how-it-works">How it Works</NavLink>
            </>
          )}
          <NavLink to="/training-guides" active={pathname.startsWith("/training-guides")}>
            Training Guides
          </NavLink>
          <NavLink to="/can-i-climb" active={pathname.startsWith("/can-i-climb")}>
            Am I Ready?
          </NavLink>
          <NavLink to="/mountains" active={pathname.startsWith("/mountains")}>
            Mountains
          </NavLink>
          <NavLink to="/readiness-check" active={pathname.startsWith("/readiness-check")}>
            Readiness Check
          </NavLink>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={toggle}
            aria-label="Toggle light/dark mode"
            className="h-10 w-10 inline-flex items-center justify-center rounded-md border sr-hairline text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <a
            href={ctaHref}
            className="hidden sm:inline-flex items-center justify-center h-12 px-6 rounded-lg bg-primary text-primary-foreground text-[0.9375rem] font-semibold tracking-[-0.005em] transition-colors duration-200 hover:bg-[hsl(var(--accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Get Started
          </a>

          <button
            className="lg:hidden h-10 w-10 inline-flex items-center justify-center rounded-md border sr-hairline text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t sr-hairline bg-background/97 backdrop-blur-xl">
          <div className="sr-shell py-4 flex flex-col">
            {isHome && (
              <>
                <a href="#problem" className="py-3.5 text-muted-foreground hover:text-foreground transition-colors font-medium border-b sr-hairline">The Reality</a>
                <a href="#features" className="py-3.5 text-muted-foreground hover:text-foreground transition-colors font-medium border-b sr-hairline">Features</a>
                <a href="#how-it-works" className="py-3.5 text-muted-foreground hover:text-foreground transition-colors font-medium border-b sr-hairline">How it Works</a>
              </>
            )}
            <Link to="/training-guides" className="py-3.5 text-muted-foreground hover:text-foreground transition-colors font-medium border-b sr-hairline">Training Guides</Link>
            <Link to="/can-i-climb" className="py-3.5 text-muted-foreground hover:text-foreground transition-colors font-medium border-b sr-hairline">Am I Ready?</Link>
            <Link to="/mountains" className="py-3.5 text-muted-foreground hover:text-foreground transition-colors font-medium border-b sr-hairline">Mountains</Link>
            <Link to="/readiness-check" className="py-3.5 text-foreground font-semibold border-b sr-hairline">Readiness Check</Link>
            <a
              href={ctaHref}
              className="mt-5 inline-flex items-center justify-center h-12 px-6 rounded-lg bg-primary text-primary-foreground font-semibold"
            >
              Get Started
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
