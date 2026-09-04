import { Contribute } from "@/components/contribute";
import { GetStarted } from "@/components/get-started";
import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Product } from "@/components/product";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { Stack } from "@/components/stack";
import { WhyOpenSource } from "@/components/why-open-source";
import { siteLinks } from "@/lib/site";

export default function HomePage() {
  const links = siteLinks();

  return (
    <div id="top" className="flex min-h-full flex-col">
      <SiteNav links={links} />
      <main className="flex-1">
        <Hero links={links} />
        <HowItWorks />
        <WhyOpenSource />
        <Product />
        <Stack />
        <GetStarted links={links} />
        <Contribute links={links} />
      </main>
      <SiteFooter links={links} />
    </div>
  );
}
