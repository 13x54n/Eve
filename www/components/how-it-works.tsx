const steps = [
  {
    n: "1",
    title: "Request",
    body: "A rider asks for a trip with pickup, dropoff, and vehicle type (bike or car).",
  },
  {
    n: "2",
    title: "Offers",
    body: "Nearby drivers send fare offers. Matching uses H3 geospatial cells, not a hidden black box.",
  },
  {
    n: "3",
    title: "Accept",
    body: "The rider picks a match. Eve stores the suggested fare and the agreed fare.",
  },
  {
    n: "4",
    title: "Pay off-platform",
    body: "Settlement happens in person. Eve is not a payment processor and takes no cut.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 border-t border-border bg-card">
      <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Four steps from request to match. Trip payment stays off-platform. Eve Wallet
          is for optional platform credits to a driver Privy wallet — not ride fares.
        </p>
        <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <li key={step.n} className="rounded-lg border border-border p-4">
              <span className="font-mono text-sm text-success">{step.n}</span>
              <h3 className="mt-2 font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
