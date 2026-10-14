'use client';

import { Nav } from "@/components/landing/Nav";
import { Hero } from "@/components/landing/Hero";
import { ProductIntro } from "@/components/landing/ProductIntro";
import { Capabilities } from "@/components/landing/Capabilities";
import { Audience } from "@/components/landing/Audience";
import { AiCore } from "@/components/landing/AiCore";
import { Workforce } from "@/components/landing/Workforce";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { OfficeShowcase } from "@/components/landing/OfficeShowcase";
import { FinalCta } from "@/components/landing/FinalCta";
import { Footer } from "@/components/landing/Footer";

export default function Page() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <section id="platform">
          <ProductIntro />
        </section>
        <section id="office">
          <OfficeShowcase />
        </section>
        <section id="workforce">
          <Workforce />
        </section>
        <section id="how-it-works">
          <HowItWorks />
        </section>
        <section id="ai-core">
          <AiCore />
        </section>
        <section id="capabilities">
          <Capabilities />
        </section>
        <section id="about">
          <Audience />
        </section>
        <section id="cta">
          <FinalCta />
        </section>
      </main>
      <Footer />
    </>
  );
}
