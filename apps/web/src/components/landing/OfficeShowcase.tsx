'use client';

import { COPY, FLOORS } from '@/lib/site';
import { useReveal } from './useReveal';
import { HqIllustration } from './HqIllustration';

export function OfficeShowcase() {
  const { ref, isVisible } = useReveal<HTMLElement>();

  return (
    <section
      ref={ref}
      className={`px-6 py-24 transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
      style={{ backgroundColor: 'var(--color-obsidian)' }}
    >
      <div className="mx-auto max-w-6xl">
        <h2
          className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl"
          style={{ color: 'var(--color-white)' }}
        >
          The Headquarters
        </h2>
        <p
          className="mb-16 max-w-2xl text-lg"
          style={{ color: 'var(--color-silver)' }}
        >
          {COPY.officeIntro}
        </p>

        <div className="mb-16 flex justify-center">
          <HqIllustration
            className="w-full max-w-4xl"
            titleId="hq-illustration-title"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {FLOORS.map((floor) => (
            <article
              key={floor.level}
              className="rounded-lg border p-6"
              style={{
                borderColor: 'var(--color-silver)',
                backgroundColor: 'var(--color-graphite)',
              }}
            >
              <div
                className="mb-2 text-sm font-semibold uppercase tracking-wider"
                style={{ color: 'var(--color-red)' }}
              >
                {floor.level}
              </div>
              <h3
                className="mb-3 text-xl font-bold"
                style={{ color: 'var(--color-white)' }}
              >
                {floor.name}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-silver)' }}
              >
                {floor.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
