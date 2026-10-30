import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Thai, Inter } from "next/font/google";
import { DesktopHeader } from "@/components/layout/desktop-header";
import { BatchRunnerMount } from "@/features/processing/batch-runner-mount";
import { BatchDraftProvider } from "@/features/upload/batch-draft-context";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CareerLens — Turn brochures into career opportunities",
  description:
    "Snap job fair brochures. CareerLens reads them, scans QR codes and organizes opportunities by company.",
  applicationName: "CareerLens",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAFAF9",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${plexThai.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <BatchDraftProvider>
          <BatchRunnerMount />
          {/* The header reads the current path; on dynamic routes that must sit in a Suspense boundary. */}
          <Suspense fallback={<div className="hidden h-16 border-b border-line bg-surface lg:block" />}>
            <DesktopHeader />
          </Suspense>
          {children}
        </BatchDraftProvider>
      </body>
    </html>
  );
}
