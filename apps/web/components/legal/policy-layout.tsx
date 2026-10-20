import Link from "next/link";
import { Logo } from "@/components/logo";
import { LEGAL_UPDATED, LEGAL_VERSION } from "@/lib/legal";
import "./policy.css";
export interface PolicySection { id: string; title: string; paragraphs: string[] }
export function PolicyLayout({ title, intro, sections }: { title: string; intro: string; sections: PolicySection[] }) {
  return <div className="legal-page">
    <header className="legal-header"><Link href="/" aria-label="ScholAu home"><Logo /></Link><nav aria-label="Legal pages"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Use</Link></nav></header>
    <main id="main" tabIndex={-1} className="legal-main">
      <p className="legal-eyebrow">SCHOLAU · Legal</p><h1>{title}</h1><p className="legal-intro">{intro}</p>
      <aside className="legal-draft" aria-label="Draft status"><strong>Draft — not yet effective</strong><p>Operator details and privacy/support contacts must be completed before publication. Under-18 registration remains closed until guardian verification is operational.</p><p>Last updated: {LEGAL_UPDATED} · Version: {LEGAL_VERSION}. No effective date has been set.</p></aside>
      <nav className="legal-contents" aria-label={`${title} sections`}><h2>On this page</h2><ol>{sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol></nav>
      {sections.map(section => <section className="legal-section" key={section.id} id={section.id} aria-labelledby={`${section.id}-title`}><h2 id={`${section.id}-title`}>{section.title}</h2>{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</section>)}
      <aside className="legal-section"><h2>Legal references</h2><p><a href="https://ndpc.gov.ng/download/nigeria-data-protection-act-2023">Nigeria Data Protection Act 2023</a> · <a href="https://ndpc.gov.ng/wp-content/uploads/2025/03/NDP-ACT-GAID-2025-MARCH-20TH.pdf">2025 General Application and Implementation Directive</a> · <a href="https://ndpc.gov.ng/">Nigeria Data Protection Commission (NDPC)</a></p></aside>
    </main>
    <footer className="legal-footer"><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Use</Link><Link href="/home">Back to ScholAu</Link></footer>
  </div>;
}
