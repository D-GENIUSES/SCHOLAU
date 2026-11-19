import type { LecturerQuizExport, LecturerQuizExportRow, LecturerQuizQuestion } from "@scholau/core";

export const EXPORT_STATUS_LABELS: Record<LecturerQuizExportRow["status"], string> = {
  submitted: "Submitted",
  in_progress: "In progress",
  not_started: "Not started",
};

export function exportFileSlug(title: string): string {
  return title.replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || "quiz";
}

/** Neutralise spreadsheet formula injection. */
export function safeExportText(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return text;
}

export function formatExportDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseExportDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type QuizCohortStats = {
  enrolled: number;
  submitted: number;
  inProgress: number;
  notStarted: number;
  averagePercent: number | null;
  highestPercent: number | null;
  lowestPercent: number | null;
};

export function quizCohortStats(rows: LecturerQuizExportRow[]): QuizCohortStats {
  const submitted = rows.filter((r) => r.status === "submitted");
  const percents = submitted
    .map((r) => (r.score != null && r.total > 0 ? (100 * r.score) / r.total : null))
    .filter((v): v is number => v !== null);
  const averagePercent = percents.length
    ? Math.round((percents.reduce((a, b) => a + b, 0) / percents.length) * 10) / 10
    : null;
  return {
    enrolled: rows.length,
    submitted: submitted.length,
    inProgress: rows.filter((r) => r.status === "in_progress").length,
    notStarted: rows.filter((r) => r.status === "not_started").length,
    averagePercent,
    highestPercent: percents.length ? Math.max(...percents) : null,
    lowestPercent: percents.length ? Math.min(...percents) : null,
  };
}

export type QuestionAnalysisRow = {
  index: number;
  prompt: string;
  correctOption: string;
  answered: number;
  correctCount: number;
  percentCorrect: number | null;
};

export function questionAnalysis(data: LecturerQuizExport): QuestionAnalysisRow[] {
  return data.questions.map((question, index) => {
    let answered = 0;
    let correctCount = 0;
    for (const row of data.rows) {
      if (row.status !== "submitted") continue;
      const pick = row.answers[String(index)];
      if (pick === undefined) continue;
      answered += 1;
      if (pick === question.correct) correctCount += 1;
    }
    return {
      index: index + 1,
      prompt: truncatePrompt(question.prompt),
      correctOption: question.options?.[question.correct ?? 0] ?? question.expected_answer ?? "",
      answered,
      correctCount,
      percentCorrect: answered > 0 ? Math.round((1000 * correctCount) / answered) / 10 : null,
    };
  });
}

function truncatePrompt(text: string, max = 120): string {
  const t = text.trim().replace(/\s+/g, " ");
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

function studentAnswerText(
  question: LecturerQuizQuestion,
  row: LecturerQuizExportRow,
  index: number,
): string {
  const pick = row.answers[String(index)];
  if (pick === undefined) return "";
  return typeof pick === "number" ? question.options?.[pick] ?? String(pick) : String(pick);
}

function studentCorrectMark(
  question: LecturerQuizQuestion,
  row: LecturerQuizExportRow,
  index: number,
): string {
  if (row.status !== "submitted") return "";
  const pick = row.answers[String(index)];
  if (pick === undefined || question.correct === undefined) return "";
  return pick === question.correct ? "Yes" : "No";
}

export function buildQuizResultsCsv(data: LecturerQuizExport, perQuestion: boolean): string {
  const qCount = data.questions.length;
  const headers = [
    "Matric",
    "Name",
    "Department",
    "Status",
    "Attempt",
    "Score",
    "Total",
    "Percent",
    "Submitted at",
    ...(perQuestion
      ? [
          ...Array.from({ length: qCount }, (_, i) => `Q${i + 1} response`),
          ...Array.from({ length: qCount }, (_, i) => `Q${i + 1} correct`),
        ]
      : []),
  ];
  const body = data.rows.map((row) => {
    const percent =
      row.score != null && row.total > 0 ? String(Math.round((100 * row.score) / row.total)) : "";
    const base: unknown[] = [
      row.matric_number,
      row.name,
      row.department,
      EXPORT_STATUS_LABELS[row.status] ?? row.status,
      row.attempt_number ?? "",
      row.score ?? "",
      row.total,
      percent,
      formatExportDateTime(row.submitted_at),
    ];
    if (!perQuestion) return base;
    const answers = Array.from({ length: qCount }, (_, i) => studentAnswerText(data.questions[i]!, row, i));
    const correct = Array.from({ length: qCount }, (_, i) => studentCorrectMark(data.questions[i]!, row, i));
    return [...base, ...answers, ...correct];
  });
  return `\uFEFF${rowsToCsv([headers, ...body])}`;
}

function rowsToCsv(rows: readonly (readonly unknown[])[]): string {
  const escapeCell = (value: unknown): string => {
    const s = safeExportText(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadBlob(filename: string, data: BlobPart, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

const EXCEL_HEADER_FILL = "FFE8EEF2";

function styleHeaderRow(row: import("exceljs").Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", wrapText: true };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: EXCEL_HEADER_FILL } };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFB8C4CE" } },
    };
  });
}

function autoWidth(sheet: import("exceljs").Worksheet, min = 10, max = 48) {
  const widths = new Map<number, number>();
  sheet.eachRow((row) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const raw = cell.value;
      const text = raw instanceof Date
        ? formatExportDateTime(raw.toISOString())
        : safeExportText(raw);
      const next = Math.min(max, Math.max(min, text.length + 2));
      widths.set(colNumber, Math.max(widths.get(colNumber) ?? min, next));
    });
  });
  for (const [colNumber, width] of widths) sheet.getColumn(colNumber).width = width;
}

export async function buildQuizResultsWorkbook(data: LecturerQuizExport): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const stats = quizCohortStats(data.rows);
  const analysis = questionAnalysis(data);
  const exportedAt = new Date();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Scholau";
  wb.created = exportedAt;

  const summary = wb.addWorksheet("Summary", { views: [{ state: "frozen", ySplit: 1 }] });
  summary.addRow(["Quiz results export"]);
  summary.getCell("A1").font = { bold: true, size: 14 };
  summary.addRow([]);
  const meta: [string, string | number][] = [
    ["Quiz title", safeExportText(data.quiz.title)],
    ["Exported at", formatExportDateTime(exportedAt.toISOString())],
    ["Opens", formatExportDateTime(data.quiz.opens_at)],
    ["Closes", formatExportDateTime(data.quiz.closes_at)],
    ["Duration (minutes)", data.quiz.duration_minutes],
    ["Max attempts", data.quiz.max_attempts],
    ["Questions", data.questions.length],
    ["Enrolled", stats.enrolled],
    ["Submitted", stats.submitted],
    ["In progress", stats.inProgress],
    ["Not started", stats.notStarted],
    ["Class average (%)", stats.averagePercent ?? "—"],
    ["Highest score (%)", stats.highestPercent ?? "—"],
    ["Lowest score (%)", stats.lowestPercent ?? "—"],
  ];
  for (const [label, value] of meta) summary.addRow([label, value]);
  summary.getColumn(1).width = 22;
  summary.getColumn(2).width = 40;

  const results = wb.addWorksheet("Results", { views: [{ state: "frozen", ySplit: 1 }] });
  results.addRow([
    "Matric",
    "Name",
    "Department",
    "Status",
    "Attempt",
    "Score",
    "Total",
    "Percent",
    "Submitted at",
  ]);
  styleHeaderRow(results.getRow(1));
  for (const row of data.rows) {
    const percent = row.score != null && row.total > 0 ? row.score / row.total : null;
    const excelRow = results.addRow([
      safeExportText(row.matric_number),
      safeExportText(row.name),
      safeExportText(row.department),
      EXPORT_STATUS_LABELS[row.status] ?? row.status,
      row.attempt_number ?? "",
      row.score ?? "",
      row.total,
      percent,
      parseExportDate(row.submitted_at),
    ]);
    const percentCell = excelRow.getCell(8);
    if (typeof percent === "number") percentCell.numFmt = "0.0%";
    const submittedCell = excelRow.getCell(9);
    if (submittedCell.value instanceof Date) submittedCell.numFmt = "yyyy-mm-dd hh:mm";
  }
  autoWidth(results);

  const items = wb.addWorksheet("Item analysis", { views: [{ state: "frozen", ySplit: 1 }] });
  items.addRow(["Question", "Prompt", "Correct answer", "Answered", "Correct", "% correct"]);
  styleHeaderRow(items.getRow(1));
  for (const row of analysis) {
    const itemRow = items.addRow([
      row.index,
      safeExportText(row.prompt),
      safeExportText(row.correctOption),
      row.answered,
      row.correctCount,
      row.percentCorrect != null ? row.percentCorrect / 100 : "",
    ]);
    const pctCell = itemRow.getCell(6);
    if (row.percentCorrect != null) pctCell.numFmt = "0.0%";
  }
  autoWidth(items);

  const qCount = data.questions.length;
  if (qCount > 0) {
    const detail = wb.addWorksheet("Responses", { views: [{ state: "frozen", ySplit: 1 }] });
    const detailHeaders = [
      "Matric",
      "Name",
      "Status",
      "Score",
      "Percent",
      ...Array.from({ length: qCount }, (_, i) => `Q${i + 1}`),
      ...Array.from({ length: qCount }, (_, i) => `Q${i + 1} OK`),
    ];
    detail.addRow(detailHeaders);
    styleHeaderRow(detail.getRow(1));
    for (const row of data.rows) {
      const percent = row.score != null && row.total > 0 ? row.score / row.total : null;
      const answers = Array.from({ length: qCount }, (_, i) => safeExportText(studentAnswerText(data.questions[i]!, row, i)));
      const marks = Array.from({ length: qCount }, (_, i) => studentCorrectMark(data.questions[i]!, row, i));
      const detailRow = detail.addRow([
        safeExportText(row.matric_number),
        safeExportText(row.name),
        EXPORT_STATUS_LABELS[row.status] ?? row.status,
        row.score ?? "",
        percent,
        ...answers,
        ...marks,
      ]);
      const pctCell = detailRow.getCell(5);
      if (typeof percent === "number") pctCell.numFmt = "0.0%";
    }
    autoWidth(detail, 10, 36);
  }

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

export async function buildQuizResultsDocx(data: LecturerQuizExport): Promise<Blob> {
  const {
    AlignmentType,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import("docx");

  const stats = quizCohortStats(data.rows);
  const exportedAt = formatExportDateTime(new Date().toISOString());

  const metaParagraphs = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: safeExportText(data.quiz.title), bold: true })],
    }),
    new Paragraph({
      children: [new TextRun({ text: "Class quiz results", italics: true, color: "555555" })],
    }),
    new Paragraph({ text: `Exported: ${exportedAt}` }),
    new Paragraph({ text: `Window: ${formatExportDateTime(data.quiz.opens_at)} → ${formatExportDateTime(data.quiz.closes_at)}` }),
    new Paragraph({
      text: `Duration: ${data.quiz.duration_minutes} minutes · Questions: ${data.questions.length} · Max attempts: ${data.quiz.max_attempts}`,
    }),
    new Paragraph({
      text: `Enrolled ${stats.enrolled} · Submitted ${stats.submitted} · In progress ${stats.inProgress} · Not started ${stats.notStarted}`,
    }),
    new Paragraph({
      text: `Class average: ${stats.averagePercent ?? "—"}% · Highest: ${stats.highestPercent ?? "—"}% · Lowest: ${stats.lowestPercent ?? "—"}%`,
    }),
    new Paragraph({ text: "" }),
  ];

  const headerRow = new TableRow({
    tableHeader: true,
    children: ["Matric", "Name", "Department", "Status", "Score", "%", "Submitted"].map(
      (label) =>
        new TableCell({
          width: { size: 14, type: WidthType.PERCENTAGE },
          children: [new Paragraph({ children: [new TextRun({ text: label, bold: true })] })],
        }),
    ),
  });

  const bodyRows = data.rows.map((row) => {
    const percent =
      row.score != null && row.total > 0 ? `${Math.round((100 * row.score) / row.total)}%` : "—";
    const score = row.score != null ? `${row.score}/${row.total}` : "—";
    const cells = [
      safeExportText(row.matric_number),
      safeExportText(row.name),
      safeExportText(row.department),
      EXPORT_STATUS_LABELS[row.status] ?? row.status,
      score,
      percent,
      formatExportDateTime(row.submitted_at) || "—",
    ];
    return new TableRow({
      children: cells.map(
        (text) =>
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text })], alignment: AlignmentType.LEFT })],
          }),
      ),
    });
  });

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...bodyRows],
  });

  const closing = [
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [
        new TextRun({
          text: "Per-question responses and item analysis are available in the Excel export.",
          italics: true,
          color: "666666",
        }),
      ],
    }),
  ];

  const doc = new Document({
    title: `${data.quiz.title} — results`,
    sections: [{ properties: {}, children: [...metaParagraphs, table, ...closing] }],
  });

  return Packer.toBlob(doc);
}
