import React from "react";
import { SiteNav } from "./SiteNav";
import { SiteFooter } from "./SiteFooter";

interface Props {
  children: React.ReactNode;
}

export function SiteLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30">
      <SiteNav />
      <main className="pt-20">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
