import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VYRON — Where Humans and AI Work Together",
  description: "A design studio for the AI-native era. We build platforms, agents, and interfaces that make human-AI collaboration feel inevitable.",
  openGraph: {
    title: "VYRON — Where Humans and AI Work Together",
    description: "A design studio for the AI-native era. We build platforms, agents, and interfaces that make human-AI collaboration feel inevitable.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
