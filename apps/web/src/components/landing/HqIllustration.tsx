export function HqIllustration({ className, titleId }: { className?: string; titleId: string }) {
  return (
    <figure className={className}>
      <svg viewBox="0 0 800 600" width="800" height="600" role="img" aria-labelledby={titleId}>
        <title id={titleId}>Concept preview of the VYRON four-floor digital headquarters</title>
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>
        {/* F1 Lobby / AI Core */}
        <rect x="100" y="450" width="600" height="100" fill="var(--color-obsidian)" stroke="var(--color-graphite)" strokeWidth="2" />
        <text x="400" y="505" textAnchor="middle" fill="var(--color-silver)" fontSize="14">F1 Lobby / AI Core</text>
        <circle cx="400" cy="500" r="30" fill="var(--color-red)" opacity="0.3" filter="url(#glow)" />
        {/* F2 Domain Agents */}
        <rect x="150" y="350" width="500" height="100" fill="var(--color-obsidian)" stroke="var(--color-graphite)" strokeWidth="2" />
        <text x="400" y="405" textAnchor="middle" fill="var(--color-silver)" fontSize="14">F2 Domain Agents</text>
        {/* F3 COO / CTO */}
        <rect x="200" y="250" width="400" height="100" fill="var(--color-obsidian)" stroke="var(--color-graphite)" strokeWidth="2" />
        <text x="400" y="305" textAnchor="middle" fill="var(--color-silver)" fontSize="14">F3 COO / CTO</text>
        {/* F4 CEO Office */}
        <rect x="250" y="150" width="300" height="100" fill="var(--color-obsidian)" stroke="var(--color-graphite)" strokeWidth="2" />
        <text x="400" y="205" textAnchor="middle" fill="var(--color-silver)" fontSize="14">F4 CEO Office</text>
      </svg>
      <figcaption className="text-sm text-silver/70 mt-2 text-center">
        Concept preview — illustrative layout, not a live simulation.
      </figcaption>
    </figure>
  );
}
