import type { Metadata, Viewport } from "next";
import { PolicyLayout } from "@/components/legal/policy-layout";
import { privacySections } from "@/lib/policy-content";
export const metadata: Metadata = { title: "Privacy Policy", description: "How ScholAu handles account, academic, learning and competition information, and your privacy choices.", alternates: { canonical: "https://scholau.com/privacy" }, robots: { index: true, follow: true } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5, userScalable: true };
export default function PrivacyPage() { return <PolicyLayout title="Privacy Policy" intro="What we collect, how we use it, who can see it, and the choices available to you." sections={privacySections} />; }
