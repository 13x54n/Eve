import type { SiteLinks } from "@/lib/site";

export function Hero({ links }: { links: SiteLinks }) {
  return (
    <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6 sm:py-28">
      <p className="text-sm font-medium text-success">Open source · MIT</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        Community ride matching you can host, inspect, and fork.
      </h1>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        Eve is an open-source marketplace for bike and car trips. Riders
        request, drivers send fare offers, the rider accepts a match. Payment
        stays off-platform — cash or whatever you agree. Eve records a suggested
        fare and the matched fare for audit. It does not collect ride payments
        and does not take commission.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href="#start"
          className="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"
        >
          Get started
        </a>
        <a
          href={links.source}
          className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium"
        >
          View source
        </a>
      </div>
    </section>
  );
}
