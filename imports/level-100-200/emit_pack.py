"""Validate and write the admin import files plus README."""
import json
import re
from collections import defaultdict
from pathlib import Path

import build_import
import more_courses  # noqa: F401
import rest_courses  # noqa: F401
import sen_cos  # noqa: F401

from build_import import (
    BATTLE_SECONDS,
    BLOCK_TYPES,
    CATALOGUE,
    DIFFS,
    PREP,
    TONES,
    COURSES,
)

LABELS = "ABCD"


def slug(code):
    return re.sub(r"[^a-z0-9]+", "-", code.lower()).strip("-")


def clip(text, limit):
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "."


def emit():
    lessons = []
    questions = []
    errors = []
    seen_lessons = set()
    seen_keys = set()
    for course in COURSES:
        code = course["code"]
        if code not in CATALOGUE:
            errors.append(f"unknown course {code}")
        for mi, chapter in enumerate(course["chapters"], 1):
            for li, item in enumerate(chapter["lessons"], 1):
                pos = (code, mi, li)
                if pos in seen_lessons:
                    errors.append(f"duplicate lesson {pos}")
                seen_lessons.add(pos)
                row = {
                    "course_code": code,
                    "module_position": mi,
                    "module_title": clip(chapter["title"], 200),
                    "lesson_position": li,
                    "title": clip(item["title"], 200),
                    "objective": clip(item["objective"], 1000),
                    "estimated_minutes": int(item["minutes"]),
                    "blocks": item["blocks"],
                    "source_reference": chapter["source"],
                }
                lessons.append(row)
                groups = (
                    ("practice", item["practice"], "learning", ["review", "practice"], ""),
                    ("mock", item["mock"], "learning", ["mock"], ""),
                    ("battle", item["battle"], "battle", ["battle"], "10"),
                )
                for kind, bank, pool, usage, seconds in groups:
                    for n, question in enumerate(bank, 1):
                        key = f"au-l100200-{slug(code)}-c{mi:02d}-l{li:02d}-{kind[0]}{n:02d}"
                        if len(key) > 120 or key in seen_keys:
                            errors.append(f"bad key {key}")
                        seen_keys.add(key)
                        options = question["options"]
                        correct = question["correct"]
                        try:
                            index = options.index(correct)
                        except ValueError:
                            errors.append(f"{key} correct not in options")
                            index = 0
                        record = {
                            "course_code": code,
                            "logical_question_key": key,
                            "pool": pool,
                            "usage": usage,
                            "difficulty": question["difficulty"],
                            "prompt": clip(question["prompt"], 2000),
                            "option_a": clip(options[0], 1000),
                            "option_b": clip(options[1], 1000),
                            "option_c": clip(options[2], 1000),
                            "option_d": clip(options[3], 1000),
                            "correct_option": LABELS[index],
                            "explanation": clip(question["explanation"], 4000),
                            "source_reference": f"{chapter['source']} | {chapter['title']} | {item['title']}",
                            "answer_format": "standard",
                            "module_position": mi,
                            "module_title": chapter["title"],
                            "lesson_position": li,
                            "lesson_title": item["title"],
                        }
                        if seconds:
                            record["battle_seconds"] = int(seconds)
                            record["battle_reading_seconds"] = 6
                        questions.append(record)
    return lessons, questions, errors


def validate(lessons, questions):
    problems = []
    for i, row in enumerate(lessons, 1):
        if row["course_code"] not in CATALOGUE:
            problems.append(f"lesson {i} course")
        if row["module_position"] < 1 or row["lesson_position"] < 1 or row["estimated_minutes"] < 1:
            problems.append(f"lesson {i} position")
        for field, limit in (("module_title", 200), ("title", 200), ("objective", 1000)):
            if not 1 <= len(row[field]) <= limit:
                problems.append(f"lesson {i} {field}")
        if not row["source_reference"].strip():
            problems.append(f"lesson {i} source")
        blocks = row["blocks"]
        if not isinstance(blocks, list) or not blocks:
            problems.append(f"lesson {i} blocks")
            continue
        for b, block in enumerate(blocks, 1):
            kind = block.get("type")
            if kind not in BLOCK_TYPES:
                problems.append(f"lesson {i} block {b} type")
            if kind in {"paragraph", "heading", "callout"} and not block.get("text"):
                problems.append(f"lesson {i} block {b} text")
            if kind == "heading" and block.get("level") not in (2, 3, 4):
                problems.append(f"lesson {i} heading level")
            if kind == "list":
                items = block.get("items")
                if not isinstance(items, list) or not items or not all(isinstance(x, str) and x for x in items):
                    problems.append(f"lesson {i} list")
            if kind == "callout" and block.get("tone") not in TONES:
                problems.append(f"lesson {i} tone")
            blob = json.dumps(block)
            if re.search(r"<\s*(script|iframe|object|embed|style)", blob, re.I):
                problems.append(f"lesson {i} html")
    seen = set()
    for i, row in enumerate(questions, 1):
        if row["pool"] not in {"learning", "battle"}:
            problems.append(f"q {i} pool")
        usage = row["usage"]
        if row["pool"] == "battle" and usage != ["battle"]:
            problems.append(f"q {i} battle usage")
        if row["pool"] == "learning" and ("battle" in usage or not usage):
            problems.append(f"q {i} learning usage")
        if row["difficulty"] not in DIFFS:
            problems.append(f"q {i} difficulty")
        if not 1 <= len(row["prompt"]) <= 2000:
            problems.append(f"q {i} prompt")
        if not 1 <= len(row["explanation"]) <= 4000:
            problems.append(f"q {i} explanation")
        bodies = [row["option_a"], row["option_b"], row["option_c"], row["option_d"]]
        if any(not 1 <= len(x) <= 1000 for x in bodies) or len(set(bodies)) != 4:
            problems.append(f"q {i} options")
        if row["correct_option"] not in LABELS:
            problems.append(f"q {i} correct")
        if row.get("battle_seconds") not in (None, *BATTLE_SECONDS) and "battle_seconds" in row:
            if row["battle_seconds"] not in BATTLE_SECONDS:
                problems.append(f"q {i} seconds")
        ident = (row["course_code"], row["logical_question_key"])
        if ident in seen:
            problems.append(f"q {i} duplicate")
        seen.add(ident)
    return problems


def readme(lessons, questions):
    by_course = defaultdict(lambda: {"chapters": {}, "quiz": 0, "mock": 0, "battle": 0})
    for row in lessons:
        course = by_course[row["course_code"]]
        course["chapters"].setdefault(row["module_position"], {"title": row["module_title"], "lessons": []})
        course["chapters"][row["module_position"]]["lessons"].append(row["title"])
    for row in questions:
        kind = "battle" if row["pool"] == "battle" else ("mock" if row["usage"] == ["mock"] else "quiz")
        by_course[row["course_code"]][kind] += 1
    lines = [
        "# 100 and 200 Level import",
        "",
        "Chapters are ScholAu modules (`module_position`, `module_title`). Lessons sit in source order inside each chapter.",
        "Quiz questions use pool `learning` and usage `review` + `practice`. Mock questions use pool `learning` and usage `mock`. Battle questions use pool `battle`, usage `battle`, four options, and `answer_format` `standard`.",
        "Each question also carries `module_position`, `module_title`, `lesson_position`, and `lesson_title`. The current importer ignores those extra fields. It stores a lesson link only when `lesson_id` is a UUID created by the lesson import. Leave `lesson_id` empty on the first import. The chapter and lesson names are repeated in `source_reference`.",
        "",
        "Import at `/admin/import`:",
        "1. Choose Lessons, upload `lessons.json` (10 MB limit, 500 rows), validate, then import as drafts.",
        "2. Choose Questions, upload `questions.json` (10 MB limit, 2000 rows), validate, then import as drafts.",
        "3. Open `/admin/review`, check the drafts, and publish when they are correct. Nothing goes live at import time.",
        "4. Build the practice and mock assessments in the existing assessment editor from the published learning questions. Battle questions are used by the battle pool, not by a lesson assessment.",
        "",
        "Files: `prepared/lessons.json`, `prepared/questions.json`.",
        "",
        "## Counts",
        "",
    ]
    for code, info in by_course.items():
        chapters = info["chapters"]
        lesson_count = sum(len(ch["lessons"]) for ch in chapters.values())
        lines.append(f"### {code} — {lesson_count} lessons, {len(chapters)} chapters, quiz {info['quiz']}, mock {info['mock']}, battle {info['battle']}")
        for pos in sorted(chapters):
            ch = chapters[pos]
            titles = "; ".join(ch["lessons"])
            lines.append(f"- Chapter {pos}. {ch['title']}: {titles}")
        lines.append("")
    lines.extend([
        "## Not converted",
        "",
        "- `MTH 201.A.pdf`: 16 scanned pages, no text layer. Facts were not invented.",
        "- `FRENCH.pdf`: 8 scanned pages, no text layer. Likely AUE-GST 221, but the wording could not be read.",
        "- `PHY 101.pdf`, `Maths Trigonometric Identities .pdf`, and `past questions .pdf`: image-only or nearly empty extracts.",
        "- `PHY 102.doc`: a saved Google Form page, not a physics note. PHY 102 lessons use the course-outline PDF only.",
        "- `GDNX practice questions.html`: title only, no question text.",
        "- `COS 101 Group A.pdf`: a class list, not lesson content.",
        "- `CH-LectureNote1.pdf`: the extract is an AUE-CSC 104 hardware outline, so it was not turned into a chemistry course.",
        "- Slide decks and long notes that were extracted but not condensed into this package, to avoid inventing chapter claims: IFT 211 slides, IFT 212 Chapter One, CSC 203, GST 212 philosophy notes, AUE-CSC 204 lecture 3, `html css.pdf`, COS 202 programming notes, the data-flow diagram note, GST 111 question paper, Bernoulli/probability booklets, and the large PHY 102 multichoice file.",
        "",
    ])
    return "\n".join(lines)


def main():
    lessons, questions, build_errors = emit()
    problems = build_errors + validate(lessons, questions)
    PREP.mkdir(parents=True, exist_ok=True)
    (PREP / "lessons.json").write_text(json.dumps(lessons, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (PREP / "questions.json").write_text(json.dumps(questions, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    text = readme(lessons, questions)
    (PREP / "README.md").write_text(text, encoding="utf-8")
    summary = {
        "lessons": len(lessons),
        "questions": len(questions),
        "problems": problems[:40],
        "problem_count": len(problems),
        "lesson_bytes": (PREP / "lessons.json").stat().st_size,
        "question_bytes": (PREP / "questions.json").stat().st_size,
    }
    (PREP / "validation.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    if problems:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
