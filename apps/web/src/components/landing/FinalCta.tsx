import { SITE, COPY } from "@/lib/site";
import { useReveal } from "./useReveal";

export function FinalCta() {
  const { ref, isVisible } = useReveal<HTMLElement>();

  return (
    <section
      id="final-cta"
      ref={ref}
      className={`px-6 py-24 transition-opacity duration-1000 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      style={{
        backgroundImage: `radial-gradient(circle at 50% 50%, rgba(227,38,54,.15), transparent 70%)`,
      }}
    >
      <div className="mx-auto max-w-4xl space-y-8 text-center">
        <h2 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
          {COPY.finalCtaTitle}
        </h2>
        <p className="text-xl text-muted-foreground">{SITE.tagline}</p>
        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <a
            href={SITE.contactHref}
            className="inline-block rounded-lg bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            {COPY.finalCtaPrimaryButton}
          </a>
          <a
            href="#platform"
            className="inline-block rounded-lg border border-graphite px-8 py-4 text-lg font-semibold text-foreground transition-colors hover:border-silver"
          >
            {COPY.finalCtaSecondaryButton}
          </a>
        </div>
      </div>
    </section>
  );
}
