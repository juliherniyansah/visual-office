'use client';

import { PLATFORM_CARDS, COPY } from '@/lib/site';
import { useReveal } from './useReveal';

export function ProductIntro() {
  const { ref, isVisible } = useReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      className={`px-6 py-24 transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{ backgroundColor: 'var(--color-graphite)' }}
    >
      <div className="mx-auto max-w-6xl">
        <h2
          className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl"
          style={{ color: 'var(--color-white)' }}
        >
          The Platform
        </h2>
        <p
          className="mb-16 max-w-2xl text-lg"
          style={{ color: 'var(--color-silver)' }}
        >
          {COPY.platformIntro}
        </p>

        <div className="grid gap-8 md:grid-cols-3">
          {PLATFORM_CARDS.map((card) => (
            <article
              key={card.title}
              className="rounded-lg border p-8 transition-colors hover:border-[var(--color-red)]"
              style={{
                borderColor: 'var(--color-silver)',
                backgroundColor: 'var(--color-obsidian)',
              }}
            >
              <h3
                className="mb-4 text-2xl font-bold"
                style={{ color: 'var(--color-white)' }}
              >
                {card.title}
              </h3>
              <p
                className="text-base leading-relaxed"
                style={{ color: 'var(--color-silver)' }}
              >
                {card.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
