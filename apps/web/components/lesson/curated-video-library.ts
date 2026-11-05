import type { LessonVideo } from "@scholau/api";

/**
 * Editorially selected YouTube embeds, matched only to lessons where the linked
 * video's published description covers the lesson's subject.
 * These are reference links, never copied or downloaded video assets.
 * Avoid automatically guessing a video for an unmatched lesson.
 */
const SOURCES: Record<string, { youtube_id: string; title: string; start_seconds?: number; end_seconds?: number }[]> = {
  "The cell and cell theory": [
    { youtube_id: "8IlzKri08kk", title: "Introduction to Cells: The Grand Cell Tour | Amoeba Sisters", start_seconds: 70, end_seconds: 195 },
  ],
  "Prokaryotic and eukaryotic cells": [
    { youtube_id: "8IlzKri08kk", title: "Prokaryotes and eukaryotes | Amoeba Sisters", start_seconds: 115, end_seconds: 195 },
  ],
  "Plant cells, animal cells, and a short review": [
    { youtube_id: "8IlzKri08kk", title: "Comparing plant and animal cells | Amoeba Sisters", start_seconds: 430, end_seconds: 500 },
  ],
  "Osmosis": [
    { youtube_id: "L-osEc07vMs", title: "Osmosis and Water Potential (Updated) | Amoeba Sisters", start_seconds: 59 },
  ],
  "Cell division and mitosis": [
    { youtube_id: "ShEzlXZPpPM", title: "Mitosis (Updated 2026) | Amoeba Sisters" },
  ],
  "Meiosis I and meiosis II": [
    { youtube_id: "VzDMG7ke69g", title: "Meiosis (Updated) | Amoeba Sisters", start_seconds: 216 },
  ],
  "Why cell division matters": [
    { youtube_id: "ShEzlXZPpPM", title: "Mitosis for growth and repair | Amoeba Sisters", start_seconds: 32, end_seconds: 85 },
  ],
  "What heredity is and why it matters": [
    { youtube_id: "8m6hHRlKwxY", title: "DNA, Chromosomes, Genes, and Traits | Amoeba Sisters" },
  ],
  "Genes, DNA, and how genes work": [
    { youtube_id: "8m6hHRlKwxY", title: "Genes, DNA, and heredity | Amoeba Sisters", start_seconds: 205 },
  ],
  "Chromosomes and their relationship to genes": [
    { youtube_id: "8m6hHRlKwxY", title: "Chromosomes and genes | Amoeba Sisters", start_seconds: 330 },
  ],
  "Arithmetic and weighted means": [
    { youtube_id: "XZo4xyJXCak", title: "Introduction to Statistics | The Organic Chemistry Tutor" },
  ],
  "Ungrouped median and mode": [
    { youtube_id: "XZo4xyJXCak", title: "Mean, median, mode, and range | The Organic Chemistry Tutor" },
  ],
  "Construct and interpret a box plot": [
    { youtube_id: "XZo4xyJXCak", title: "Box plots and quartiles | The Organic Chemistry Tutor" },
  ],
  "Select and draw graphs": [
    { youtube_id: "XZo4xyJXCak", title: "Statistical charts and graphs | The Organic Chemistry Tutor" },
  ],
  "Build and verify frequency distributions": [
    { youtube_id: "XZo4xyJXCak", title: "Frequency distributions and tables | The Organic Chemistry Tutor" },
  ],
};
export function curatedVideosForLesson(title: string): LessonVideo[] {
  return (SOURCES[title.trim()] ?? []).map((v) => ({
    id: "editorial-" + v.youtube_id + "-" + (v.start_seconds ?? 0),
    youtube_id: v.youtube_id,
    title: v.title,
    start_seconds: v.start_seconds ?? 0,
    end_seconds: v.end_seconds ?? null,
  }));
}
