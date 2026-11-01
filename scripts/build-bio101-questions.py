"""Build BIO 101 learning + battle questions from chapters 1–7 notes."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "supabase/content/bio-101-chapters-1-7-questions-20261101.json"
SRC = "BIO CH.1-7.pdf"

# prompt, options (4), correct_index 0-3, explanation, difficulty, book pages
BANK: list[tuple[str, list[str], int, str, str, str]] = [
    # Chapter 1
    ("Biology is best defined as the scientific study of:", ["Rocks and minerals", "Life", "Only human disease", "The weather"], 1, "The notes define biology as the scientific study of life, from cells to ecosystems.", "beginner", "1–2"),
    ("Which scientist grouped animals by visible traits in ancient Greece?", ["Linnaeus", "Darwin", "Aristotle", "Harvey"], 2, "Aristotle made an early classification of animals from what he could observe.", "beginner", "1"),
    ("William Harvey is linked in this course to:", ["The naming of cells", "Blood circulation", "The structure of DNA", "Natural selection"], 1, "Harvey showed that blood circulates through the body.", "beginner", "1"),
    ("Who introduced the two-part naming system still used to name species?", ["Aristotle", "Carolus Linnaeus", "Ibn Sina", "Vesalius"], 1, "Linnaeus built the naming method used in modern classification.", "beginner", "1"),
    ("Darwin’s main contribution named in the notes is:", ["The microscope", "Evolution by natural selection", "The cell wall", "Anaerobic respiration"], 1, "Darwin explained how species change by natural selection.", "beginner", "1"),
    ("Watson and Crick described:", ["The circulation of blood", "The structure of DNA", "Plant meristems", "Kingdom Fungi"], 1, "They described the structure of DNA, a 20th-century landmark in the notes.", "beginner", "1"),
    ("Botany is the study of:", ["Animals", "Fossils only", "Plants", "The immune system"], 2, "Botany is the plant branch of biology; zoology is animals.", "beginner", "2"),
    ("Zoology is the study of:", ["Plants", "Animals", "Rocks", "Weather systems"], 1, "Zoology covers the animal kingdom.", "beginner", "2"),
    ("Which branch studies how organisms interact with their environment?", ["Anatomy", "Ecology", "Paleontology", "Immunology"], 1, "Ecology examines organisms with each other and their surroundings.", "beginner", "2–3"),
    ("Genetics is the study of:", ["Only ocean animals", "How traits are passed on", "Rock layers", "Star positions"], 1, "Genetics studies heredity through genes, DNA, and chromosomes.", "beginner", "3"),
    ("Microbiology studies:", ["Only whales", "Bacteria, archaea, protists and fungi", "Only flowering plants", "The whole solar system"], 1, "Microbiology is the world of microorganisms listed in the notes.", "beginner", "3"),
    ("A career field listed under the scope of biology is:", ["Astronomy of black holes", "Medicine", "Pure number theory", "Civil court procedure"], 1, "Medicine is named first among biology career fields, with agriculture, pharmacy and others.", "beginner", "6"),
    # Chapter 2
    ("Living things are made of microscopic structures called:", ["Atoms only", "Cells", "Crystals", "Sand grains"], 1, "Living things are cellular; the cell is the basic unit of life.", "beginner", "7–8"),
    ("Which extras distinguish a typical plant cell from an animal cell?", ["Flagellum, lysosome and centriole", "Cell wall, chloroplast and large central vacuole", "Nucleoid, pili and capsule", "Gills, lungs and kidneys"], 1, "Plant cells have a wall, chloroplasts and a large vacuole.", "beginner", "8"),
    ("Anabolism is:", ["Breaking molecules to release energy", "Building complex molecules using energy", "Death of an organism", "A type of fossil"], 1, "Anabolism (constructive metabolism) builds complex substances from simpler ones.", "beginner", "8–9"),
    ("Catabolism is:", ["Building proteins for storage", "Breaking complex molecules and releasing energy", "A kingdom of plants", "A type of chromosome"], 1, "Catabolism is destructive metabolism: complex molecules are broken down, often to release energy.", "beginner", "9"),
    ("Metabolism is:", ["Only photosynthesis", "Only excretion", "Anabolism plus catabolism", "A non-living process"], 2, "Metabolism collectively names both anabolic and catabolic processes.", "beginner", "9"),
    ("Organisms that manufacture their own food are:", ["Heterotrophs", "Autotrophs", "Carnivores only", "Omnivores only"], 1, "Autotrophs make their own food, for example green plants by photosynthesis.", "beginner", "9"),
    ("In the photosynthesis equation in the notes, the sugar produced is:", ["Ethanol", "Urea", "Glucose", "Cellulose only"], 2, "Light and chlorophyll convert carbon dioxide and water to glucose and oxygen.", "beginner", "9–10"),
    ("The light (Hill) reaction of photosynthesis:", ["Needs no light", "Absorbs light, splits water and makes reducing power", "Is only chewing of food", "Occurs only in mitochondria"], 1, "The light phase needs light: chlorophyll absorbs energy and water is split, producing NADP reducing agent and cellular energy.", "beginner", "10"),
    ("The dark phase of photosynthesis mainly:", ["Splits water using light", "Fixes carbon dioxide into organic compounds", "Makes urea in the kidney", "Copies DNA"], 1, "The dark phase does not need light; it uses reducing power from the light phase to fix CO2.", "beginner", "10"),
    ("Chemosynthesis uses:", ["Sunlight only", "Chemical energy, not light, to make food", "Only animal digestion", "Wind energy"], 1, "Colourless bacteria can make food from chemical energy such as nitrogen, sulphide or iron compounds.", "beginner", "10"),
    ("Herbivores, carnivores and omnivores are all:", ["Autotrophs", "Consumers (heterotrophs)", "Prokaryotes", "Fungi"], 1, "Heterotrophs must obtain energy by eating; the three consumer types are named in the notes.", "beginner", "10"),
    ("Aerobic respiration takes place:", ["Without oxygen", "In the presence of oxygen", "Only in dead cells", "Only in viruses"], 1, "Aerobic respiration uses oxygen; glucose plus oxygen yields carbon dioxide, water and ATP.", "beginner", "10"),
    ("Anaerobic respiration in the notes yields:", ["Only water", "Ethanol, carbon dioxide and energy", "Starch only", "DNA"], 1, "Without oxygen, glucose can form ethanol, CO2 and energy.", "beginner", "10"),
    ("Organs of respiration in mammals, fish and amoeba are:", ["Leaves, stomata and xylem", "Lungs, gills and body surface", "Kidneys, liver and skin only", "Roots, stems and fruits"], 1, "Mammals use lungs, fish use gills, amoeba uses the body surface.", "beginner", "10"),
    ("Excretion is:", ["Taking in food", "Removal of toxic metabolic wastes and excess substances", "Cell division", "Naming species"], 1, "Excretion removes toxic materials, metabolic wastes and excess substances.", "beginner", "10–11"),
    ("Sexual reproduction requires:", ["No parents", "Union of male and female cells to form a zygote", "Only budding", "Only binary fission"], 1, "Sexual reproduction uses gametes that form a zygote.", "beginner", "11"),
    ("Asexual reproduction examples in the notes include:", ["Only fertilisation", "Binary fission, budding and vegetative propagation", "Meiosis I only", "Pollination only"], 1, "Asexual reproduction does not use sex cells; fission, budding and vegetative propagation are named.", "beginner", "11"),
    ("Senescence in this chapter means:", ["Seed germination", "Biological ageing ending in death", "Photosynthesis", "Classification"], 1, "Living things have a lifespan; senescence is biological ageing that ends in death.", "beginner", "12"),
    ("Which is a non-living example from the comparison table?", ["Maize plant", "Insect", "Rock", "Human"], 2, "Rocks, pens, buildings and gadgets are listed as non-living.", "beginner", "12"),
    # Chapter 3
    ("Classification arranges organisms by:", ["Random page numbers", "Similarities and differences", "Only colour of fur", "Only habitat temperature"], 1, "Classification groups living things by similarities and differences.", "beginner", "13"),
    ("The study of classification principles is:", ["Physiology", "Taxonomy (systematics)", "Pharmacology", "Forensics"], 1, "Taxonomy or systematics studies the general principles of classification.", "beginner", "13"),
    ("The smallest unit of classification is the:", ["Kingdom", "Phylum", "Family", "Species"], 3, "Species is the most exact rank; members can mate and produce fertile offspring.", "beginner", "13–15"),
    ("The hierarchy from largest to smallest begins:", ["Species then genus", "Kingdom, then phylum or division", "Family then kingdom", "Order then kingdom"], 1, "Kingdom is largest, then phylum/division, class, order, family, genus, species.", "beginner", "13–14"),
    ("A scientific name has two parts:", ["Family and order", "Genus then species", "Kingdom then phylum", "Class then family"], 1, "Binomial names use genus first and species second.", "beginner", "15"),
    ("The five kingdoms in this course are:", ["Virus, Algae, Moss, Fern, Pine", "Monera, Protista, Fungi, Plantae, Animalia", "Fish, Bird, Mammal, Reptile, Amphibian", "Root, Stem, Leaf, Flower, Fruit"], 1, "Linnaeus is presented as classifying living things into those five kingdoms.", "beginner", "15"),
    ("Kingdom Monera cell type is:", ["Eukaryotic", "Prokaryotic", "Always multicellular", "Without DNA"], 1, "Monera are prokaryotes with no nuclear membrane.", "beginner", "15–16"),
    ("Nostoc and Spirulina are placed in:", ["Animalia", "Fungi", "Monera (cyanobacteria)", "Plantae as trees"], 2, "Blue-green algae such as Nostoc and Spirulina are prokaryotes in Monera.", "beginner", "15–16"),
    ("A bacterium’s DNA region without a nuclear envelope is the:", ["Mitochondrion", "Nucleoid", "Golgi body", "Chloroplast"], 1, "Bacterial DNA sits in a nucleoid, not a true nucleus.", "beginner", "16"),
    ("Mycoplasma is unusual among bacteria because it:", ["Has chloroplasts", "Lacks a cell wall", "Is a mammal", "Has a cellulose wall"], 1, "The notes say a few bacteria such as Mycoplasma do not have a cell wall.", "beginner", "16"),
    ("Protista comes from a word meaning:", ["Last animals", "The very first", "No nucleus", "Only fungi"], 1, "Protista is from Greek protistos, ‘the very first’.", "beginner", "17"),
    ("Most protists are:", ["Prokaryotic and multicellular trees", "Eukaryotic and usually unicellular", "Viruses", "Rocks"], 1, "Protists have a nucleus and organelles; most species are unicellular.", "beginner", "17"),
    ("Trypanosoma is named as causing:", ["Malaria in birds only", "Sleeping sickness in humans", "Common cold", "Scurvy"], 1, "Parasitic Trypanosoma protozoa can cause sleeping sickness.", "beginner", "18"),
    ("Giant kelp is used as an example of:", ["A prokaryote", "A multicellular protist", "A mammal", "A fungus spore"], 1, "Most protists are unicellular, but kelp can be huge and multicellular.", "beginner", "17"),
    ("Fungi feed as:", ["Photosynthetic autotrophs", "Heterotrophs without chlorophyll", "Chemosynthetic plants", "Only carnivores"], 1, "Fungi lack chlorophyll and cannot photosynthesise; they are heterotrophs.", "beginner", "18"),
    ("Fungi reproduce mainly by:", ["Seeds with fruit", "Spores", "Live birth", "Eggs with shells"], 1, "Fungi reproduce by spores, sexually or asexually, and have no embryonic stage.", "beginner", "18"),
    ("Chitin biosynthesis is listed as a feature of:", ["Animal blood", "Fungi", "Granite", "Viruses only"], 1, "The notes list biosynthesis of chitin among fungal characteristics.", "beginner", "18"),
    ("Kingdom Plantae members are:", ["Heterotrophic and wall-less", "Eukaryotic, multicellular autotrophs with chlorophyll", "Prokaryotic bacteria", "Always unicellular"], 1, "Plants make food with chlorophyll, have cell walls and are multicellular eukaryotes.", "beginner", "19"),
    ("Animals differ from plants in this chapter because they:", ["Have cellulose walls", "Lack chlorophyll and a cell wall and are heterotrophic", "Are always prokaryotes", "Never move"], 1, "Animalia is the largest kingdom; members have no chlorophyll or cell wall and must eat.", "beginner", "19"),
    ("Chordata is listed as a phylum of:", ["Fungi", "Monera", "Animalia", "Protista only"], 2, "Animal phyla named include Porifera through Chordata.", "beginner", "19"),
    # Chapter 4
    ("Who named cells after looking at cork in 1665?", ["Virchow", "Robert Hooke", "Mendel", "Darwin"], 1, "Hooke saw pores in cork, called them cells, and published Micrographia.", "beginner", "20"),
    ("Leeuwenhoek called the tiny organisms he saw:", ["Chromosomes", "Animalcules", "Tissues", "Organs"], 1, "He saw bacteria and protozoa with a simple microscope and called them animalcules.", "beginner", "20"),
    ("Schleiden studied _____ cells and Schwann studied _____ cells.", ["animal; plant", "plant; animal", "bacterial; viral", "fungal; algal"], 1, "Schleiden worked on plants, Schwann on animals; together they proposed cell theory.", "beginner", "20–21"),
    ("Virchow’s 1855 statement was that:", ["Cells crystallise from body fluid", "All cells come from existing cells", "DNA is protein", "Plants have no cells"], 1, "Virchow corrected earlier ideas: new cells are generated by existing cells.", "beginner", "21, 29"),
    ("Cell theory states all of the following except:", ["Living things are made of cells", "The cell is the smallest unit of a living thing", "New cells come from pre-existing cells", "All cells have chloroplasts"], 3, "The three pillars do not claim every cell has chloroplasts.", "beginner", "29"),
    ("A unicellular example in the notes is:", ["Human", "Cat", "Amoeba", "Spirogyra as a whole plant body of many specialised cells"], 2, "Amoeba, Paramecium and Chlamydomonas are unicellular examples.", "beginner", "20"),
    ("The four basic human tissue types are:", ["Bone, blood, fat, hair", "Epithelial, muscle, nervous, connective", "Root, stem, leaf, flower", "Kingdom, phylum, class, order"], 1, "Those four tissue types are listed at the tissue level of organisation.", "beginner", "22"),
    ("An organ is:", ["One molecule", "Two or more tissues performing a particular function", "A single cell", "A whole ecosystem"], 1, "Heart, liver and kidney are given as organs made of tissues.", "beginner", "23"),
    ("Prokaryotic means:", ["True nucleus", "Before a nucleus", "Always a plant", "Without DNA"], 1, "From Greek: pro = before, karyose = kernel/nucleus.", "beginner", "24"),
    ("Four features common to all cells are:", ["Nucleus, mitochondria, Golgi, chloroplast", "DNA, plasma membrane, cytoplasm, ribosomes", "Cell wall, vacuole, centriole, cilium", "Gills, lungs, kidneys, skin"], 1, "Every cell has DNA, a membrane, cytoplasm and ribosomes.", "beginner", "24"),
    ("Prokaryotic DNA is typically:", ["Linear with histones", "Circular, in a nucleoid, often with plasmids", "Absent", "Only RNA"], 1, "Prokaryotes have one circular DNA molecule plus smaller plasmids; DNA is not in a true nucleus.", "beginner", "25–26"),
    ("Eukaryotic cells compared with prokaryotes are:", ["Always smaller and simpler", "Larger and more complex, with membrane organelles", "Without ribosomes", "Without DNA"], 1, "Eukaryotes are much larger and more complex, with a true nucleus and organelles.", "beginner", "25"),
    ("Plant cells typically store food as:", ["Glycogen", "Starch", "Urea", "Chitin only"], 1, "Reserved food in plant cells is starch; animals store glycogen.", "beginner", "29"),
    ("Animal cells typically have centrioles; plant cells in the table:", ["Always have more centrioles", "Typically lack centrioles", "Use them as chloroplasts", "Use them as cell walls"], 1, "Centrioles/centrosomes are listed present in animal cells and absent in plant cells.", "beginner", "29"),
    # Chapter 5
    ("Osmosis is the movement of water through a membrane from:", ["Low water to high water using ATP pumps only", "High water (low solute) to low water (high solute)", "Solute crystals only", "Air into stone"], 1, "Osmosis is passive movement of solvent/water through a partially permeable membrane down the water gradient.", "beginner", "31"),
    ("In an isotonic solution, net water movement is:", ["Strongly into the cell", "Strongly out of the cell", "None; entry equals exit", "Only through the nucleus"], 2, "Solute concentrations match, so water in equals water out.", "beginner", "31"),
    ("A hypotonic solution causes:", ["Water to leave; plasmolysis", "Water to enter; turgidity or possible lysis", "No membrane to exist", "DNA to leave the cell"], 1, "More water enters. Plant cells become turgid; animal cells may burst.", "beginner", "31–32"),
    ("Exosmosis in a hypertonic solution makes a plant cell:", ["Turgid", "Flaccid or plasmolysed", "A bacterium", "An autotroph"], 1, "Water leaves; the cell becomes flaccid or undergoes plasmolysis.", "beginner", "32"),
    ("Animal cells survive best in:", ["A strongly hypotonic bath", "An isotonic solution", "Pure concentrated brine only", "A vacuum"], 1, "Animal cells lyse in hypotonic liquid and need isotonic surroundings.", "beginner", "32"),
    ("Osmotic pressure is:", ["The pressure required to stop osmosis", "The pressure that copies DNA", "Blood type", "A fungal spore"], 0, "It is the minimum pressure that stops solvent transfer by osmosis.", "beginner", "32"),
    ("Diffusion is movement of molecules:", ["Only through a living kidney", "From higher to lower concentration until even", "Only of water through a membrane", "From low to high using ATP always"], 1, "Diffusion equalises concentration in solids, liquids or gases and does not require a membrane.", "beginner", "33"),
    ("Facilitated diffusion is:", ["Active transport that spends ATP", "Passive movement via a carrier from high to low concentration", "A type of meiosis", "Chemosynthesis"], 1, "A carrier helps, but it is still passive down the gradient.", "beginner", "33–34"),
    ("A factor that speeds diffusion in the notes is:", ["Lower temperature always", "A steeper concentration gradient", "A thicker wall always", "Larger particles always"], 1, "Temperature, gradient, distance, particle size and membrane type affect rate; a steeper gradient increases rate.", "beginner", "34–35"),
    ("Mitosis in humans keeps the chromosome number at:", ["23", "46", "92", "2"], 1, "Mitosis copies chromosomes so daughter body cells still have 46.", "beginner", "37"),
    ("Meiosis produces:", ["Two identical body cells", "Haploid gametes with half the chromosome number", "Only cell walls", "Starch grains"], 1, "Meiosis is a two-step process that forms egg and sperm; humans go from 46 to 23.", "beginner", "37"),
    ("DNA is copied in which cell-cycle phase?", ["Anaphase", "S phase", "Cytokinesis only", "Telophase only"], 1, "S (synthesis) is when chromosomes/DNA are replicated.", "beginner", "38"),
    ("Interphase is:", ["G1 + S + G2", "Only anaphase", "Only cytokinesis", "Fertilisation"], 0, "Interphase is the long period of growth and DNA copying between mitotic divisions.", "beginner", "38"),
    ("Chromosomes line up at the equator in:", ["Prophase", "Metaphase", "Anaphase", "G1"], 1, "Metaphase aligns chromosomes on the metaphase plate.", "beginner", "39"),
    ("Sister chromatids separate in mitosis during:", ["Prophase", "Metaphase", "Anaphase", "G2"], 2, "Anaphase is the short stage when sisters are pulled to opposite poles.", "beginner", "39"),
    ("Plant cytokinesis forms a:", ["Cleavage furrow only", "Cell plate", "Nucleoid", "Plasmid"], 1, "Plants build a cell plate; animals constrict the cytoplasm.", "beginner", "40"),
    ("Crossing over occurs in:", ["Prophase of mitosis", "Prophase I of meiosis", "G0", "S phase of bacteria only"], 1, "Homologues pair and exchange DNA at chiasmata in prophase I.", "beginner", "41"),
    ("Meiosis I separates:", ["Sister chromatids only", "Homologous chromosome pairs", "Ribosomes", "Cell walls"], 1, "Homologues (bivalents) separate in meiosis I; sisters separate in meiosis II.", "beginner", "41–43"),
    ("Independent assortment of 23 human pairs allows about:", ["2 combinations", "46 combinations", "Over 8 million combinations", "Exactly 23 combinations"], 2, "The notes give 2^23, over 8 million possible combinations.", "beginner", "41"),
    ("Uncontrolled cell division is linked in the notes to:", ["Better photosynthesis", "Serious disease such as cancer", "Osmosis only", "Taxonomy"], 1, "If genes that regulate division fail, serious health issues such as cancer can follow.", "beginner", "37, 44"),
    # Chapter 6
    ("Heredity is:", ["Ageing of rocks", "Passing traits from parents to offspring through genes", "Only learned behaviour", "Diffusion of perfume"], 1, "Heredity is gene-based transmission of characteristics between generations.", "beginner", "45"),
    ("Aristotle’s blending idea failed because it could not explain:", ["Why children exist", "Hidden traits that reappear in later generations", "Why plants are green", "Why cells have walls"], 1, "Blending predicted medium offspring forever; Mendel showed units can hide and return.", "beginner", "46"),
    ("Mendel experimented mainly on:", ["Fruit flies", "Pea plants", "Humans in hospitals", "Bacteria only"], 1, "He tracked pea height, flower colour and seed texture.", "beginner", "46–47"),
    ("The law of segregation says alleles:", ["Never separate", "Separate during gamete formation so each gamete gets one", "Blend into paint", "Sit only on mitochondria"], 1, "Each offspring then receives one allele from each parent.", "beginner", "47"),
    ("Independent assortment means:", ["All genes are on one chromosome only", "Alleles of different traits can segregate independently", "Offspring are clones", "DNA is RNA"], 1, "Mendel saw different character pairs assort independently in offspring.", "beginner", "47"),
    ("A dominant allele in a heterozygote:", ["Is destroyed", "Can mask a recessive allele", "Is always lowercase", "Cannot be inherited"], 1, "The dominant form is expressed; the recessive can reappear in homozygotes.", "beginner", "47"),
    ("In a monohybrid tall × short cross, F1 plants are:", ["All short", "All medium height", "All tall", "Half seeds"], 2, "F1 is heterozygous tall; there was no medium-height blending.", "beginner", "48"),
    ("The F2 phenotype ratio in that monohybrid is about:", ["1:1", "3 tall : 1 short", "9:3:3:1 only", "All short"], 1, "F2 is about three tall to one short; genotypes are 1 TT : 2 Tt : 1 tt.", "beginner", "48"),
    ("Genotype means:", ["The visible trait only", "The complete set of alleles an organism carries", "The environment", "A type of tissue"], 1, "Genotype is genetic identity, including unexpressed alleles.", "beginner", "49"),
    ("Phenotype means:", ["Only the DNA sequence hidden in a file", "The expressed physical characteristics", "The kingdom name", "A plasmid"], 1, "Phenotype is the description of actual expressed traits.", "beginner", "49"),
    ("Heterozygous means:", ["Both alleles the same", "The two alleles of a gene are different", "No genes", "Only recessive alleles"], 1, "Tt is heterozygous; TT or tt is homozygous.", "beginner", "49–50"),
    ("A dihybrid cross follows:", ["One trait pair", "Two pairs of contrasting characters", "No genes", "Only environment"], 1, "Example: round-yellow versus wrinkled-green peas.", "beginner", "48–49"),
    # Chapter 7
    ("Genes are:", ["Whole organisms", "DNA segments that carry hereditary instructions", "Only sugar molecules", "Cell walls"], 1, "Genes are the fundamental units of heredity, segments of DNA.", "beginner", "52–53"),
    ("A chromosome is:", ["A single amino acid", "A thread of DNA plus packaging proteins carrying many genes", "A type of lipid only", "A kingdom"], 1, "Chromosomes are thread-like nuclear structures made of DNA containing many genes.", "beginner", "52, 55"),
    ("Human body cells have how many chromosome pairs?", ["12", "23", "46 pairs", "2"], 1, "Humans have 23 pairs; 46 chromosomes in total.", "beginner", "52, 55"),
    ("The four DNA bases named are:", ["Iron, zinc, copper, boron", "Adenine, cytosine, thymine, guanine", "Glucose, starch, glycogen, cellulose", "Sodium, potassium, calcium, magnesium"], 1, "A, C, T and G write the DNA code.", "beginner", "52"),
    ("About how many DNA bases are in a human, according to the notes?", ["23", "46", "About 3 billion", "99"], 2, "About 99% of those bases are the same in everyone; the rest make you unique.", "beginner", "52"),
    ("The term ‘gene’ was coined by:", ["Darwin in 1859", "Wilhelm Johannsen in 1909", "Hooke in 1665", "Aristotle"], 1, "Bateson introduced genetics in 1905; Johannsen named the gene in 1909.", "beginner", "53"),
    ("A locus is:", ["The whole genome", "The fixed position of a gene on a chromosome", "A type of fungus", "A hypotonic solution"], 1, "Each gene occupies a particular position (locus) on a chromosome.", "beginner", "53"),
    ("The genome is:", ["One codon", "The entire set of chromosomes / genetic material", "Only mRNA", "The cell wall"], 1, "An organism’s genome is the complete set of chromosomes.", "beginner", "53"),
    ("A codon is:", ["Three bases that specify an amino acid", "A whole chromosome", "A histone only", "A tissue"], 0, "The genetic code uses three-base units; Nirenberg’s work is cited for this principle.", "beginner", "54"),
    ("Transcription is:", ["mRNA to protein", "DNA copied into mRNA", "Cell bursting", "Osmosis"], 1, "Transcription produces a messenger RNA copy of a gene.", "beginner", "54"),
    ("Translation is:", ["DNA to mRNA", "mRNA to protein at ribosomes", "Mitosis", "Classification"], 1, "Translation builds the protein from the mRNA message.", "beginner", "54"),
    ("Haemoglobin is given as a protein that:", ["Builds cell walls", "Carries oxygen in the blood", "Copies osmosis", "Names species"], 1, "The globin gene instructs production of haemoglobin.", "beginner", "55"),
    ("Histones are:", ["DNA bases", "Proteins that pack eukaryotic DNA", "Plant vacuoles", "Types of osmosis"], 1, "Eukaryotic chromosomes wrap DNA on histone proteins.", "beginner", "56"),
    ("Two chromosomal disorders named are:", ["Osmosis and diffusion", "Down syndrome and Turner syndrome", "Starch and glycogen", "Botany and zoology"], 1, "Chromosome number or structure errors can cause those conditions and some leukaemias.", "beginner", "56"),
    ("A gene compared with a chromosome is:", ["Larger and always visible", "A coded segment on a chromosome, not visible as an X shape", "A whole pack of many chromosomes", "A type of tissue"], 1, "Genes are not visible under an ordinary microscope; condensed chromosomes are.", "beginner", "58"),
    ("Large chromosomal changes listed include:", ["Only point mutations of one base", "Duplication, deletion, inversion and rearrangement", "Only osmosis", "Only budding"], 1, "Those rearrangements can affect many genes at once.", "beginner", "58–59"),
]


def options_payload(bodies: list[str]) -> list[dict]:
    return [{"label": chr(65 + i), "body": body} for i, body in enumerate(bodies)]


def main() -> None:
    rows: list[dict] = []
    seen_prompts: set[str] = set()
    for i, (prompt, bodies, correct, explanation, difficulty, pages) in enumerate(BANK, 1):
        if len(bodies) != 4:
            raise SystemExit(f"Q{i} needs 4 options")
        if prompt in seen_prompts:
            raise SystemExit(f"Duplicate prompt: {prompt}")
        seen_prompts.add(prompt)
        if not 0 <= correct <= 3:
            raise SystemExit(f"Q{i} bad correct index")
        if not 1 <= len(explanation) <= 4000 or not 1 <= len(prompt) <= 2000:
            raise SystemExit(f"Q{i} length")
        key = f"bio101-ch1-7-20261101-{i:03d}"
        ref = f"{SRC}, book pp. {pages}"
        opts = options_payload(bodies)
        letter = chr(65 + correct)
        rows.append({
            "logical_question_key": f"{key}-learning",
            "pool": "learning",
            "usage": ["review", "practice", "mock"],
            "prompt": prompt,
            "options": opts,
            "correct_option": letter,
            "explanation": explanation,
            "course_code": "BIO 101",
            "difficulty": difficulty,
            "source_reference": ref,
            "answer_format": "standard",
        })
        rows.append({
            "logical_question_key": f"{key}-battle",
            "pool": "battle",
            "usage": ["battle"],
            "prompt": prompt,
            "options": opts,
            "correct_option": letter,
            "explanation": explanation,
            "course_code": "BIO 101",
            "difficulty": difficulty,
            "source_reference": ref,
            "answer_format": "standard",
            "battle_seconds": 12,
            "battle_reading_seconds": 8,
        })
    if len(BANK) < 40:
        raise SystemExit("Need a larger bank")
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{OUT}: {len(BANK)} unique, {len(rows)} rows (learning+battle)")


if __name__ == "__main__":
    main()
