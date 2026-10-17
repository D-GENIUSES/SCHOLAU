"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ImageOff, Info, Lightbulb, NotebookPen } from "lucide-react";
import { useState } from "react";
import type { LessonBlock } from "@scholau/core";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

type CalloutTone = NonNullable<Extract<LessonBlock, { type: "callout" }>["tone"]>;

const CALLOUT: Record<CalloutTone, { label: string; icon: typeof Info; box: string; iconClass: string }> = {
  info: { label: "Note", icon: Info, box: "border-[#cfe3fb] bg-surface-tint", iconClass: "text-brand-primary" },
  tip: { label: "Tip", icon: Lightbulb, box: "border-[#b8e0cc] bg-success-bg", iconClass: "text-success" },
  warning: { label: "Warning", icon: AlertTriangle, box: "border-[#f0d9a8] bg-warning-bg", iconClass: "text-warning" },
  example: { label: "Example", icon: NotebookPen, box: "border-line bg-surface-page", iconClass: "text-ink-muted" },
};

export function LessonBlocks({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <div className="flex flex-col gap-4 text-base leading-relaxed">
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

function Block({ block }: { block: LessonBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p className="whitespace-pre-line">{block.text}</p>;
    case "heading": {
      const level = block.level ?? 2;
      if (level === 4) return <h4 className="mt-2 text-lg font-bold">{block.text}</h4>;
      if (level === 3) return <h3 className="mt-3 text-xl font-bold">{block.text}</h3>;
      return <h2 className="mt-4 text-2xl font-bold">{block.text}</h2>;
    }
    case "list": {
      const items = block.items.map((item, i) => <li key={i}>{item}</li>);
      return block.ordered ? (
        <ol className="flex list-decimal flex-col gap-1 pl-6">{items}</ol>
      ) : (
        <ul className="flex list-disc flex-col gap-1 pl-6">{items}</ul>
      );
    }
    case "image":
      return <LessonImage path={block.path} alt={block.alt} caption={block.caption} />;
    case "callout": {
      const tone = CALLOUT[block.tone ?? "info"];
      const Icon = tone.icon;
      return (
        <aside className={cn("flex gap-3 rounded-control border p-4", tone.box)}>
          <Icon className={cn("mt-0.5 size-5 shrink-0", tone.iconClass)} aria-hidden />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-semibold">{block.title ? `${tone.label}: ${block.title}` : tone.label}</p>
            <p className="whitespace-pre-line">{block.text}</p>
          </div>
        </aside>
      );
    }
    case "code":
      return (
        <figure className="flex flex-col gap-1">
          {block.language ? (
            <figcaption className="text-sm font-semibold text-ink-muted">{block.language}</figcaption>
          ) : null}
          <pre
            tabIndex={0}
            aria-label={block.language ? `${block.language} code` : "Code"}
            className="overflow-x-auto rounded-control border border-line bg-[#0f1f33] p-4 text-sm text-[#e6eef8]"
          >
            <code>{block.code}</code>
          </pre>
        </figure>
      );
    default:
      return null;
  }
}

function LessonImage({ path, alt, caption }: { path: string; alt: string; caption?: string }) {
  const [broken, setBroken] = useState(false);
  const signed = useQuery({
    queryKey: ["scholau", "lesson-asset", path],
    queryFn: async () => {
      const response = await fetch(`/api/lesson-assets?path=${encodeURIComponent(path)}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error("Image unavailable");
      const data: { signedUrl?: string } = await response.json();
      if (!data.signedUrl) throw new Error("Image unavailable");
      return data.signedUrl;
    },
    staleTime: 50 * 60_000,
    retry: 1,
  });

  let content;
  if (signed.isPending) {
    content = <Skeleton className="aspect-video w-full" />;
  } else if (signed.isError || broken || !signed.data) {
    content = (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-control border border-dashed border-line bg-surface-page p-4 text-center text-ink-muted">
        <ImageOff className="size-6" aria-hidden />
        <span className="text-sm">Image unavailable: {alt}</span>
      </div>
    );
  } else {
    content = (
      // Signed URLs from private storage are short-lived and not configured as next/image remote patterns.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={signed.data}
        alt={alt}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-auto w-full rounded-control border border-line"
      />
    );
  }

  return (
    <figure className="flex flex-col gap-2">
      {content}
      {caption ? <figcaption className="text-sm text-ink-muted">{caption}</figcaption> : null}
    </figure>
  );
}
