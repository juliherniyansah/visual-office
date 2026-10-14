'use client';

import { AI_CORE_NODES, COPY } from '@/lib/site';
import { useReveal } from './useReveal';

export function AiCore() {
  const { ref, isVisible } = useReveal<HTMLElement>(0.2);

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
            {COPY.aiCoreIntro.title}
          </h2>
          <p
            className="text-lg leading-relaxed"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {COPY.aiCoreIntro.body}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {AI_CORE_NODES.map((node, index) => (
            <div
              key={node.label}
              className="group rounded-lg border p-6"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'var(--color-card)',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
                transition: `opacity 500ms ease-out ${index * 100}ms, transform 500ms ease-out ${index * 100}ms`,
              }}
            >
              <h3
                className="mb-3 text-xl font-medium tracking-tight"
                style={{ color: 'var(--color-foreground)' }}
              >
                {node.label}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {node.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
