import katex from "katex";
import type { ReactNode } from "react";

/** Content uses explicit delimiters: \(...\) inline, \[...\] or $$...$$ on its own line.
 * Plain text is deliberately never guessed to be maths (e.g. prices, code, or a/b).
 */
export function Equation({ expression, reading, display = false }: {
  expression: string;
  reading?: string;
  display?: boolean;
}) {
  let html: string;
  try {
    html = katex.renderToString(expression, {
      displayMode: display,
      output: "htmlAndMathml",
      throwOnError: true,
      trust: false,
      strict: "error",
      maxExpand: 200,
      maxSize: 20,
    });
  } catch {
    // Preserve the author's expression on malformed/unsupported input; never silently change it.
    return <span className="math-invalid" role="note">Equation needs review: {expression}</span>;
  }
  return <span className={display ? "math-equation math-display" : "math-equation math-inline"}
    role={display ? "region" : undefined} aria-label={display ? "Calculation; scroll horizontally if needed" : undefined}
    tabIndex={display ? 0 : undefined}>
    {reading ? <span className="sr-only">{reading}</span> : null}
    <span aria-hidden={reading ? true : undefined} dangerouslySetInnerHTML={{ __html: html }} />
  </span>;
}

const CODE_CONTEXT = /\b(?:java|javascript|typescript|python|c\+\+|c#|programming|source code|code snippet|escape sequence|string literal|console\.|system\.out|sql|html|css|regex)\b/i;
const MATH_CONTEXT = /\b(?:maths?|mathematics|algebra|fraction|ratio|equation|solve|simplify|evaluate|calculate|derivative|integral|square root|multiply|multiplication)\b/i;
const LOOSE_MATH = /\\(?:frac|sqrt|sum|int|lim|pi|alpha|beta|gamma|theta|sigma)(?:\{[^{}\n]*\}){0,2}|(?:\([^()\n]+\)|\b[A-Za-z0-9]+)\s*(?:\*\*|\^|_)\s*(?:\{[^{}\n]+\}|\([^()\n]+\)|[+-]?\d+|[A-Za-z](?![A-Za-z0-9]))|\bsqrt\([^()\n]+\)|(?<![\w.])(?:\d+(?:\.\d+)?|[A-Za-z])\s*[*/]\s*(?:\d+(?:\.\d+)?|[A-Za-z])(?![\w.])/g;

/** Format unambiguous legacy maths without interpreting programming syntax as equations. */
function mathNotation(expression: string): string {
  let result = expression
    .replace(/\*\*/g, "^")
    .replace(/−/g, "-")
    .replace(/≤/g, "\\le ")
    .replace(/≥/g, "\\ge ")
    .replace(/×/g, "\\times ")
    .replace(/÷/g, "\\div ")
    .replace(/(\^|_)\s*\(([^()\n]+)\)/g, "$1{$2}")
    .replace(/\bsqrt\(([^()\n]+)\)/g, "\\sqrt{$1}");
  result = result.replace(
    /(?<![\w^_])(\([^()\n]+\)|[A-Za-z]|\d+(?:\.\d+)?)\s*\/\s*(\([^()\n]+\)|[A-Za-z]|\d+(?:\.\d+)?)(?![\w^_])/g,
    (_match, numerator: string, denominator: string) => "\\frac{" + numerator + "}{" + denominator + "}",
  );
  return result.replace(/\*/g, "\\times ");
}

function standaloneFormula(text: string): boolean {
  const value = text.trim();
  if (!value || /\b(?:and|or|the|is|are|for|with|from|which|what|your|when|where|how)\b/i.test(value)) return false;
  const withoutCommands = value.replace(/\\(?:frac|sqrt|times|cdot|alpha|beta|gamma|theta|sigma|sum|int|lim|pi)\b/g, "");
  return !/[A-Za-z]{5,}/.test(withoutCommands)
    && /^[\w\s\\{}()[\]+\-*/^=<>≤≥×÷.,]+$/.test(value)
    && /(?:\^|\*\*|_|[+\-*/=<>≤≥×÷]|\bsqrt\b)/.test(value);
}

function PlainText({ text }: { text: string }) {
  const containsCode = CODE_CONTEXT.test(text);
  const hasMathContext = MATH_CONTEXT.test(text);
  const spans = text.split(/(`[^`\n]*`)/g);
  return <>{spans.map((segment, index) => {
    if (segment.startsWith("`") && segment.endsWith("`")) return <code key={index}>{segment.slice(1, -1)}</code>;
    if (containsCode) return <span key={index}>{segment}</span>;
    if (standaloneFormula(segment)) return <Equation key={index} expression={mathNotation(segment.trim())} />;
    const pieces: ReactNode[] = [];
    let offset = 0;
    for (const match of segment.matchAll(LOOSE_MATH)) {
      const candidate = match[0];
      const start = match.index;
      if (start === undefined || !candidate) continue;
      // Ordinary a/b is ambiguous in prose; a standalone fraction or maths context is not.
      if (/^[A-Za-z]\/[A-Za-z]$/.test(candidate) && !hasMathContext && segment.trim() !== candidate) continue;
      pieces.push(segment.slice(offset, start));
      pieces.push(<Equation key={start} expression={mathNotation(candidate)} />);
      offset = start + candidate.length;
    }
    pieces.push(segment.slice(offset));
    return <span key={index}>{pieces}</span>;
  })}</>;
}

/** Explicit TeX takes priority; legacy unmarked expressions use guarded maths formatting. */
export function MathText({ text }: { text: string }) {
  const parts = text.split(/(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\))/g);
  return <>{parts.map((part, i) => {
    if (part.startsWith("\\[") || part.startsWith("$$")) {
      return <Equation key={i} expression={part.slice(2, -2)} display />;
    }
    if (part.startsWith("\\(")) return <Equation key={i} expression={part.slice(2, -2)} />;
    return <span key={i} className="whitespace-pre-line"><PlainText text={part} /></span>;
  })}</>;
}
