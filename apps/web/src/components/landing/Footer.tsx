import { SITE } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-graphite bg-background px-6 py-12">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="space-y-4">
            <p className="text-2xl font-bold tracking-tight text-foreground">{SITE.name}</p>
            <p className="text-sm text-muted-foreground">{SITE.tagline}</p>
          </div>
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-silver">Contact</p>
            <a
              href={SITE.contactHref}
              className="block text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              hello@vyron.ai
            </a>
          </div>
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-silver">Visit</p>
            <a
              href={SITE.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {SITE.url}
            </a>
          </div>
        </div>
        <div className="border-t border-graphite pt-8">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
