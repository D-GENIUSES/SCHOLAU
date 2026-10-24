# Builds ScholAu admin-import JSON from course notes already extracted in this folder.
# Chapters are importer modules (module_position / module_title). Questions carry the
# same chapter and lesson fields so they stay attached; the live RPC ignores unknown
# keys and links a question only after lesson_id is a real uuid.
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PREP = ROOT / "prepared"
CATALOGUE = {
    "GST 111", "AUE-GST 100", "AUE-GST 101", "MTH 101", "PHY 101", "PHY 107", "STA 111",
    "COS 101", "CHM 101", "BIO 101", "GST 112", "AUE-GST 102", "AUE-CSC 104", "MTH 102",
    "PHY 102", "PHY 108", "COS 102", "STA 112", "ENT 211", "AUE-GST 201", "AUE-GST 221",
    "COS 201", "CSC 203", "IFT 211", "SEN 201", "CYB 201", "STA 121", "MTH 201", "GST 212",
    "AUE-GST 200", "AUE-GST 202", "MTH 202", "COS 202", "IFT 212", "AUE-CSC 202", "AUE-CSC 204",
    "CYB 203",
}
BLOCK_TYPES = {"paragraph", "heading", "list", "image", "callout", "code"}
TONES = {"info", "tip", "warning", "example"}
DIFFS = {"beginner", "intermediate", "advanced"}
BATTLE_SECONDS = {5, 8, 10, 12, 15}


def blocks(heading, paragraphs, items=None, callout=None, tone="example"):
    out = [{"type": "heading", "level": 2, "text": heading}]
    for text in paragraphs:
        out.append({"type": "paragraph", "text": text})
    if items:
        out.append({"type": "list", "items": list(items)})
    if callout:
        out.append({"type": "callout", "tone": tone, "text": callout})
    return out


def q(prompt, correct, wrongs, why, difficulty="beginner"):
    options = [correct, *wrongs]
    if len(options) != 4 or len(set(options)) != 4:
        raise ValueError(prompt)
    return {
        "prompt": prompt,
        "options": options,
        "correct": correct,
        "explanation": why,
        "difficulty": difficulty,
    }


def lesson(title, objective, minutes, body, practice, mock, battle):
    return {
        "title": title,
        "objective": objective,
        "minutes": minutes,
        "blocks": body,
        "practice": practice,
        "mock": mock,
        "battle": battle,
    }


def chapter(title, source, lessons):
    return {"title": title, "source": source, "lessons": lessons}


def course(code, title, level, chapters):
    return {"code": code, "title": title, "level": level, "chapters": chapters}


COURSES = []

# --- COS 101 ---
COURSES.append(course("COS 101", "Introduction to Computing Sciences", "100", [
    chapter("What a computer is", "COS 101 Introduction to Computing-1.pdf, pages 3-8", [
        lesson(
            "Computers and early milestones",
            "Define a computer and place early computing milestones on the course timeline.",
            12,
            blocks(
                "What a computer does",
                [
                    "A computer is an electronic device that takes data as input, processes that data under the control of a program, and produces an output. The whole arrangement is called a computer system.",
                    "The lecture timeline starts from a need for efficient number-crunching. Punch-card computers began around the late 19th century, and modern smartphones have more computing power than early computers.",
                ],
                [
                    "1801: Jacquard's loom uses punch cards for fabric designs.",
                    "1822: Babbage conceives a steam-driven calculating machine, left incomplete.",
                    "1890: Hollerith's punch-card system calculates the U.S. Census.",
                    "1936: Turing presents the universal computing machine.",
                    "1943-1944: Mauchly and Eckert build ENIAC, the first large-scale digital computer.",
                    "1946: UNIVAC becomes the first commercial computer for government and business use.",
                ],
                "Grace Hopper's COBOL work and the integrated circuit are placed in 1953-1958.",
            ),
            [
                q("In the COS 101 definition, what controls how a computer processes input data?", "A program, a set of instructions", ["The case colour", "A printer tray", "The power cable alone"], "The notes say processing happens under the control of a program."),
                q("Which 1801 device used punch cards for fabric designs?", "Joseph Marie Jacquard's loom", ["ENIAC", "The Apple I", "UNIVAC"], "The early-milestones slide dates Jacquard's punch-card loom to 1801."),
                q("Who presented the idea of a universal computing machine in 1936?", "Alan Turing", ["Steve Jobs", "Bill Gates", "Tim Berners-Lee"], "The 1801-1937 slide names Turing's universal computing machine."),
            ],
            [q("ENIAC is described in the notes as what?", "The first large-scale digital computer", ["The first commercial computer", "A punch-card loom", "The first GUI"], "ENIAC is the 1943-1944 large-scale digital computer. UNIVAC is the first commercial one.", "intermediate")],
            [q("Which invention does the timeline date to 1801?", "Jacquard's punch-card loom", ["The computer mouse", "HTML", "The floppy disk"], "1801 is Jacquard's loom on the early-milestones slide.")],
        ),
    ]),
    chapter("Generations and characteristics", "COS 101 Introduction to Computing-1.pdf, pages 9-10", [
        lesson(
            "Five generations and system characteristics",
            "Match each computer generation to its technology and name the listed system characteristics.",
            10,
            blocks(
                "Generations and characteristics",
                [
                    "The notes summarise five generations: vacuum tubes (1940-1956), transistors (1956-1963), integrated circuits (1964-1971), microprocessors (1971-present), and artificial intelligence (present and future).",
                    "Listed characteristics are speed, accuracy, diligence, versatility, reliability, automation, and memory. Accuracy means calculations are precise, and errors occur only with inconsistent or inaccurate data. Memory uses primary built-in storage and secondary removable storage such as CDs and pen drives.",
                ],
                ["Speed", "Accuracy", "Diligence", "Versatility", "Reliability", "Automation", "Memory"],
                "Diligence means the system keeps performing without fatigue.",
            ),
            [
                q("Which technology does the notes assign to the first generation (1940-1956)?", "Vacuum tubes", ["Transistors", "Microprocessors", "Artificial intelligence"], "First generation is vacuum tubes."),
                q("Fourth-generation computers, from 1971, are associated with what?", "Microprocessors", ["Vacuum tubes", "Transistors only", "Punch cards only"], "The generation summary names microprocessors for 1971 to the present."),
                q("According to the characteristics slide, when do calculation errors occur?", "When the data is inconsistent or inaccurate", ["Whenever the computer runs for more than a minute", "Only on fifth-generation machines", "Only if the monitor is off"], "The accuracy point says errors occur only with inconsistent or inaccurate data."),
            ],
            [q("Which generation does the outline call present and future, based on artificial intelligence?", "Fifth generation", ["First generation", "Second generation", "Third generation"], "Fifth generation is artificial intelligence, present and future.", "intermediate")],
            [q("Primary and secondary storage are listed under which characteristic?", "Memory", ["Versatility", "Automation", "Speed"], "The memory characteristic covers primary and secondary storage.")],
        ),
    ]),
    chapter("Data, information, and functions", "COS 101 Introduction to Computing-1.pdf, pages 11-12", [
        lesson(
            "From data to output",
            "Distinguish data from information and list the four computer functions in the notes.",
            10,
            blocks(
                "Data, information, and functions",
                [
                    "Data is a collection of unorganized facts and figures and does not by itself show patterns or context. Information is structured data: organized, meaningful, and processed. A computer is used to turn data into information.",
                    "The four functions are receiving input, processing the information according to program instructions, storing the information in primary or secondary storage, and producing output through devices such as a monitor or printer.",
                ],
                ["Receiving input", "Processing", "Storing", "Producing output"],
                "Input examples on the slide include the keyboard, mouse, digital pen, CD-ROM, pen drive, and scanner.",
            ),
            [
                q("How do the notes distinguish information from data?", "Information is organized, meaningful, and processed", ["Information cannot be stored", "Information must be handwritten", "Information contains only unorganized facts"], "Information is structured data. Data is unorganized facts and figures."),
                q("Which function uses devices such as a monitor or printer?", "Producing output", ["Receiving input only", "Booting the operating system", "Naming an identifier"], "Producing output communicates processed information through output devices."),
                q("What does processing do with input data?", "It carries out operations based on program instructions", ["It only prints the raw facts", "It deletes primary memory", "It converts the computer into an analog machine"], "Processing follows the instructions provided in the programs."),
            ],
            [q("Unorganized facts and figures that show no pattern or context are called what?", "Data", ["Information", "An operating system", "A packet"], "The data slide defines data as unorganized facts and figures.", "intermediate")],
            [q("Which pair matches the notes?", "Data is unorganized; information is processed", ["Both words mean the same raw facts", "Information is input and data is only output", "Data is always a program"], "That is the data-versus-information distinction on page 11.")],
        ),
    ]),
    chapter("CPU, memory, and devices", "COS 101 Introduction to Computing-1.pdf, pages 13-20", [
        lesson(
            "The CPU and memory units",
            "Name the CPU parts and contrast RAM with ROM using the lecture comparison.",
            12,
            blocks(
                "CPU and memory",
                [
                    "The CPU is called the brain of the computer and controls the operations of all parts. The ALU processes data, performs calculations and comparisons, and handles non-numeric processing and decision-making. The control unit extracts instructions, directs CPU operations, and supervises data flow.",
                    "The memory unit stores data, instructions, and results. Its unit is the byte, and 1 byte equals 8 bits. RAM is volatile temporary storage that is lost when power is off. ROM is non-volatile permanent storage that remains when power is off.",
                ],
                [
                    "ALU: calculations, comparisons, and decision-making",
                    "Control unit: fetches instructions and directs data flow",
                    "RAM: volatile, user-modifiable, SRAM and DRAM",
                    "ROM: non-volatile, read-only, PROM, EPROM, EEPROM, and flash",
                    "Secondary memory: non-volatile supplementary storage such as CDs, floppy disks, pen drives, and external hard drives",
                ],
                "The comparison table says RAM has high speed and smaller capacity, while ROM has lower speed and higher capacity.",
            ),
            [
                q("Which CPU component performs calculations and comparisons?", "The arithmetic logic unit", ["The monitor", "ROM", "A barcode reader"], "The ALU processes data and performs calculations and comparisons."),
                q("What happens to RAM contents when power is switched off?", "They are lost", ["They move into ROM automatically", "They become secondary memory", "They stay because RAM is non-volatile"], "RAM is volatile temporary storage."),
                q("How many bits are in one byte, according to the memory slide?", "8", ["4", "16", "1024"], "The notes state 1 byte equals 8 bits."),
            ],
            [q("Which list matches ROM types on the primary-memory slide?", "PROM, EPROM, EEPROM, and flash", ["SRAM and DRAM only", "Keyboard, mouse, and scanner", "PAN, LAN, and WAN"], "ROM types are PROM, EPROM, EEPROM, and flash. SRAM and DRAM are RAM types.", "intermediate")],
            [q("The control unit's job in these notes is to do what?", "Extract instructions and direct CPU operations", ["Print documents", "Store files only on pen drives", "Measure analog quantities"], "The control unit extracts instructions and directs operations.")],
        ),
    ]),
    chapter("Types, hardware, and software", "COS 101 Introduction to Computing-1.pdf, pages 21-24", [
        lesson(
            "Classes of computers and software",
            "Classify computers by operation and size, and separate hardware from applications and systems software.",
            12,
            blocks(
                "Types, hardware, and software",
                [
                    "By operation, analog computers measure physical quantities and are described as nearly extinct. Digital computers use binary 0 and 1 and are programmable. Hybrid computers combine analog and digital functions for process control.",
                    "By size, microcomputers use a microprocessor and include desktops, laptops, notebooks, tablets, and PDAs. Minicomputers support about 10 to 100 users. Mainframes support about 100 to 1000 or more users and are used for bulk data. Supercomputers handle extremely fast scientific work such as weather forecasting.",
                    "Hardware is the physical equipment. Software is the set of instructions that control hardware. Applications software does specific tasks, with examples MS Word, Excel, PowerPoint, and MySQL. Systems software is the operating system and utilities, with examples Windows, Linux, and macOS.",
                ],
                ["Analog", "Digital", "Hybrid", "Microcomputer", "Minicomputer", "Mainframe", "Supercomputer"],
                "A modem is listed with output hardware on this slide, alongside the monitor, printer, and sound card.",
            ),
            [
                q("Which computers use binary 0 and 1 and are programmable?", "Digital computers", ["Analog computers", "Only hybrid computers", "Only super minicomputers"], "Digital computers use binary and are programmable."),
                q("About how many users can a minicomputer support, according to the notes?", "10 to 100", ["1 only", "100 to 1000 or more", "Hundreds of millions"], "Minicomputers are multi-user machines for about 10 to 100 users. Mainframes cover the larger range."),
                q("MS Word and Excel are examples of what?", "Applications software", ["Systems software", "Input hardware", "Secondary memory"], "Applications software is for specific tasks. Windows, Linux, and macOS are the systems-software examples."),
            ],
            [q("Weather forecasting is given as an application of which class?", "Supercomputers", ["Microcomputers", "Analog computers", "PDAs"], "Supercomputers are linked to weather forecasting, quantum physics, and molecular theory.", "intermediate")],
            [q("Hardware in this lecture means what?", "The physical components of the computer system", ["Only the operating system", "Only application programs", "Packets on the internet"], "Hardware is the physical equipment. Software is the instructions.")],
        ),
    ]),
    chapter("Operating systems, networks, and the internet", "COS 101 Introduction to Computing-1.pdf, pages 25-32", [
        lesson(
            "Operating systems and networks",
            "List operating-system jobs and network types, and state how the notes describe the internet.",
            12,
            blocks(
                "Systems and networks",
                [
                    "Operating-system functions in the notes are booting, a command-line or graphical user interface, hardware management, file-system management, and program support such as saving files and allocating memory.",
                    "Cooperative multitasking needs cooperation between the OS and applications, with Macintosh OS as the example. Preemptive multitasking lets the OS control CPU time, with UNIX and Windows NT as examples. UNIX and Windows NT are also the multi-user examples. In asymmetric multiprocessing one CPU controls the others. In symmetric multiprocessing the CPUs work independently.",
                    "A network is a system formed by links that allow information sharing. A host sends or receives information on the network. Named types are PAN, LAN, WAN, and MAN. The internet is a global network of computers. It began with ARPANET in the 1960s, and networks communicate using TCP/IP. Data is broken into packets.",
                ],
                ["Booting", "User interface", "Hardware management", "File system management", "Program support", "PAN, LAN, WAN, and MAN"],
                "The World Wide Web is dated to 1991 and uses hyperlinks. E-mail is asynchronous because the recipient need not be online.",
            ),
            [
                q("Which pair are the multi-user operating-system examples on the slide?", "UNIX and Windows NT", ["DOS and a punch card", "Only Macintosh OS", "HTML and TCP"], "The multi-user category cites UNIX and Windows NT."),
                q("In symmetric multiprocessing, how do the CPUs work?", "No single CPU controls the others; they work independently", ["One CPU controls all the others", "Only one CPU is allowed", "The CPUs must be analog"], "Symmetric means no single controlling CPU."),
                q("What do the notes say TCP/IP does for internet data?", "It ensures proper delivery of packets across networks", ["It replaces the operating system", "It stores files in ROM", "It prints e-mail"], "Data is broken into packets and TCP/IP ensures delivery."),
            ],
            [q("ARPANET is described as the origin of what?", "The internet, begun in the 1960s by the U.S. Department of Defense", ["The first microcomputer", "ROM", "Jacquard's loom"], "The internet overview traces the internet to ARPANET in the 1960s.", "intermediate")],
            [q("Which interface types does the operating-system slide name?", "Command line and graphical user interface", ["Only punch cards", "Only analog dials", "Only hyperlinks"], "The user-interface function is CLI or GUI.")],
        ),
    ]),
]))
