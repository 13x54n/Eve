import type { SiteLinks } from "@/lib/site";

const nav = [
  { href: "#product", label: "Product" },
  { href: "#stack", label: "Stack" },
  { href: "#start", label: "Start" },
];

export function SiteNav({ links }: { links: SiteLinks }) {
  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <a href="#top" className="text-sm font-semibold tracking-tight">
          Eve
        </a>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
          <a href={links.docs} className="hover:text-foreground">
            Docs
          </a>
        </nav>
        <a
          href={links.source}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
        >
          View source
        </a>
      </div>
    </header>
  );
}
