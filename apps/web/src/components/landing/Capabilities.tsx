'use client';

import { CAPABILITIES, COPY } from '@/lib/site';
import { useReveal } from './useReveal';

export function Capabilities() {
  const { ref, isVisible } = useReveal<HTMLElement>(0.2);

  const currentCapabilities = CAPABILITIES.filter((cap) => cap.status === 'current');
  const visionCapabilities = CAPABILITIES.filter((cap) => cap.status === 'vision');

  return (
    <section
      ref={ref}
      className="px-6 py-24 md:px-12 lg:px-24"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 600ms ease-out, transform 600ms ease-out',
      }}
    >
      <div className="mx-auto max-w-6xl">
        <div className="mb-16 max-w-3xl">
          <h2
            className="mb-6 text-4xl font-light tracking-tight md:text-5xl"
            style={{ color: 'var(--color-foreground)' }}
          >
            Capabilities
          </h2>
          <p
            className="text-lg leading-relaxed"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            What we build today, and what we are working toward.
          </p>
        </div>

        <div className="mb-12">
          <h3
            className="mb-6 text-sm font-medium uppercase tracking-wider"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            Current
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {currentCapabilities.map((cap, index) => (
              <div
                key={cap.title}
                className="rounded-lg border p-6"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-card)',
                  opacity: isVisible ? 1 : 0,
                  transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
                  transition: `opacity 500ms ease-out ${index * 100}ms, transform 500ms ease-out ${index * 100}ms`,
                }}
              >
                <h4
                  className="mb-3 text-lg font-medium tracking-tight"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  {cap.title}
                </h4>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  {cap.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3
            className="mb-6 text-sm font-medium uppercase tracking-wider"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {COPY.visionHeading}
          </h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {visionCapabilities.map((cap, index) => (
              <div
                key={cap.title}
                className="rounded-lg border border-dashed p-6"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-card)',
                  opacity: isVisible ? 0.7 : 0,
                  transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
                  transition: `opacity 500ms ease-out ${(currentCapabilities.length + index) * 100}ms, transform 500ms ease-out ${(currentCapabilities.length + index) * 100}ms`,
                }}
              >
                <h4
                  className="mb-3 text-lg font-medium tracking-tight"
                  style={{ color: 'var(--color-foreground)' }}
                >
                  {cap.title}
                </h4>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  {cap.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
