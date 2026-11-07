import { z } from "zod";
import type { BattleMix } from "./types";

export const topicOutlineSegmentSchema = z.object({
  lesson_position: z.number().int().min(1).max(12),
  lesson_title: z.string().min(1).max(200),
  source_hint: z.string().min(1).max(500),
  confidence: z.enum(["high", "medium", "low"]).optional(),
  lesson_id: z.string().uuid().optional(),
});

export const topicOutlineSchema = z.object({
  module_title: z.string().min(1).max(200),
  segments: z.array(topicOutlineSegmentSchema).min(1).max(12),
});

export type TopicOutline = z.infer<typeof topicOutlineSchema>;

export function parseTopicOutline(raw: unknown): TopicOutline {
  return topicOutlineSchema.parse(raw);
}

export type OutlineGenerateInput = {
  courseCode: string;
  moduleTitle: string;
  filename: string;
  mimeType: string;
  fileBytes: Buffer;
  lessonSlots: { position: number; title: string; lesson_id?: string }[];
  battleMix: BattleMix;
};

export function buildOutlineSystemPrompt(input: OutlineGenerateInput): string {
  const slots = input.lessonSlots
    .map((s) => `- position ${s.position}: "${s.title}"${s.lesson_id ? ` (existing lesson)` : ""}`)
    .join("\n");
  return `You segment an uploaded study source into lessons for one course topic. Return JSON only.
Course: ${input.courseCode}. Topic: ${input.moduleTitle}. Source file: ${input.filename}.
Existing lesson slots in this topic (use these positions and align titles when the source supports it):
${slots || "- (no lessons yet — propose up to 8 new lesson titles from the source)"}

Rules:
- Ground every segment in the uploaded file. Do not invent unrelated lessons.
- Each segment needs lesson_position (1-based within topic), lesson_title, source_hint (pages/sections).
- At most 12 segments. Prefer matching existing slot positions when content maps clearly.
- module_title may refine the topic title if the source suggests a clearer name.

JSON shape:
{
  "module_title": string,
  "segments": [{ "lesson_position": number, "lesson_title": string, "source_hint": string, "confidence": "high"|"medium"|"low" }]
}`;
}

export async function generateTopicOutlineFromSource(input: OutlineGenerateInput): Promise<TopicOutline> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_NOT_CONFIGURED: topic outline requires a configured Gemini API key.");
  }
  const { GoogleGenAI } = await import("@google/genai");
  const model = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildOutlineSystemPrompt(input);
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: input.mimeType, data: input.fileBytes.toString("base64") } },
          { text: prompt },
        ],
      },
    ],
    config: { responseMimeType: "application/json" },
  });
  const text = response.text?.trim();
  if (!text) throw new Error("Empty Gemini outline response");
  return parseTopicOutline(JSON.parse(text));
}
