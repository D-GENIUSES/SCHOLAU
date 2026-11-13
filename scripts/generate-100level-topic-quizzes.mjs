/**
 * Generate 20 fresh learning/practice MCQs per published 100-level lesson that has teaching text,
 * import + publish into the topic-quiz bank.
 *
 * Usage:
 *   node --env-file=apps/web/.env.local --import tsx scripts/generate-100level-topic-quizzes.mjs
 *
 * Env:
 *   COURSE_FILTER=BIO 101,COS 101   only these course codes
 *   LIMIT=3                         process at most N lessons (smoke)
 *   MIN_TEXT_LEN=200                skip thin lessons
 *   QUESTION_COUNT=20               10–30
 *   ONLY_NEED_TOPUP=0               1 = skip lessons that already have ≥ QUESTION_COUNT practice items
 *   DRY_RUN=1                       generate only, do not import
 *   SLEEP_MS=1500                   pause between Gemini calls
 *   GEMINI_API_KEYS=key1,key2       rotate keys on quota / 429 (preferred)
 *   FORCE_GEMINI_MODEL=gemini-3.8-flash  override model after .env.local
 */
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { generateQuizQuestionsFromTopics } from "../packages/core/src/ingestion/gemini-quiz-from-topics.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const progressPath = join(root, ".content-sync", "100level-topic-quiz-progress.json");
const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
const questionCount = Math.min(30, Math.max(10, Number(process.env.QUESTION_COUNT ?? 20) || 20));
const minTextLen = Number(process.env.MIN_TEXT_LEN ?? 200) || 200;
const sleepMs = Math.max(0, Number(process.env.SLEEP_MS ?? 1500) || 0);
const limit = process.env.LIMIT ? Number(process.env.LIMIT) : null;
const dryRun = process.env.DRY_RUN === "1";
const onlyNeedTopup = process.env.ONLY_NEED_TOPUP !== "0";
const courseFilter = new Set(
  (process.env.COURSE_FILTER ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);
if (process.env.FORCE_GEMINI_MODEL) process.env.GEMINI_MODEL = process.env.FORCE_GEMINI_MODEL;

const apiKeys = [
  ...String(process.env.GEMINI_API_KEYS ?? "")
    .split(/[,\n;]+/)
    .map((s) => s.trim())
    .filter(Boolean),
  process.env.GEMINI_API_KEY,
].filter(Boolean);
const uniqueKeys = [...new Set(apiKeys)];
let keyIndex = 0;

function useApiKey(index = keyIndex) {
  if (!uniqueKeys.length) throw new Error("GEMINI_API_KEY or GEMINI_API_KEYS is required");
  keyIndex = ((index % uniqueKeys.length) + uniqueKeys.length) % uniqueKeys.length;
  process.env.GEMINI_API_KEY = uniqueKeys[keyIndex];
  return keyIndex;
}

function rotateApiKey(reason = "quota") {
  if (uniqueKeys.length < 2) return false;
  const prev = keyIndex;
  useApiKey(keyIndex + 1);
  console.warn(`Rotated Gemini API key ${prev + 1}/${uniqueKeys.length} → ${keyIndex + 1}/${uniqueKeys.length} (${reason})`);
  return true;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function is100LevelCode(code) {
  const match = String(code).match(/(\d{3})\s*$/);
  if (!match) return false;
  const n = Number(match[1]);
  return n >= 100 && n < 200;
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function runSql(sql, label) {
  const file = join(tmpdir(), `scholau-l100-quiz-${randomUUID()}.sql`);
  writeFileSync(file, sql, "utf8");
  try {
    if (label) console.log(label);
    const out = execSync(`npx supabase db query --linked -f "${file}"`, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      shell: true,
    });
    return out;
  } finally {
    try {
      unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

function parseQueryRows(output) {
  const start = output.indexOf("{");
  if (start < 0) throw new Error(`No JSON in SQL output:\n${output.slice(0, 500)}`);
  const parsed = JSON.parse(output.slice(start));
  return parsed.rows ?? [];
}

function loadProgress() {
  if (!existsSync(progressPath)) return { completed: {}, failed: {} };
  try {
    return JSON.parse(readFileSync(progressPath, "utf8"));
  } catch {
    return { completed: {}, failed: {} };
  }
}

function saveProgress(progress) {
  mkdirSync(dirname(progressPath), { recursive: true });
  writeFileSync(progressPath, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
}

function shuffleOptions(options, correctIndex) {
  const items = options.map((body, index) => ({ body, correct: index === correctIndex }));
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  const labels = ["A", "B", "C", "D"];
  const mapped = items.slice(0, 4).map((item, index) => ({
    label: labels[index],
    body: String(item.body).trim().slice(0, 1000),
    correct: item.correct,
  }));
  while (mapped.length < 4) {
    mapped.push({
      label: labels[mapped.length],
      body: `Option ${labels[mapped.length]}`,
      correct: false,
    });
  }
  const correct = mapped.find((item) => item.correct) ?? mapped[0];
  correct.correct = true;
  return {
    options: mapped.map(({ label, body }) => ({ label, body })),
    correct_option: correct.label,
  };
}

function toImportRows(lesson, questions) {
  const courseSlug = slug(lesson.course_code);
  const lessonSlug = slug(lesson.lesson_title || lesson.lesson_id).slice(0, 24);
  return questions.map((question, index) => {
    const opts = Array.isArray(question.options) ? question.options.map(String) : [];
    const correct = Number(question.correct) || 0;
    const four = shuffleOptions(opts.length >= 2 ? opts : ["A", "B", "C", "D"], Math.min(correct, Math.max(opts.length - 1, 0)));
    const n = String(index + 1).padStart(2, "0");
    return {
      logical_question_key: `l100-${courseSlug}-${lessonSlug}-${stamp}-${n}-learning`.slice(0, 120),
      pool: "learning",
      usage: ["review", "practice", "mock"],
      prompt: String(question.prompt).trim().slice(0, 2000),
      options: four.options,
      correct_option: four.correct_option,
      explanation: String(question.explanation || "Based on the published lesson content.").trim().slice(0, 4000) || "Based on the published lesson content.",
      course_code: lesson.course_code,
      lesson_id: lesson.lesson_id,
      difficulty: index % 5 === 0 ? "intermediate" : "beginner",
      source_reference: `Gemini renew ${stamp} · ${lesson.course_code} · ${lesson.lesson_title}`.slice(0, 240),
      answer_format: "standard",
    };
  });
}

function importAndPublish(rows) {
  const requestKey = randomUUID();
  const jsonLiteral = JSON.stringify(rows);
  if (jsonLiteral.includes("$l100q$")) throw new Error("Import JSON contains dollar-quote tag");
  const sql = `
do $body$
declare
  v_admin uuid;
  v_import jsonb;
  v_item jsonb;
  v_id uuid;
begin
  select user_id into v_admin from public.user_roles where role = 'admin' order by user_id limit 1;
  if v_admin is null then raise exception 'No administrator account'; end if;
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated', 'aal', 'aal1')::text, true);

  v_import := public.admin_import_questions_v1($l100q$${jsonLiteral}$l100q$::jsonb, false, '${requestKey}'::uuid);
  if coalesce(v_import->>'valid','false') <> 'true'
     or jsonb_array_length(coalesce(v_import->'created', '[]'::jsonb)) = 0 then
    raise exception 'Question import failed: %', v_import;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(v_import->'created', '[]'::jsonb)) loop
    v_id := (v_item->>'question_version_id')::uuid;
    perform public.admin_publish_v1('question_version', v_id, gen_random_uuid());
  end loop;

  raise notice 'Imported and published % questions', jsonb_array_length(v_import->'created');
end
$body$;
`;
  runSql(sql, `Import+publish ${rows.length} questions…`);
}

function listLessons() {
  const sql = `
with lvl as (
  select distinct c.id as course_id, c.code as course_code
  from public.courses c
  join public.course_offerings o on o.course_id = c.id and o.status = 'published'
  join public.levels lv on lv.id = o.level_id and lv.label = '100 Level'
  where c.active
),
lessons as (
  select
    c.course_code,
    l.id as lesson_id,
    coalesce(m.title, 'Course topics') as module_title,
    v.title as lesson_title,
    coalesce(v.objective, '') as objective,
    private.lesson_blocks_teaching_text(v.blocks) as text,
    length(coalesce(private.lesson_blocks_teaching_text(v.blocks), '')) as text_len
  from lvl c
  join public.lessons l on l.course_id = c.course_id
  join public.modules m on m.id = l.module_id
  join public.lesson_versions v on v.lesson_id = l.id and v.status = 'published'
),
counts as (
  select q.lesson_id, count(*)::int as practice_n
  from public.questions q
  join public.question_versions qv on qv.question_id = q.id and qv.status = 'published'
  where q.pool = 'learning'
    and q.lesson_id is not null
    and 'practice' = any(qv.usage)
  group by q.lesson_id
)
select
  l.course_code,
  l.lesson_id,
  l.module_title,
  l.lesson_title,
  l.objective,
  l.text,
  l.text_len,
  coalesce(c.practice_n, 0) as practice_n
from lessons l
left join counts c on c.lesson_id = l.lesson_id
where l.text_len >= ${minTextLen}
order by l.course_code, l.module_title, l.lesson_title;
`;
  return parseQueryRows(runSql(sql));
}

function isQuotaError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /RESOURCE_EXHAUSTED|"code":429|quota|rate-limits|Free Tier/i.test(message);
}

function isRetryableGeminiError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return isQuotaError(error) || /"code":503|high demand|UNAVAILABLE/i.test(message);
}

async function generateOnce(lesson) {
  useApiKey(keyIndex);
  return generateQuizQuestionsFromTopics({
    courseCode: lesson.course_code,
    sources: [
      {
        lesson_id: lesson.lesson_id,
        module_title: lesson.module_title || "Course topics",
        lesson_title: lesson.lesson_title || "Lesson",
        objective: lesson.objective || "",
        text: String(lesson.text || "").trim().slice(0, 12000),
      },
    ],
    questionCount,
  });
}

async function generateForLesson(lesson) {
  const text = String(lesson.text || "").trim().slice(0, 12000);
  if (text.length < minTextLen) throw new Error("Teaching text too short");
  const maxAttempts = Number(process.env.GEMINI_RETRIES ?? 6) || 6;
  let lastError = null;
  let quotaHits = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      let extracted = await generateOnce(lesson);
      let usable = extracted.questions.filter((q) => Array.isArray(q.options) && q.options.length >= 4);
      if (usable.length < Math.min(10, questionCount)) {
        extracted = await generateOnce(lesson);
        usable = extracted.questions.filter((q) => Array.isArray(q.options) && q.options.length >= 4);
      }
      if (usable.length < 10) {
        throw new Error(`Gemini returned only ${usable.length} four-option questions`);
      }
      return usable.slice(0, questionCount);
    } catch (error) {
      lastError = error;
      if (!isRetryableGeminiError(error) || attempt === maxAttempts) break;
      if (isQuotaError(error)) {
        quotaHits += 1;
        if (!rotateApiKey("429/quota") || quotaHits >= uniqueKeys.length) {
          throw new Error(
            `All ${uniqueKeys.length} Gemini API key(s) hit quota. Add more via GEMINI_API_KEYS and resume.`,
          );
        }
        continue;
      }
      const delay = Math.min(60_000, 5_000 * attempt);
      console.warn(`Retry ${attempt}/${maxAttempts} in ${delay}ms…`);
      await sleep(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function main() {
  useApiKey(0);
  const progress = loadProgress();
  // Retry previously failed lessons on resume.
  for (const lessonId of Object.keys(progress.failed ?? {})) {
    if (!progress.completed?.[lessonId]) delete progress.failed[lessonId];
  }
  saveProgress(progress);
  let lessons = listLessons().filter((row) => is100LevelCode(row.course_code));
  if (courseFilter.size) lessons = lessons.filter((row) => courseFilter.has(row.course_code));
  if (onlyNeedTopup) {
    lessons = lessons.filter((row) => Number(row.practice_n) < questionCount);
  }
  lessons = lessons.filter((row) => !progress.completed[row.lesson_id]);
  if (limit != null && Number.isFinite(limit)) lessons = lessons.slice(0, limit);

  console.log(
    JSON.stringify(
      {
        stamp,
        questionCount,
        dryRun,
        onlyNeedTopup,
        model: process.env.GEMINI_MODEL ?? "gemini-3-flash-preview",
        apiKeyCount: uniqueKeys.length,
        courses: [...new Set(lessons.map((l) => l.course_code))],
        lessonCount: lessons.length,
        alreadyDone: Object.keys(progress.completed).length,
      },
      null,
      2,
    ),
  );

  let ok = 0;
  let failed = 0;
  for (const [index, lesson] of lessons.entries()) {
    const label = `[${index + 1}/${lessons.length}] ${lesson.course_code} · ${lesson.lesson_title}`;
    try {
      console.log(`${label} — generating…`);
      const questions = await generateForLesson(lesson);
      const rows = toImportRows(lesson, questions);
      if (dryRun) {
        console.log(`${label} — dry-run kept ${rows.length} rows`);
      } else {
        importAndPublish(rows);
        console.log(`${label} — published ${rows.length}`);
      }
      progress.completed[lesson.lesson_id] = {
        course_code: lesson.course_code,
        title: lesson.lesson_title,
        count: rows.length,
        at: new Date().toISOString(),
      };
      delete progress.failed[lesson.lesson_id];
      saveProgress(progress);
      ok += 1;
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${label} — FAILED: ${message}`);
      progress.failed[lesson.lesson_id] = {
        course_code: lesson.course_code,
        title: lesson.lesson_title,
        error: message.slice(0, 500),
        at: new Date().toISOString(),
      };
      saveProgress(progress);
    }
    if (sleepMs && index < lessons.length - 1) await sleep(sleepMs);
  }

  console.log(JSON.stringify({ ok, failed, progressPath }, null, 2));
  if (failed > 0) process.exitCode = 1;
}

await main();
