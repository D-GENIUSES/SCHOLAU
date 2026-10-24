"""Remaining readable courses. Imported after build_import defines COURSES."""
from build_import import COURSES, blocks, chapter, course, lesson, q

def add(item):
    COURSES.append(item)

add(course("COS 102", "Problem Solving", "100", [
    chapter("Foundations of problem solving", "CSC HELP (THEORICAL).docx, Module 1; notes titled CSC 102", [
        lesson("Asking questions before you code", "Use the five-question strategy and state what the notes mean by computer science.", 10,
            blocks("Five questions", [
                "The notes define computerization as using computers to develop software that automates routine human tasks efficiently.",
                "Before solving a problem, ask what you know, what information you must process, what the solution looks like, what special cases exist, and how you will recognize that the solution has been found.",
                "Computer science is described as the study of the theoretical foundations of information and computation. It is compared with mathematics because both define and solve problems using models.",
            ], ["Know", "Info", "Look", "Special", "Recognize"], "The notes' mnemonic for those five questions is K-I-L-S-R."),
            [q("What is computerization in these notes?", "Using computers to develop software that automates routine human tasks", ["Replacing every algorithm with a flowchart symbol", "Storing data only in ROM", "Printing without a program"], "That is the Module 1 definition."),
             q("Which question checks that you can tell the solution has been found?", "How will I recognize that the solution is found?", ["What colour is the case?", "Which port is HTTPS?", "How many bytes are in a bit?"], "Recognize is the fifth question."),
             q("Computer science is compared with which subject because both use models?", "Mathematics", ["Only painting", "Only music", "Only geography"], "The notes say it is similar to mathematics.")],
            [q("K-I-L-S-R is the mnemonic for what?", "The five questions asked before solving a problem", ["The five generations of computers", "Five OOP pillars only", "Five network types"], "The mnemonic covers Know, Info, Look, Special, and Recognize.", "intermediate")],
            [q("Computerization in this module means what?", "Using computers to automate routine tasks with software", ["Measuring analog voltage only", "Registering a company at CAC", "Sending a phishing message"], "That matches the Module 1 definition.")]),
    ]),
    chapter("Programming languages and levels", "CSC HELP (THEORICAL).docx, Module 2", [
        lesson("Machine, assembly, and high-level languages", "Distinguish a program from a programming language and the three language levels.", 10,
            blocks("Three levels", [
                "A program is a sequence of instructions a computer executes to solve a problem. A programming language is an artificial language used to organize information and express solutions precisely.",
                "Machine level is instructions the CPU executes directly, made of binary. Assembly level is low-level, with a one-to-one correspondence with machine code, and an assembler converts it to machine code. High level is closer to human language and independent of the hardware. Examples given are C++, Java, and Python.",
            ], ["Machine level: binary instructions", "Assembly level: assembler converts it", "High level: closer to human language"], "Do not confuse the assembler, which is the tool, with assembly, which is the language."),
            [q("What converts assembly language into machine code?", "An assembler", ["A compiler used only for English prose", "A printer", "ROM"], "The table says assembly uses a utility called an assembler."),
             q("Which level is described as closer to human language?", "High level", ["Machine level", "Only assembly level", "Only binary with no language"], "High-level examples include C++, Java, and Python."),
             q("A program is defined as what?", "A sequence of instructions a computer executes to solve a problem", ["Any spoken language", "Only a flowchart diamond", "A hardware resistor"], "That is the Module 2 definition of a program.")],
            [q("Assembly language's relationship to machine code is described as what?", "One-to-one correspondence", ["No relationship", "Only a graphical user interface", "A network packet"], "The language-level table says assembly has a one-to-one correspondence with machine code.", "intermediate")],
            [q("Which statement matches the exam note?", "An assembler is the tool; assembly is the language", ["They are the same word for binary", "Assembly is only a high-level language", "An assembler is a printer"], "The notes warn not to swap those two terms.")]),
    ]),
    chapter("The problem-solving lifecycle", "CSC HELP (THEORICAL).docx, Module 3", [
        lesson("Analyse, algorithm, code, test", "Order the four computer problem-solving steps and separate syntax errors from logical errors.", 10,
            blocks("Four steps", [
                "Problem solving is described as a sequence: identify, then algorithm, then implement.",
                "The four key steps are analysing the problem so inputs and outputs are clear, developing an algorithm as a recipe in natural language, coding that algorithm in a programming language, and testing and debugging.",
                "A syntax error violates the language rules, such as a missing semicolon, and produces no output. A logical error lets the program run but produces the wrong output because the plan was wrong.",
            ], ["Analyse the problem", "Develop an algorithm", "Code", "Test and debug"], "Syntax errors stop output. Logical errors give the wrong output."),
            [q("A missing semicolon is which kind of error in these notes?", "A syntax error", ["A logical error", "A runtime hardware fault only", "A correct program"], "A syntax error violates language rules and results in no output."),
             q("A program that runs but gives the wrong result has what?", "A logical error", ["No error", "Only a syntax error", "An assembler"], "The plan was wrong, so the output is wrong."),
             q("What should be clear during analysis?", "The inputs the program accepts and the outputs it produces", ["Only the monitor brand", "Only the student's matric number", "The colour of the case"], "Analysis means understanding inputs and outputs.")],
            [q("Which order matches the four key steps?", "Analyse, develop an algorithm, code, then test and debug", ["Code first, then decide the inputs", "Test, then invent the problem", "Print, then delete the algorithm"], "That is the Module 3 sequence.", "intermediate")],
            [q("An algorithm at this stage is written as what?", "A recipe in natural language", ["Only Java bytecode", "Only a punch card", "A business registration form"], "Developing an algorithm means a natural-language recipe.")]),
    ]),
    chapter("Algorithms and flowcharts", "CSC HELP (THEORICAL).docx, Module 4", [
        lesson("Characteristics of a good algorithm", "State the five characteristics and contrast a flowchart with pseudocode.", 10,
            blocks("Algorithms", [
                "An algorithm is a finite sequence of steps that produces a desired output.",
                "The five characteristics are precision, uniqueness, finiteness, input, and output. Precision means steps are clearly stated. Uniqueness means each step depends only on previous steps or input. Finiteness means it must stop. Input means it receives data. Output means it produces a result.",
                "A flowchart is a visual representation using boxes, diamonds, and arrows. Pseudocode is not real code. It is a non-formal, human-readable description of the instructions.",
            ], ["Precision", "Uniqueness", "Finiteness", "Input", "Output"], "The notes' mnemonic is P-U-F-I-O."),
            [q("Finiteness means an algorithm must do what?", "Stop after a set number of steps", ["Run forever", "Avoid all input", "Use only binary comments"], "Finiteness means it must stop."),
             q("What is a flowchart?", "A visual representation using boxes, diamonds, and arrows", ["A programming language", "A type of ROM", "A business plan"], "That is the Module 4 definition."),
             q("Pseudocode is described as what?", "A non-formal human-readable description, not real code", ["Machine code", "A Java class file", "A certificate of incorporation"], "The notes say pseudocode is not real code.")],
            [q("P-U-F-I-O stands for which set?", "Precision, uniqueness, finiteness, input, and output", ["Python, UNIX, files, internet, and objects", "PAN, UDP, FTP, IP, and OSI", "Patents, utilities, firms, investors, and offices"], "That is the algorithm mnemonic.", "intermediate")],
            [q("An algorithm in this module is what?", "A finite sequence of steps to a desired output", ["An infinite loop by definition", "Only a hardware chip", "A religious dialogue"], "The definition requires a finite sequence that produces output.")]),
    ]),
    chapter("Object-oriented programming", "CSC HELP (THEORICAL).docx, Module 5", [
        lesson("Objects, classes, and the seven ideas", "Contrast procedure-oriented programming with OOP and name the seven ideas in the notes.", 12,
            blocks("OOP ideas", [
                "Procedure-oriented programming views a problem as a sequence of things to do, such as reading, calculating, and printing. Object-oriented programming partitions memory into objects that contain both data and functions.",
                "The seven ideas listed are objects, classes, data abstraction, encapsulation, inheritance, polymorphism, and dynamic binding. A class is a template for objects that share properties. Encapsulation wraps data and functions into one unit. Inheritance lets one class acquire properties of another. Polymorphism is the ability to take more than one form. Dynamic binding links a procedure call to code at run time.",
                "Benefits named in the likely-exam notes are code reuse through inheritance, productivity from standard modules, security through data hiding, and scalability from small systems to large ones.",
            ], ["Objects", "Classes", "Abstraction", "Encapsulation", "Inheritance", "Polymorphism", "Dynamic binding"], "The notes' mnemonic is O-C-A-E-I-P-D."),
            [q("Encapsulation in these notes means what?", "Wrapping data and functions into one unit so they are hidden from the outside", ["Writing steps with no data", "Only using machine code", "Registering a company"], "Encapsulation wraps data and functions into a class."),
             q("Inheritance is said to promote what?", "Reusability", ["Deleting all classes", "Analog measurement", "Packet loss"], "One class acquires properties of another, which promotes reuse."),
             q("Dynamic binding links a procedure call to code at what time?", "Run time", ["Before the problem is identified", "Only on paper", "Only during company registration"], "The notes say the link happens at run time.")],
            [q("How do the notes contrast OOP with procedure-oriented programming?", "OOP uses objects that hold data and functions; procedure-oriented programming is a sequence of actions", ["They are identical", "OOP forbids classes", "Procedure-oriented programming uses only classes"], "That is the Module 5 contrast.", "intermediate")],
            [q("A class is described as what?", "A template for objects that share properties", ["A single running bank account only", "A flowchart diamond", "A syntax error"], "Classes group objects that share common properties.")]),
    ]),
    chapter("C++ program shape", "CSC HELP (THEORICAL).docx, Module 6", [
        lesson("Hello World and C++ symbols", "Identify the roles of include, main, cout, and the comment marks in the sample.", 10,
            blocks("A first C++ program", [
                "The notes say C++ was developed by Bjarne Stroustrup at Bell Labs in the early 1980s and was originally called C with Classes.",
                "The sample starts with #include <iostream>, which the notes call a preprocessor directive that brings in input and output tools. Execution starts at int main, which is mandatory. std::cout with the insertion operator << prints text. return 0 ends the program.",
                "// is a single-line comment. /* ... */ is a multi-line comment. A semicolon ends a statement.",
            ], ["#include <iostream>", "int main", "std::cout and <<", "return 0", "comments and semicolons"], "The include is required so the program can use std::cout."),
            [q("Why do the notes say #include <iostream> is needed?", "It provides the input/output tools used by std::cout", ["It creates a class template", "It is a logical error", "It registers a business name"], "It is the preprocessor directive for I/O."),
             q("Which mark is a single-line comment?", "//", ["<<", ";", "#include"], "The notes say // is ignored by the compiler as a single-line comment."),
             q("What does return 0 indicate in the sample?", "The exit status that ends the program", ["A syntax error", "The start of a comment", "An infinite algorithm"], "return 0 ends the program.")],
            [q("The notes say C++ was originally called what?", "C with Classes", ["C with Punch Cards", "Java Virtual Machine", "Write Once, Run Anywhere"], "That early name is in Module 6.", "intermediate")],
            [q("Which operator is used with cout?", "The insertion operator <<", ["The comment mark //", "Only a semicolon", "A flowchart arrow"], "cout uses << to print.")]),
    ]),
]))

add(course("AUE-CSC 104", "Computer Hardware", "100", [
    chapter("Computer circuits", "AUE-CSC-104 .pdf, Module 1", [
        lesson("Components, diodes, and adapters", "Name the basic components and the role of a peripheral interface adapter.", 10,
            blocks("Circuits", [
                "Computer circuits are interconnected electronic components that process, store, and transmit electrical signals representing data and instructions.",
                "Resistors limit current. Capacitors store and release energy for filtering and timing. Inductors store energy in magnetic fields for power regulation. Transistors act as switches or amplifiers and are the building blocks of digital circuits.",
                "A diode lets current flow in only one direction. The notes list rectification, voltage regulation, and signal clipping. A diode array packs several diodes into one package. A peripheral interface adapter lets the CPU communicate with peripheral devices.",
            ], ["Resistor", "Capacitor", "Inductor", "Transistor", "Diode", "PIA"], "PIAs manage data transfer, control signals, and synchronization."),
            [q("Which part lets current flow in only one direction?", "A diode", ["A resistor", "An inductor", "A keyboard"], "Diodes are one-way semiconductor devices."),
             q("Transistors are described as what?", "Electronic switches or amplifiers and the building blocks of digital circuits", ["Only magnetic tapes", "Only printers", "Only operating systems"], "That is the Module 1 description."),
             q("What does a PIA connect?", "The CPU and peripheral devices", ["Two religions in dialogue", "Only RAM and ROM names", "A business and the CAC"], "PIAs manage communication with peripherals.")],
            [q("Which component stores and releases electrical energy for filtering and timing?", "A capacitor", ["A resistor", "A printer", "A magnetic tape"], "Capacitors are for filtering and timing.", "intermediate")],
            [q("A diode's listed uses include what?", "Rectification, voltage regulation, and signal clipping", ["Only printing", "Only file storage", "Only user stories"], "Those three functions are in Module 1.")]),
    ]),
    chapter("Integrated circuits", "AUE-CSC-104 .pdf, Module 2", [
        lesson("How chips are scaled", "Define an integrated circuit and order the integration levels.", 10,
            blocks("Integrated circuits", [
                "An integrated circuit is a complete electronic circuit fabricated on a small semiconductor, usually silicon.",
                "The fabrication list is silicon crystal growth, wafer slicing and polishing, oxidation, photolithography, etching, doping, metallization, then packaging and testing.",
                "SSI covers logic gates and flip-flops. MSI covers adders, counters, and multiplexers. LSI covers microprocessors and memory chips. VLSI covers modern CPUs and systems on a chip. These levels support compact design, higher speed, lower power, and better reliability.",
            ], ["SSI", "MSI", "LSI", "VLSI"], "Doping is one step in the fabrication list."),
            [q("An integrated circuit is fabricated on what material in the notes?", "A small semiconductor, usually silicon", ["Magnetic tape", "Paper punch cards", "A CRT screen"], "The definition names a semiconductor, usually silicon."),
             q("Logic gates and flip-flops are which level?", "SSI", ["MSI", "LSI", "VLSI"], "SSI is small-scale integration for gates and flip-flops."),
             q("Modern CPUs and systems on a chip are which level?", "VLSI", ["SSI", "MSI", "Only core memory"], "VLSI is very large scale integration.")],
            [q("Which sequence matches the start of the fabrication list?", "Crystal growth, wafer slicing, oxidation, photolithography", ["Packaging first, then crystal growth", "Printing, then etching paper", "Booting, then a GUI"], "Those are the first fabrication steps.", "intermediate")],
            [q("MSI examples in the notes are what?", "Adders, counters, and multiplexers", ["Only modern CPUs", "Only resistors", "Only CRTs"], "MSI is medium-scale integration for those parts.")]),
    ]),
    chapter("Memory systems", "AUE-CSC-104 .pdf, Module 3", [
        lesson("Primary, secondary, and core memory", "Contrast RAM, ROM, secondary memory, and core memory.", 8,
            blocks("Memory", [
                "Memory stores the data and instructions the computer needs for processing.",
                "RAM is volatile memory for active processes. ROM stores permanent instructions such as firmware. Secondary memory is non-volatile storage for long-term retention.",
                "Core memory used magnetic cores to store binary data. The notes say it was common in early computers, was non-volatile, and was bulky and expensive.",
            ], ["RAM: volatile, active processes", "ROM: firmware", "Secondary: long-term", "Core: magnetic and bulky"], "Core memory is not the same as a modern CPU core."),
            [q("Which memory is volatile and used for active processes?", "RAM", ["ROM", "Secondary memory", "Core memory"], "RAM is the volatile primary memory in Module 3."),
             q("ROM is said to store what?", "Permanent instructions such as firmware", ["Only active unsaved documents", "Only magnetic tape backups", "Only printed output"], "ROM holds permanent instructions such as firmware."),
             q("Core memory stored bits using what?", "Magnetic cores", ["Vacuum tubes only", "Punch-card looms", "Hyperlinks"], "Core memory used magnetic cores.")],
            [q("Why do the notes say core memory fell out of ordinary use?", "It was bulky and expensive, even though it was non-volatile", ["It was volatile", "It could not store binary", "It was a programming language"], "The notes call it non-volatile but bulky and expensive.", "intermediate")],
            [q("Secondary memory is for what?", "Long-term non-volatile retention", ["Only the current CPU instruction", "Only firmware", "Only analog signals"], "Secondary memory is long-term non-volatile storage.")]),
    ]),
    chapter("Magnetic storage and peripherals", "AUE-CSC-104 .pdf, Modules 4-5", [
        lesson("Disks, tapes, and input/output devices", "Contrast disk and tape access and name the peripheral examples.", 10,
            blocks("Storage and peripherals", [
                "Magnetic disks, including hard disk drives, are described as high-capacity random-access storage. Magnetic tapes are sequential-access storage used for backups and archives.",
                "The video-disk section gives optical and magnetic examples: CDs, DVDs, and Blu-ray disks.",
                "Input examples are keyboards and character-recognition devices such as OCR and MICR. Output examples are dot-matrix, inkjet, and laser printers, plus CRTs as early displays. Peripherals let people interact with the computer.",
            ], ["HDD: random access", "Tape: sequential access", "CD, DVD, Blu-ray", "Keyboard, OCR, MICR", "Printers and CRTs"], "Sequential tape is a poor fit when you need an arbitrary record immediately."),
            [q("Hard disks are described as what kind of access?", "Random access", ["Sequential access only", "Write-only", "Analog only"], "Magnetic disks are high-capacity random-access storage."),
             q("Magnetic tape is used for what in the notes?", "Backups and archives, with sequential access", ["CPU arithmetic", "Only firmware", "Only GUIs"], "Tape is sequential and used for backup and archival storage."),
             q("OCR and MICR are examples of what?", "Character-recognition input devices", ["Operating systems", "Integration levels", "Output printers"], "They are listed under input devices.")],
            [q("Which display is named as an early visual output device?", "The cathode ray tube", ["Blu-ray", "A resistor", "A diode array"], "CRTs are the early visual display units in Module 5.", "intermediate")],
            [q("CDs, DVDs, and Blu-ray are grouped as what?", "Video-disk examples, optical and magnetic storage", ["CPU parts", "Only RAM types", "Only programming languages"], "Module 4 lists them as video-disk examples.")]),
    ]),
    chapter("Op-amps, converters, and analog computers", "AUE-CSC-104 .pdf, Modules 6-8", [
        lesson("Analog circuits and converters", "State op-amp traits and the direction of ADC and DAC conversion.", 10,
            blocks("Analog hardware", [
                "An operational amplifier is a high-gain electronic amplifier used in analog circuits. The notes list high input impedance, low output impedance, and high voltage gain. Applications include signal amplification, filtering, and voltage regulation.",
                "An ADC converts a continuous analog signal into discrete digital values. A DAC converts digital data into an analog signal for output devices.",
                "Analog computers operate on continuous data represented by physical quantities such as voltage or current. They are described as fast and continuous, with limited accuracy, and are used for engineering simulations and control systems.",
            ], ["High input impedance", "Low output impedance", "High voltage gain", "ADC and DAC"], "Digital computers in COS 101 use discrete binary values. Analog computers here use continuous quantities."),
            [q("An ADC converts what into what?", "A continuous analog signal into discrete digital values", ["Digital data into analog sound only", "Text into a flowchart", "A program into a class"], "That is the Module 7 definition of an ADC."),
             q("Which trait is listed for an op-amp?", "High input impedance and high voltage gain", ["Low voltage gain only", "Sequential tape access", "Volatile firmware"], "Op-amps have high input impedance, low output impedance, and high gain."),
             q("Analog computers represent data by what?", "Continuous physical quantities such as voltage or current", ["Only punch cards", "Only classes", "Only TCP packets"], "Module 8 says they use continuous quantities.")],
            [q("The notes say analog computers have what limitation?", "Limited accuracy", ["No speed", "No applications", "They cannot use voltage"], "They are fast but have limited accuracy.", "intermediate")],
            [q("A DAC is used when you need to do what?", "Turn digital data into an analog signal", ["Turn analog sound into binary only", "Store firmware in ROM", "Assemble assembly language"], "DAC means digital-to-analog conversion.")]),
    ]),
]))

add(course("AUE-GST 102", "God in Modern Society", "100", [
    chapter("Religious dialogue", "AUGST supplementary notes, AU-GST 102", [
        lesson("What dialogue is for", "Explain religious dialogue and the four types named in the notes.", 12,
            blocks("Dialogue", [
                "Religious dialogue is the attempt to create cooperation and a productive relationship among groups such as Christianity, Islam, African Traditional Religion, and secular-minded people. It seeks mutual respect and peaceful coexistence.",
                "The notes say dialogue is a continuous journey. It is not aimed at converting the other person. It is for mutual understanding and tolerance.",
                "The four types are interfaith dialogue between representatives of different religions, intrafaith dialogue among members of the same tradition, interreligious dialogue among different religious traditions, and secular-religious dialogue between religious and secular perspectives.",
            ], ["Interfaith", "Intrafaith", "Interreligious", "Secular-religious"], "The notes say interfaith and interreligious are often used interchangeably, with interreligious dialogue more focused on specific religious traditions."),
            [q("The notes say dialogue is aimed at what?", "Mutual understanding and tolerance, not necessarily conversion", ["Forcing one religion on the other", "Ending all religion", "Replacing law with myth"], "Conversion is not the aim."),
             q("Dialogue inside one religious tradition is called what?", "Intrafaith dialogue", ["Interfaith dialogue", "Secular-religious dialogue", "Henotheism"], "Intrafaith is among members of the same tradition."),
             q("Secular-religious dialogue is between whom?", "Religious and secular perspectives", ["Only two churches", "Only students in one department", "Only printed books"], "That is the fourth type.")],
            [q("Which statement matches the notes on dialogue?", "It is a continuous journey and does not end", ["It is a single meeting that closes the issue", "It requires conversion", "It forbids mentioning differences"], "The notes call dialogue a continuous journey.", "intermediate")],
            [q("Interfaith dialogue is between whom?", "Representatives of different religions", ["Only members of one congregation", "Only secular writers", "Only government registrars"], "That is the first of the four types.")]),
    ]),
    chapter("Challenges and faith", "AUGST supplementary notes, challenges and faith", [
        lesson("Obstacles and the meaning of faith", "List challenges to dialogue and give the notes' theological meaning of faith.", 10,
            blocks("Challenges and faith", [
                "Challenges named in the notes include misunderstanding and stereotypes, dogmatism, cultural and linguistic barriers, fear of proselytism, political interference, historical conflicts, lack of education, gender and power dynamics, radicalization, and the secular-religious divide.",
                "Theologically, faith is a firm belief in God and His promises, leading to trust and obedience.",
                "The notes also connect faith with mental well-being. They say prayer, meditation, and reliance on God can reduce stress, and that gratitude encouraged in faith traditions improves mental well-being.",
            ], ["Stereotypes", "Dogmatism", "Fear of proselytism", "Historical conflict", "Lack of education"], "Fear of proselytism means people worry that dialogue will pressure them to convert."),
            [q("How do the notes define faith theologically?", "A firm belief in God and His promises, leading to trust and obedience", ["A research method", "A business registration step", "A computer generation"], "That sentence is in the faith section."),
             q("Dogmatism hinders dialogue because it does what?", "It makes beliefs rigid and limits openness to other perspectives", ["It requires a translator", "It creates RAM", "It ends all conflict automatically"], "The notes describe dogmatism as rigidity."),
             q("Which practice do the notes say can reduce stress?", "Prayer, meditation, and reliance on God", ["Avoiding every conversation", "Deleting digital evidence", "Refusing gratitude"], "Those practices are listed under coping.")],
            [q("Fear of proselytism means participants fear what?", "Pressure to convert or compromise their beliefs", ["A lack of printers", "A syntax error", "A slow algorithm"], "That is the notes' wording.", "intermediate")],
            [q("Gratitude in faith traditions is linked to what?", "Improved mental well-being", ["Higher CPU speed", "Company incorporation", "Magnetic tape"], "The notes say gratitude improves mental well-being.")]),
    ]),
]))

add(course("GST 112", "Nigerian Peoples and Culture", "100", [
    chapter("Norms and values", "WEEK 2 GST112 notes", [
        lesson("Norms, values, and three major groups", "Distinguish norms from values and recall examples given for Hausa-Fulani, Yoruba, and Igbo communities.", 14,
            blocks("Norms and values", [
                "Norms are established rules or expected behaviours. Folkways are everyday customs that are not strictly enforced, such as greeting elders with respect. Mores are strongly held norms with moral significance, and breaking them may bring disgrace or legal punishment.",
                "Values are fundamental beliefs about what is good or desirable. Examples in the notes include honesty, respect, hard work, and hospitality. Nigeria is said to have over 250 ethnic groups, with Hausa-Fulani, Yoruba, and Igbo treated as the three major ones.",
                "Hausa-Fulani examples include respect for elders, modest dress, and the value of faith (Iman). Yoruba examples include prostration or kneeling when greeting elders, titles such as Baba, Iya, and Kabiyesi, and the value of respect (Owo). Igbo examples include the age-grade system, titles such as Ozo or Ichie, and a strong value on self-reliance and trade.",
            ], ["Folkways and mores", "Hausa-Fulani", "Yoruba", "Igbo"], "The conclusion says respect, hard work, and communal living are shared across groups."),
            [q("Folkways are described as what?", "Everyday customs that are not strictly enforced", ["Norms whose breach brings legal punishment", "Only written constitutions", "Only pre-colonial bronzes"], "Mores, not folkways, carry the serious moral weight."),
             q("Which value name does the Yoruba section give for respect?", "Owo", ["Iman", "Aikin yi", "Adire"], "Owo is the Yoruba value of respect. Iman is faith in the Hausa-Fulani section."),
             q("The Igbo age-grade system is presented as what?", "Young people forming age groups that contribute to community development", ["A type of computer memory", "A CAC registration step", "A dialogue type"], "That is the Igbo norm in the week 2 notes.")],
            [q("Mores differ from folkways because mores do what?", "Carry moral significance, and violating them may bring disgrace or punishment", ["Are never enforced", "Apply only to computers", "Are only textile patterns"], "That is the week 2 contrast.", "intermediate")],
            [q("Kabiyesi is given as a title for whom?", "Kings", ["Age grades", "Only traders", "Only students"], "The Yoruba section says Kabiyesi is used for kings.")]),
    ]),
    chapter("Pre-colonial culture and arts", "WEEK 3 GST 112 notes", [
        lesson("Southern kingdoms and their arts", "Identify Ife, Benin, and Igbo-Ukwu art from the week 3 notes.", 12,
            blocks("Southern Nigeria", [
                "The week 3 notes say southern peoples included Yoruba, Igbo, Edo (Bini), Ijaw, and Ibibio groups.",
                "Ife is called the spiritual centre of the Yoruba and is known for naturalistic terracotta and bronze sculptures of the 12th to 15th centuries. The Oyo Empire is described as a military and political power with textiles, beadwork, and wood carving.",
                "The Benin Kingdom is famous for bronze and ivory carvings. The Benin Bronzes used the lost-wax technique. Igbo-Ukwu, in the 9th to 10th century, produced intricate bronzes. Nri is linked with peace and ritual kingship, and Arochukwu with trade and religion.",
            ], ["Ife bronzes and terracotta", "Oyo textiles and carving", "Benin lost-wax bronzes", "Igbo-Ukwu bronzes"], "Nok terracotta, dated about 900 BCE to 200 CE, is also named later in the art section."),
            [q("Which city is called the spiritual centre of the Yoruba in these notes?", "Ife", ["Kano", "Katsina", "Sokoto"], "Ife is the Yoruba spiritual centre in the week 3 notes."),
             q("The Benin Bronzes were made by which technique?", "Lost-wax casting", ["Resist dyeing", "Punch cards", "Lithography only"], "The notes name lost-wax casting."),
             q("Igbo-Ukwu is dated to which centuries in the notes?", "The 9th to 10th century", ["The 19th century only", "2000 CE", "The 1960s"], "Igbo-Ukwu bronzes are placed in the 9th to 10th century.")],
            [q("Nok culture is known in these notes for what?", "Terracotta figurines of humans and animals", ["Indigo Kano cloth only", "The Gobarau Minaret", "Computer hardware"], "Nok terracotta is in the sculpture section.", "intermediate")],
            [q("Oyo is described as known for what arts?", "Textiles, beadwork, and wood carving", ["Only Arabic calligraphy", "Only Goje music", "Only RAM chips"], "Those are the Oyo artistic expressions in the notes.")]),
        lesson("Northern societies, textiles, and belief", "Recall Hausa, Kanem-Bornu, and Sokoto examples and the art forms that close the week.", 12,
            blocks("Northern Nigeria and shared arts", [
                "Hausa city-states such as Kano, Zaria, Katsina, and Gobir are placed between the 10th and 15th centuries as trans-Saharan trade centres. The notes mention Kano's walls and mosques, leatherwork, metalwork, and indigo-dyed cloth.",
                "Kanem-Bornu, ruled by the Sayfawa dynasty, is linked with Arabic calligraphy, mosque architecture, and horse-mounted warriors. The Sokoto Caliphate under Usman dan Fodio is the 19th-century Islamic influence named for calligraphy, mosques, and Quranic manuscript illumination.",
                "Later sections add Yoruba adire resist-dye cloth, Hausa embroidered robes such as Babban Riga, Yoruba dundun talking drums, the Hausa-Kanuri goje, the Gobarau Minaret, Yoruba Orisha art, and Igbo Mbari houses.",
            ], ["Hausa city-states", "Kanem-Bornu", "Sokoto Caliphate", "Adire and Babban Riga", "Dundun and goje"], "Trans-Saharan trade is the route the notes give for exchange with North Africa."),
            [q("Indigo-dyed cloth is associated with which city in these notes?", "Kano", ["Ife", "Benin", "Igbo-Ukwu"], "The Hausa section names indigo-dyed Kano cloth."),
             q("Who leads the Sokoto Caliphate in the week 3 account?", "Usman dan Fodio", ["The Oba of Benin", "The Ooni of Ife", "A Yoruba age grade"], "The Fulani and Islamic section names Usman dan Fodio."),
             q("Adire cloth is made by what method?", "Resist dyeing on indigo fabric", ["Lost-wax bronze casting", "Magnetic core storage", "Punch cards"], "Adire is the Yoruba resist-dye textile.")],
            [q("Dundun drums belong to which people in the notes?", "The Yoruba", ["Only the Kanuri", "Only the Nupe", "Only computer engineers"], "Yoruba talking drums are called dundun.", "intermediate")],
            [q("The Gobarau Minaret is given as an example of what?", "Northern mosque and Sahelian architecture in Katsina", ["A Benin bronze", "A southern shrine only", "A programming language"], "It is named with Katsina's architecture.")]),
    ]),
]))
