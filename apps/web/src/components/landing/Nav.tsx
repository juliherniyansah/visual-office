'use client';

import { useState } from "react";
import { SITE, NAV_LINKS } from "@/lib/site";

export function Nav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-graphite bg-background/90">
      <nav aria-label="Primary" className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <a href="#hero" className="text-2xl font-bold tracking-tight text-foreground">
          {SITE.name}
        </a>
        <button
          type="button"
          className="lg:hidden"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="primary-menu"
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
        <ul
          id="primary-menu"
          className={`${isOpen ? "flex" : "hidden"} flex-col gap-4 lg:flex lg:flex-row lg:items-center`}
        >
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href="/login"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90"
            >
              Sign in
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
