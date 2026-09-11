import type { SiteLinks } from "@/lib/site";

export function SiteFooter({ links }: { links: SiteLinks }) {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-10 text-sm text-muted-foreground sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          <p className="font-medium text-foreground">Eve</p>
          <p className="mt-1 max-w-sm">
            Open-source ride matching. Not a taxi company. Ride payments are not
            collected on the platform.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <a href={links.docs} className="hover:text-foreground">
            Getting started
          </a>
          <a href={links.source} className="hover:text-foreground">
            Source
          </a>
          <span>MIT License</span>
        </div>
      </div>
    </footer>
  );
}
