export class CsvParseError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(message);
    this.name = "CsvParseError";
  }
}

/** RFC 4180 parser: quoted fields, escaped quotes (""), CRLF/LF/CR line breaks, optional UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let quoteStartLine = 1;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;

  const endRow = () => {
    row.push(field);
    rows.push(row);
    row = [];
    field = "";
  };

  for (; i < text.length; i++) {
    const c = text.charAt(i);
    if (inQuotes) {
      if (c === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (c === "\n") line++;
        field += c;
      }
      continue;
    }
    if (c === '"') {
      if (field.length > 0) throw new CsvParseError("A quote appeared inside an unquoted field.", line);
      inQuotes = true;
      quoteStartLine = line;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" || c === "\n") {
      if (c === "\r" && text.charAt(i + 1) === "\n") i++;
      endRow();
      line++;
    } else {
      field += c;
    }
  }
  if (inQuotes) throw new CsvParseError("A quoted field was never closed.", quoteStartLine);
  if (field.length > 0 || row.length > 0) endRow();
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** First row is the header (names trimmed); each following row becomes an object keyed by header. */
export function csvToObjects(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const table = parseCsv(text);
  const [headerRow, ...body] = table;
  if (!headerRow) return { headers: [], rows: [] };
  const headers = headerRow.map((h) => h.trim());
  if (headers.some((h) => h === "")) throw new CsvParseError("The header row has an empty column name.", 1);
  const dup = headers.find((h, idx) => headers.indexOf(h) !== idx);
  if (dup) throw new CsvParseError(`The header "${dup}" appears more than once.`, 1);
  const rows = body.map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] ?? "";
    });
    return obj;
  });
  return { headers, rows };
}

function escapeCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  // Neutralise spreadsheet formula injection when the file is opened in Excel/Sheets.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map((r) => r.map(escapeCell).join(",")).join("\r\n") + "\r\n";
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
