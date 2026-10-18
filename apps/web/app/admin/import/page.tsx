"use client";

import { CheckCircle2, Download, FileUp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, useId, useState } from "react";
import { type ImportResult, newRequestKey } from "@scholau/api";
import { useAdminImport } from "@scholau/api/react";
import { formatNumber, pluralize } from "@scholau/core";
import { CsvParseError, csvToObjects, downloadText, toCsv } from "@/components/admin/csv";
import { type Column, DataTable } from "@/components/admin/data-table";
import { MutationError } from "@/components/admin/shared";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { LiveRegion, PageHeader } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";

type Kind = "questions" | "lessons";
type Row = Record<string, unknown>;

const ROW_LIMIT: Record<Kind, number> = { questions: 2000, lessons: 500 };
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const PREVIEW_ROWS = 20;
const ERROR_ROWS_SHOWN = 100;

const QUESTION_HEADERS = [
  "course_code",
  "logical_question_key",
  "pool",
  "usage",
  "difficulty",
  "prompt",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_option",
  "explanation",
  "source_reference",
  "lesson_id",
] as const;

const QUESTION_EXAMPLE = [
  "CSC101",
  "csc101-number-systems-001",
  "learning",
  "review|practice",
  "beginner",
  "What is the decimal value of the binary number 1010?",
  "8",
  "10",
  "12",
  "14",
  "B",
  "1010 in binary is 8 + 0 + 2 + 0, which is 10.",
  "CSC101 lecture notes, week 2",
  "",
];

const LESSON_TEMPLATE = [
  {
    course_code: "CSC101",
    module_position: 1,
    module_title: "Number systems",
    lesson_position: 1,
    title: "Binary numbers",
    objective: "Convert whole numbers between binary and decimal.",
    estimated_minutes: 10,
    blocks: [
      { type: "heading", text: "What is binary?", level: 2 },
      { type: "paragraph", text: "Binary is a base-2 number system that uses only the digits 0 and 1." },
      { type: "list", items: ["Each position is a power of 2.", "Read place values from right to left."] },
      { type: "callout", tone: "example", text: "1010 in binary is 8 + 2 = 10 in decimal." },
    ],
    source_reference: "CSC101 lecture notes, week 2",
  },
];

const PREVIEW_FIELDS: Record<Kind, string[]> = {
  questions: ["course_code", "logical_question_key", "pool", "usage", "difficulty", "prompt", "correct_option"],
  lessons: ["course_code", "module_position", "lesson_position", "title", "estimated_minutes", "blocks"],
};

type Parsed = { ok: true; rows: Row[]; format: "csv" | "json" } | { ok: false; message: string };

function parseInput(text: string, kind: Kind): Parsed {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: "The file or pasted text is empty." };
  const looksJson = trimmed.startsWith("[") || trimmed.startsWith("{");
  let rows: Row[];
  let format: "csv" | "json";
  if (looksJson) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch (e) {
      return { ok: false, message: `Invalid JSON: ${e instanceof Error ? e.message : "it could not be parsed."}` };
    }
    if (!Array.isArray(data)) return { ok: false, message: "The JSON must be an array of row objects, like [ {…}, {…} ]." };
    const bad = data.findIndex((r) => !r || typeof r !== "object" || Array.isArray(r));
    if (bad >= 0) return { ok: false, message: `Item ${bad + 1} in the JSON array is not an object.` };
    rows = data as Row[];
    format = "json";
  } else {
    if (kind === "lessons") return { ok: false, message: "Lesson imports must be a JSON array of lesson objects. Download the template to see the format." };
    try {
      rows = csvToObjects(text).rows;
    } catch (e) {
      if (e instanceof CsvParseError) return { ok: false, message: `CSV error on line ${e.line}: ${e.message}` };
      return { ok: false, message: "The CSV could not be parsed." };
    }
    format = "csv";
  }
  if (rows.length === 0) return { ok: false, message: "No data rows found. Include a header row and at least one data row." };
  if (rows.length > ROW_LIMIT[kind]) {
    return {
      ok: false,
      message: `This import has ${formatNumber(rows.length)} rows. The limit is ${formatNumber(ROW_LIMIT[kind])} ${kind === "questions" ? "question" : "lesson"} rows per import — split it into smaller files.`,
    };
  }
  return { ok: true, rows, format };
}

function display(value: unknown, field: string): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "blocks") return Array.isArray(value) ? pluralize(value.length, "block") : "Not a list";
  if (Array.isArray(value)) return value.map(String).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  const s = String(value);
  return s.length > 140 ? `${s.slice(0, 140)}…` : s;
}

interface Validation {
  text: string;
  kind: Kind;
  rows: Row[];
  format: "csv" | "json";
  result: ImportResult;
}

function ErrorsPanel({ result, kind }: { result: ImportResult; kind: Kind }) {
  if (result.errors.length === 0) return null;
  const columns: Column<ImportResult["errors"][number]>[] = [
    { key: "row", header: "Row", cell: (e) => e.row },
    { key: "field", header: "Field", cell: (e) => <code className="font-mono">{e.field}</code> },
    { key: "message", header: "Message", cell: (e) => e.message },
  ];
  const shown = result.errors.slice(0, ERROR_ROWS_SHOWN);
  return (
    <section aria-labelledby="row-errors-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="row-errors-heading" className="font-bold">
          Row errors
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadText(
              `scholau-${kind}-import-errors.csv`,
              toCsv([["row", "field", "message"], ...result.errors.map((e) => [e.row, e.field, e.message])]),
            )
          }
        >
          <Download className="size-4" aria-hidden /> Download errors CSV
        </Button>
      </div>
      <DataTable caption="Row errors" columns={columns} rows={shown} rowKey={(e) => `${e.row}-${e.field}-${e.message}`} />
      {result.errors.length > shown.length ? (
        <p className="text-sm text-ink-muted">
          Showing the first {ERROR_ROWS_SHOWN} of {formatNumber(result.errors.length)} errors. Download the CSV for the full list.
        </p>
      ) : null}
    </section>
  );
}

function PreviewTable({ rows, kind }: { rows: Row[]; kind: Kind }) {
  const fields = PREVIEW_FIELDS[kind];
  const indexed = rows.slice(0, PREVIEW_ROWS).map((r, i) => ({ n: i + 1, r }));
  const columns: Column<(typeof indexed)[number]>[] = [
    { key: "n", header: "Row", cell: (x) => x.n },
    ...fields.map((f) => ({ key: f, header: f, cell: (x: (typeof indexed)[number]) => display(x.r[f], f) })),
  ];
  return (
    <section aria-labelledby="preview-heading" className="flex flex-col gap-3">
      <h3 id="preview-heading" className="font-bold">
        Preview{rows.length > PREVIEW_ROWS ? ` (first ${PREVIEW_ROWS} of ${formatNumber(rows.length)} rows)` : ""}
      </h3>
      <DataTable caption="Parsed rows preview" columns={columns} rows={indexed} rowKey={(x) => String(x.n)} />
    </section>
  );
}

function CreatedList({ result, kind }: { result: ImportResult; kind: Kind }) {
  const idKey = kind === "questions" ? "question_version_id" : "lesson_version_id";
  const shown = result.created.slice(0, 50);
  return (
    <div className="flex flex-col gap-3">
      <Alert tone="success" title={`Imported ${pluralize(result.created.length, "draft version")}`} role="status">
        Nothing is live yet. Review each draft and publish it when it&apos;s correct.
      </Alert>
      <ul className="flex flex-col gap-1 text-sm">
        {shown.map((c, i) => (
          <li key={String(c[idKey] ?? i)} className="break-words">
            Row {String(c.row ?? i + 1)} → version {String(c.version ?? "?")}{" "}
            <code className="break-all font-mono text-ink-muted">{String(c[idKey] ?? "")}</code>
          </li>
        ))}
      </ul>
      {result.created.length > shown.length ? (
        <p className="text-sm text-ink-muted">…and {formatNumber(result.created.length - shown.length)} more.</p>
      ) : null}
      <div>
        <Button asChild>
          <Link href={`/admin/review?tab=${kind}&status=draft`}>Review drafts</Link>
        </Button>
      </div>
    </div>
  );
}

export default function AdminImportPage() {
  const textId = useId();
  const fileId = useId();
  const [kind, setKind] = useState<Kind>("questions");
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [intent, setIntent] = useState<{ text: string; key: string } | null>(null);
  const [imported, setImported] = useState<{ text: string; result: ImportResult } | null>(null);
  const mutation = useAdminImport(kind);

  const pendingDryRun = mutation.isPending && mutation.variables?.dryRun === true;
  const pendingImport = mutation.isPending && mutation.variables?.dryRun === false;
  const errorPhase = mutation.isError ? (mutation.variables?.dryRun ? "validate" : "import") : null;
  const current = validation && validation.text === text && validation.kind === kind ? validation : null;
  const stale = validation !== null && current === null;
  const importedCurrent = imported && imported.text === text ? imported.result : null;
  const canImport = Boolean(current?.result.valid) && !importedCurrent?.imported && !mutation.isPending;

  const resetResults = () => {
    setParseError(null);
    setValidation(null);
    setImported(null);
    setIntent(null);
    mutation.reset();
  };

  const changeKind = (k: Kind) => {
    setKind(k);
    setText("");
    setFileName(null);
    resetResults();
  };

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    resetResults();
    if (file.size === 0) {
      setParseError("The file is empty.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setParseError("The file is larger than 10 MB. Split it into smaller imports.");
      return;
    }
    try {
      setText(await file.text());
      setFileName(file.name);
    } catch {
      setParseError("The file couldn't be read. Try again or paste its contents.");
    }
  };

  const validate = () => {
    setImported(null);
    setIntent(null);
    const parsed = parseInput(text, kind);
    if (!parsed.ok) {
      setValidation(null);
      setParseError(parsed.message);
      return;
    }
    setParseError(null);
    const snapshot = text;
    const snapshotKind = kind;
    mutation.mutate(
      { rows: parsed.rows, dryRun: true },
      { onSuccess: (result) => setValidation({ text: snapshot, kind: snapshotKind, rows: parsed.rows, format: parsed.format, result }) },
    );
  };

  const runImport = () => {
    if (!current) return;
    const key = intent && intent.text === text ? intent.key : newRequestKey();
    if (!intent || intent.text !== text) setIntent({ text, key });
    const snapshot = text;
    mutation.mutate(
      { rows: current.rows, dryRun: false, requestKey: key },
      { onSuccess: (result) => setImported({ text: snapshot, result }) },
    );
  };

  const downloadTemplate = () => {
    if (kind === "questions") downloadText("scholau-questions-template.csv", toCsv([QUESTION_HEADERS, QUESTION_EXAMPLE]));
    else downloadText("scholau-lessons-template.json", `${JSON.stringify(LESSON_TEMPLATE, null, 2)}\n`, "application/json;charset=utf-8");
  };

  const validRows = current ? current.result.row_count - new Set(current.result.errors.map((e) => e.row)).size : 0;

  return (
    <>
      <Alert tone="info" title="Battle question formats">
        Battle questions need exactly four options. In JSON, set answer_format to standard or worked_solution.
        For worked solutions, give each option a steps array and put its final answer in body.
        Optional battle_seconds accepts 5, 8, 10, 12 or 15. Optional battle_reading_seconds accepts 2–12. Automatic suggestions consider difficulty, format and the full question, options and steps.
        Review reading time and plausible distractors before publishing.
      </Alert>
      <PageHeader eyebrow="Admin" title="Import content" description="Bulk-create draft questions or lessons from a file." />

      <Alert tone="info" title="Imports create drafts only" className="mb-6">
        Nothing is published until you review and publish it. Re-importing an existing key replaces its current draft, or
        creates a new draft version if the latest version is already published.
      </Alert>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Choose what to import</CardTitle>
            <CardDescription>
              Questions accept CSV or JSON (max {formatNumber(ROW_LIMIT.questions)} rows). Lessons accept JSON (max{" "}
              {formatNumber(ROW_LIMIT.lessons)} rows).
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="max-w-full overflow-x-auto">
              <Segmented
                name="import-kind"
                legend="Content type"
                value={kind}
                onChange={changeKind}
                options={[
                  { value: "questions", label: "Questions" },
                  { value: "lessons", label: "Lessons" },
                ]}
              />
            </div>
            <div>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="size-4" aria-hidden />
                {kind === "questions" ? "Download question CSV template" : "Download lesson JSON template"}
              </Button>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={fileId} className="text-sm font-semibold text-ink">
                Upload a file
              </label>
              <p id={`${fileId}-hint`} className="text-sm text-ink-muted">
                {kind === "questions" ? ".csv or .json" : ".json"} — or paste the contents below.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  id={fileId}
                  type="file"
                  accept={kind === "questions" ? ".csv,.json,text/csv,application/json" : ".json,application/json"}
                  aria-describedby={`${fileId}-hint`}
                  onChange={onFile}
                  className="block w-full max-w-full text-sm file:mr-3 file:min-h-11 file:cursor-pointer file:rounded-control file:border file:border-line file:bg-surface-card file:px-4 file:font-semibold file:text-ink hover:file:bg-surface-page sm:w-auto"
                />
                {fileName ? (
                  <span className="inline-flex items-center gap-1 text-sm text-ink-muted">
                    <FileUp className="size-4" aria-hidden /> Loaded {fileName}
                  </span>
                ) : null}
              </div>
            </div>

            <Field id={textId} label="File contents" hint="Edit or paste here. Changing the contents requires validating again.">
              <Textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setFileName(null);
                  setParseError(null);
                }}
                spellCheck={false}
                className="min-h-56 font-mono text-sm"
                placeholder={kind === "questions" ? `${QUESTION_HEADERS.join(",")}\n…` : "[ { \"course_code\": \"…\", … } ]"}
              />
            </Field>

            {parseError ? (
              <Alert tone="error" title="We couldn't read this input" role="alert">
                {parseError}
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 1 · Validate</CardTitle>
            <CardDescription>A dry run checks every row on the server without saving anything.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <Button onClick={validate} loading={pendingDryRun} disabled={mutation.isPending || !text.trim()}>
                <ShieldCheck className="size-4" aria-hidden /> Validate
              </Button>
            </div>
            {errorPhase === "validate" ? <MutationError error={mutation.error} /> : null}
            {stale ? (
              <Alert tone="warning" title="The input changed">
                Validate again before importing.
              </Alert>
            ) : null}
            {current ? (
              <>
                <LiveRegion>
                  {current.result.valid
                    ? `All ${current.result.row_count} rows are valid.`
                    : `${current.result.error_count} errors found in ${current.result.row_count} rows.`}
                </LiveRegion>
                {current.result.valid ? (
                  <Alert tone="success" title={`All ${pluralize(current.result.row_count, "row")} are valid`}>
                    Parsed as {current.format.toUpperCase()}. You can import them as drafts.
                  </Alert>
                ) : (
                  <Alert tone="error" title={`${pluralize(current.result.error_count, "error")} found`}>
                    Fix the rows below and validate again. Nothing is imported unless every row is valid.
                  </Alert>
                )}
                <dl className="grid grid-cols-3 gap-3">
                  <div className="rounded-control border border-line p-3">
                    <dt className="text-sm text-ink-muted">Rows</dt>
                    <dd className="text-lg font-bold">{formatNumber(current.result.row_count)}</dd>
                  </div>
                  <div className="rounded-control border border-line p-3">
                    <dt className="text-sm text-ink-muted">Valid</dt>
                    <dd className="text-lg font-bold">{formatNumber(validRows)}</dd>
                  </div>
                  <div className="rounded-control border border-line p-3">
                    <dt className="text-sm text-ink-muted">Invalid</dt>
                    <dd className="text-lg font-bold">{formatNumber(current.result.row_count - validRows)}</dd>
                  </div>
                </dl>
                <ErrorsPanel result={current.result} kind={kind} />
                <PreviewTable rows={current.rows} kind={kind} />
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Step 2 · Import as drafts</CardTitle>
            <CardDescription>Available after a successful validation of the exact input above.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {errorPhase === "import" ? (
              <>
                <MutationError error={mutation.error} />
                <p className="text-sm text-ink-muted">Retrying reuses the same import request, so rows won&apos;t be created twice.</p>
              </>
            ) : null}
            {importedCurrent && !importedCurrent.imported ? (
              <>
                <Alert tone="error" title="Nothing was imported" role="alert">
                  The server found {pluralize(importedCurrent.error_count, "error")} at import time. Fix them and validate again.
                </Alert>
                <ErrorsPanel result={importedCurrent} kind={kind} />
              </>
            ) : null}
            {importedCurrent?.imported ? <CreatedList result={importedCurrent} kind={kind} /> : null}
          </CardContent>
          {!importedCurrent?.imported ? (
            <CardFooter>
              <Button onClick={runImport} disabled={!canImport} loading={pendingImport}>
                <CheckCircle2 className="size-4" aria-hidden />
                {current?.result.valid ? `Import ${pluralize(current.result.row_count, "row")} as drafts` : "Import as drafts"}
              </Button>
            </CardFooter>
          ) : null}
        </Card>
      </div>
    </>
  );
}
