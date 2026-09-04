const items = [
  "Node.js 22",
  "PostgreSQL 16",
  "Redis 7",
  "Expo 57",
  "Next.js 16",
  "Auth0",
  "Mapbox",
  "Uber H3",
  "Socket.IO",
  "Prisma",
  "TypeScript",
  "Docker",
];

export function Stack() {
  return (
    <section id="stack" className="mx-auto max-w-5xl scroll-mt-16 px-4 py-16 sm:px-6">
      <h2 className="text-2xl font-semibold tracking-tight">Stack</h2>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        The same versions documented in the repo. Auth0 is required for the
        mobile apps; backend can be exercised without it at first.
      </p>
      <ul className="mt-8 flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-full border border-border bg-card px-3 py-1.5 text-sm"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
