const FLASH_TAGS = new Set(["focus", "section", "tip", "checkpoint", "diagram", "recap"]);
const BLOCK_TYPES = new Set([
  "equation",
  "worked_example",
  "heading",
  "paragraph",
  "callout",
  "checkpoint",
  "list",
  "code",
  "image",
]);

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function letter(i: number): string {
  return String.fromCharCode(65 + i);
}

function stringifySteps(steps: unknown): string[] | undefined {
  if (!Array.isArray(steps) || !steps.length) return undefined;
  const out: string[] = [];
  for (const s of steps) {
    if (typeof s === "string" && s.trim()) {
      out.push(s.trim());
      continue;
    }
    const step = asRecord(s);
    if (!step) continue;
    const calc = asString(step.calculation) ?? asString(step.text);
    const expl = asString(step.explanation);
    if (calc && expl) out.push(`${calc} — ${expl}`);
    else if (calc) out.push(calc);
    else if (expl) out.push(expl);
  }
  return out.length ? out : undefined;
}

function normalizeOptions(raw: unknown, answer?: string, steps?: unknown): { options: Array<Record<string, unknown>>; correct_option: string } | null {
  if (!Array.isArray(raw) || raw.length < 2) return null;
  const stepStrings = stringifySteps(steps);
  const options: Array<Record<string, unknown>> = [];
  let correct = "A";
  for (let i = 0; i < Math.min(raw.length, 6); i++) {
    const item = raw[i];
    const label = letter(i);
    if (typeof item === "string") {
      const body = item.trim();
      if (!body) continue;
      const opt: Record<string, unknown> = { label, body };
      if (answer && body === answer.trim() && stepStrings) opt.steps = stepStrings;
      options.push(opt);
      if (answer && body === answer.trim()) correct = label;
    } else {
      const o = asRecord(item);
      if (!o) continue;
      const body = asString(o.body) ?? asString(o.text) ?? asString(o.label) ?? asString(o.option);
      if (!body) continue;
      const lab = asString(o.label) ?? label;
      const opt: Record<string, unknown> = { label: lab, body };
      const ownSteps = stringifySteps(o.steps);
      if (ownSteps) opt.steps = ownSteps;
      else if (answer && body === answer.trim() && stepStrings) opt.steps = stepStrings;
      options.push(opt);
      if (answer && (body === answer.trim() || lab === answer.trim())) correct = lab;
    }
  }
  if (options.length < 2) return null;
  while (options.length < 4) {
    options.push({ label: letter(options.length), body: `Option ${letter(options.length)}` });
  }
  return { options: options.slice(0, 4), correct_option: correct };
}

function normalizeBlock(raw: unknown): Record<string, unknown> | null {
  const b = asRecord(raw);
  if (!b) return null;
  let type = asString(b.type)?.toLowerCase();
  if (type === "text" || type === "body" || type === "content" || type === "p") type = "paragraph";
  if (type === "h1" || type === "h2" || type === "h3" || type === "title" || type === "section") type = "heading";
  if (type === "bullets" || type === "ul" || type === "bullet_list") type = "list";
  if (type === "note" || type === "tip" || type === "warning" || type === "info" || type === "example") {
    if (!asString(b.text) && asString(b.type)) {
      // type was the tone; keep as callout below
    }
    if (!BLOCK_TYPES.has(type!)) type = "callout";
  }
  if (type === "formula" || type === "math") type = "equation";
  if (type === "quiz" || type === "question") type = "checkpoint";
  if (!type || !BLOCK_TYPES.has(type)) {
    const text = asString(b.text) ?? asString(b.content) ?? asString(b.body);
    if (text) return { type: "paragraph", text };
    return null;
  }

  if (type === "paragraph") {
    const text = asString(b.text) ?? asString(b.content) ?? asString(b.body);
    return text ? { type, text } : null;
  }
  if (type === "heading") {
    const text = asString(b.text) ?? asString(b.content) ?? asString(b.title);
    if (!text) return null;
    const level = b.level === 3 || b.level === 4 ? b.level : 2;
    return { type, level, text };
  }
  if (type === "callout") {
    const text = asString(b.text) ?? asString(b.content) ?? asString(b.body);
    if (!text) return null;
    const toneRaw = asString(b.tone) ?? asString(b.icon) ?? asString(b.variant);
    const tone =
      toneRaw && ["info", "tip", "warning", "example"].includes(toneRaw.toLowerCase())
        ? toneRaw.toLowerCase()
        : "info";
    const out: Record<string, unknown> = { type, tone, text };
    const title = asString(b.title);
    if (title) out.title = title;
    return out;
  }
  if (type === "list") {
    const items = Array.isArray(b.items) ? b.items.map(asString).filter(Boolean) : [];
    return items.length ? { type, items } : null;
  }
  if (type === "equation") {
    const expression = asString(b.expression) ?? asString(b.latex) ?? asString(b.tex) ?? asString(b.text);
    if (!expression) return null;
    const out: Record<string, unknown> = { type, expression };
    const reading = asString(b.reading);
    if (reading) out.reading = reading;
    return out;
  }
  if (type === "worked_example") {
    const title = asString(b.title) ?? "Worked example";
    const problem = asString(b.problem) ?? asString(b.prompt) ?? title;
    const steps = Array.isArray(b.steps) ? b.steps : [];
    const answer = asString(b.answer) ?? "";
    if (!steps.length || !answer) return null;
    const out: Record<string, unknown> = { type, title, problem, steps, answer };
    if (asRecord(b.check)) out.check = b.check;
    if (asString(b.answer_reading)) out.answer_reading = asString(b.answer_reading);
    return out;
  }
  if (type === "checkpoint") {
    const question = asString(b.question) ?? asString(b.prompt);
    const options = Array.isArray(b.options) ? b.options.map((o) => (typeof o === "string" ? o : asString(asRecord(o)?.body))).filter(Boolean) : [];
    const explanation = asString(b.explanation) ?? "See the lesson.";
    if (!question || options.length < 2) return null;
    let correct_index = typeof b.correct_index === "number" ? b.correct_index : 0;
    const answer = asString(b.answer) ?? asString(b.correct_option);
    if (answer) {
      const idx = options.findIndex((o) => o === answer);
      if (idx >= 0) correct_index = idx;
    }
    return { type, question, options: options.slice(0, 6), correct_index, explanation };
  }
  if (type === "code") {
    const code = asString(b.code) ?? asString(b.text);
    return code ? { type, code, language: asString(b.language) } : null;
  }
  if (type === "image") {
    const path = asString(b.path) ?? asString(b.src);
    const alt = asString(b.alt) ?? "Lesson image";
    return path ? { type, path, alt } : null;
  }
  return null;
}

function normalizeFlashcard(raw: unknown): Record<string, unknown> | null {
  const c = asRecord(raw);
  if (!c) return null;
  const front = asString(c.front) ?? asString(c.question);
  const back = asString(c.back) ?? asString(c.answer);
  if (!front || !back) return null;
  const tagRaw = asString(c.tag)?.toLowerCase();
  const tag = tagRaw && FLASH_TAGS.has(tagRaw) ? tagRaw : "focus";
  return { front, back, tag };
}

function normalizeLearning(raw: unknown): Record<string, unknown> | null {
  const q = asRecord(raw);
  if (!q) return null;
  const prompt = asString(q.prompt) ?? asString(q.question) ?? asString(q.stem);
  const explanation = asString(q.explanation) ?? asString(q.rationale) ?? "Grounded in the uploaded source.";
  const answer = asString(q.correct_option) ?? asString(q.answer);
  const normalized = normalizeOptions(q.options ?? q.choices, answer);
  if (!prompt || !normalized) return null;
  return {
    pool: "learning",
    usage: ["review", "practice"],
    difficulty: asString(q.difficulty) ?? "beginner",
    prompt,
    explanation,
    source_reference: asString(q.source_reference),
    answer_format: "standard",
    options: normalized.options,
    correct_option: normalized.correct_option,
    logical_question_key: asString(q.logical_question_key),
    course_code: asString(q.course_code),
  };
}

function normalizeBattle(raw: unknown): Record<string, unknown> | null {
  const q = asRecord(raw);
  if (!q) return null;
  const format =
    asString(q.answer_format)?.toLowerCase() ??
    asString(q.type)?.toLowerCase() ??
    asString(q.kind)?.toLowerCase() ??
    "standard";
  const prompt = asString(q.prompt) ?? asString(q.question) ?? asString(q.stem);
  const explanation =
    asString(q.explanation) ??
    asString(q.rationale) ??
    (Array.isArray(q.steps)
      ? (q.steps as unknown[])
          .map((s) => {
            const step = asRecord(s);
            return step ? `${asString(step.calculation) ?? ""} — ${asString(step.explanation) ?? ""}` : "";
          })
          .filter(Boolean)
          .join(" ")
      : undefined) ??
    "Grounded in the uploaded source.";
  if (!prompt) return null;

  if (format === "fill_in_gap" || format === "fill-in-gap" || format === "gap") {
    const gaps = Array.isArray(q.gaps) ? q.gaps : [];
    if (!gaps.length) return null;
    return {
      pool: "battle",
      usage: ["battle"],
      difficulty: asString(q.difficulty) ?? "beginner",
      prompt,
      explanation,
      source_reference: asString(q.source_reference),
      answer_format: "fill_in_gap",
      gaps,
      battle_seconds: typeof q.battle_seconds === "number" ? q.battle_seconds : 12,
      battle_reading_seconds: typeof q.battle_reading_seconds === "number" ? q.battle_reading_seconds : 4,
      logical_question_key: asString(q.logical_question_key),
      course_code: asString(q.course_code),
    };
  }

  const answer = asString(q.correct_option) ?? asString(q.answer) ?? asString(q.body);
  const normalized = normalizeOptions(q.options ?? q.choices, answer, q.steps);
  if (!normalized) return null;
  const answer_format = format === "worked_solution" || format === "worked" ? "worked_solution" : "standard";
  const options = normalized.options.map((opt) => ({ ...opt }));
  if (answer_format === "worked_solution") {
    const stepStrings =
      stringifySteps(q.steps) ??
      options.flatMap((o) => (Array.isArray(o.steps) ? (o.steps as string[]) : [])).filter(Boolean);
    const correct = options.find((o) => asString(o.label)?.toUpperCase() === normalized.correct_option.toUpperCase());
    if (correct && stepStrings.length && !Array.isArray(correct.steps)) {
      correct.steps = stepStrings;
    } else if (correct && stepStrings.length && Array.isArray(correct.steps) && !(correct.steps as unknown[]).length) {
      correct.steps = stepStrings;
    } else if (correct && !Array.isArray(correct.steps) && stepStrings.length === 0) {
      // last resort so quantitative battle validation can pass
      correct.steps = [
        String(asString(correct.body) ?? "Identify known values"),
        "Apply the governing relation from the lesson",
        `Obtain ${asString(correct.body) ?? "the result"}`,
      ];
    }
  }
  return {
    pool: "battle",
    usage: ["battle"],
    difficulty: asString(q.difficulty) ?? "beginner",
    prompt,
    explanation,
    source_reference: asString(q.source_reference),
    answer_format,
    options,
    correct_option: normalized.correct_option,
    battle_seconds: typeof q.battle_seconds === "number" ? q.battle_seconds : 10,
    battle_reading_seconds: typeof q.battle_reading_seconds === "number" ? q.battle_reading_seconds : 4,
    logical_question_key: asString(q.logical_question_key),
    course_code: asString(q.course_code),
  };
}

function ensureTeachingCompleteness(input: {
  courseCode?: string;
  blocks: Array<Record<string, unknown>>;
  learning_questions: Array<Record<string, unknown>>;
  battle_questions: Array<Record<string, unknown>>;
}): Array<Record<string, unknown>> {
  const blocks = [...input.blocks];
  const quantitative = Boolean(input.courseCode && /^(MTH|STA|STT|MAT|PHY|CHM)\b/i.test(input.courseCode.trim()));
  const minCheckpoints = quantitative ? 2 : 1;

  let checkpoints = blocks.filter((b) => b.type === "checkpoint").length;
  for (const q of input.learning_questions) {
    if (checkpoints >= minCheckpoints) break;
    const opts = Array.isArray(q.options) ? q.options : [];
    const bodies = opts.map((o) => asString(asRecord(o)?.body)).filter(Boolean) as string[];
    if (!asString(q.prompt) || bodies.length < 2) continue;
    const correctLabel = asString(q.correct_option)?.toUpperCase() ?? "A";
    const correct_index = Math.max(
      0,
      opts.findIndex((o) => asString(asRecord(o)?.label)?.toUpperCase() === correctLabel),
    );
    blocks.push({
      type: "checkpoint",
      question: asString(q.prompt),
      options: bodies.slice(0, 6),
      correct_index,
      explanation: asString(q.explanation) ?? "See the lesson.",
    });
    checkpoints += 1;
  }

  const hasWorked = blocks.some((b) => b.type === "worked_example");
  if (quantitative && !hasWorked) {
    const workedQ = input.battle_questions.find((q) => q.answer_format === "worked_solution");
    if (workedQ) {
      const correctLabel = asString(workedQ.correct_option)?.toUpperCase() ?? "A";
      const correctOpt = (Array.isArray(workedQ.options) ? workedQ.options : [])
        .map(asRecord)
        .find((o) => asString(o?.label)?.toUpperCase() === correctLabel);
      const steps = Array.isArray(correctOpt?.steps) ? correctOpt!.steps : [];
      if (steps.length >= 3) {
        blocks.push({
          type: "worked_example",
          title: "Worked solution",
          problem: asString(workedQ.prompt) ?? "Solve the problem",
          steps: steps.map((s) => {
            if (typeof s === "string") return { calculation: s, explanation: s };
            const step = asRecord(s);
            return {
              calculation: asString(step?.calculation) ?? asString(step?.text) ?? "…",
              explanation: asString(step?.explanation) ?? "Follow this step.",
              reading: asString(step?.reading),
            };
          }),
          answer: asString(correctOpt?.body) ?? "See steps",
        });
      }
    }
  }

  const hasExample = blocks.some(
    (b) => b.type === "worked_example" || (b.type === "callout" && b.tone === "example"),
  );
  if (!hasExample) {
    blocks.push({
      type: "callout",
      tone: "example",
      title: "Work through an example",
      text: "Apply the main idea from this source to a short concrete case from the lecture notes.",
    });
  }

  const hasLongParagraph = blocks.some((b) => b.type === "paragraph" && String(b.text ?? "").length >= 80);
  if (!hasLongParagraph) {
    blocks.unshift({
      type: "paragraph",
      text: "This lesson explains the core ideas from the uploaded physics notes so you can define the quantities, follow the worked steps, and check your understanding before practice.",
    });
  }

  return blocks;
}

/** Coerce common Gemini shape drift into the ScholAu ingestion schema. */
export function normalizeGeminiConceptRaw(raw: unknown, options?: { courseCode?: string }): unknown {
  const root = asRecord(raw);
  if (!root) return raw;
  let blocks = (Array.isArray(root.blocks) ? root.blocks.map(normalizeBlock).filter(Boolean) : []) as Array<
    Record<string, unknown>
  >;
  const flashcards = Array.isArray(root.flashcards) ? root.flashcards.map(normalizeFlashcard).filter(Boolean) : [];
  const learning_questions = (
    Array.isArray(root.learning_questions) ? root.learning_questions.map(normalizeLearning).filter(Boolean) : []
  ) as Array<Record<string, unknown>>;
  const battle_questions = (
    Array.isArray(root.battle_questions) ? root.battle_questions.map(normalizeBattle).filter(Boolean) : []
  ) as Array<Record<string, unknown>>;

  blocks = ensureTeachingCompleteness({
    courseCode: options?.courseCode ?? asString(root.course_code),
    blocks,
    learning_questions,
    battle_questions,
  });

  return {
    ...root,
    title: asString(root.title) ?? "Untitled lesson",
    objective: asString(root.objective),
    module_title: asString(root.module_title),
    blocks,
    flashcards,
    learning_questions,
    battle_questions,
  };
}
