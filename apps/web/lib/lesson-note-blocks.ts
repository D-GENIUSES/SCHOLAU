import type { LessonBlock } from "@scholau/core";

/** Imported plain-text notes are prose, even when stored in a legacy code block. */
export function normalizeNoteBlocks(blocks: LessonBlock[]): LessonBlock[] {
  return blocks.flatMap(block => {
    if (block.type !== "code" || !/^(text|txt|plain|plaintext)$/i.test(block.language?.trim() ?? "")) return [block];
    const result: LessonBlock[] = [];
    let code: string[] = [];
    const flushCode = () => {
      if (code.length) result.push({ type: "code", code: code.join("\n") });
      code = [];
    };
    for (const raw of block.code.replace(/\r\n?/g, "\n").split("\n")) {
      const line = raw.trim();
      const codeLine = /^[{}]|[{}]$/.test(line) ||
        (/;$/.test(line) && /[=()]|^(?:return|import|package|break|continue|throw)\b/.test(line));
      if (codeLine || (code.length > 0 && /^\/\//.test(line))) {
        code.push(raw);
        continue;
      }
      flushCode();
      if (!line || /^```(?:text|txt|plaintext)?$/i.test(line)) continue;
      const bullet = line.match(/^[•●▪*-]\s+(.+)$/);
      if (bullet?.[1]) {
        const last = result.at(-1);
        if (last?.type === "list" && !last.ordered) last.items.push(bullet[1]);
        else result.push({ type: "list", ordered: false, items: [bullet[1]] });
      } else if (/^(?:#{1,4}\s|\d+(?:\.\d+)+\s|LECTURE\s+\d+\b)/i.test(line) || (line.length < 100 && /[A-Z]/.test(line) && line === line.toUpperCase())) {
        result.push({ type: "heading", level: 3, text: line.replace(/^#{1,4}\s+/, "") });
      } else {
        result.push({ type: "paragraph", text: line });
      }
    }
    flushCode();
    return result;
  });
}
