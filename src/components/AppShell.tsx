import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/Brand";
import { BRAND } from "@/lib/brand";

const NAV = [
  { to: "/", label: "New" },
  { to: "/projects", label: "Projects" },
  { to: "/import", label: "Import" },
  { to: "/studio", label: "Studio" },
  { to: "/open-source", label: "Open source" },
  { to: "/settings", label: "Settings" },
  { to: "/help", label: "Help" },
] as const;

export function AppShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <Link to="/" className="flex items-center">
            <BrandLogo />
          </Link>
          <nav className="flex flex-wrap items-center gap-1 text-xs">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                className="rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground data-[status=active]:bg-card data-[status=active]:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
        <div className="mt-8">{children}</div>
        <footer className="mt-16 pt-5 pb-2 text-center text-[10px] tracking-wide text-muted-foreground/50">
          <a
            href={BRAND.authorUrl}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-muted-foreground"
          >
            Crafted by {BRAND.author}
          </a>
        </footer>
      </main>
    </div>
  );
}
