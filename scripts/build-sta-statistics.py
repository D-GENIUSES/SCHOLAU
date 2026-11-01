#!/usr/bin/env python3
"""Parse the ScholAu statistics study-edition PDFs into practice import rows.

Answers are taken only from the worked key. Items that do not parse cleanly are
skipped and listed. MCQ options are shuffled with a fixed seed so the printed
B, A, D, C key is not the stored key. Nothing is labelled as a past question.
"""
from __future__ import annotations

import json
import random
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTES = ROOT / "imports/sta/source/lesson-notes.pdf"
CBT = ROOT / "imports/sta/source/cbt-and-gap.pdf"
LESSONS_OUT = ROOT / "supabase/content/sta-statistics-lessons-20261101.json"
QUESTIONS_OUT = ROOT / "supabase/content/sta-statistics-questions-20261101.json"
CHECKS_OUT = ROOT / "supabase/content/sta-statistics-topic-checks-20261101.json"
SKIPPED_OUT = ROOT / "imports/sta/skipped.json"
SUMMARY_OUT = ROOT / "imports/sta/summary.json"
CATALOG_OUT = ROOT / "apps/web/lib/public-courses/catalog.json"
GUEST_OUT = ROOT / "apps/web/components/guest/university-samples.json"
FEATURED_OUT = ROOT / "apps/web/components/guest/featured-links.json"
BIO_LESSONS = ROOT / "supabase/content/bio-101-chapters-1-7-lessons-20261031.json"
BIO_QUESTIONS = ROOT / "supabase/content/bio-101-chapters-1-7-questions-20261101.json"

LABELS = ["A", "B", "C", "D"]
COURSE_TITLES = {
    "STA 111": "Descriptive Statistics",
    "STA 112": "Probability I",
    "STA 121": "Statistical Inference I",
}
DIFFICULTY = {"STA 111": "beginner", "STA 112": "intermediate", "STA 121": "advanced"}
FLAG_WORDS = ("uncertain", "excluded", "missing", "cropped", "do not invent", "not claimed", "unrelated", "overwritten", "ambigu")


def pages(path: Path) -> list[str]:
    text = subprocess.check_output(["pdftotext", "-layout", str(path), "-"], text=True)
    chunks = text.split("\f")
    if chunks and not chunks[-1].strip():
        chunks.pop()
    return chunks


def clean_lines(page: str) -> list[str]:
    lines: list[str] = []
    for raw in page.splitlines():
        line = raw.strip()
        if not line:
            lines.append("")
            continue
        if line.startswith("SCHOLAU / STATISTICS"):
            continue
        if "Study edition" in line and "STA 111" in line:
            continue
        lines.append(line)
    return lines


def page_lines(chunks: list[str], start: int, end: int) -> list[str]:
    lines: list[str] = []
    for chunk in chunks[start - 1 : end]:
        lines.extend(clean_lines(chunk))
        lines.append("")
    return lines


def parse_ranges(text: str) -> list[tuple[str, int, int]]:
    found = []
    for match in re.finditer(r"\b([TS])(\d+)(?:\s*[-–]\s*(\d+))?", text):
        start = int(match.group(2))
        end = int(match.group(3) or start)
        if end < start:
            start, end = end, start
        found.append((match.group(1), start, end))
    return found


def overlaps(a: tuple[str, int, int], b: tuple[str, int, int]) -> bool:
    return a[0] == b[0] and not (a[2] < b[1] or b[2] < a[1])


def editorial_status(citation: str, register: list[dict], extra: str = "") -> str | None:
    status = None
    for item_range in parse_ranges(citation):
        for entry in register:
            if any(overlaps(item_range, reg) for reg in entry["ranges"]):
                if entry["status"] == "flagged" or status is None:
                    status = entry["status"]
    lowered = extra.lower()
    if any(word in lowered for word in ("uncertain", "source issue", "do not invent")):
        return "flagged"
    if status == "flagged":
        return "flagged"
    if "corrected" in lowered and status != "flagged":
        return "corrected"
    return status


def parse_register(chunks: list[str]) -> list[dict]:
    lines = page_lines(chunks, 48, len(chunks))
    text = "\n".join(lines)
    start = text.find("Source issue register")
    if start < 0:
        raise SystemExit("Could not find the source issue register")
    body = text[start:]
    stop = body.find("Independent reference checks")
    if stop > 0:
        body = body[:stop]
    entries = []
    current = None
    for line in body.splitlines():
        match = re.match(r"^((?:[TS]\d+(?:-\d+)?(?:,\s*)?)+)\s+•\s+\S", line)
        all_scans = line.startswith("All scans •")
        if match and not all_scans:
            if current:
                entries.append(current)
            ranges = parse_ranges(match.group(1))
            current = {"ranges": ranges, "text": line}
        elif current and line and not line.startswith("Source issue register"):
            current["text"] += " " + line
    if current:
        entries.append(current)
    for entry in entries:
        lowered = entry["text"].lower()
        entry["status"] = "flagged" if any(word in lowered for word in FLAG_WORDS) else "corrected"
    return entries


def paragraphs(lines: list[str]) -> list[str]:
    paras: list[str] = []
    buf: list[str] = []
    for line in lines:
        if not line:
            if buf:
                paras.append(join_wrapped(buf))
                buf = []
        else:
            buf.append(line)
    if buf:
        paras.append(join_wrapped(buf))
    return [p for p in paras if p]


def join_wrapped(lines: list[str]) -> str:
    text = ""
    for line in lines:
        if not text:
            text = line
        elif text.endswith("-") and line[:1].islower():
            text = text[:-1] + line
        else:
            text += " " + line
    return re.sub(r"\s+", " ", text).strip()


def split_long(text: str, limit: int = 900) -> list[str]:
    if len(text) <= limit:
        return [text]
    parts: list[str] = []
    rest = text
    while len(rest) > limit:
        cut = rest.rfind(". ", 0, limit)
        if cut < 200:
            cut = limit
        else:
            cut += 1
        parts.append(rest[:cut].strip())
        rest = rest[cut:].strip()
    if rest:
        parts.append(rest)
    return parts


def lesson_blocks(body: list[str], worked_title: str, worked: list[str], check: list[str]) -> list[dict]:
    blocks: list[dict] = []
    for para in paragraphs(body):
        for piece in split_long(para):
            blocks.append({"type": "paragraph", "text": piece})
    if not blocks:
        return []
    if worked:
        text = join_wrapped(worked)
        blocks.append({"type": "callout", "tone": "example", "title": worked_title or "Worked explanation", "text": text[:4000]})
    if check:
        blocks.append({"type": "callout", "tone": "tip", "title": "Check before moving on", "text": join_wrapped(check)[:4000]})
    return blocks


def parse_lessons(chunks: list[str], register: list[dict]) -> tuple[list[dict], list[dict]]:
    lines = page_lines(chunks, 5, 46)
    lessons = []
    skipped = []
    course = None
    topic_no = None
    topic_title = None
    topic_source = None
    current = None

    def finish():
        nonlocal current
        if not current:
            return
        blocks = lesson_blocks(current["body"], current["worked_title"], current["worked"], current["check"])
        if not blocks or not course or not topic_no or not topic_title:
            skipped.append({"id": current["id"], "reason": "lesson body did not parse into blocks"})
        else:
            words = sum(len(b.get("text", "").split()) for b in blocks)
            status = editorial_status(topic_source or "", register, " ".join(current["body"] + current["worked"] + current["check"]))
            lessons.append({
                "logical_key": current["id"].lower(),
                "course_code": course,
                "module_position": topic_no,
                "module_title": topic_title[:200],
                "lesson_position": current["position"],
                "title": current["title"][:200],
                "objective": current["objective"][:1000] or current["title"][:1000],
                "estimated_minutes": max(5, min(20, round(words / 80) or 5)),
                "blocks": blocks,
                "flashcards": [],
                "source_reference": f"{current['id']}; Source: {topic_source}",
                "editorial_status": status,
                "topic_slug": f"topic-{topic_no:02d}",
            })
        current = None

    for line in lines:
        if re.fullmatch(r"STA (111|112|121)", line or ""):
            finish()
            course = line
            continue
        topic = re.match(r"^Topic (\d+) • (.+)$", line or "")
        if topic:
            finish()
            topic_no = int(topic.group(1))
            topic_title = topic.group(2).strip()
            topic_source = None
            continue
        source = re.match(r"^Source: (.+)$", line or "")
        if source and current is None:
            topic_source = source.group(1).strip()
            continue
        lesson = re.match(r"^(STA\d{3}-T\d{2}-L\d{2}) • Lesson (\d+): (.+)$", line or "")
        if lesson:
            finish()
            current = {
                "id": lesson.group(1),
                "position": int(lesson.group(2)),
                "title": lesson.group(3).strip(),
                "objective": "",
                "body": [],
                "worked": [],
                "worked_title": "",
                "check": [],
                "mode": "body",
            }
            continue
        if not current:
            continue
        outcome = re.match(r"^Learning outcome: (.+)$", line or "")
        if outcome and current["mode"] == "body" and not current["objective"]:
            current["objective"] = outcome.group(1).strip()
            continue
        worked = re.match(r"^Worked explanation • (.+)$", line or "")
        if worked:
            current["mode"] = "worked"
            current["worked_title"] = worked.group(1).strip()
            continue
        if line.startswith("Check before moving on:"):
            current["mode"] = "check"
            current["check"].append(line.split(":", 1)[1].strip())
            continue
        current[current["mode"]].append(line)
    finish()
    return lessons, skipped


def is_marker(line: str) -> bool:
    return bool(re.match(r"^(Q\d{3}\b|F\d{3}\b|Topic \d+|STA (111|112|121)$|Fill in the gaps|Part )", line))


def parse_questions(chunks: list[str]) -> tuple[list[dict], list[dict]]:
    lines = page_lines(chunks, 7, 82)
    items = []
    skipped = []
    course = None
    topic_no = None
    topic_title = None
    pathway = None
    mode = None
    current = None

    def finish():
        nonlocal current
        if not current:
            return
        if current["kind"] == "mcq":
            if len(current["options"]) != 4 or not current["source"] or not current["prompt"]:
                skipped.append({"id": current["id"], "reason": "MCQ missing four options, a prompt, or a source citation"})
            else:
                items.append(current)
        else:
            if not current["prompt"] or "____" not in current["prompt"] or not current["source"]:
                skipped.append({"id": current["id"], "reason": "gap item missing a blank, prompt, or source citation"})
            else:
                items.append(current)
        current = None

    for line in lines:
        if re.fullmatch(r"STA (111|112|121)", line or ""):
            finish()
            course = line
            continue
        topic = re.match(r"^Topic (\d+) • (.+)$", line or "")
        if topic:
            finish()
            topic_no = int(topic.group(1))
            topic_title = topic.group(2).strip()
            mode = "mcq"
            continue
        pathway_match = re.match(r"^Source pathway: (.+)$", line or "")
        if pathway_match:
            pathway = pathway_match.group(1).strip()
            continue
        if line == "Fill in the gaps":
            finish()
            mode = "gap"
            continue
        q = re.match(r"^(Q\d{3})\s+(.*)$", line or "")
        if q:
            finish()
            current = {"kind": "mcq", "id": q.group(1), "prompt": q.group(2).strip(), "options": [], "source": "", "course": course, "topic_no": topic_no, "topic_title": topic_title, "pathway": pathway}
            mode = "mcq"
            continue
        g = re.match(r"^(F\d{3})\s+(.*)$", line or "")
        if g:
            finish()
            current = {"kind": "gap", "id": g.group(1), "prompt": g.group(2).strip(), "source": "", "course": course, "topic_no": topic_no, "topic_title": topic_title, "pathway": pathway}
            mode = "gap"
            continue
        opt = re.match(r"^([A-D])\.\s+(.*)$", line or "")
        if opt and current and current["kind"] == "mcq":
            current["options"].append({"label": opt.group(1), "body": opt.group(2).strip()})
            continue
        src = re.match(r"^Source:\s*(.*)$", line or "")
        if src and current:
            current["source"] = src.group(1).strip()
            continue
        if current and line and not is_marker(line):
            if current["kind"] == "mcq" and current["options"] and not current["source"]:
                current["options"][-1]["body"] += " " + line
            elif not current["source"]:
                current["prompt"] += " " + line
            elif re.match(r"^[TS]\d", line):
                current["source"] = (current["source"] + " " + line).strip()
    finish()
    return items, skipped


def parse_worked(chunks: list[str]) -> dict[str, dict]:
    lines = [line for line in page_lines(chunks, 86, 112) if line]
    answers = {}
    i = 0
    while i < len(lines):
        match = re.match(r"^(Q\d{3}) • ([A-D]) - (.+)$", lines[i])
        if not match:
            i += 1
            continue
        qid, letter, summary = match.group(1), match.group(2), match.group(3).strip()
        i += 1
        explanation = []
        source = ""
        while i < len(lines) and not re.match(r"^Q\d{3} • ", lines[i]) and not lines[i].startswith("Topic "):
            src = re.search(r"Source:\s*(.+)$", lines[i])
            if src:
                source = src.group(1).strip()
                before = lines[i][: src.start()].strip(" |")
                if before:
                    explanation.append(before)
            else:
                explanation.append(lines[i])
            i += 1
        answers[qid] = {"letter": letter, "summary": summary, "explanation": " ".join(explanation).strip(), "source": source}
    return answers


def parse_gap_answers(chunks: list[str]) -> dict[str, dict]:
    lines = page_lines(chunks, 113, 121)
    answers = {}
    current = None
    buf: list[str] = []

    def finish():
        nonlocal current, buf
        if not current:
            return
        text = join_wrapped([line for line in buf if line])
        src = re.search(r"Source:\s*(.+)$", text)
        source = src.group(1).strip() if src else ""
        explanation = text[: src.start()].strip() if src else text
        answers[current[0]] = {"answer": current[1], "explanation": explanation, "source": source}
        current = None
        buf = []

    for line in lines:
        match = re.match(r"^(F\d{3}) • (.+)$", line or "")
        if match:
            finish()
            current = (match.group(1), match.group(2).strip())
            continue
        if current:
            buf.append(line)
    finish()
    return answers


def parse_compact(chunks: list[str]) -> dict[str, str]:
    text = "\n".join(page_lines(chunks, 83, 85))
    return {qid: letter for qid, letter in re.findall(r"\b(Q\d{3})\s+([A-D])\b", text)}


def shuffle_options(qid: str, options: list[dict], correct_label: str) -> tuple[list[dict], str]:
    correct_body = next(option["body"] for option in options if option["label"] == correct_label)
    bodies = [option["body"] for option in options]
    rng = random.Random(f"scholau-sta-option-order-v1:{qid}")
    order = bodies[:]
    rng.shuffle(order)
    if order == bodies:
        order = bodies[1:] + bodies[:1]
    shuffled = [{"label": LABELS[i], "body": order[i]} for i in range(4)]
    new_correct = next(option["label"] for option in shuffled if option["body"] == correct_body)
    return shuffled, new_correct


def build_questions(raw, worked, gaps, compact, register):
    rows = []
    skipped = []
    by_topic: dict[tuple, list] = {}
    for item in raw:
        if not item["course"] or not item["topic_no"]:
            skipped.append({"id": item["id"], "reason": "missing course or topic"})
            continue
        if item["kind"] == "mcq":
            answer = worked.get(item["id"])
            compact_letter = compact.get(item["id"])
            if not answer or not answer["explanation"] or not answer["source"]:
                skipped.append({"id": item["id"], "reason": "worked answer, explanation, or source missing"})
                continue
            if compact_letter and compact_letter != answer["letter"]:
                skipped.append({"id": item["id"], "reason": f"compact key {compact_letter} disagrees with worked key {answer['letter']}"})
                continue
            bodies = {opt["label"]: opt["body"] for opt in item["options"]}
            if answer["letter"] not in bodies:
                skipped.append({"id": item["id"], "reason": "worked letter is not one of the options"})
                continue
            if answer["summary"] not in bodies[answer["letter"]] and bodies[answer["letter"]] not in answer["summary"]:
                skipped.append({"id": item["id"], "reason": "worked answer text does not match the keyed option"})
                continue
            if item["source"].split(",")[0].strip() != answer["source"].split(",")[0].strip() and item["source"] != answer["source"]:
                # Same citation may differ only by spacing; require the cited tokens to match.
                if parse_ranges(item["source"]) != parse_ranges(answer["source"]):
                    skipped.append({"id": item["id"], "reason": f"question source {item['source']} disagrees with answer source {answer['source']}"})
                    continue
            options, correct = shuffle_options(item["id"], item["options"], answer["letter"])
            if any(len(opt["body"]) > 1000 or len(opt["body"]) < 1 for opt in options) or len(item["prompt"]) > 2000 or len(answer["explanation"]) > 4000:
                skipped.append({"id": item["id"], "reason": "text exceeds the import length limits"})
                continue
            row = {
                "logical_question_key": f"{item['course'].replace(' ', '').lower()}-{item['id'].lower()}-practice",
                "pool": "learning",
                "usage": ["practice"],
                "prompt": item["prompt"],
                "options": options,
                "correct_option": correct,
                "explanation": answer["explanation"],
                "course_code": item["course"],
                "difficulty": DIFFICULTY[item["course"]],
                "source_reference": f"Statistics study edition practice item {item['id']}; Source: {item['source']}",
                "answer_format": "standard",
                "editorial_status": editorial_status(item["source"], register, answer["explanation"]),
                "topic_slug": f"topic-{item['topic_no']:02d}",
                "topic_title": item["topic_title"],
            }
        else:
            answer = gaps.get(item["id"])
            if not answer or not answer["answer"] or not answer["source"]:
                skipped.append({"id": item["id"], "reason": "gap answer or source missing"})
                continue
            if parse_ranges(item["source"]) != parse_ranges(answer["source"]):
                skipped.append({"id": item["id"], "reason": "gap source disagrees with the answer key"})
                continue
            explanation = answer["explanation"] or f"Accepted answer: {answer['answer']}."
            row = {
                "logical_question_key": f"{item['course'].replace(' ', '').lower()}-{item['id'].lower()}-practice",
                "pool": "learning",
                "usage": ["practice"],
                "prompt": item["prompt"],
                "explanation": explanation[:4000],
                "course_code": item["course"],
                "difficulty": DIFFICULTY[item["course"]],
                "source_reference": f"Statistics study edition practice item {item['id']}; Source: {item['source']}",
                "answer_format": "fill_in_gap",
                "gaps": [{"index": 1, "accepted_answers": [answer["answer"]]}],
                "editorial_status": editorial_status(item["source"], register, explanation),
                "topic_slug": f"topic-{item['topic_no']:02d}",
                "topic_title": item["topic_title"],
            }
        rows.append(row)
        by_topic.setdefault((row["course_code"], row["topic_slug"]), []).append(row)
    return rows, skipped, by_topic


def topic_checks(by_topic: dict) -> list[dict]:
    checks = []
    for (course, slug), rows in by_topic.items():
        mcq = [row for row in rows if row["answer_format"] == "standard"]
        half = len(mcq) // 2
        if half < 1:
            continue
        take = min(4, half)
        title = mcq[0]["topic_title"]
        for kind, selected in (("pre", mcq[:take]), ("post", mcq[take : take * 2])):
            for position, row in enumerate(selected, start=1):
                checks.append({
                    "course_code": course,
                    "topic_key": slug,
                    "topic_title": title,
                    "kind": kind,
                    "position": position,
                    "logical_question_key": row["logical_question_key"],
                })
    return checks


def pattern_is_predictable(rows: list[dict]) -> bool:
    letters = [row["correct_option"] for row in rows if row["answer_format"] == "standard"]
    cycle = ["B", "A", "D", "C"]
    if len(letters) < 20:
        return False
    matches = sum(1 for i, letter in enumerate(letters) if letter == cycle[i % 4])
    return matches / len(letters) > 0.5


def public_catalog(lessons: list[dict], questions: list[dict]) -> dict:
    courses = {}
    for lesson in lessons:
        course = courses.setdefault(lesson["course_code"], {
            "slug": lesson["course_code"].lower().replace(" ", "-"),
            "code": lesson["course_code"],
            "title": COURSE_TITLES[lesson["course_code"]],
            "description": f"Practice lessons for {lesson['course_code']} {COURSE_TITLES[lesson['course_code']]} at Adeleke University. These are study notes, not past examination papers.",
            "topics": {},
        })
        topic = course["topics"].setdefault(lesson["topic_slug"], {
            "slug": lesson["topic_slug"],
            "title": lesson["module_title"],
            "description": f"{lesson['course_code']} {lesson['module_title']}. Source: {lesson['source_reference']}",
            "lessons": [],
            "questions": [],
        })
        topic["lessons"].append({
            "slug": lesson["logical_key"],
            "title": lesson["title"],
            "objective": lesson["objective"],
            "source": lesson["source_reference"],
            "editorial_status": lesson["editorial_status"],
            "blocks": lesson["blocks"],
        })
    for question in questions:
        topic = courses[question["course_code"]]["topics"][question["topic_slug"]]
        topic["questions"].append({k: v for k, v in question.items() if k not in {"topic_title"}})
    bio = bio_public()
    catalog_courses = []
    for code in ("STA 111", "STA 112", "STA 121"):
        course = courses[code]
        course["topics"] = list(course["topics"].values())
        catalog_courses.append(course)
    catalog_courses.append(bio)
    featured_sta = max(
        (topic for course in catalog_courses if course["code"] == "STA 111" for topic in course["topics"]),
        key=lambda topic: len(topic["questions"]),
    )
    featured_sta["featured"] = True
    bio["topics"][0]["featured"] = True
    return {"courses": catalog_courses}


def bio_public() -> dict:
    lessons = json.loads(BIO_LESSONS.read_text())
    questions = [q for q in json.loads(BIO_QUESTIONS.read_text()) if q.get("pool") == "learning" and q.get("answer_format", "standard") == "standard"]
    topics = {}
    for lesson in lessons:
        slug = re.sub(r"[^a-z0-9]+", "-", lesson["module_title"].lower()).strip("-")
        topic = topics.setdefault(lesson["module_position"], {
            "slug": slug,
            "title": lesson["module_title"],
            "description": f"BIO 101 {lesson['module_title']}, from the chapter 1–7 notes.",
            "lessons": [],
            "questions": [],
        })
        topic["lessons"].append({
            "slug": lesson["logical_key"],
            "title": lesson["title"],
            "objective": lesson["objective"],
            "source": lesson["source_reference"],
            "editorial_status": None,
            "blocks": lesson["blocks"],
        })
    first = topics[min(topics)]
    for question in questions[:10]:
        options = [{"label": opt["label"], "body": opt["body"]} for opt in question["options"]]
        first["questions"].append({
            "logical_question_key": question["logical_question_key"],
            "pool": "learning",
            "usage": ["practice"],
            "prompt": question["prompt"],
            "options": options,
            "correct_option": question["correct_option"],
            "explanation": question["explanation"],
            "course_code": "BIO 101",
            "difficulty": question["difficulty"],
            "source_reference": question["source_reference"],
            "answer_format": "standard",
            "editorial_status": None,
            "topic_slug": first["slug"],
        })
    return {
        "slug": "bio-101",
        "code": "BIO 101",
        "title": "General Biology I",
        "description": "BIO 101 lessons from the chapter 1–7 notes. Practice questions, not past papers.",
        "topics": list(topics.values()),
    }


def guest_samples(catalog: dict) -> list[dict]:
    samples = []
    for course in catalog["courses"]:
        if course["code"] not in {"STA 111", "BIO 101"}:
            continue
        topic = next(item for item in course["topics"] if item.get("featured"))
        for question in topic["questions"]:
            if question["answer_format"] != "standard":
                continue
            options = [opt["body"] for opt in question["options"]]
            samples.append({
                "id": question["logical_question_key"],
                "courseCode": course["code"],
                "courseTitle": course["title"],
                "level": 100,
                "prompt": question["prompt"],
                "options": options,
                "correct": LABELS.index(question["correct_option"]),
                "explanation": question["explanation"],
                "sourceReference": question["source_reference"],
            })
            if sum(1 for item in samples if item["courseCode"] == course["code"]) >= 10:
                break
    return samples


def main() -> None:
    note_pages = pages(NOTES)
    cbt_pages = pages(CBT)
    register = parse_register(note_pages)
    lessons, lesson_skips = parse_lessons(note_pages, register)
    raw, question_skips = parse_questions(cbt_pages)
    worked = parse_worked(cbt_pages)
    gap_answers = parse_gap_answers(cbt_pages)
    compact = parse_compact(cbt_pages)
    questions, answer_skips, by_topic = build_questions(raw, worked, gap_answers, compact, register)
    skipped = lesson_skips + question_skips + answer_skips
    checks = topic_checks(by_topic)
    if pattern_is_predictable(questions):
        raise SystemExit("MCQ key is still the printed B/A/D/C pattern")
    mcq = [q for q in questions if q["answer_format"] == "standard"]
    gaps = [q for q in questions if q["answer_format"] == "fill_in_gap"]
    summary = {
        "lessons": len(lessons),
        "topics": len({(lesson["course_code"], lesson["module_position"]) for lesson in lessons}),
        "mcq": len(mcq),
        "gaps": len(gaps),
        "skipped": skipped,
        "register_entries": len(register),
        "corrected": sum(1 for row in lessons + questions if row.get("editorial_status") == "corrected"),
        "flagged": sum(1 for row in lessons + questions if row.get("editorial_status") == "flagged"),
        "practice_only": all(row["usage"] == ["practice"] for row in questions),
    }
    if len(lessons) != 84 or summary["topics"] != 42:
        raise SystemExit(f"Expected 84 lessons and 42 topics, got {summary}")
    if len(mcq) + len(gaps) + len(question_skips) + len(answer_skips) < 400:
        raise SystemExit(f"Question accounting failed: {summary}")
    catalog = public_catalog(lessons, questions)
    CATALOG_OUT.parent.mkdir(parents=True, exist_ok=True)
    for path, data in (
        (LESSONS_OUT, lessons),
        (QUESTIONS_OUT, questions),
        (CHECKS_OUT, checks),
        (SKIPPED_OUT, skipped),
        (SUMMARY_OUT, summary),
        (CATALOG_OUT, catalog),
        (GUEST_OUT, guest_samples(catalog)),
        (FEATURED_OUT, [
            {
                "href": f"/courses/{course['slug']}/{topic['slug']}",
                "code": course["code"],
                "title": topic["title"],
                "lessons": len(topic["lessons"]),
                "questions": len(topic["questions"]),
            }
            for course in catalog["courses"]
            for topic in course["topics"]
            if topic.get("featured")
        ]),
    ):
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in summary.items() if k != "skipped"}, indent=2))
    print(f"skipped {len(skipped)}")
    for item in skipped:
        print(f"  {item['id']}: {item['reason']}")


if __name__ == "__main__":
    main()
