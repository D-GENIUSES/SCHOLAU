import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="auth-layout"><aside className="auth-story"><Logo /><div><p className="eyebrow">A LITTLE BETTER, EVERY DAY</p><h2>Study.<br />Compete.<br /><span>Rise.</span></h2><p>Your courses, your challenges,<br />your next big step.</p></div><Image unoptimized src="/illustrations/learning-shield.webp" alt="" width={512} height={512} sizes="320px" className="auth-art" /><p>Made for your university journey.</p></aside>
    <div className="auth-content"><Link href="/home" className="auth-back">← Explore ScholAu</Link><Link href="/home" aria-label="ScholAu home" className="mb-6 lg:hidden"><Logo /></Link><main id="main" tabIndex={-1} className="auth-card">{children}</main><footer><Link href="/privacy">Privacy</Link><span aria-hidden>·</span><Link href="/home">Continue as guest</Link></footer></div>
  </div>;
}
