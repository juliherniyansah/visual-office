'use client';

import { STEPS, COPY } from '@/lib/site';
import { useReveal } from './useReveal';

export function HowItWorks() {
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
          How It Works
        </h2>
        <p
          className="mb-16 max-w-2xl text-lg"
          style={{ color: 'var(--color-silver)' }}
        >
          {COPY.howItWorksIntro}
        </p>

        <div className="grid gap-8 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <article
              key={step.title}
              className="relative rounded-lg border p-8"
              style={{
                borderColor: 'var(--color-silver)',
                backgroundColor: 'var(--color-graphite)',
              }}
            >
              <div
                className="mb-6 text-6xl font-bold"
                style={{ color: 'var(--color-red)' }}
              >
                {String(index + 1).padStart(2, '0')}
              </div>
              <h3
                className="mb-4 text-2xl font-bold"
                style={{ color: 'var(--color-white)' }}
              >
                {step.title}
              </h3>
              <p
                className="text-base leading-relaxed"
                style={{ color: 'var(--color-silver)' }}
              >
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
