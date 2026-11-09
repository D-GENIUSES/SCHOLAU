import "server-only";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const LOG_PATHS = [
  join(process.cwd(), "../../../debug-2deea9.log"),
  join(process.cwd(), "debug-2deea9.log"),
];

export async function agentDebugLogServer(payload: Record<string, unknown>) {
  const line = `${JSON.stringify({ sessionId: "2deea9", timestamp: Date.now(), ...payload })}\n`;
  for (const file of LOG_PATHS) {
    try {
      await mkdir(dirname(file), { recursive: true });
      await appendFile(file, line, "utf8");
      return file;
    } catch {
      /* try next path */
    }
  }
  return null;
}
