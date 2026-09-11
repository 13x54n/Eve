import type { SiteLinks } from "@/lib/site";

export function Contribute({ links }: { links: SiteLinks }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight">Contribute</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Fork the repository, open a feature branch, follow the development
        workflow, and send a pull request. TypeScript, ESLint, and Prettier are
        the baseline. Tests for new behavior, docs for API changes.
      </p>
      <a
        href={links.source}
        className="mt-6 inline-block text-sm font-medium underline underline-offset-2"
      >
        Open the source
      </a>
    </section>
  );
}
