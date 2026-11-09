import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { NextResponse } from "next/server";

const routeDir = dirname(fileURLToPath(import.meta.url));
const LOG_CANDIDATES = [
  join(routeDir, "../../../../../../../debug-2deea9.log"),
  join(routeDir, "../../../../debug-2deea9.log"),
  join(process.cwd(), "debug-2deea9.log"),
  join(process.cwd(), "../../../debug-2deea9.log"),
];

async function writeLog(line: string) {
  let lastError: unknown;
  for (const file of LOG_CANDIDATES) {
    try {
      await mkdir(dirname(file), { recursive: true });
      await appendFile(file, line, "utf8");
      return file;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Dev / explicit debug: NDJSON agent session logs. */
export async function POST(request: Request) {
  const debugSession = request.headers.get("x-debug-session-id");
  const allowed =
    process.env.NODE_ENV !== "production" || process.env.SCHOLAU_AGENT_DEBUG === "1" || debugSession === "2deea9";
  if (!allowed) return NextResponse.json({ ok: false }, { status: 404 });
  try {
    const payload = await request.json();
    const file = await writeLog(`${JSON.stringify(payload)}\n`);
    return NextResponse.json({ ok: true, file });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
