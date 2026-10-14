import { AUDIENCE_GROUPS } from "@/lib/site";
import { useReveal } from "./useReveal";

export function Audience() {
  const { ref, isVisible } = useReveal<HTMLElement>();

  return (
    <section
      id="audience"
      ref={ref}
      className={`px-6 py-24 transition-opacity duration-1000 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="mx-auto max-w-7xl space-y-12">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-widest text-silver">Who It's For</p>
          <h2 className="text-4xl font-bold tracking-tight text-foreground md:text-5xl">
            Built for operators, not observers
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {AUDIENCE_GROUPS.map((group) => (
            <div
              key={group.label}
              className="space-y-4 rounded-lg border border-graphite bg-card p-8 transition-colors hover:border-silver"
            >
              <p className="text-sm font-medium uppercase tracking-widest text-silver">{group.label}</p>
              <p className="text-muted-foreground">{group.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
