import katex from "katex";

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

function LegacyText({ text }: { text: string }) {
  // Only a complete, explicit power is formatted. Never infer fraction/grouping precedence.
  const powers = text.split(/(\^(?:\{[^{}\n]+\}|\([^()\n]+\)|[+−-]?\d+|[A-Za-z](?![A-Za-z0-9])))/g);
  return <>{powers.map((part, index) => {
    if (index % 2 === 0 || !/[A-Za-z0-9)\]}]$/.test(powers[index - 1] ?? "")) return part;
    const exponent = part.slice(1).replace(/^[{(]([\s\S]*)[})]$/, "$1");
    return <span key={index}><span className="sr-only"> raised to the power of {exponent} </span><sup aria-hidden="true">{exponent}</sup></span>;
  })}</>;
}

export function MathText({ text }: { text: string }) {
  const parts = text.split(/(\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\))/g);
  return <>{parts.map((part, i) => {
    if (part.startsWith("\\[") || part.startsWith("$$")) {
      return <Equation key={i} expression={part.slice(2, -2)} display />;
    }
    if (part.startsWith("\\(")) return <Equation key={i} expression={part.slice(2, -2)} />;
    return <span key={i} className="whitespace-pre-line"><LegacyText text={part} /></span>;
  })}</>;
}
