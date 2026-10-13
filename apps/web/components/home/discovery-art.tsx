import { BookOpen, Globe, Sparkles } from "lucide-react";

/** General discovery artwork for public previews, independent of any subject or profile. */
export function DiscoveryArt({ className }: { className?: string }) {
  return <div className={className} aria-hidden>
    <div className="relative mx-auto flex aspect-square w-full items-center justify-center rounded-full bg-[radial-gradient(circle,#d0eaff_0%,#eaf4ff80_55%,transparent_70%)]">
      <Globe className="size-[58%] text-brand-bright" strokeWidth={1.15} />
      <span className="absolute bottom-[12%] left-[12%] flex size-[32%] items-center justify-center rounded-2xl border-4 border-white bg-brand-primary text-white shadow-raised"><BookOpen className="size-[62%]" strokeWidth={1.6} /></span>
      <Sparkles className="absolute right-[10%] top-[12%] size-[18%] text-brand-primary" strokeWidth={1.5} />
    </div>
  </div>;
}
