import type { Metadata } from "next";
// Self-hosted brand fonts (Flying Pickle Brand Playbook):
// Bebas Neue for headings, Poppins for body.
import "@fontsource/bebas-neue/400.css";
import "@fontsource/poppins/300.css";
import "@fontsource/poppins/400.css";
import "@fontsource/poppins/500.css";
import "@fontsource/poppins/600.css";
import "@fontsource/poppins/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "TFP OS",
  description:
    "Everything you need to run your Flying Pickle location — resources, updates, and your onboarding, all in one place.",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
