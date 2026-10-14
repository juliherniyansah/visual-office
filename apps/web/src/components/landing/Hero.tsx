'use client';

import { SITE } from "@/lib/site";
import { useReveal } from "./useReveal";
import { HqIllustration } from "./HqIllustration";

export function Hero() {
  const { ref, isVisible } = useReveal<HTMLElement>();

  return (
    <section
      id="hero"
      ref={ref}
      className={`relative min-h-[100svh] flex items-center px-6 py-24 overflow-hidden transition-opacity duration-1000 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      style={{
        backgroundImage: `radial-gradient(circle at 70% 40%, rgba(227,38,54,.18), transparent 60%),
          linear-gradient(var(--graphite) 1px, transparent 1px),
          linear-gradient(90deg, var(--graphite) 1px, transparent 1px)`,
        backgroundSize: "100% 100%, 64px 64px, 64px 64px",
      }}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
        <div className="space-y-6">
          <p className="text-sm font-medium uppercase tracking-widest text-silver">
            AI Company OS · Early access
          </p>
          <h1 className="text-5xl font-bold tracking-tight text-foreground md:text-7xl">
            {SITE.tagline}
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground md:text-xl">
            {SITE.description}
          </p>
          <div className="flex flex-wrap gap-4 pt-4">
            <a
              href="#platform"
              className="inline-block rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Explore VYRON
            </a>
            <a
              href="#office"
              className="inline-block rounded-lg border border-graphite px-8 py-4 text-lg font-semibold text-foreground transition-colors hover:border-silver"
            >
              Discover the Virtual Office
            </a>
          </div>
        </div>
        <div className="w-full">
          <HqIllustration className="w-full" titleId="hq-title-hero" />
        </div>
      </div>
    </section>
  );
}
