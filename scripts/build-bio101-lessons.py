"""Build BIO 101 chapter 1–7 lesson + flashcard import JSON from extracted notes."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "supabase/content/bio-101-chapters-1-7-lessons-20261031.json"
SRC = "BIO CH.1-7.pdf"


def heading(text: str, level: int = 2) -> dict:
    return {"type": "heading", "level": level, "text": text}


def para(text: str) -> dict:
    return {"type": "paragraph", "text": text}


def bullets(*items: str) -> dict:
    return {"type": "list", "items": list(items)}


def callout(tone: str, text: str, title: str | None = None) -> dict:
    block: dict = {"type": "callout", "tone": tone, "text": text}
    if title:
        block["title"] = title
    return block


def checkpoint(question: str, options: list[str], correct: int, explanation: str) -> dict:
    return {
        "type": "checkpoint",
        "question": question,
        "options": options,
        "correct_index": correct,
        "explanation": explanation,
    }


def card(front: str, back: str, tag: str = "section") -> dict:
    return {"front": front, "back": back, "tag": tag}


def lesson(
    *,
    key: str,
    module_position: int,
    module_title: str,
    lesson_position: int,
    title: str,
    objective: str,
    minutes: int,
    pages: str,
    blocks: list[dict],
    flashcards: list[dict],
) -> dict:
    return {
        "logical_key": key,
        "course_code": "BIO 101",
        "module_position": module_position,
        "module_title": module_title,
        "lesson_position": lesson_position,
        "title": title,
        "objective": objective,
        "estimated_minutes": minutes,
        "blocks": blocks,
        "flashcards": flashcards,
        "source_reference": f"{SRC}, book pp. {pages}",
    }


M1 = "Introduction to Biology"
M2 = "Living Things"
M3 = "Classification of Living Things"
M4 = "Cell Types and Cell Theory"
M5 = "Activities Within the Cell"
M6 = "Heredity"
M7 = "Genes and Chromosomes"

lessons = [
    lesson(
        key="bio101-ch01-history-20261031",
        module_position=1, module_title=M1, lesson_position=1,
        title="History and meaning of biology",
        objective="Define biology and place the main discoveries of living things on a simple timeline.",
        minutes=10, pages="1–2",
        blocks=[
            heading("Understand the idea"),
            para("Biology is the scientific study of life. It covers every living thing, from bacteria you cannot see to whales, and from a single cell to a whole forest. The word itself is modern, but people have watched plants and animals for thousands of years."),
            para("Early farmers in Egypt and Mesopotamia grew crops and kept animals. In Greece, Aristotle grouped animals by what he could see. Later, Ibn Sina wrote about medicine and plants. Vesalius mapped the human body by dissection, and William Harvey showed that blood circulates."),
            para("The microscope opened a hidden world: Hooke named cells in cork, and Leeuwenhoek saw microbes. Linnaeus gave organisms two-part names. Darwin explained how species change by natural selection. Mendel’s rules of inheritance were rediscovered, and Watson and Crick described the structure of DNA."),
            callout("example", "Think of biology as a long notebook. Each century added a page: naming living things, seeing cells, then reading DNA. You are now adding the page that starts with BIO 101.", "A timeline you can tell"),
            callout("warning", "Do not say biology began only with Darwin or DNA. Classification, anatomy, and microscopy came first, and they still matter in this course.", "Common mix-up"),
            heading("What to remember"),
            bullets(
                "Biology = scientific study of life.",
                "Aristotle classified; Linnaeus named; Darwin explained change; Watson and Crick described DNA.",
                "Microscopes made cells and microbes visible.",
            ),
            checkpoint(
                "Who introduced the two-part naming system still used in classification?",
                ["Aristotle", "Carolus Linnaeus", "Charles Darwin", "William Harvey"],
                1,
                "Linnaeus built the naming system used today. Aristotle classified earlier, Darwin explained evolution, and Harvey described circulation.",
            ),
            heading("Recap"),
            para("Biology studies living things. Ancient observation led to classification, anatomy, microscopy, evolution, and DNA. Keep the order of those discoveries when you explain the subject."),
        ],
        flashcards=[
            card("What is biology?", "The scientific study of life, from cells to ecosystems.", "focus"),
            card("Who grouped animals by visible traits in ancient Greece?", "Aristotle.", "section"),
            card("What did William Harvey discover?", "Blood circulates through the body.", "section"),
            card("What did Leeuwenhoek see with his microscope?", "Microbes he called animalcules.", "section"),
            card("Who designed the modern naming system?", "Carolus Linnaeus.", "focus"),
            card("What idea is Darwin linked to?", "Evolution by natural selection.", "focus"),
            card("What did Watson and Crick describe?", "The structure of DNA.", "focus"),
        ],
    ),
    lesson(
        key="bio101-ch01-branches-20261031",
        module_position=1, module_title=M1, lesson_position=2,
        title="Branches of biology and why they matter",
        objective="Name the main branches of biology and explain why the subject is useful in health, food, and the environment.",
        minutes=12, pages="2–6",
        blocks=[
            heading("Understand the idea"),
            para("Two big branches sit at the base of biology. Botany is the study of plants. Zoology is the study of animals. Most other fields grow from these two, plus the study of tiny organisms and of molecules inside cells."),
            para("Anatomy asks how a body is built. Physiology asks how it works. Cell biology looks at cells; biochemistry looks at the chemistry of life; genetics looks at how traits are passed on. Ecology studies living things with their surroundings. Microbiology studies bacteria, protists, and fungi."),
            para("Biology is useful because it explains body change, disease, food production, and how to protect habitats. Careers include medicine, agriculture, pharmacy, forensics, environmental science, and genetic engineering. Ethics matters too: gene editing is powerful and must be used with care."),
            callout("example", "A malaria case uses many branches at once: microbiology for the parasite, ecology for the mosquito, physiology for fever, and pharmacology for the drug.", "One problem, many branches"),
            callout("warning", "Botany is not ‘just gardening’ and zoology is not ‘just zoo animals’. Both include structure, function, genetics, and ecology.", "Do not shrink the branches"),
            heading("What to remember"),
            bullets(
                "Botany = plants; zoology = animals.",
                "Genetics, ecology, microbiology, and physiology are core supporting fields.",
                "Biology feeds medicine, farming, conservation, forensics, and biotechnology.",
            ),
            checkpoint(
                "Which branch studies how organisms interact with each other and their environment?",
                ["Anatomy", "Ecology", "Paleontology", "Immunology"],
                1,
                "Ecology is the study of organisms with their environment. Anatomy is structure, paleontology uses fossils, and immunology is the immune system.",
            ),
            heading("Recap"),
            para("Start with botany and zoology, then add the specialist fields. Biology matters because it explains bodies, disease, food, and the living environment, and it opens many careers."),
        ],
        flashcards=[
            card("What does botany study?", "Plants: structure, function, genetics, and ecology.", "focus"),
            card("What does zoology study?", "Animals: behaviour, physiology, evolution, and ecology.", "focus"),
            card("What is genetics?", "How traits are passed through genes, DNA, and chromosomes.", "section"),
            card("What is microbiology?", "The study of bacteria, archaea, protists, and fungi.", "section"),
            card("What is physiology?", "How organs and systems work inside an organism.", "section"),
            card("Name two biology careers from this chapter.", "Medicine and agriculture.\nAlso pharmacy, forensics, or environmental science.", "focus"),
            card("Why does biology raise ethical questions?", "Tools such as gene editing can change life and must be used responsibly.", "tip"),
        ],
    ),
    lesson(
        key="bio101-ch02-characteristics-20261031",
        module_position=2, module_title=M2, lesson_position=1,
        title="What living things are and how they stay alive",
        objective="List the characteristics of life and explain cells, energy, nutrition, respiration, and excretion in plain language.",
        minutes=14, pages="7–11",
        blocks=[
            heading("Understand the idea"),
            para("The earth holds living and non-living things. Living things have life: they are made of cells, use energy, respond, grow, reproduce, and finally die. A tree does not walk away when you touch it, but it is still alive because those life processes run inside it."),
            para("A cell is the basic unit of life. It has protoplasm inside a plasma membrane. Plant cells also have a cell wall, a large central vacuole, and chloroplasts. Animals are motile heterotrophs without a cell wall. Plants are non-motile autotrophs with a cell wall. Bacteria are prokaryotes: they have no nucleus."),
            para("Energy comes from photosynthesis or from breaking food in respiration to make ATP. Anabolism builds complex molecules. Catabolism breaks them. Together they are metabolism. Autotrophs make food; heterotrophs eat plants or animals. Living things also remove wastes by excretion."),
            callout("example", "Photosynthesis: carbon dioxide and water become glucose and oxygen in the light, using chlorophyll. Respiration then releases energy from that glucose inside cells.", "Energy in, energy out"),
            callout("warning", "Breathing air is not the whole of respiration. Respiration is the release of energy from food in cells, with or without oxygen.", "Respiration is not only breathing"),
            heading("What to remember"),
            bullets(
                "Life signs: organisation, energy, metabolism, growth, response, reproduction, death.",
                "Anabolism builds; catabolism breaks; metabolism is both.",
                "Autotrophs make food; herbivores, carnivores, and omnivores consume it.",
            ),
            checkpoint(
                "Which pair is correct?",
                [
                    "Anabolism breaks molecules and releases energy",
                    "Catabolism builds proteins from simpler parts",
                    "Metabolism is anabolism plus catabolism",
                    "Only animals have metabolism",
                ],
                2,
                "Metabolism is the name for both building (anabolism) and breaking (catabolism). Plants and animals both metabolise.",
            ),
            heading("Recap"),
            para("Living things are cellular, use energy, metabolise, grow, respond, reproduce, and die. Know plant versus animal cells, autotroph versus heterotroph, and the difference between photosynthesis and respiration."),
        ],
        flashcards=[
            card("What is the basic unit of a living thing?", "The cell.", "focus"),
            card("Name three extras in a plant cell.", "Cell wall, chloroplasts, and a large central vacuole.", "focus"),
            card("What is anabolism?", "Building complex molecules from simpler ones, using energy.", "section"),
            card("What is catabolism?", "Breaking complex molecules into simpler ones, releasing energy.", "section"),
            card("Write the idea of photosynthesis.", "Light and chlorophyll turn CO2 and water into glucose and oxygen.", "focus"),
            card("What is a heterotroph?", "A consumer that must eat plants or animals for energy.", "section"),
            card("Aerobic vs anaerobic respiration?", "Aerobic uses oxygen and yields much ATP.\nAnaerobic does not; yeast makes ethanol and CO2.", "focus"),
            card("How do plants excrete?", "They release gases and water; they store some wastes as tannin or resin.", "section"),
        ],
    ),
    lesson(
        key="bio101-ch02-living-vs-nonliving-20261031",
        module_position=2, module_title=M2, lesson_position=2,
        title="Living versus non-living things",
        objective="Compare living and non-living things using reproduction, growth, response, movement, and death.",
        minutes=10, pages="11–12",
        blocks=[
            heading("Understand the idea"),
            para("Once you know the signs of life, you can sort anything you see. Living things reproduce, grow, sense stimuli, metabolise, respire, and die. Non-living things do not do these on their own. A phone can ‘move’ if you throw it, but it does not move itself, feed, or make offspring."),
            para("Reproduction may be sexual (two gametes form a zygote) or asexual (one parent: binary fission, budding, vegetative propagation). Growth is more cells or bigger cells. Animals use stem cells; plants use meristems. Organisms detect change with receptors. Plants show nastic movement rather than walking."),
            para("Every living thing has a lifespan. Senescence is biological ageing that ends in death. Non-living objects have no lifespan in this biological sense."),
            callout("example", "Humans, goats, maize, and insects are living. Rock, a pen, a building, and a charger are non-living.", "Quick sort"),
            callout("warning", "Movement alone does not prove life. Wind moves dust. Ask also: does it grow, respire, and reproduce?", "Do not use one sign only"),
            heading("What to remember"),
            bullets(
                "Living: life, reproduction, food/air/water, stimuli, metabolism, growth, lifespan, self-movement, respiration.",
                "Non-living: none of those requirements.",
                "Sexual reproduction uses two parents; asexual uses one.",
            ),
            checkpoint(
                "Which statement about non-living things is true in this course?",
                [
                    "They respire in their cells",
                    "They have no metabolic reactions",
                    "They grow by cell division",
                    "They always respond to stimuli",
                ],
                1,
                "Non-living things have no metabolism, no cell respiration, and no growth by cells. Living things do.",
            ),
            heading("Recap"),
            para("Use a checklist, not a single clue. If it cannot grow, respire, respond, or reproduce, treat it as non-living, even if it looks busy."),
        ],
        flashcards=[
            card("Name two types of reproduction.", "Sexual (gametes and a zygote) and asexual (one parent).", "focus"),
            card("What is senescence?", "Biological ageing that ends in death.", "section"),
            card("What is nastic movement?", "Plant movement that is not free locomotion like an animal’s.", "section"),
            card("Do living things need food, air, and water?", "Yes. Non-living things do not.", "focus"),
            card("Give two living and two non-living examples.", "Living: human, plant.\nNon-living: rock, pen.", "section"),
            card("Why is a tree living even if it cannot walk?", "It is cellular, grows, metabolises, reproduces, and dies.", "focus"),
        ],
    ),
    lesson(
        key="bio101-ch03-taxonomy-20261031",
        module_position=3, module_title=M3, lesson_position=1,
        title="Taxonomy and the hierarchy of life",
        objective="Explain why we classify organisms and recite the ranks from kingdom to species.",
        minutes=11, pages="13–15",
        blocks=[
            heading("Understand the idea"),
            para("Classification arranges living things into groups by similarities and differences. Biologists have named more than 1.8 million kinds, and more wait to be found. Without a shared system we could not identify or talk about them clearly."),
            para("Aristotle made an early attempt. Carolus Linnaeus built the method still used to name species. Taxonomy (or systematics) is the study of those principles. Shared important features make a large group; smaller differences split that group again and again."),
            para("The ranks from largest to smallest are kingdom, phylum (or division in plants), class, order, family, genus, and species. A species is the smallest unit: members look alike in general and can mate to give fertile offspring. The scientific name has two parts: genus then species."),
            callout("example", "Humans sit in family Hominidae. The genus is the first half of the two-part name; the species is the second half.", "Where you sit in the ladder"),
            callout("warning", "Going down the ladder does not add random labels. Variety shrinks: a kingdom is mixed, a species is tightly related.", "Ranks are not equal"),
            heading("What to remember"),
            bullets(
                "Taxonomy = principles of classification.",
                "Kingdom → phylum/division → class → order → family → genus → species.",
                "Species members can breed and produce fertile young.",
            ),
            checkpoint(
                "What is the smallest unit of classification?",
                ["Kingdom", "Family", "Genus", "Species"],
                3,
                "Species is the most exact rank. Individuals can mate and produce fertile offspring.",
            ),
            heading("Recap"),
            para("We classify to name and group life. Learn Linnaeus, the seven ranks, and the two-part species name. That ladder is the map for the five kingdoms that follow."),
        ],
        flashcards=[
            card("What is classification?", "Arranging organisms into groups by similarities and differences.", "focus"),
            card("What is taxonomy?", "The study of the principles of classification.", "section"),
            card("Who is the key figure in modern naming?", "Carolus Linnaeus.", "focus"),
            card("List the hierarchy from largest to smallest.", "Kingdom, phylum/division, class, order, family, genus, species.", "focus"),
            card("What defines a species here?", "Organisms that can mate and produce fertile offspring.", "focus"),
            card("What are the two parts of a scientific name?", "Genus first, then species.", "section"),
        ],
    ),
    lesson(
        key="bio101-ch03-monera-20261031",
        module_position=3, module_title=M3, lesson_position=2,
        title="Kingdom Monera",
        objective="Describe prokaryotes in Kingdom Monera, including bacteria and cyanobacteria.",
        minutes=10, pages="15–16",
        blocks=[
            heading("Understand the idea"),
            para("This course uses five kingdoms: Monera, Protista, Fungi, Plantae, and Animalia. Kingdoms are sorted by how they get food, what their cells are like, and whether they are one cell or many."),
            para("Monera are prokaryotes. They have no nuclear membrane. The cell wall is present and is not cellulose. They are unicellular and may be autotrophic or heterotrophic. Bacteria and blue-green algae (cyanobacteria) such as Nostoc and Spirulina belong here."),
            para("A typical bacterium has a capsule, cell wall, plasma membrane, cytoplasm, ribosomes, and a nucleoid of DNA. Pili are short surface strands; flagella are long and used for movement. Mycoplasma lacks a cell wall. Cyanobacteria photosynthesise but still have no mitochondria, Golgi, chloroplasts, or ER."),
            callout("example", "Draw a rod: outer capsule, then wall, then membrane, DNA tangled in the middle, ribosomes as dots, and one long flagellum.", "Bacterial cell sketch"),
            callout("warning", "Cyanobacteria look a bit like algae, but they are prokaryotes, so they sit in Monera, not Protista or Plantae.", "Do not file them as plants"),
            heading("What to remember"),
            bullets(
                "Monera = prokaryotic, unicellular, no nuclear membrane.",
                "Nutrition may be autotrophic or heterotrophic.",
                "Cyanobacteria are photosynthetic prokaryotes.",
            ),
            checkpoint(
                "Which feature belongs to Kingdom Monera?",
                ["Membrane-bound nucleus", "Cellulose cell wall", "No nuclear membrane", "Always multicellular"],
                2,
                "Monera are prokaryotes: the nuclear membrane is absent. They are unicellular and their wall is not cellulose.",
            ),
            heading("Recap"),
            para("Monera are the prokaryote kingdom. Remember the bacterial parts, the missing nucleus, and why blue-green algae were moved here."),
        ],
        flashcards=[
            card("Name the five kingdoms in this course.", "Monera, Protista, Fungi, Plantae, Animalia.", "focus"),
            card("What cell type is Monera?", "Prokaryotic: no nuclear membrane.", "focus"),
            card("Give two Monera examples.", "Bacteria and cyanobacteria such as Nostoc or Spirulina.", "section"),
            card("What is a nucleoid?", "The region of DNA in a prokaryote, not inside a nucleus.", "section"),
            card("What do flagella do?", "They help a bacterium move.", "section"),
            card("Why are cyanobacteria in Monera?", "They photosynthesise but are still prokaryotes.", "focus"),
        ],
    ),
    lesson(
        key="bio101-ch03-protista-20261031",
        module_position=3, module_title=M3, lesson_position=3,
        title="Kingdom Protista",
        objective="Describe protists as early eukaryotes and give examples of movement, nutrition, and disease.",
        minutes=10, pages="17–18",
        blocks=[
            heading("Understand the idea"),
            para("Protista comes from a Greek word meaning ‘the very first’. These organisms are eukaryotes: they have a nucleus and membrane-bound organelles. Most are unicellular. Many live in water, soil, or damp places. They are treated as the first eukaryotic forms, before plants, animals, and fungi."),
            para("Some protists make their own food; others feed on other organisms. A few are multicellular. Giant kelp can grow taller than 100 feet. Kelp forests can shelter otters, and otters eat sea urchins that would otherwise destroy the kelp. That is a living partnership."),
            para("Movement may use cilia, flagella, or pseudopodia. Trypanosoma is a parasitic protist that causes sleeping sickness. Reproduction is usually asexual; sexual reproduction is rare and often happens under stress."),
            callout("example", "If you see a single-celled organism with a true nucleus in pond water, start with Protista, not Monera.", "Pond-water test"),
            callout("warning", "Not every protist is harmless or microscopic. Some cause disease, and kelp is a huge multicellular protist.", "Watch the exceptions"),
            heading("What to remember"),
            bullets(
                "Protists are eukaryotes, usually unicellular, often aquatic.",
                "Nutrition: autotrophic or heterotrophic.",
                "Trypanosoma causes sleeping sickness.",
            ),
            checkpoint(
                "Which organism is a parasitic protist named in this chapter?",
                ["Nostoc", "Trypanosoma", "Yeast", "Spirulina"],
                1,
                "Trypanosoma is a protozoan that can cause sleeping sickness. Nostoc and Spirulina are cyanobacteria; yeast is a fungus.",
            ),
            heading("Recap"),
            para("Protists are the eukaryotic ‘first’ kingdom: mostly one cell, true nucleus, mixed nutrition, and several ways to move. Know kelp and Trypanosoma as named examples."),
        ],
        flashcards=[
            card("What does Protista mean?", "From Greek protistos, ‘the very first’.", "section"),
            card("Are protists prokaryotes or eukaryotes?", "Eukaryotes with a nucleus and organelles.", "focus"),
            card("Where do protists usually live?", "Water, soil, or moist places.", "section"),
            card("How can protists move?", "Cilia, flagella, or pseudopodia.", "focus"),
            card("What disease is linked to Trypanosoma?", "Sleeping sickness in humans.", "focus"),
            card("When is sexual reproduction common in protists?", "It is rare and usually happens in stress.", "tip"),
        ],
    ),
    lesson(
        key="bio101-ch03-fungi-plants-animals-20261031",
        module_position=3, module_title=M3, lesson_position=4,
        title="Fungi, plants, and animals",
        objective="Compare Kingdoms Fungi, Plantae, and Animalia using cell wall, food, and movement.",
        minutes=11, pages="18–19",
        blocks=[
            heading("Understand the idea"),
            para("Fungi include yeasts, moulds, and mushrooms. They are eukaryotic, non-motile heterotrophs. They have a cell wall and make chitin. They do not photosynthesise. They reproduce with spores, sexually or asexually, and some are parasites. They have no embryo; a spore grows into the fungus."),
            para("Kingdom Plantae holds the plants: eukaryotic, multicellular autotrophs. Chlorophyll in plastids captures light. Cells have a wall and a large central vacuole. Plants do not walk. They reproduce sexually or by vegetative propagation. Roots, stems, and leaves divide jobs such as anchorage, support, and photosynthesis."),
            para("Kingdom Animalia is the largest of the five. Animals are multicellular eukaryotes without chlorophyll or a cell wall, so they must eat. Body plan splits them into phyla such as Porifera, Cnidaria, Platyhelminthes, Nematoda, Annelida, Arthropoda, Mollusca, Echinodermata, and Chordata."),
            callout("example", "Mushroom on dead wood = fungus (absorbs food). Maize in a field = plant (makes food). Goat = animal (eats plants).", "Three kingdoms on a farm"),
            callout("warning", "A green colour does not make an organism a plant. Cyanobacteria are green and prokaryotic. Fungi are never photosynthetic in this chapter.", "Colour is not the kingdom"),
            heading("What to remember"),
            bullets(
                "Fungi: heterotrophs, spores, chitin, no chlorophyll.",
                "Plants: autotrophs, chlorophyll, wall, vacuole, non-motile.",
                "Animals: heterotrophs, no wall, no chlorophyll, many phyla.",
            ),
            checkpoint(
                "Why are fungi not placed in Plantae in this course?",
                [
                    "They are prokaryotes",
                    "They lack chlorophyll and cannot photosynthesise",
                    "They have no cell wall",
                    "They are always unicellular",
                ],
                1,
                "Fungi are eukaryotic heterotrophs without chlorophyll. Plants make food with chlorophyll. Fungi may be unicellular (yeast) or filamentous.",
            ),
            heading("Recap"),
            para("After Monera and Protista, sort the rest by food and cell wall: fungi absorb, plants photosynthesise, animals ingest. Learn one clear example of each."),
        ],
        flashcards=[
            card("Name three fungi.", "Yeasts, moulds, and mushrooms.", "section"),
            card("How do fungi feed?", "They are heterotrophs; they do not photosynthesise.", "focus"),
            card("What wall material is named for fungi?", "Chitin.", "focus"),
            card("What makes Plantae autotrophic?", "Chlorophyll in plastids used for photosynthesis.", "focus"),
            card("Do animal cells have a cell wall?", "No. Animals are heterotrophs without chlorophyll.", "focus"),
            card("Name three animal phyla from the list.", "For example Chordata, Arthropoda, and Mollusca.", "section"),
        ],
    ),
    lesson(
        key="bio101-ch04-cell-theory-20261031",
        module_position=4, module_title=M4, lesson_position=1,
        title="The cell and cell theory",
        objective="Define the cell, retell how it was discovered, and state the three points of cell theory.",
        minutes=12, pages="20–21, 29–30",
        blocks=[
            heading("Understand the idea"),
            para("The cell is the lowest living structure that can carry out life’s jobs. It is the structural and functional unit of life. Most cells are 1–100 micrometres wide. Unicellular examples are Amoeba, Paramecium, and Chlamydomonas. Multicellular examples are humans, cats, and Spirogyra. All must take in nutrients, remove wastes, respond, and reproduce."),
            para("Robert Hooke improved a compound microscope in 1665 and saw tiny pores in cork. He named them cells because they looked like monastery rooms, and he published Micrographia. Leeuwenhoek’s simple microscope magnified 200–300 times; he saw bacteria and protozoa (‘animalcules’) and described sperm in 1677."),
            para("Schleiden (plants, 1838) and Schwann (animals, 1839) argued that cells make up plants and animals. They were wrong about how new cells appear. Rudolf Virchow stated in 1855 that all cells come from existing cells. Cell theory now has three points: living things are made of cells; the cell is the smallest unit of a living thing; new cells come from pre-existing cells."),
            callout("example", "Cork looked empty to Hooke because those plant cells were dead walls. Living cells are filled with cytoplasm and organelles.", "Why cork looked like boxes"),
            callout("warning", "Schleiden and Schwann get credit for the cell as a unit, not for cell origin. Virchow added ‘cells from cells’.", "Split the credit"),
            heading("What to remember"),
            bullets(
                "Hooke named cells (1665); Leeuwenhoek saw microbes.",
                "Schleiden and Schwann proposed cell theory; Virchow added origin from existing cells.",
                "Unicellular = one cell; multicellular = many specialised cells.",
            ),
            checkpoint(
                "Cell theory says new cells come from which source?",
                ["Crystalising body fluids", "Seeding by the nucleus only", "Pre-existing cells", "Spontaneous dust"],
                2,
                "Virchow’s point is that all new cells come from cells that already exist. Schleiden’s ‘seeding’ and Schwann’s ‘crystallising’ were rejected.",
            ),
            heading("Recap"),
            para("A cell is life’s unit. Microscopes revealed it. Cell theory’s three lines are your exam core: composition, smallest unit, and origin from other cells."),
        ],
        flashcards=[
            card("What is a cell?", "The structural and functional unit of life.", "focus"),
            card("Who named cells, and when?", "Robert Hooke in 1665, from cork.", "focus"),
            card("What did Leeuwenhoek call microbes?", "Animalcules.", "section"),
            card("Who proposed cell theory?", "Matthias Schleiden and Theodor Schwann.", "focus"),
            card("What did Virchow add in 1855?", "All cells are generated by existing cells.", "focus"),
            card("Give a unicellular and a multicellular example.", "Unicellular: Amoeba.\nMulticellular: human or Spirogyra.", "section"),
            card("State the three points of cell theory.", "Living things are made of cells.\nThe cell is the smallest unit.\nNew cells come from existing cells.", "focus"),
        ],
    ),
    lesson(
        key="bio101-ch04-organization-20261031",
        module_position=4, module_title=M4, lesson_position=2,
        title="Levels of cell organisation",
        objective="Order chemical, cell, tissue, organ, and system levels and give a human example of each.",
        minutes=10, pages="21–23",
        blocks=[
            heading("Understand the idea"),
            para("Cells did not appear fully modern. Early Earth may have received small molecules from meteorites, deep-sea vents, or lightning. RNA is often thought to be an early self-copying molecule because it can store information and speed reactions. Lipid molecules can form tiny bags in water, a step toward membranes. Cells are thought to be at least 4.0–4.3 billion years old."),
            para("Inside a body, organisation climbs. The chemical level is atoms and molecules such as amino acids. The cellular level is the working unit, including specialised cells such as egg, sperm, muscle, and nerve cells. A tissue is a group of cells with one job. Humans have epithelial, muscle, nervous, and connective tissues."),
            para("An organ is two or more tissues doing one function (heart, liver, kidney). A system is organs with a shared job: digestive, nervous, endocrine, circulatory, respiratory, urinary, reproductive. Cellular physiology is activity inside the cell; organ physiology is how organs work together."),
            callout("example", "Stomach wall: several muscle layers plus glands. That is tissue stacked into an organ, which then sits in the digestive system.", "From tissue to system"),
            callout("warning", "Do not skip ranks. A heart is not a tissue and a cell is not an organ. Each level is built from the one below.", "Keep the ladder"),
            heading("What to remember"),
            bullets(
                "Chemical → cell → tissue → organ → system.",
                "Four human tissues: epithelial, muscle, nervous, connective.",
                "Organ = two or more tissues; system = organs with one function.",
            ),
            checkpoint(
                "What is an organ in this chapter?",
                [
                    "A single cell type",
                    "Two or more tissues with a particular function",
                    "Any molecule in cytoplasm",
                    "The same as a tissue",
                ],
                1,
                "An organ is two or more tissues performing a particular function, such as heart, liver, or kidney.",
            ),
            heading("Recap"),
            para("Life likely started with simple molecules and membranes. In the body, molecules build cells, cells build tissues, tissues build organs, and organs build systems."),
        ],
        flashcards=[
            card("Name the four human tissue types.", "Epithelial, muscle, nervous, and connective.", "focus"),
            card("What is a tissue?", "A group of cells that perform a specific function.", "section"),
            card("What is an organ?", "Two or more tissues performing one function.", "focus"),
            card("What is a system?", "Organs that share a common function.", "section"),
            card("Cellular vs organ physiology?", "Cellular: activities inside the cell.\nOrgan: how organs work.", "section"),
            card("How old are the earliest cells in this text?", "At least 4.0 to 4.3 billion years.", "tip"),
        ],
    ),
    lesson(
        key="bio101-ch04-prokaryote-eukaryote-20261031",
        module_position=4, module_title=M4, lesson_position=3,
        title="Prokaryotic and eukaryotic cells",
        objective="Contrast prokaryotes and eukaryotes and list the four features common to all cells.",
        minutes=12, pages="24–27",
        blocks=[
            heading("Understand the idea"),
            para("There are two basic cell types. Prokaryotic means ‘before a nucleus’ (bacteria). Eukaryotic means ‘true nucleus’ (plant, animal, and your body cells). Despite the gap in complexity, both types do many of the same jobs with the same kind of DNA and the same genetic code."),
            para("Every cell has four shared parts. DNA carries instructions: in a nucleoid if prokaryotic, in a membrane-bound nucleus if eukaryotic. A plasma membrane of phospholipid and protein controls what enters. Cytoplasm is the material inside, with fluid cytosol. Ribosomes build proteins."),
            para("Eukaryotic cells are larger (about 5–100 μm) and have linear DNA with histones, several chromosomes, and membrane organelles such as mitochondria and ER. Prokaryotes are smaller (about 0.1–5 μm), with circular DNA, plasmids, a nucleoid that has no membrane, smaller ribosomes, and no true membrane organelles."),
            callout("example", "A bacterium is a backpack with tools loose inside. A liver cell is a workshop with labelled rooms (nucleus, mitochondria, Golgi).", "Rooms versus an open bag"),
            callout("warning", "A nucleoid is not a nucleus. It is only the region where DNA sits, with no envelope around it.", "Do not rename nucleoid"),
            heading("What to remember"),
            bullets(
                "All cells: DNA, plasma membrane, cytoplasm, ribosomes.",
                "Prokaryote: no nucleus, circular DNA, small, unicellular.",
                "Eukaryote: true nucleus, linear chromosomes, organelles.",
            ),
            checkpoint(
                "Which structures are found in all cells?",
                [
                    "Nucleus, mitochondria, Golgi",
                    "DNA, plasma membrane, cytoplasm, ribosomes",
                    "Chloroplasts and cell wall",
                    "Lysosomes and centrioles",
                ],
                1,
                "The four shared features are DNA, plasma membrane, cytoplasm, and ribosomes. Nucleus and mitochondria are eukaryotic extras.",
            ),
            heading("Recap"),
            para("Start with the four shared parts, then add the nucleus test. No nucleus and circular DNA: prokaryote. True nucleus and organelles: eukaryote."),
        ],
        flashcards=[
            card("What does prokaryotic mean?", "Before a nucleus.", "focus"),
            card("What does eukaryotic mean?", "Possessing a true nucleus.", "focus"),
            card("Four features of all cells?", "DNA, plasma membrane, cytoplasm, ribosomes.", "focus"),
            card("Where is DNA in a prokaryote?", "In the nucleoid region, not membrane-bound.", "section"),
            card("Prokaryotic vs eukaryotic DNA shape?", "Prokaryotic DNA is circular.\nEukaryotic DNA is linear.", "focus"),
            card("Typical size range for a prokaryote?", "About 0.1–5.0 micrometres.", "section"),
            card("Do prokaryotes have mitochondria?", "No. Membrane-bound organelles are absent.", "section"),
        ],
    ),
    lesson(
        key="bio101-ch04-plant-animal-cells-20261031",
        module_position=4, module_title=M4, lesson_position=4,
        title="Plant cells, animal cells, and a short review",
        objective="Compare plant and animal cells and use the chapter review questions as a self-check.",
        minutes=11, pages="28–30",
        blocks=[
            heading("Understand the idea"),
            para("The two eukaryotic types you must compare are plant and animal cells. Plant cells are generally larger (about 10–100 μm) with a fixed rectangular shape because a cellulose wall sits outside the plasma membrane. Animal cells are smaller (about 10–30 μm) and irregular, wrapped only by a flexible plasma membrane."),
            para("Plant cells have plastids and chloroplasts, one large supporting vacuole, and a nucleus often to one side. They store starch and can make many of their own nutrients. Animal cells lack chloroplasts and a wall. Their vacuoles are small and many. The nucleus is central. They store glycogen, have more mitochondria, and typically have centrioles, centrosomes, and lysosomes."),
            para("Both have cytoplasm, ribosomes, and a nucleus. Use those shared parts as the baseline, then add wall, chloroplast, and vacuole to recognise a plant cell in a diagram."),
            callout("example", "If a diagram shows a boxy cell with a thick outline and green ovals, it is a plant cell. A round cell with many small vacuoles is animal.", "Exam diagram habit"),
            callout("warning", "The source review asked for two features common to all cells: cytoplasm and ribosomes are accepted answers, along with DNA and membrane from the earlier list.", "Review trap"),
            heading("What to remember"),
            bullets(
                "Plant: wall, chloroplasts, large vacuole, starch, fixed shape.",
                "Animal: no wall, glycogen, centrioles, lysosomes, irregular shape.",
                "Organ = two or more tissues; prokaryotes lack nuclei.",
            ),
            checkpoint(
                "Which structure is present in plant cells but not in animal cells?",
                ["Ribosomes", "Nucleus", "Chloroplast", "Plasma membrane"],
                2,
                "Chloroplasts (and the cellulose wall and large vacuole) mark plant cells. Ribosomes, nucleus, and plasma membrane occur in both.",
            ),
            heading("Recap"),
            para("Eukaryotic does not mean identical. Plant versus animal is a table of wall, chloroplast, vacuole, stored food, and shape. That table plus cell theory closes Chapter 4."),
        ],
        flashcards=[
            card("Why is a plant cell’s shape fixed?", "A rigid cellulose cell wall surrounds it.", "focus"),
            card("Where is the nucleus in many plant cells?", "To one side, pushed by the large vacuole.", "section"),
            card("What food do plant cells store?", "Starch.", "section"),
            card("What food do animal cells store?", "Glycogen and complex carbohydrates.", "section"),
            card("Do animal cells have centrioles?", "Yes. Plant cells typically lack them.", "focus"),
            card("Cells without nuclei are called what?", "Prokaryotic cells.", "focus"),
            card("Two or more tissues doing one job form a…?", "An organ.", "section"),
        ],
    ),
    lesson(
        key="bio101-ch05-osmosis-20261031",
        module_position=5, module_title=M5, lesson_position=1,
        title="Osmosis",
        objective="Define osmosis, name hypotonic, isotonic, and hypertonic solutions, and predict what happens to plant and animal cells.",
        minutes=12, pages="31–33",
        blocks=[
            heading("Understand the idea"),
            para("Osmosis is the movement of water (or another solvent) through a partially permeable membrane from the side with more free water to the side with less free water. That is the same as moving toward the higher solute concentration. It is passive: the cell does not spend ATP on the water flow itself."),
            para("An isotonic solution matches the cell: water in equals water out. A hypotonic solution is more dilute outside, so water enters (endosmosis); the cell becomes turgid. A hypertonic solution is more concentrated outside, so water leaves (exosmosis); the cell becomes flaccid or plasmolysed. Osmotic pressure is the pressure that can stop that flow."),
            para("Animal cells survive in isotonic fluid; they can burst (lyse) in hypotonic liquid. Plant cells have walls, so hypotonic surroundings are useful: turgor supports the plant. In isotonic solution a plant may droop. Roots take water from soil by osmosis and send it up the xylem."),
            callout("example", "Guard cells swell with water and open stomata. Freshwater fish must handle water constantly entering their cells. Cholera can reverse intestinal water flow and cause dehydration.", "Osmosis you can notice"),
            callout("warning", "Hypotonic and hypertonic are named from solute, not from water. Hypertonic = more solute outside, so water leaves the cell.", "Name the solute side"),
            heading("What to remember"),
            bullets(
                "Osmosis: water through a membrane, high water → low water, no extra energy.",
                "Hypotonic: water in; hypertonic: water out; isotonic: no net change.",
                "Plants need turgor; animal cells lyse if too much water enters.",
            ),
            checkpoint(
                "What happens to an animal cell in a hypotonic solution?",
                [
                    "It becomes turgid and is protected by a wall",
                    "There is no net water movement",
                    "Water enters and the cell may lyse",
                    "Water leaves and the cell plasmolyses",
                ],
                2,
                "Hypotonic means more water enters. Animal cells lack a strong wall, so they can burst. Plant cells become turgid instead.",
            ),
            heading("Recap"),
            para("Osmosis is water following its concentration through a membrane. Link each solution name to the direction of water, then to turgor, drooping, or bursting."),
        ],
        flashcards=[
            card("Define osmosis.", "Water moves through a partially permeable membrane from high water to low water.", "focus"),
            card("Is osmosis active or passive?", "Passive; it does not spend energy.", "section"),
            card("What is an isotonic solution?", "Same solute inside and outside; no net water movement.", "focus"),
            card("Endosmosis vs exosmosis?", "Endosmosis: water in, turgid.\nExosmosis: water out, flaccid or plasmolysis.", "focus"),
            card("Why don’t plant cells burst in hypotonic solution?", "Thick walls hold them; turgor is useful.", "section"),
            card("What is osmotic pressure?", "The pressure needed to stop osmosis.", "section"),
            card("Why does root water rise in a plant?", "Osmosis absorbs soil water and helps move it in the xylem.", "tip"),
        ],
    ),
    lesson(
        key="bio101-ch05-diffusion-20261031",
        module_position=5, module_title=M5, lesson_position=2,
        title="Diffusion",
        objective="Define diffusion, distinguish it from osmosis, and explain simple versus facilitated diffusion.",
        minutes=11, pages="33–37",
        blocks=[
            heading("Understand the idea"),
            para("Diffusion is the movement of molecules from higher concentration to lower concentration until the mix is even. It happens in solids, liquids, and gases. Unlike osmosis, it does not require a membrane and both solute and solvent can move, in all directions. You cannot stop ordinary diffusion by squeezing one side."),
            para("Simple diffusion crosses a membrane or space without a helper protein, as when oxygen enters cytoplasm. Facilitated diffusion is still passive, but a carrier protein helps a substance cross from high to low concentration. Temperature, gradient steepness, distance, particle size, and membrane type change the rate."),
            para("Diffusion lets carbon dioxide leave cells, moves ions, brings soil water and minerals toward root hairs, and helps nerve signals. In plants it also moves gases through stomata and spreads flower scent. Tea in hot water, perfume in air, and incense smoke are everyday pictures of the same rule."),
            callout("example", "Osmosis is a special water story through a membrane. Diffusion is the general mixing story. If perfume fills a room, that is diffusion, not osmosis.", "Keep the two words apart"),
            callout("warning", "Facilitated diffusion still goes high to low and does not spend ATP. Do not call it active transport.", "Helper is not a pump"),
            heading("What to remember"),
            bullets(
                "Diffusion: high concentration → low, any state of matter.",
                "Simple = no protein helper; facilitated = carrier, still passive.",
                "Osmosis needs a membrane and concerns water; diffusion is broader.",
            ),
            checkpoint(
                "Which statement matches diffusion rather than osmosis?",
                [
                    "Only water moves, and a membrane is required",
                    "The process can be reversed by extra pressure on one side",
                    "Particles can move in all directions without a membrane",
                    "It occurs only between similar solutions",
                ],
                2,
                "Diffusion does not need a semipermeable membrane and can run in all directions. Osmosis is the water-and-membrane case.",
            ),
            heading("Recap"),
            para("Diffusion equalises concentration. Add a membrane and water only, and you have osmosis. Add a carrier protein but no energy cost, and you have facilitated diffusion."),
        ],
        flashcards=[
            card("Define diffusion.", "Movement of molecules from higher to lower concentration until even.", "focus"),
            card("Does diffusion need a membrane?", "No. Osmosis does.", "focus"),
            card("What is simple diffusion?", "A substance crosses without a transport protein.", "section"),
            card("What is facilitated diffusion?", "Passive movement through a carrier from high to low concentration.", "focus"),
            card("Name two factors that speed diffusion.", "Higher temperature and a steeper concentration gradient.", "section"),
            card("Give one living use of diffusion.", "CO2 leaving cells, or ions moving in nerves.", "tip"),
        ],
    ),
    lesson(
        key="bio101-ch05-mitosis-20261031",
        module_position=5, module_title=M5, lesson_position=3,
        title="Cell division and mitosis",
        objective="Explain why cells divide and walk through interphase plus the stages of mitosis.",
        minutes=13, pages="37–40",
        blocks=[
            heading("Understand the idea"),
            para("Cell division makes new cells for growth, replacement, and reproduction. Unicellular organisms often split by binary fission. Multicellular bodies use mitosis for new body cells and meiosis for sperm and egg. Mitosis copies chromosomes so each daughter cell matches the parent. In humans that number stays 46."),
            para("The cell cycle is G1 (growth), S (DNA and centrosome copied), G2 (more growth and checks), then M phase. Interphase is G1 + S + G2, when the cell is not yet visibly dividing. M phase is prophase, metaphase, anaphase, telophase, then cytokinesis, which splits the cytoplasm."),
            para("In prophase the nuclear envelope breaks, the nucleolus fades, and chromosomes condense as sister chromatids. Prometaphase attaches spindle fibres to kinetochores. Metaphase lines chromosomes at the equator. Anaphase pulls sisters apart. Telophase rebuilds nuclei. Animals pinch in; plants build a cell plate."),
            callout("example", "Remember PMAT: prophase packs, metaphase meets in the middle, anaphase apart, telophase two nuclei.", "Four letters"),
            callout("warning", "Interphase is not a rest with nothing happening. DNA is copied in S phase. If that copy is wrong, later mitosis can spread damage.", "Interphase is busy"),
            heading("What to remember"),
            bullets(
                "Mitosis → two identical body cells; chromosome number unchanged.",
                "Cycle: G1, S, G2, mitosis, cytokinesis.",
                "PMAT + cytokinesis completes the visible division.",
            ),
            checkpoint(
                "During which stage do sister chromatids separate?",
                ["Prophase", "Metaphase", "Anaphase", "Interphase"],
                2,
                "Anaphase is the short stage when centromeres split and sisters are pulled to opposite poles. Metaphase only lines them up.",
            ),
            heading("Recap"),
            para("Mitosis keeps chromosome number and identity. Learn the cycle names, then PMAT, then how plant and animal cells finish cytokinesis differently."),
        ],
        flashcards=[
            card("What does mitosis produce?", "Two identical body cells with the same chromosome number.", "focus"),
            card("Why do humans stay at 46 chromosomes in body cells?", "Mitosis duplicates and then shares chromosomes equally.", "section"),
            card("What happens in S phase?", "DNA is replicated and the centrosome is copied.", "focus"),
            card("What is interphase?", "G1 + S + G2; the cell grows and copies DNA.", "section"),
            card("What happens at metaphase?", "Chromosomes line up at the metaphase plate.", "focus"),
            card("Plant vs animal cytokinesis?", "Plants form a cell plate.\nAnimals constrict the cytoplasm.", "section"),
        ],
    ),
    lesson(
        key="bio101-ch05-meiosis-20261031",
        module_position=5, module_title=M5, lesson_position=4,
        title="Meiosis I and meiosis II",
        objective="Describe how meiosis halves the chromosome number and creates genetic variety.",
        minutes=13, pages="40–43",
        blocks=[
            heading("Understand the idea"),
            para("Meiosis is eukaryotic cell division that makes haploid gametes. A diploid human cell has 46 chromosomes (23 pairs). After meiosis, egg or sperm has 23. Fertilisation returns the number to 46. Meiosis is two divisions after one DNA copy: meiosis I then meiosis II."),
            para("Meiosis I separates homologous pairs. In prophase I, homologues pair, form tetrads, and may swap DNA at chiasmata (crossing over). Metaphase I lines bivalents; anaphase I sends homologues to opposite poles. The two cells are already haploid for chromosome pairs, though each chromosome still has two chromatids."),
            para("Meiosis II is like a mitosis of those haploid cells: sister chromatids separate. Variety comes from crossing over in meiosis I and from random lining-up of maternal and paternal chromosomes. Humans have 23 pairs, so independent assortment alone allows over 8 million combinations."),
            callout("example", "Sperm cell precursor diagrams in the notes show pairing and crossing over in meiosis I, then a second split. Female meiosis II also forms polar bodies beside the egg.", "Follow the diagrams"),
            callout("warning", "Do not say meiosis II halves 46 to 23. The drop from diploid to haploid is meiosis I. Meiosis II splits chromatids.", "Which division halves pairs"),
            heading("What to remember"),
            bullets(
                "Meiosis: one DNA copy, two divisions, haploid gametes.",
                "Meiosis I: homologues pair, cross over, then separate.",
                "Meiosis II: sister chromatids separate.",
            ),
            checkpoint(
                "When does crossing over occur?",
                ["Prophase of mitosis", "Prophase I of meiosis", "Anaphase II", "Cytokinesis only"],
                1,
                "Homologous chromosomes pair and exchange DNA in prophase I. Mitosis has no pairing of homologues and no crossing over in this course.",
            ),
            heading("Recap"),
            para("Meiosis exists so chromosome number does not double every generation, and so offspring are not copies. Pairing, crossing over, and a second split are the story."),
        ],
        flashcards=[
            card("What does meiosis produce?", "Haploid gametes with half the chromosome number.", "focus"),
            card("Human body vs gamete chromosome number?", "46 in body cells; 23 in egg or sperm.", "focus"),
            card("What is synapsis?", "Homologous chromosomes pairing closely as tetrads.", "section"),
            card("What is a chiasma?", "The point where crossing over links homologues.", "section"),
            card("Meiosis I vs meiosis II?", "I separates homologues.\nII separates sister chromatids.", "focus"),
            card("Why are siblings not identical?", "Crossing over plus random assortment of chromosome pairs.", "tip"),
        ],
    ),
    lesson(
        key="bio101-ch05-division-significance-20261031",
        module_position=5, module_title=M5, lesson_position=5,
        title="Why cell division matters",
        objective="List the uses of cell division and contrast mitosis with meiosis in a short table.",
        minutes=9, pages="44",
        blocks=[
            heading("Understand the idea"),
            para("Cell division is required for growth, repair, and reproduction in every living creature. Unicellular organisms reproduce by binary fission. Multicellular organisms use division to make gametes and to add or replace body cells. Without control, division can contribute to cancer."),
            para("Division renews damaged cells, produces new cells from older ones, keeps a working chromosome set, and increases cell number for growth. In plants, mitosis also builds new organs and repairs wounded parts. Meiosis is the special path that halves chromosomes for sexual reproduction."),
            para("Mitosis forms genetically identical sister chromatids and two daughters with the parent number. Meiosis pairs homologues, allows crossing over, and yields four daughters with half the count. Those two outcomes must not be swapped in an exam answer."),
            callout("example", "A healing skin cut is mitosis. Making sperm is meiosis. A bacterium splitting is binary fission, still a form of division.", "Match the job"),
            callout("warning", "Uncontrolled division is not ‘more growth’ in a healthy sense. The notes link poor regulation to serious disease such as cancer.", "Control matters"),
            heading("What to remember"),
            bullets(
                "Uses: growth, repair, reproduction, development.",
                "Mitosis: two identical cells, same chromosome number.",
                "Meiosis: four haploid cells, half the number, variety.",
            ),
            checkpoint(
                "Which result matches meiosis rather than mitosis?",
                [
                    "Two daughters with the parent chromosome number",
                    "Genetically identical body cells",
                    "Four haploid cells and crossing over",
                    "A cell plate with no chromosome change",
                ],
                2,
                "Meiosis produces haploid cells and includes pairing and crossing over. Mitosis makes two matching body cells.",
            ),
            heading("Recap"),
            para("Ask what the new cells are for. Body growth and repair point to mitosis. Gametes and halved chromosomes point to meiosis."),
        ],
        flashcards=[
            card("Why is cell division needed?", "Growth, repair, and reproduction.", "focus"),
            card("How do many unicellular organisms divide?", "Binary fission.", "section"),
            card("Mitosis daughter number and type?", "Two cells with the parent chromosome count.", "focus"),
            card("Meiosis daughter number and type?", "Four haploid cells.", "focus"),
            card("When do homologues pair?", "In meiosis (prophase I), not in mitosis.", "section"),
            card("What if cell division is not regulated?", "It can cause serious disease such as cancer.", "tip"),
        ],
    ),
    lesson(
        key="bio101-ch06-heredity-20261031",
        module_position=6, module_title=M6, lesson_position=1,
        title="What heredity is and why it matters",
        objective="Define heredity and variation, and explain why genetics matters in medicine, farming, and evolution.",
        minutes=10, pages="45–46",
        blocks=[
            heading("Understand the idea"),
            para("Heredity is the passing of traits from parents to offspring through genes. It is easiest to see in sexual reproduction, where children resemble both parents but are not copies. Variation comes from DNA copying mistakes, from the environment acting on genes, and from mutations. Asexual offspring vary much less."),
            para("Heredity is the base of biological diversity: traits travel generation to generation and help explain why organisms look and behave as they do. It is also the foundation of genetics, which studies genes, inheritance, genetic disease, and evolution."),
            para("Knowing heredity helps diagnose genetic disorders, estimate risk, and counsel families. It underpins evolution by natural selection, crop improvement, gene therapy, and conservation of endangered species. It also raises ethical questions about testing and genetic technology."),
            callout("example", "A family may share eye colour through genes, while a farmer selects seed that keeps a useful trait in the next harvest.", "Home and farm"),
            callout("warning", "Aristotle thought parental traits blended like paint, so a tall and short parent would make medium children forever. Mendel showed units can hide and reappear.", "Blending is the old error"),
            heading("What to remember"),
            bullets(
                "Heredity = traits through genes from parent to offspring.",
                "Variation is normal and fuels diversity and evolution.",
                "Applications: medicine, biotechnology, conservation, ethics.",
            ),
            checkpoint(
                "What is heredity?",
                [
                    "The ageing of cells only",
                    "Passing traits from parents to offspring through genes",
                    "Any change caused only by weather",
                    "The mixing of blood in Aristotle’s sense",
                ],
                1,
                "Heredity is gene-based transmission of characteristics from one generation to the next.",
            ),
            heading("Recap"),
            para("Heredity is genetic handover. Variation keeps life diverse. That idea opens medicine, evolution, and the pea experiments in the next lesson."),
        ],
        flashcards=[
            card("Define heredity.", "Passing of traits from parents to offspring through genes.", "focus"),
            card("Name two causes of variation.", "DNA copying errors and gene–environment interaction or mutation.", "section"),
            card("Why is heredity medically useful?", "It helps diagnose disorders, predict risk, and guide counselling.", "focus"),
            card("How does heredity help conservation?", "It tracks diversity and guides breeding of endangered species.", "tip"),
            card("What was Aristotle’s inheritance idea?", "Blending of parental traits, which cannot explain hidden traits returning.", "section"),
        ],
    ),
    lesson(
        key="bio101-ch06-mendel-20261031",
        module_position=6, module_title=M6, lesson_position=2,
        title="Mendel’s experiments and genetic terms",
        objective="State Mendel’s main laws and use genotype, phenotype, and allele language on a monohybrid cross.",
        minutes=14, pages="46–51",
        blocks=[
            heading("Understand the idea"),
            para("Gregor Mendel (1822–1884), an Austrian monk, crossed pea plants and tracked height, flower colour, and seed texture. He showed that traits are discrete units (now called genes) that come in pairs (alleles) and are inherited by rules, not by blending."),
            para("The law of segregation: the two alleles for a trait separate when gametes form, so each gamete carries one. Offspring get one allele from each parent. Independent assortment: alleles for different traits segregate independently. Dominance: a dominant allele can hide a recessive allele in a heterozygote. F2 often shows about three dominant phenotypes to one recessive."),
            para("A gene is a DNA unit of inheritance. Alleles are its alternative forms. Genotype is the allele set (TT, Tt, tt). Phenotype is what you see (tall or short). Capital letters are dominant; lowercase recessive. Homozygous means both alleles the same; heterozygous means they differ. Chromosomes are the threads that carry genes."),
            callout("example", "Tall (TT or Tt) × short (tt). F1 is all tall Tt. F2 is about 3 tall : 1 short, with genotypes 1 TT : 2 Tt : 1 tt. One T is enough for tall.", "Monohybrid height"),
            callout("warning", "A 3:1 ratio is the phenotype in F2, not the genotype. The genotype split is 1:2:1. Dihybrid crosses follow two trait pairs at once.", "Ratio mix-up"),
            heading("What to remember"),
            bullets(
                "Segregation, independent assortment, and dominance are Mendel’s core rules.",
                "Genotype = alleles; phenotype = expressed trait.",
                "Monohybrid F2 phenotype ≈ 3:1; genotype 1:2:1.",
            ),
            checkpoint(
                "In a monohybrid tall × short cross, why can F2 include short plants again?",
                [
                    "Because blending makes medium then short",
                    "Because recessive alleles can meet as tt after segregation",
                    "Because height is not genetic",
                    "Because F1 plants were all short",
                ],
                1,
                "F1 heterozygotes are tall. Segregation lets two t alleles meet in some F2 offspring, which are short. The trait was hidden, not destroyed.",
            ),
            heading("Recap"),
            para("Mendel turned inheritance into countable units. Learn the three laws, the letter code, and the monohybrid ratios before you read genes and chromosomes in Chapter 7."),
        ],
        flashcards=[
            card("Who is called the father of genetics here?", "Gregor Mendel.", "focus"),
            card("What is the law of segregation?", "Allele pairs separate in gamete formation; each gamete gets one.", "focus"),
            card("What is independent assortment?", "Alleles of different traits segregate independently.", "section"),
            card("Genotype vs phenotype?", "Genotype is the allele set.\nPhenotype is the expressed trait.", "focus"),
            card("What does heterozygous mean?", "The two alleles of a gene are different, e.g. Tt.", "section"),
            card("F2 monohybrid phenotype ratio?", "About 3 dominant : 1 recessive.", "focus"),
            card("What is a dihybrid cross?", "A cross that follows two pairs of contrasting characters.", "section"),
            card("How are dominant alleles written?", "Capital letters; recessive alleles use lowercase.", "tip"),
        ],
    ),
    lesson(
        key="bio101-ch07-genes-20261031",
        module_position=7, module_title=M7, lesson_position=1,
        title="Genes, DNA, and how genes work",
        objective="Describe genes as DNA instructions and outline transcription, translation, and gene function.",
        minutes=12, pages="52–55",
        blocks=[
            heading("Understand the idea"),
            para("Genes are the basic units of heredity: segments of DNA that carry instructions, especially for proteins. DNA is a double helix of two polynucleotide chains. Four bases write the code: adenine (A), cytosine (C), thymine (T), and guanine (G). About three billion bases are in a human; roughly 99% are the same in everyone."),
            para("William Bateson used ‘genetics’ in 1905. Wilhelm Johannsen named the ‘gene’ in 1909. A gene sits at a locus on a chromosome. The genome is the full set. Humans have 23 pairs of chromosomes. A codon is three bases that specify an amino acid. Transcription copies a gene into mRNA; translation builds the protein."),
            para("Genes control DNA and RNA work and therefore enzymes and structures such as haemoglobin, which carries oxygen. Phenotype comes from genotype plus environment. Many traits are polygenic. Mutations create alleles; natural selection and drift change how common those alleles are."),
            callout("example", "Each parent passes one copy of a gene, so a child can show a mix of both, such as hair or eye features.", "Why children resemble both parents"),
            callout("warning", "DNA is the stored manual; RNA can be a working copy. Do not say a gene is the whole chromosome.", "Gene is a segment"),
            heading("What to remember"),
            bullets(
                "Gene = DNA instruction, often for a protein; locus = its place.",
                "DNA bases A, C, T, G; codon = three bases.",
                "Transcription then translation turn a gene into protein.",
            ),
            checkpoint(
                "What is a codon in this chapter?",
                [
                    "A whole chromosome",
                    "Three DNA bases that specify an amino acid",
                    "A histone protein only",
                    "The nuclear membrane",
                ],
                1,
                "The genetic code uses three-base units (codons) to specify amino acids in a protein.",
            ),
            heading("Recap"),
            para("A gene is a DNA paragraph. Chromosomes are the books. Expression copies the paragraph into RNA and then into protein, which does the body’s work."),
        ],
        flashcards=[
            card("What is a gene?", "A DNA segment that carries hereditary instructions.", "focus"),
            card("Name the four DNA bases.", "Adenine, cytosine, thymine, guanine.", "focus"),
            card("What is a genome?", "The complete set of chromosomes / genetic material.", "section"),
            card("How many chromosome pairs in a human cell?", "23 pairs (46 chromosomes).", "focus"),
            card("Transcription vs translation?", "Transcription: DNA → mRNA.\nTranslation: mRNA → protein.", "focus"),
            card("What is a locus?", "The fixed position of a gene on a chromosome.", "section"),
            card("Give one named gene product.", "Haemoglobin, which carries oxygen in blood.", "tip"),
        ],
    ),
    lesson(
        key="bio101-ch07-chromosomes-20261031",
        module_position=7, module_title=M7, lesson_position=2,
        title="Chromosomes and their relationship to genes",
        objective="Explain what chromosomes are, how they differ from genes, and why chromosome errors matter.",
        minutes=12, pages="55–61",
        blocks=[
            heading("Understand the idea"),
            para("A chromosome is a microscopic thread of DNA plus packaging proteins. It carries many genes. In eukaryotes DNA wraps on histone proteins so a huge length can fit in the nucleus. Chromosomes become easy to see when a cell divides. Each daughter cell should receive a complete set."),
            para("A gene is a short coded stretch and is not visible under an ordinary microscope. A chromosome is a pack of many genes, visible when condensed, and large changes (duplication, deletion, inversion, rearrangement) affect many genes at once. Equal splitting of chromosomes keeps DNA balanced; unequal splitting can cause disorders."),
            para("Genes and chromosomes together transmit instructions through mitosis and meiosis, regulate when proteins are made, and sit in linked groups. Errors can cause conditions named in the notes such as Down syndrome, Turner syndrome, and some leukaemias. Understanding this map also supports gene editing, personalised medicine, and conservation."),
            callout("example", "Think of a chromosome as a necklace and genes as the beads. Moving the whole necklace is a chromosomal change; swapping one bead is a gene mutation.", "Necklace model"),
            callout("warning", "Do not treat gene and chromosome as synonyms. Exams ask for definition, location, visibility, and size of change.", "Use the comparison table"),
            heading("What to remember"),
            bullets(
                "Chromosome = long DNA with many genes, packed with histones.",
                "Gene = one coded segment on a chromosome.",
                "Chromosome mistakes can cause named genetic disorders.",
            ),
            checkpoint(
                "Which statement is true?",
                [
                    "A gene contains many chromosomes",
                    "A chromosome is a pack of genes visible in cell division",
                    "Genes are visible under a light microscope as X shapes",
                    "Histones are the four DNA bases",
                ],
                1,
                "Chromosomes package many genes with proteins and are the structures you see during division. Genes themselves are not those X shapes.",
            ),
            heading("Recap"),
            para("Genes are instructions; chromosomes are the structures that carry, copy, and share those instructions. Keep that relationship clear and you have finished BIO 101 chapters 1–7."),
        ],
        flashcards=[
            card("What is a chromosome?", "A thread of DNA and protein that carries many genes.", "focus"),
            card("What are histones?", "Proteins that pack eukaryotic DNA in chromosomes.", "focus"),
            card("Is a gene visible under the microscope?", "No. The chromosome is the visible pack during division.", "section"),
            card("Name two chromosomal disorders from the notes.", "Down syndrome and Turner syndrome.", "focus"),
            card("Why must chromosomes split equally?", "So each daughter cell gets a complete DNA set.", "section"),
            card("Gene vs chromosome location?", "A gene sits on a chromosome.\nA chromosome is packed in the nucleus.", "focus"),
            card("Name one large chromosomal change.", "Duplication, deletion, inversion, or rearrangement.", "section"),
            card("True or false: the gene is the basis of heredity.", "True.", "focus"),
        ],
    ),
]


def validate(rows: list[dict]) -> None:
    errors: list[str] = []
    seen: set[tuple] = set()
    for i, row in enumerate(rows, 1):
        key = (row["course_code"], row["module_position"], row["lesson_position"])
        if key in seen:
            errors.append(f"row {i}: duplicate module/lesson position {key}")
        seen.add(key)
        if not 1 <= len(row["title"]) <= 200:
            errors.append(f"row {i}: title length")
        if not 1 <= len(row["objective"]) <= 1000:
            errors.append(f"row {i}: objective length")
        if row["estimated_minutes"] < 1:
            errors.append(f"row {i}: minutes")
        blocks = row["blocks"]
        if not blocks:
            errors.append(f"row {i}: empty blocks")
        if not any(b["type"] == "checkpoint" for b in blocks):
            errors.append(f"row {i}: needs checkpoint")
        if not any(b["type"] == "callout" and b.get("tone") == "example" for b in blocks):
            errors.append(f"row {i}: needs example callout")
        if not any(b["type"] == "paragraph" and len(b["text"]) >= 80 for b in blocks):
            errors.append(f"row {i}: needs long paragraph")
        for j, b in enumerate(blocks, 1):
            if b["type"] == "paragraph" and len(b["text"]) > 600:
                nxt = blocks[j] if j < len(blocks) else None
                if not nxt or nxt["type"] not in {"list", "equation", "worked_example"}:
                    errors.append(f"row {i} block {j}: paragraph too long")
        cards = row["flashcards"]
        if not 1 <= len(cards) <= 30:
            errors.append(f"row {i}: flashcard count {len(cards)}")
        for k, c in enumerate(cards, 1):
            if not 1 <= len(c["front"]) <= 500 or not 1 <= len(c["back"]) <= 520:
                errors.append(f"row {i} card {k}: length front={len(c['front'])} back={len(c['back'])}")
    if errors:
        raise SystemExit("Validation failed:\n" + "\n".join(errors))


def main() -> None:
    validate(lessons)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(lessons, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{OUT}: {len(lessons)} lessons")
    by_mod: dict[int, int] = {}
    cards = 0
    for row in lessons:
        by_mod[row["module_position"]] = by_mod.get(row["module_position"], 0) + 1
        cards += len(row["flashcards"])
    print("modules:", by_mod, "flashcards:", cards)


if __name__ == "__main__":
    main()
