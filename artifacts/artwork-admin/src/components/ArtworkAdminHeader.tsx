import type { ReactNode } from "react";
import { ImageIcon } from "lucide-react";
import { Link } from "wouter";

type ArtworkAdminSection =
  | "signatures"
  | "mountains"
  | "ui-assets"
  | "assets";

interface ArtworkAdminHeaderProps {
  activeSection: ArtworkAdminSection;
  actions?: ReactNode;
}

const NAV_LINKS: Array<{
  section: ArtworkAdminSection;
  href: string;
  label: string;
  devOnly?: boolean;
}> = [
  { section: "signatures", href: "/", label: "Signatures" },
  { section: "mountains", href: "/mountains", label: "Mountain Heroes" },
  { section: "ui-assets", href: "/ui-assets", label: "UI Asset System" },
  { section: "assets", href: "/assets", label: "Assets (DEV)", devOnly: true },
];

export function ArtworkAdminHeader({
  activeSection,
  actions,
}: ArtworkAdminHeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-card px-4 py-4 sm:px-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
          <h1 className="flex shrink-0 items-center gap-2 text-xl font-semibold tracking-tight text-white">
            <ImageIcon className="h-5 w-5 text-primary" aria-hidden="true" />
            SummitReady{" "}
            <span className="font-normal text-muted-foreground">
              Artwork Admin
            </span>
          </h1>

          <nav
            className="flex max-w-full items-center gap-1 overflow-x-auto rounded-md bg-secondary/50 p-1"
            aria-label="Artwork Admin"
          >
            {NAV_LINKS.map((item) => {
              if (item.devOnly && !import.meta.env.DEV) return null;
              const isActive = item.section === activeSection;

              return (
                <Link
                  key={item.section}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`shrink-0 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                  data-testid={`link-nav-${item.section}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {actions ? (
          <div className="flex shrink-0 items-center gap-4">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}