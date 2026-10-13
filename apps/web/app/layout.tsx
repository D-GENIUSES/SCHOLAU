import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { OfflineIndicator } from "@/components/offline-indicator";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "ScholAu — Study. Compete. Rise.", template: "%s · ScholAu" },
  description: "Study your university courses, practise with feedback and compete in 1v1 quiz battles.",
  applicationName: "ScholAu",
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: { type: "website", siteName: "ScholAu", title: "ScholAu — Study. Compete. Rise." },
  twitter: { card: "summary_large_image" },
  appleWebApp: { capable: true, title: "ScholAu", statusBarStyle: "default" },
};

// Intentional product choice: lock page scale for a native-app feel (no pinch/browser zoom).
// Users who rely on system zoom may prefer the browser; this targets installed / standalone use.
export const viewport: Viewport = {
  themeColor: "#0066D6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-control focus:bg-surface-card focus:px-4 focus:py-3 focus:font-semibold focus:text-brand-primary focus:shadow-raised"
        >
          Skip to main content
        </a>
        <Providers>
          <OfflineIndicator />
          {children}
        </Providers>
      </body>
    </html>
  );
}
