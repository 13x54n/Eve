import type { SiteLinks } from "@/lib/site";

export function GetStarted({ links }: { links: SiteLinks }) {
  return (
    <section id="start" className="scroll-mt-16 border-t border-border bg-card">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Get started</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Alpha path: PostgreSQL and Redis, then the backend, then rider and
          driver. Admin, monitor, and this site are optional. You will want Node
          22, npm 10, Docker, and about an hour.
        </p>
        <pre className="mt-8 overflow-x-auto rounded-lg border border-border bg-primary p-4 font-mono text-sm text-primary-foreground">
          <code>{`git clone ${links.github ?? "<repository-url>"}
cd Eve
# then follow GETTING_STARTED.md
# Postgres/Redis → backend (npm run dev) → rider/driver`}</code>
        </pre>
        <p className="mt-4 text-sm text-muted-foreground">
          Full walkthrough:{" "}
          <a href={links.docs} className="underline underline-offset-2">
            GETTING_STARTED.md
          </a>
          . This landing page runs with{" "}
          <code className="font-mono text-foreground">cd www && npm run dev</code>{" "}
          on port 3020.
        </p>
      </div>
    </section>
  );
}
