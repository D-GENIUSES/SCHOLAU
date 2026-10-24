import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { LegalLinks } from "@/components/legal-links";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="auth-story">
        <Link href="/home" aria-label="ScholAu home"><Logo /></Link>
        <div className="auth-overview"><p className="auth-kicker">ScholAu accounts</p><h2>Sign in to ScholAu</h2><p>Sign in or create an account.</p>
          <dl className="auth-features"><div><dt>For students</dt><dd>Read assigned lessons, take practice tests, and track your results.</dd></div><div><dt>For lecturers</dt><dd>Apply for access to manage teaching materials and course activities.</dd></div></dl>
        </div>
        <Link href="/home">Try ScholAu</Link>
      </aside>
      <div className="auth-content">
        <Link href="/home" className="auth-back"><ArrowLeft className="size-4" aria-hidden />Back to ScholAu</Link>
        <Link href="/home" aria-label="ScholAu home" className="mb-6 lg:hidden"><Logo /></Link>
        <main id="main" tabIndex={-1} className="auth-card">{children}</main>
        <footer className="flex-wrap justify-center"><LegalLinks /><Link href="/home">Continue as guest</Link></footer>
      </div>
    </div>
  );
}
