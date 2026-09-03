const points = [
  {
    title: "Self-host",
    body: "Run the stack on your own Postgres, Redis, and Auth0 tenant. Alpha path is local Docker plus Node 22.",
  },
  {
    title: "No commission",
    body: "The platform never collects ride payments. Communities keep the full matched fare.",
  },
  {
    title: "Inspect matching",
    body: "H3 indexing, offer flow, and fare audit live in the repo. Change the rules instead of hoping a vendor will.",
  },
  {
    title: "Fork for a city",
    body: "Start from rider and driver apps, staff console, and microservices — then adapt markets, zones, and copy.",
  },
];

export function WhyOpenSource() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight">Why open source</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Ride matching is infrastructure. It should be readable, forkable, and
        owned by the operators who run it.
      </p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {points.map((point) => (
          <article
            key={point.title}
            className="rounded-lg border border-border bg-card p-5"
          >
            <h3 className="font-medium">{point.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {point.body}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
