# 100 and 200 Level import

Chapters are ScholAu modules (`module_position`, `module_title`). Lessons sit in source order inside each chapter.
Quiz questions use pool `learning` and usage `review` + `practice`. Mock questions use pool `learning` and usage `mock`. Battle questions use pool `battle`, usage `battle`, four options, and `answer_format` `standard`.
Each question also carries `module_position`, `module_title`, `lesson_position`, and `lesson_title`. The current importer ignores those extra fields. It stores a lesson link only when `lesson_id` is a UUID created by the lesson import. Leave `lesson_id` empty on the first import. The chapter and lesson names are repeated in `source_reference`.

Import at `/admin/import`:
1. Choose Lessons, upload `lessons.json` (10 MB limit, 500 rows), validate, then import as drafts.
2. Choose Questions, upload `questions.json` (10 MB limit, 2000 rows), validate, then import as drafts.
3. Open `/admin/review`, check the drafts, and publish when they are correct. Nothing goes live at import time.
4. Build the practice and mock assessments in the existing assessment editor from the published learning questions. Battle questions are used by the battle pool, not by a lesson assessment.

Files: `prepared/lessons.json`, `prepared/questions.json`.

## Counts

### COS 101 — 6 lessons, 6 chapters, quiz 18, mock 6, battle 6
- Chapter 1. What a computer is: Computers and early milestones
- Chapter 2. Generations and characteristics: Five generations and system characteristics
- Chapter 3. Data, information, and functions: From data to output
- Chapter 4. CPU, memory, and devices: The CPU and memory units
- Chapter 5. Types, hardware, and software: Classes of computers and software
- Chapter 6. Operating systems, networks, and the internet: Operating systems and networks

### COS 102 — 6 lessons, 6 chapters, quiz 18, mock 6, battle 6
- Chapter 1. Foundations of problem solving: Asking questions before you code
- Chapter 2. Programming languages and levels: Machine, assembly, and high-level languages
- Chapter 3. The problem-solving lifecycle: Analyse, algorithm, code, test
- Chapter 4. Algorithms and flowcharts: Characteristics of a good algorithm
- Chapter 5. Object-oriented programming: Objects, classes, and the seven ideas
- Chapter 6. C++ program shape: Hello World and C++ symbols

### AUE-CSC 104 — 5 lessons, 5 chapters, quiz 15, mock 5, battle 5
- Chapter 1. Computer circuits: Components, diodes, and adapters
- Chapter 2. Integrated circuits: How chips are scaled
- Chapter 3. Memory systems: Primary, secondary, and core memory
- Chapter 4. Magnetic storage and peripherals: Disks, tapes, and input/output devices
- Chapter 5. Op-amps, converters, and analog computers: Analog circuits and converters

### AUE-GST 102 — 2 lessons, 2 chapters, quiz 6, mock 2, battle 2
- Chapter 1. Religious dialogue: What dialogue is for
- Chapter 2. Challenges and faith: Obstacles and the meaning of faith

### GST 112 — 3 lessons, 2 chapters, quiz 9, mock 3, battle 3
- Chapter 1. Norms and values: Norms, values, and three major groups
- Chapter 2. Pre-colonial culture and arts: Southern kingdoms and their arts; Northern societies, textiles, and belief

### PHY 102 — 8 lessons, 8 chapters, quiz 24, mock 8, battle 8
- Chapter 1. Introduction to semiconductors: Introduction to semiconductors
- Chapter 2. Electrostatics: Electrostatics
- Chapter 3. Capacitors and dielectrics: Capacitors and dielectrics
- Chapter 4. Ohm's law and resistance: Ohm's law and resistance
- Chapter 5. Current electricity: Current electricity
- Chapter 6. Alternating current: Alternating current
- Chapter 7. Components in AC circuits: Components in AC circuits
- Chapter 8. Special AC circuits: Special AC circuits

### ENT 211 — 8 lessons, 8 chapters, quiz 24, mock 8, battle 8
- Chapter 1. Concept of entrepreneurship: Entrepreneurs, intrapreneurs, and theories
- Chapter 2. Characteristics of entrepreneurs: Traits that can be learned
- Chapter 3. Entrepreneurial thinking: Critical, reflective, and creative thinking
- Chapter 4. Innovation: Five dimensions of innovation
- Chapter 5. Enterprise formation and networking: Plans, ownership, and registration
- Chapter 6. Contemporary issues: Intellectual property and digital work
- Chapter 7. Entrepreneurship in Nigeria: Nigerian examples and support bodies
- Chapter 8. E-commerce: Types and challenges of e-commerce

### CYB 203 — 5 lessons, 5 chapters, quiz 15, mock 5, battle 5
- Chapter 1. Understanding cybercrime: Crime, technology, and six characteristics
- Chapter 2. Definition and categories: Tool, target, and evidence
- Chapter 3. Types of cybercrime: Nine named types
- Chapter 4. Critical infrastructure: Essential services and threat types
- Chapter 5. Perpetrators and social engineering: Who attacks, and how they persuade

### COS 201 — 4 lessons, 4 chapters, quiz 12, mock 4, battle 4
- Chapter 1. Programming and Java: Instructions, Java, and the JDK
- Chapter 2. Paradigms and structured programming: Four paradigms and three structures
- Chapter 3. Variables and data types: Names, primitives, and constants
- Chapter 4. Operators, input, decisions, arrays, strings, methods, classes, and APIs: What the later lectures cover

### SEN 201 — 13 lessons, 13 chapters, quiz 39, mock 13, battle 13
- Chapter 1. Week 1: What software engineering covers
- Chapter 2. Week 2: Generic process activities
- Chapter 3. Week 3: Agile, Scrum's neighbours, and user stories
- Chapter 4. Week 4: Eliciting requirements
- Chapter 5. Week 5: Specifying and managing requirements
- Chapter 6. Week 6: UML class diagrams
- Chapter 7. Week 7: Mid-semester revision
- Chapter 8. Week 8: Software architecture
- Chapter 9. Week 9: Design patterns
- Chapter 10. Week 10: Reuse, Git, and continuous integration
- Chapter 11. Week 11: Regression testing and TDD
- Chapter 12. Week 12: Technical debt and project concerns
- Chapter 13. Week 13: Evolution, legacy systems, and revision

### STA 111 — 1 lessons, 1 chapters, quiz 3, mock 1, battle 1
- Chapter 1. Ideas in the statistics practice file: Central tendency, variability, and variable types

## Not converted

- `MTH 201.A.pdf`: 16 scanned pages, no text layer. Facts were not invented.
- `FRENCH.pdf`: 8 scanned pages, no text layer. Likely AUE-GST 221, but the wording could not be read.
- `PHY 101.pdf`, `Maths Trigonometric Identities .pdf`, and `past questions .pdf`: image-only or nearly empty extracts.
- `PHY 102.doc`: a saved Google Form page, not a physics note. PHY 102 lessons use the course-outline PDF only.
- `GDNX practice questions.html`: title only, no question text.
- `COS 101 Group A.pdf`: a class list, not lesson content.
- `CH-LectureNote1.pdf`: the extract is an AUE-CSC 104 hardware outline, so it was not turned into a chemistry course.
- Slide decks and long notes that were extracted but not condensed into this package, to avoid inventing chapter claims: IFT 211 slides, IFT 212 Chapter One, CSC 203, GST 212 philosophy notes, AUE-CSC 204 lecture 3, `html css.pdf`, COS 202 programming notes, the data-flow diagram note, GST 111 question paper, Bernoulli/probability booklets, and the large PHY 102 multichoice file.
