"""PHY 102, ENT 211, CYB 203, COS 201, SEN 201, and STA 111."""
from build_import import COURSES, blocks, chapter, course, lesson, q

def add(item):
    COURSES.append(item)

def outline_lesson(title, objective, minutes, heading, lead, items, source_fact, practice, mock, battle):
    return lesson(title, objective, minutes, blocks(heading, [lead], items, source_fact), practice, mock, battle)

add(course("PHY 102", "General Physics II", "100", [
    chapter(name, "PHY_102_Course_Outline.pdf", [
        outline_lesson(name, f"State the PHY 102 outline points for {name}.", 8, name,
            f"The PHY 102 course outline lists {name} with these points and no further formulas in the outline file.",
            points,
            "Questions in this chapter use only the outline headings, not formulas the outline does not state.",
            [q(f"Which point belongs to {name} in the PHY 102 outline?", points[0], wrongs, f"The outline places {points[0]} under {name}."),
             q(f"How many outline points are listed here for {name}?", str(len(points)), [str(len(points)+2), str(max(1, len(points)-1)), "10"], f"The outline lists {len(points)} points under {name}."),
             q(f"{name} is a topic in which course outline?", "PHY 102", ["COS 101", "ENT 211", "GST 112"], "These points come from the PHY 102 course outline.")],
            [q(f"Which item is not listed under {name}?", wrongs[0], [points[0], points[1] if len(points)>1 else points[0], "It is listed"], f"{wrongs[0]} is a point from a different outline section.", "intermediate")],
            [q(f"The outline file groups {points[0]} under which heading?", name, ["A different PHY 102 heading", "COS 101 history", "SEN 201 week 1"], f"{points[0]} is under {name}.")])
    ]) for name, points, wrongs in [
        ("Introduction to semiconductors", ["Definition of semiconductors", "Intrinsic and extrinsic semiconductors", "Doping", "p-type and n-type materials", "p-n junctions"], ["Coulomb's law", "RMS values", "Resonance"]),
        ("Electrostatics", ["Electric charge", "Electric field", "Electric field strength", "Coulomb's law", "Electric field lines"], ["Doping", "Ohm's law", "Resonance"]),
        ("Capacitors and dielectrics", ["Capacitance", "Energy stored in a capacitor", "Capacitors in series and parallel", "Dielectrics", "Drift velocity"], ["p-n junctions", "RMS values", "Cells in series"]),
        ("Ohm's law and resistance", ["Ohm's law, V = IR", "Resistors in series", "Resistors in parallel"], ["Coulomb's law", "Doping", "Resonance"]),
        ("Current electricity", ["Electric current", "Electromotive force", "Internal resistance", "Cells in series and parallel"], ["Dielectrics", "p-type materials", "Angular frequency"]),
        ("Alternating current", ["AC voltage and current", "Frequency and angular frequency", "RMS values"], ["Doping", "Folkways", "JDK"]),
        ("Components in AC circuits", ["Resistors", "Capacitors", "Inductors"], ["p-n junctions", "User stories", "Folkways"]),
        ("Special AC circuits", ["RC circuit", "RL circuit", "RLC circuit", "Resonance"], ["Doping", "Coulomb's law only", "VAT registration"]),
    ]
]))

add(course("ENT 211", "Entrepreneurship and Innovation", "200", [
    chapter("Concept of entrepreneurship", "ENT 211 UPDATED NOTE.docx, Unit 1", [
        lesson("Entrepreneurs, intrapreneurs, and theories", "Distinguish entrepreneurship from intrapreneurship and name the theories in Unit 1.", 12,
            blocks("Unit 1", [
                "Entrepreneurship is identifying opportunities, mobilizing resources, and establishing ventures to create value. It includes both a mindset and the act of creating an enterprise.",
                "An entrepreneur starts ventures independently. An intrapreneur innovates inside an existing organization. The comparison table says the entrepreneur bears the risk and receives profit, while the organization shares intrapreneurial risk and provides the resources.",
                "Schumpeter's innovation theory says entrepreneurs introduce new combinations and drive creative destruction. Other perspectives named are economic theories about market gaps, psychological theories such as McClelland's need for achievement, and sociological theories about culture and networks.",
            ], ["Schumpeter: innovation and creative destruction", "Economic: market gaps", "Psychological: need for achievement", "Sociological: culture and networks"], "Necessity-based entrepreneurship comes from lack of other employment. Opportunity-based entrepreneurship exploits a profitable gap."),
            [q("Who bears the risk in the Unit 1 comparison table?", "The entrepreneur", ["The existing organization, for an independent founder", "Neither party", "Only the CAC"], "The table says entrepreneurial risk is borne by the entrepreneur."),
             q("Creative destruction is associated with whom?", "Joseph Schumpeter", ["McClelland only", "A computer CPU", "Usman dan Fodio"], "Schumpeterian theory uses creative destruction."),
             q("Intrapreneurship happens where?", "Inside an existing organization", ["Only before a business is named", "Only in analog computers", "Only in religious dialogue"], "Intrapreneurs innovate while employed.")],
            [q("Necessity-based entrepreneurship is driven by what?", "Lack of alternative employment or survival needs", ["A guaranteed grant", "A software requirements specification", "A diode"], "That contrast is in Unit 1.", "intermediate")],
            [q("Schumpeter's new combinations include what kind of change?", "New products, methods, markets, supply sources, or organizational forms", ["Only folkways", "Only RAM types", "Only TCP packets"], "Those are the new combinations in the note.")]),
    ]),
    chapter("Characteristics of entrepreneurs", "ENT 211 UPDATED NOTE.docx, Unit 2", [
        lesson("Traits that can be learned", "List the core characteristics and the natural-versus-developed distinction.", 10,
            blocks("Unit 2", [
                "Core characteristics are opportunity seeking, calculated risk taking, problem solving, and innovation. The Dangote cement example illustrates opportunity seeking. Flutterwave is the fintech example of solving limited access to global payments.",
                "Other traits are persistence, vision, leadership, networking, and ethical orientation.",
                "Natural traits listed are creativity, passion, intuition, and confidence. Developed traits are business planning, financial literacy, negotiation, and strategic management.",
            ], ["Opportunity seeker", "Calculated risk taker", "Problem solver", "Innovator"], "The notes say entrepreneurship can be nurtured through education, mentorship, and experience."),
            [q("The cement example of opportunity seeking names whom?", "Aliko Dangote", ["Jason Njoku", "A control unit", "Alan Turing"], "Unit 2 uses Dangote's local cement production."),
             q("Which traits does Unit 2 call developed rather than natural?", "Business planning, financial literacy, negotiation, and strategic management", ["Creativity and passion only", "Only intuition", "Only confidence"], "Those four are the developed traits."),
             q("Flutterwave is used as an example of what?", "A fintech solution to limited access to global payments", ["A bronze-casting method", "A CPU", "A folkway"], "It is the problem-solver example.")],
            [q("Risk taking in Unit 2 is described as what?", "Calculated, after looking at gains and losses", ["Reckless by definition", "Forbidden", "Only financial and never reputational"], "Entrepreneurs take calculated risks.", "intermediate")],
            [q("Ethical orientation means operating with what?", "Integrity, fairness, and social responsibility", ["Secrecy only", "Unlimited liability", "No partners"], "That is the ethical-orientation trait.")]),
    ]),
    chapter("Entrepreneurial thinking", "ENT 211 UPDATED NOTE.docx, Unit 3", [
        lesson("Critical, reflective, and creative thinking", "Define the three thinking modes and how the notes say they are cultivated.", 10,
            blocks("Unit 3", [
                "Entrepreneurial thinking is the mindset used to find opportunities, solve problems, and decide under uncertainty.",
                "Critical thinking analyses a situation and questions assumptions. Reflective thinking looks back at success and failure. Creative thinking generates novel and useful ideas. Techniques named are brainstorming, mind-mapping, and lateral thinking. Nollywood is the example of creative use of limited resources and digital distribution.",
                "The notes say this thinking is cultivated through education, mentorship, small experiments, feedback, and reading.",
            ], ["Critical", "Reflective", "Creative"], "A failed first venture can still teach pricing, marketing, or team lessons if the founder reflects."),
            [q("Looking back at a failed venture to learn from it is which mode?", "Reflective thinking", ["Only critical thinking", "Only a balance sheet", "A syntax error"], "Reflective thinking uses past experience."),
             q("Which example illustrates creative thinking?", "Nollywood combining limited resources with digital distribution", ["A resistor limiting current", "ENIAC", "A diode"], "Unit 3 uses Nollywood."),
             q("Brainstorming and mind-mapping are techniques for what?", "Creative thinking", ["CAC registration only", "ROM storage", "Sequential tape backup"], "They are listed under creative thinking.")],
            [q("Critical thinking helps an entrepreneur do what before launch?", "Analyse demand, competition, and financial implications", ["Skip all evidence", "Avoid customers", "Delete the plan"], "That is the Unit 3 example.", "intermediate")],
            [q("Entrepreneurial thinking combines which three modes?", "Critical, reflective, and creative thinking", ["Only accounting", "Only hardware design", "Only folkways"], "Those are the three elements in Unit 3.")]),
    ]),
    chapter("Innovation", "ENT 211 UPDATED NOTE.docx, Unit 4", [
        lesson("Five dimensions of innovation", "Separate invention from innovation and name the five dimensions.", 10,
            blocks("Unit 4", [
                "Invention creates something new. Innovation applies that creation in a useful, profitable, and sustainable way.",
                "The five dimensions are product, process, business-model, marketing, and organizational innovation. Examples are smartphones, automation, Netflix's subscription model instead of video rental, viral social campaigns, and flatter organizations.",
                "Change is an alteration in the environment. Innovation is a deliberate response to change. The COVID-19 example is online delivery and remote work. Knowledge is created, shared, and applied.",
            ], ["Product", "Process", "Business model", "Marketing", "Organizational"], "Netflix is the business-model example, not the product-only example."),
            [q("How do the notes separate innovation from invention?", "Innovation applies a creation in a useful and sustainable way", ["They are the same word", "Innovation never reaches customers", "Invention is always a subscription"], "Invention creates something new. Innovation applies it."),
             q("Netflix replacing video rental is which dimension?", "Business-model innovation", ["Only a folkway", "A diode function", "A syntax rule"], "The subscription model is the business-model example."),
             q("Online delivery during COVID-19 is used to show what?", "Innovation as a response to change", ["That change forbids new methods", "That knowledge cannot be shared", "That partnerships are illegal"], "Innovation is a deliberate response to change.")],
            [q("Which set matches the five dimensions?", "Product, process, business model, marketing, and organizational", ["RAM, ROM, SSD, CPU, and ALU", "PAN, LAN, WAN, MAN, and IP", "Folkways, mores, values, titles, and age grades"], "Those five are Unit 4.", "intermediate")],
            [q("Process innovation is illustrated by what?", "Automation and robotics in manufacturing", ["A smartphone combining camera and apps", "A viral campaign only", "A flatter organization only"], "Automation is the process example. The smartphone is the product example.")]),
    ]),
    chapter("Enterprise formation and networking", "ENT 211 UPDATED NOTE.docx, Unit 5", [
        lesson("Plans, ownership, and registration", "List business-plan parts, ownership forms, and the CAC steps in the note.", 12,
            blocks("Unit 5", [
                "A business plan describes vision, mission, objectives, strategies, and operations. Parts listed are the executive summary, business description, market analysis, organization and management, marketing and sales, operations, and the financial plan.",
                "Ownership forms are sole proprietorship, partnership, limited liability company, public limited company, and cooperative. A sole proprietor has full control and unlimited liability. A partnership shares risk but can face conflict. An LLC is a separate legal entity with limited liability.",
                "In Nigeria the Corporate Affairs Commission registers businesses. The steps are choose a name, search availability, complete forms, pay fees, and obtain a certificate of incorporation.",
            ], ["Sole proprietorship", "Partnership", "LLC", "PLC", "Cooperative"], "A joint venture creates a new entity for a specific project. A strategic alliance does not have to create that new entity."),
            [q("Which body registers businesses in the note?", "The Corporate Affairs Commission", ["SMEDAN only", "The CPU", "ARPANET"], "Unit 5 names the CAC."),
             q("Unlimited liability is a disadvantage of which form?", "Sole proprietorship", ["A public limited company, in the note's advantage list", "An LLC", "A cooperative's only feature"], "The sole proprietorship disadvantages include unlimited liability."),
             q("A joint venture does what?", "Two or more businesses create a new entity for a specific project", ["It is only an informal chat", "It deletes a partnership", "It is a computer bus"], "That is the Unit 5 definition.")],
            [q("Which item is a listed part of the business plan?", "The financial plan of income, expenses, funding, and cash flow", ["A diode array", "A class diagram", "A punch card"], "The financial plan is one of the key components.", "intermediate")],
            [q("The last registration step in the note is what?", "Obtain a certificate of incorporation", ["Choose a CPU", "Write pseudocode", "Cast a bronze"], "The steps end with the certificate.")]),
    ]),
    chapter("Contemporary issues", "ENT 211 UPDATED NOTE.docx, Unit 6", [
        lesson("Intellectual property and digital work", "Name the IP types and the finance sources in Unit 6.", 10,
            blocks("Unit 6", [
                "Intellectual property covers creations of the mind. Patents protect inventions and processes. Copyrights protect creative works such as books, music, films, and software. Trademarks protect names, logos, and slogans. Trade secrets protect confidential information. The example is Coca-Cola's recipe.",
                "Virtual offices use tools such as Zoom, Teams, Slack, Trello, and Asana. Advantages are cost, flexibility, and a global workforce. Challenges are cohesion, data security, and productivity.",
                "Crowdfunding raises small amounts from many people. Angel investors use personal money. Venture capital firms invest larger sums. Other issues named are globalization, green business, cybersecurity, and online shopping.",
            ], ["Patent", "Copyright", "Trademark", "Trade secret"], "LinkedIn, X, WhatsApp groups, forums, and webinars are the digital networking tools."),
            [q("A trademark protects what?", "Brand names, logos, and slogans", ["Only inventions", "Only confidential recipes", "Only buildings"], "Trademarks are for brand identity. Patents are for inventions."),
             q("Coca-Cola's recipe is the example of what?", "A trade secret", ["A patent in this note", "A folkway", "A CPU register"], "Unit 6 uses it as a trade secret."),
             q("Venture capital is described as what?", "A firm whose business is investing large sums in other businesses", ["A small personal gift only", "A government certificate", "A resistor"], "That is the note's contrast with angel investors.")],
            [q("Which pair matches the note?", "Angel investors use personal money; venture capital invests larger sums", ["They are identical", "Angels are government agencies", "Venture capital is a folkway"], "Unit 6 distinguishes the two.", "intermediate")],
            [q("Copyright in Unit 6 covers what?", "Creative works such as books, music, films, and software", ["Only logos", "Only inventions", "Only office rent"], "Those are the copyright examples.")]),
    ]),
    chapter("Entrepreneurship in Nigeria", "ENT 211 UPDATED NOTE.docx, Unit 7", [
        lesson("Nigerian examples and support bodies", "Match the named entrepreneurs and support institutions.", 10,
            blocks("Unit 7", [
                "Examples are Dangote Group, Folorunsho Alakija of Famfa Oil, Tony Elumelu of UBA and the Tony Elumelu Foundation, Jason Njoku of iROKOtv, and Tara Fela-Durotoye of House of Tara.",
                "Support bodies are SMEDAN, the Bank of Industry, the National Directorate of Employment, the Tony Elumelu Foundation, and YouWin Connect Nigeria. Networks named include the Nigerian Young Professionals Forum, Fate Foundation, and Co-Creation Hub.",
                "Barriers listed are poor electricity and roads, costly finance, policy changes, corruption and bureaucracy, and cultural preference for salaried jobs.",
            ], ["SMEDAN", "Bank of Industry", "NDE", "TEF", "YouWin"], "CcHub is named for tech innovation."),
            [q("iROKOtv is associated with whom?", "Jason Njoku", ["Aliko Dangote", "Tara Fela-Durotoye", "Folorunsho Alakija"], "Njoku is the iROKOtv example."),
             q("Which body offers loans for industrial and SME projects?", "Bank of Industry", ["NDE only", "A diode maker", "ARPANET"], "BOI offers those loans."),
             q("CcHub is described as supporting what?", "Tech innovation", ["Only bronze casting", "Only RAM manufacture", "Only census punch cards"], "Co-Creation Hub supports tech innovation.")],
            [q("Which barrier is listed in Unit 7?", "Policy inconsistency and poor infrastructure", ["Too many venture-capital firms by law", "A ban on SMEDAN", "Free electricity everywhere"], "Infrastructure and policy inconsistency are listed barriers.", "intermediate")],
            [q("House of Tara is whose example?", "Tara Fela-Durotoye", ["Tony Elumelu", "Jason Njoku", "Usman dan Fodio"], "She is the beauty-industry example.")]),
    ]),
    chapter("E-commerce", "ENT 211 UPDATED NOTE.docx, Unit 8", [
        lesson("Types and challenges of e-commerce", "Define e-commerce and the four relationship types in the note.", 10,
            blocks("Unit 8", [
                "E-commerce is buying and selling goods and services over the internet. It also includes online banking, mobile money, ticketing, and digital marketing. Nigerian examples named are Jumia, Konga, Paystack, and Flutterwave.",
                "B2B is company to company. B2C is business to consumer, with Jumia and Amazon as examples. C2C is consumer to consumer, with OLX and Facebook Marketplace. C2B is an individual serving a business, with freelancers on Upwork or Fiverr.",
                "Advantages include wider reach, lower store costs, 24/7 availability, personalized marketing, and scalability. Challenges include trust and fraud, weak logistics, the digital divide, weak consumer-protection enforcement, and high competition.",
            ], ["B2B", "B2C", "C2C", "C2B"], "Future points include mobile commerce, AI recommendations, social commerce, and fintech payments."),
            [q("Jumia is used as which type?", "Business-to-consumer", ["Consumer-to-business only", "A trade secret", "A diode"], "Jumia and Amazon are B2C examples."),
             q("Upwork and Fiverr illustrate what?", "Consumer-to-business freelance services", ["B2B textile supply only", "C2C garage sales only", "A CPU"], "Individuals offer services to businesses."),
             q("Which challenge is listed?", "Trust, fraud, and weak logistics", ["Unlimited free delivery by law", "No competition", "A ban on mobile phones"], "Trust and logistics are challenges.")],
            [q("OLX is which type?", "Consumer-to-consumer", ["Business-to-business", "A patent", "An op-amp"], "OLX and Facebook Marketplace are C2C.", "intermediate")],
            [q("E-commerce in the note is broader than shopping because it includes what?", "Online banking, mobile money, ticketing, and digital marketing", ["Only physical stores", "Only bronze art", "Only assembly language"], "The definition lists those digital transactions.")]),
    ]),
]))

add(course("CYB 203", "Cybercrime, Law and Countermeasures", "200", [
    chapter("Understanding cybercrime", "CYB 203 NOTE U.pdf, Lesson 1", [
        lesson("Crime, technology, and six characteristics", "Define the scope of cybercrime and list the six characteristics.", 12,
            blocks("Lesson 1", [
                "Cybercrime is not simply crime on the internet. It covers criminal activities involving computers, networks, digital devices, information systems, or electronic data.",
                "The notes treat it as technology plus people plus money plus law plus society. Phishing can succeed because a person trusts a message such as a warning that a university account will be disabled.",
                "Six characteristics are its borderless nature, speed, anonymity, scalability, dependence on fragile digital evidence, and technical complexity. The discussion point is that fraud, theft, impersonation, and extortion existed before computers, but technology changed their speed and reach.",
            ], ["Borderless", "Speed", "Anonymity", "Scalability", "Fragile evidence", "Technical complexity"], "A graduate may meet cybercrime as a developer, administrator, analyst, forensic examiner, auditor, or incident responder."),
            [q("The notes say cybercrime is not simply what?", "Crime on the internet", ["Any use of a keyboard", "A business plan", "A folkway"], "The opening lesson rejects that narrow phrase."),
             q("Scalability means what here?", "One malicious message can reach thousands of people", ["The offender must be in the same room", "Evidence cannot change", "Computers are not involved"], "That is the scalability characteristic."),
             q("Why is digital evidence a concern?", "It can be fragile and can change quickly", ["It is always printed on paper", "It cannot be copied", "It replaces the criminal law"], "Dependence on evidence is one of the six points.")],
            [q("Phishing in the classroom example depends on what as well as technology?", "Human trust", ["A lost-wax mould", "A business-model canvas only", "A vacuum tube"], "The notes say human behaviour contributes to success.", "intermediate")],
            [q("Borderless cybercrime means what?", "Offender, victim, and server may be in different countries", ["The crime cannot cross a campus", "Only one computer is involved", "Evidence is permanent"], "That is the borderless characteristic.")]),
    ]),
    chapter("Definition and categories", "CYB 203 NOTE U.pdf, Lesson 2", [
        lesson("Tool, target, and evidence", "Explain the three computer roles and the four victim categories.", 12,
            blocks("Lesson 2", [
                "Cybercrime is any unlawful activity in which a computer, system, network, digital device, or digital information is a tool, a target, an environment, or a source of evidence.",
                "The computer is the target in unauthorised access, malware, data destruction, denial of service, or sabotage. It is the tool in online fraud, identity theft, phishing, cyberstalking, and online impersonation. It is evidence when investigators recover emails, documents, messages, or transaction records.",
                "Categories are crimes against individuals, organisations, government, and society. Organisational examples include corporate data theft, ransomware, insider attacks, website compromise, and intellectual-property theft.",
            ], ["Target", "Tool", "Evidence", "Individuals", "Organisations", "Government", "Society"], "A fake bursar email that moves money uses the computer as a tool."),
            [q("Deleting student records on a university server makes the server what?", "The target", ["Only a folkway", "A trademark", "A flowchart"], "The server is attacked, so it is the target."),
             q("A fake bursar email is which role?", "The computer as a tool", ["The computer as the only victim", "A hardware resistor", "A generation of computers"], "The computer is used to commit the fraud."),
             q("Identity theft is grouped under crimes against whom?", "Individuals", ["Only magnetic tape", "Only operating systems", "Only cooperatives"], "Identity theft is in the individuals category.")],
            [q("When investigators recover relevant emails, the computer is what?", "A source of evidence", ["Automatically the offender", "A diode", "A business plan"], "The computer holds evidence even if it is not the victim.", "intermediate")],
            [q("Online impersonation means what in the notes?", "Pretending to be a real person online, often with a fake profile", ["A legal partnership", "A class template", "A sequential tape"], "That is the definition in Lesson 2.")]),
    ]),
    chapter("Types of cybercrime", "CYB 203 NOTE U.pdf, Lesson 3", [
        lesson("Nine named types", "Match each named type with the example given in the note.", 12,
            blocks("Lesson 3", [
                "Unauthorised access is entering a system, account, or network without lawful permission. The example is using another student's portal password. The notes say it may still be unlawful even if nothing is stolen.",
                "Phishing deceives people into revealing passwords, banking details, or other personal information. Prevention steps are to verify the sender, avoid suspicious links, check addresses, use multifactor authentication, and report the message.",
                "Other types are identity theft, online financial fraud, malware, denial of service, cyberstalking, intellectual-property crime, and insider threats. Malware examples are viruses, worms, trojans, ransomware, spyware, and some malicious scripts. A distributed denial of service uses multiple sources. An insider has legitimate access but misuses it.",
            ], ["Unauthorised access", "Phishing", "Malware", "Denial of service", "Insider threat"], "Authorised access does not mean unlimited authority."),
            [q("Using another student's portal password is which type?", "Unauthorised access", ["A lawful review", "A trademark", "A folkway"], "The notes use that portal example."),
             q("Ransomware is listed as a form of what?", "Malware", ["A business plan", "A textile", "An operating system"], "Ransomware is one malware example."),
             q("An employee who copies student records for an unauthorised person is what?", "An insider threat", ["A diode", "A public company", "A generation of computers"], "Legitimate access was misused.")],
            [q("The notes say unauthorised access may still be unlawful even if what?", "Nothing is stolen", ["The password is long", "The computer is off", "A report is filed first"], "The discussion point says theft is not required.", "intermediate")],
            [q("A distributed denial of service differs because it uses what?", "Multiple systems or sources", ["Only one keyboard", "Only printed paper", "Only a flowchart"], "DDoS uses multiple sources.")]),
    ]),
    chapter("Critical infrastructure", "CYB 203 NOTE U.pdf, Lesson 4", [
        lesson("Essential services and threat types", "Define critical infrastructure and the threat types named in the lesson.", 10,
            blocks("Lesson 4", [
                "Critical infrastructure means systems and services essential to a country or society. Examples are electricity, telecommunications, banking, transportation, healthcare, government services, water, emergency services, and major information systems.",
                "These targets are attractive because one incident can affect many people. A hospital system outage can affect patient care. A financial-system outage can affect businesses and citizens.",
                "Threat types are cyber espionage, sabotage, ransomware, distributed denial of service, and supply-chain compromise. Supply-chain compromise means the attacker first compromises a supplier or third party.",
            ], ["Electricity", "Banking", "Healthcare", "Water", "Emergency services"], "Espionage is unauthorised collection of sensitive information. Sabotage is intentional disruption or destruction."),
            [q("A supply-chain compromise starts where?", "At a supplier or third party", ["Only inside ROM", "Only in a folkway", "Only in a flowchart"], "The attacker uses the supplier to reach the final organisation."),
             q("Why is critical infrastructure attractive?", "One attack can affect many people at once", ["It cannot be connected to a network", "It has no data", "It is always analog"], "That is the lesson's reason."),
             q("Cyber espionage is what?", "Unauthorised collection of sensitive information", ["A public festival", "A copyright symbol", "A CPU generation"], "That is the definition in Lesson 4.")],
            [q("Which service is listed as critical infrastructure?", "Healthcare", ["A private diary with no public role", "A single classroom pencil", "A comment in source code"], "Healthcare is one of the examples.", "intermediate")],
            [q("Sabotage means what here?", "Intentional disruption or destruction of systems", ["Authorised maintenance", "A business registration", "A user story"], "That is the sabotage definition.")]),
    ]),
    chapter("Perpetrators and social engineering", "CYB 203 NOTE U.pdf, Lesson 5", [
        lesson("Who attacks, and how they persuade", "List perpetrator groups, motivations, and social-engineering tactics.", 10,
            blocks("Lesson 5", [
                "Perpetrators can include individuals, organised criminal groups, disgruntled insiders, fraud networks, ideologically motivated groups, state-associated actors, and opportunistic criminals. The notes say they do not all share one motivation.",
                "Motivations named are financial gain, revenge, espionage, political or ideological objectives, and recognition inside a criminal community.",
                "Social-engineering tactics are urgency, fear, authority, curiosity, and reward. Example lines are 'You must act immediately', 'Your account will be closed', 'I am calling from the bank', 'See the attached document', and 'You have won a prize'.",
            ], ["Urgency", "Fear", "Authority", "Curiosity", "Reward"], "Financial gain means the offender wants money. Espionage means the objective is information."),
            [q("'You have won a prize' is which tactic?", "Reward", ["Fear", "A hardware interrupt", "A class diagram"], "Reward is the prize tactic."),
             q("Which motivation seeks information rather than money?", "Espionage", ["Financial gain", "A folkway", "A dividend"], "Espionage aims at information."),
             q("'I am calling from the bank' appeals to what?", "Authority", ["Curiosity only", "A resistor", "A textile pattern"], "Authority is the impersonation of a trusted office.")],
            [q("The notes warn against assuming what about perpetrators?", "That they all have the same motivation", ["That computers can store data", "That evidence should be kept", "That phishing uses messages"], "Motivations differ.", "intermediate")],
            [q("Urgency is illustrated by which line?", "You must act immediately", ["See the attached document", "You have won a prize", "I am calling from the bank"], "Urgency is the demand to act immediately.")]),
    ]),
]))
