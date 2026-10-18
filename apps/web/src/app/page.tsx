'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { apiClient } from "@/lib/api";

export default function Page() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkSetup() {
      try {
        const response = await apiClient.checkSetupStatus();
        if (response.success && response.data) {
          if (!response.data.setupComplete) {
            router.replace('/setup');
            return;
          }
          if (localStorage.getItem('auth_token')) {
            router.replace('/dashboard');
            return;
          }
        }
      } catch (err) {
        console.error('Setup check failed:', err);
        setError('Failed to check setup status');
      } finally {
        setIsLoading(false);
      }
    }

    checkSetup();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Memeriksa status...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

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
