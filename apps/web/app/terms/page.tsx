import type { Metadata, Viewport } from "next";
import { PolicyLayout } from "@/components/legal/policy-layout";
import { termsSections } from "@/lib/policy-content";
export const metadata: Metadata = { title: "Terms of Use — Draft", description: "SCHOLAU account eligibility, learning and competition rules, content rights and user responsibilities.", robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 5, userScalable: true };
export default function TermsPage() { return <PolicyLayout title="Terms of Use" intro="The conditions for accounts, learning, teaching and fair competition on SCHOLAU." sections={termsSections} />; }
