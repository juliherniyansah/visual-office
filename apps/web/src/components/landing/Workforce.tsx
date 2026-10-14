'use client';

import { AGENTS, COPY } from '@/lib/site';
import { useReveal } from './useReveal';

export function Workforce() {
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
          Your AI Workforce
        </h2>
          <p
            className="max-w-3xl text-lg leading-relaxed"
            style={{ color: 'var(--color-silver)' }}
          >
            {COPY.workforceIntro}
          </p>
          <p className="mt-4 text-xs uppercase tracking-wider" style={{ color: 'var(--color-silver)' }}>
            Status: Planned
          </p>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {AGENTS.map((agent, index) => (
            <article
              key={agent.role}
              className="rounded-lg border p-6 transition-all duration-300 hover:scale-105"
              style={{
                borderColor: 'var(--color-silver)',
                backgroundColor: 'var(--color-obsidian)',
              }}
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold"
                style={{
                  backgroundColor: 'var(--color-red)',
                  color: 'var(--color-white)',
                }}
              >
                {index + 1}
              </div>
              <h3
                className="mb-3 text-2xl font-bold"
                style={{ color: 'var(--color-white)' }}
              >
                {agent.role}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--color-silver)' }}
              >
                {agent.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
