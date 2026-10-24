import { AlertTriangle, ImageIcon } from "lucide-react";

type RawBlock = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v : "");

const CALLOUT_LABEL: Record<string, string> = { info: "Note", tip: "Tip", warning: "Warning", example: "Example" };

function Unsupported({ reason }: { reason: string }) {
  return (
    <p className="flex items-start gap-2 rounded-control border border-[#f0d9a8] bg-warning-bg p-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      {reason}
    </p>
  );
}

function Block({ block }: { block: RawBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p className="whitespace-pre-line">{str(block.text)}</p>;
    case "checkpoint": {
      const options = Array.isArray(block.options) ? block.options.map(str) : [];
      return <aside className="rounded-control border border-line bg-surface-page p-4">
        <p className="font-semibold">Knowledge check: {str(block.question)}</p>
        <ol className="my-2 list-decimal pl-6">{options.map((option, i) => <li key={i}>{option}{i === block.correct_index ? " (correct)" : ""}</li>)}</ol>
        <p>{str(block.explanation)}</p>
      </aside>;
    }
    case "heading": {
      const level = block.level === 3 ? 3 : block.level === 4 ? 4 : 2;
      const text = str(block.text);
      if (level === 2) return <h3 className="text-lg font-bold">{text}</h3>;
      if (level === 3) return <h4 className="text-base font-bold">{text}</h4>;
      return <h5 className="text-base font-semibold">{text}</h5>;
    }
    case "list": {
      const items = Array.isArray(block.items) ? block.items.map(str) : [];
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag className={block.ordered ? "list-decimal space-y-1 pl-6" : "list-disc space-y-1 pl-6"}>
          {items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </Tag>
      );
    }
    case "image":
      return (
        <figure className="flex flex-col gap-1 rounded-control border border-dashed border-line-strong bg-surface-page p-3 text-sm">
          <span className="flex items-center gap-2 font-semibold">
            <ImageIcon className="size-4 text-brand-primary" aria-hidden /> Image
          </span>
          <span>
            Storage path: <code className="break-all font-mono">{str(block.path) || "(missing)"}</code>
          </span>
          <span>Alt text: {str(block.alt) || <em>(missing — required for accessibility)</em>}</span>
          {str(block.caption) ? <figcaption className="text-ink-muted">Caption: {str(block.caption)}</figcaption> : null}
        </figure>
      );
    case "callout": {
      const tone = str(block.tone) || "info";
      return (
        <aside className="rounded-control border border-[#cfe3fb] bg-surface-tint p-3">
          <p className="text-sm font-semibold text-brand-primary">
            {CALLOUT_LABEL[tone] ?? "Note"}
            {str(block.title) ? `: ${str(block.title)}` : ""}
          </p>
          <p className="whitespace-pre-line">{str(block.text)}</p>
        </aside>
      );
    }
    case "code":
      return (
        <pre className="overflow-x-auto rounded-control bg-[#11243c] p-3 text-sm text-ink-inverse">
          {str(block.language) ? <span className="mb-2 block text-xs uppercase opacity-75">{str(block.language)}</span> : null}
          <code>{str(block.code)}</code>
        </pre>
      );
    default:
      return <Unsupported reason={`Unsupported block type: ${String(block.type ?? "(none)")}. Publishing will fail validation.`} />;
  }
}

/** Text-only preview of structured lesson blocks. Never renders HTML from content. */
export function BlockPreview({ blocks }: { blocks: unknown }) {
  if (!Array.isArray(blocks)) return <Unsupported reason="Blocks are not a list. Publishing will fail validation." />;
  if (blocks.length === 0) return <p className="text-ink-muted">This lesson has no blocks.</p>;
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) =>
        b && typeof b === "object" && !Array.isArray(b) ? (
          <Block key={i} block={b as RawBlock} />
        ) : (
          <Unsupported key={i} reason={`Block ${i + 1} is not an object.`} />
        ),
      )}
    </div>
  );
}
