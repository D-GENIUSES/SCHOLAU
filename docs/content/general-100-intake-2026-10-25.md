# General 100-level materials intake — 25 October 2026

Published to the existing ScholAu database and private course-material storage.

- 144 input files, including 22 byte-identical duplicates.
- 69 verified course downloads registered across 18 canonical courses.
- 17 source files were already published and were preserved.
- 9 further files repeat extracted study content.
- 219 unique, checked interactive questions: 219 learning entries and 219 battle entries.
- 36 published assessments across 12 courses: review, practice and mock for each course.
- 16 sources retained as question evidence rather than raw student downloads. These include identified student submissions, quiz responses, and a scanned question bank with incorrect historical answer keys.
- 11 files excluded as administrative records, personal reflections, course-list references or empty inputs. Two further empty copies are counted among the byte duplicates.

## Confirmed course mappings

- PHY 111 practical sources → PHY 107.
- CHM 112/122 organic chemistry sources → CHM 102.
- Chemistry kinetics → CHM 101.
- Legacy English/GES 101 sources → GST 111 when their subject is English.
- Use of Library sources → AUE-GST 101.
- God in Modern Society, including legacy GES 102/112 headings → AUE-GST 102.
- Nigerian Peoples and Culture → GST 112.
- The two Java lecture files labelled COS/COS 201 → COS 201, rather than COS 101.
- Probability questions in the mixed statistics bank → STA 112; descriptive statistics questions → STA 111.

Assignment questions were included. Identifying cover sheets, email addresses, matriculation numbers and grades were not included in the interactive questions.

The HTML hardware source was read as data without executing its scripts, converted to a plain-text worksheet, and its incorrect modem definition was corrected to modulation and demodulation. The misleading NPU question was replaced with an unambiguous abbreviation question.

## Interactive questions

| Course | Unique questions | Learning entries | Battle entries |
| --- | ---: | ---: | ---: |
| AUE-CSC 104 | 4 | 4 | 4 |
| AUE-GST 101 | 4 | 4 | 4 |
| BIO 101 | 13 | 13 | 13 |
| CHM 101 | 11 | 11 | 11 |
| CHM 102 | 7 | 7 | 7 |
| COS 102 | 72 | 72 | 72 |
| GST 111 | 15 | 15 | 15 |
| GST 112 | 4 | 4 | 4 |
| MTH 102 | 8 | 8 | 8 |
| PHY 107 | 14 | 14 | 14 |
| STA 111 | 54 | 54 | 54 |
| STA 112 | 13 | 13 | 13 |

## Verification and remaining work

All uploaded objects passed size and SHA-256 metadata verification. The final database registration query returned 69 published material records. Published question versions total 438. Existing courses, lessons, question banks and assessments were preserved; the new assessments were added separately.

Enrolled-student course overview and material RPC checks passed for CHM 101, AUE-GST 101, GST 111, PHY 107, BIO 101 and STA 111. Each exposed the three new assessments and course downloads, with battle eligibility true. Those responses did not expose correct-option fields.

CHM 102 did not previously exist. Its canonical course, two material files and seven interactive questions are now stored, but it has **no departmental course offerings yet**. Its student availability still requires the relevant semester curriculum; no departmental offerings were invented.

The entire folder has been classified. The 219 interactive questions are the checked subset, not a claim that every question in every source has been verified. The candidate extraction contains 1,639 entries before cross-source question deduplication, including repeated, malformed, incomplete and ambiguous questions. Remaining candidates require answer/content review before conversion into graded interactive questions. Assignment and quiz sources containing personal details remain local evidence, not public downloads.

Local audit files: `manifest.json`, `uploaded.json`, `question-review.json`, `verified.json`, and `materials-final.json`. Answer-bearing import data stays outside the application repository.

## Lesson presentation correction

The follow-up migration replaces unanswered Philosophy of Education prompt lists and source-editing commentary with explanatory notes. Flashcards now exclude editorial material and unanswered prompt lists, omit learning-objective cards, and present a question followed by its answer. The card renderer removes category labels and flip-hint text. Published lesson changes preserve lesson IDs and existing learner progress.

Reference checks: [OpenStax Philosophy](https://openstax.org/books/introduction-philosophy/pages/1-4-an-overview-of-contemporary-philosophy), [OpenStax Learning](https://openstax.org/books/psychology/pages/6-1-what-is-learning), [Stanford knowledge analysis](https://plato.stanford.edu/entries/knowledge-analysis/), [Stanford panpsychism](https://plato.stanford.edu/entries/panpsychism/).
