import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
register("tsx/esm", pathToFileURL("./"));

const { generateConceptFromSource } = await import("../src/ingestion/index.ts");
const pdf = join(root, "imports", "phy-101", "PHY101-CH-part1-p1-16.pdf");
const bytes = readFileSync(pdf);
const sha = createHash("sha256").update(bytes).digest("hex");

try {
  const concept = await generateConceptFromSource({
    courseCode: "PHY 101",
    sourceSha256: sha,
    filename: "PHY101-CH-part1-p1-16.pdf",
    mimeType: "application/pdf",
    moduleTitle: "Physics — Chapters 1–4 (pages 1–16)",
    modulePosition: 1,
    lessonPosition: 1,
    battleMix: { standard: 0.3, worked_solution: 0.3, fill_in_gap: 0.4 },
    fileBytes: bytes,
  });
  console.log("OK title:", concept.title);
  console.log(
    "blocks",
    concept.blocks?.length,
    "flash",
    concept.flashcards?.length,
    "learn",
    concept.learning_questions?.length,
    "battle",
    concept.battle_questions?.length,
  );
} catch (e) {
  console.error("FAIL:", e.message);
  console.error("cause:", e.cause?.message ?? e.cause);
  if (e.cause?.stack) console.error(String(e.cause.stack).slice(0, 2000));
  process.exit(1);
}
