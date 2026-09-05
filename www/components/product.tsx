const surfaces = [
  {
    name: "Rider",
    stack: "Expo 57",
    body: "Request a trip, review offers, track the match, and read history.",
  },
  {
    name: "Driver",
    stack: "Expo 57",
    body: "Onboard, go online, send offers, run the trip, see matched fares, and cash out Eve Wallet credits to Privy.",
  },
  {
    name: "Admin",
    stack: "Next.js 16 · :3000",
    body: "Optional operations console: riders, drivers, trips, vehicles, pricing, safety, support.",
  },
  {
    name: "Backend",
    stack: "Node services",
    body: "Auth, location, ride, notify, and admin APIs. Postgres 16, Redis 7, gRPC between services.",
  },
];

export function Product() {
  return (
    <section id="product" className="scroll-mt-16 border-t border-border bg-card">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Product surface</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Native apps for riders and drivers. Web consoles are optional. Clients
          talk to services directly — there is no HTTP gateway.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {surfaces.map((item) => (
            <li
              key={item.name}
              className="rounded-lg border border-border p-4"
            >
              <h3 className="font-medium">{item.name}</h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {item.stack}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
