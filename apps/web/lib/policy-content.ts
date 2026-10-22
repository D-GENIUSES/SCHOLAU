import type { PolicySection } from "@/components/legal/policy-layout";

export const privacySections: PolicySection[] = [
  { id: "operator", title: "1. Who is responsible", paragraphs: [
    "SCHOLAU is a university learning platform operated by David Mba, who is responsible for the processing described here. For privacy questions or requests, email johnnwaokolo01@gmail.com.",
    "This notice covers the SCHOLAU website and learning accounts. A university’s own systems and independent third-party websites have their own notices. University or course names identify academic content; they do not by themselves establish a partnership or endorsement."
  ] },
  { id: "google-sign-in", title: "Google sign-in and Google user data", paragraphs: [
    "When you choose Continue with Google, Google shares your Google account identifier, email address and basic profile information, such as your name and profile picture, with SCHOLAU through Supabase Auth. We use this information to authenticate you, create or identify your SCHOLAU account, maintain your sign-in session and display your account profile. SCHOLAU does not receive your Google password.",
    "Google sign-in requests basic identity, email and profile access only. It does not request access to your Gmail messages, Google Drive files, calendar, contacts or other Google account content. You can use email and password instead of Google sign-in.",
    "Supabase processes and stores Google authentication and account information on SCHOLAU’s behalf. Authorized administrators may access account information for support and security. Your display name and profile image may be visible to other users through SCHOLAU’s profile, social and competition features as described below; your email address is not a public leaderboard field.",
    "We do not sell Google user data, use it for advertising, or use it to train artificial intelligence models. We use and share Google user data only to provide and secure the account and profile features described in this policy, with service providers performing those functions, or where required by law.",
    "We retain Google account and profile information while it is needed to provide your account and address support, security or legal requirements. You can disconnect SCHOLAU in your Google Account’s third-party connections settings. Disconnecting prevents future Google authorization but does not automatically delete information already stored in SCHOLAU; request deletion through your Profile or email johnnwaokolo01@gmail.com. Deletion is handled as described in the retention and deletion section below."
  ] },
  { id: "information", title: "2. Information we handle", paragraphs: [
    "Account information: email, authentication records, username, display name, optional profile photograph, account status, age declaration, and records of terms acceptance. Supabase Auth handles passwords and sign-in credentials.",
    "Academic information: university, faculty, department, level, semester, academic period, enrollments and course assignments. Learning records include lesson progress, assessment attempts, submitted answers, scores, feedback, mastery, XP, streaks and rewards.",
    "Competition and social records: friend handles and relationships, invitations, battle participation, answers, outcomes and leaderboard preferences.",
    "Lecturer applications: name, university, faculty, department, position, requested courses, optional institutional profile link, verification notes and review decisions. The application form does not request identity-document uploads.",
    "Communications: reports, support and deletion requests, announcements, notification preferences, delivery records, and browser push subscriptions when enabled.",
    "Technical information: authentication cookies, browser storage, request and security logs, device/browser information and network identifiers such as IP addresses where processed by hosting or authentication services.",
    "Guardian verification, when available: applicant email, guardian name and contact, relationship, consent and verification records, reviewing administrator, policy versions, approval status and account linkage. We do not request identity documents through the registration form."
  ] },
  { id: "purposes", title: "3. Purposes and lawful bases", paragraphs: [
    "We use account, academic, learning and competition information to provide the services you request, administer accounts, match course content, save progress and deliver results. Where a valid contract applies, we rely on steps towards or performance of that contract.",
    "We rely on legitimate interests, subject to your rights and reasonable expectations, for proportionate security, abuse prevention, troubleshooting, content review and administration. We rely on legal obligations where a law requires particular processing or disclosure.",
    "Where consent is required, including processing children’s information through verified parent or guardian consent, we obtain it before enabling the relevant processing. Optional push notifications are offered separately. Accepting the Terms is not blanket consent to unrelated processing. You may withdraw consent; withdrawal does not make earlier lawful processing unlawful, but may prevent continued use of the affected feature."
  ] },
  { id: "visibility", title: "4. Who can see your information", paragraphs: [
    "Other learners may see your username, display name and profile image in social and competition features, together with relevant battle results. Leaderboards display public identity and XP. You can change leaderboard visibility in Profile; this does not remove your identity from friend relationships or battle history. Your detailed XP ledger and account contact details are not public leaderboard information.",
    "Authorized administrators handle support, moderation, lecturer applications and account management. Approved lecturers receive access appropriate to their assigned teaching role and courses. Access is controlled by permissions; a lecturer application alone does not grant teaching access."
  ] },
  { id: "providers", title: "5. Service providers and transfers", paragraphs: [
    "The application uses Supabase for authentication, database and associated storage, Vercel for hosting, and Cloudflare R2 for configured private learning assets. Email and browser push delivery can involve the relevant delivery and browser platform providers. These services process information needed for their functions. We may disclose information where lawfully required, to protect rights and security, or to advisers bound by appropriate confidentiality.",
    "Our providers may process data outside Nigeria. We use providers for the functions described here and assess their applicable transfer protections. Contact us if you want information about a particular transfer."
  ] },
  { id: "cookies", title: "6. Cookies, storage and analytics", paragraphs: [
    "SCHOLAU uses authentication cookies to maintain sessions and browser storage or caching for preferences, the installed web application and offline behavior. You can manage cookies and site data through your browser; blocking required session storage may prevent sign-in or other requested functions. Shared-device users should sign out and clear site data when appropriate.",
    "The current release connects product events to an analytics adapter that discards them; no external product-analytics adapter is configured. It does not implement session replay. Operational database records and hosting or security logs are separate from product analytics. Any future non-essential analytics must be assessed, disclosed and, where required, offered with a separate consent choice before activation."
  ] },
  { id: "children", title: "7. University entrants under 18", paragraphs: [
    "SCHOLAU intends to support university entrants under 18 without a fixed minimum age, only after verified parent or guardian consent and an assessment appropriate to the student’s age. This pathway is currently closed while support contacts and verification are established. Selecting ‘under 18’ does not create a learning account.",
    "Once available, a parent or guardian must contact support. Support checks their authority, consent to the identified processing and the applicant’s eligibility, records the review, and supplies an email-bound approval code after approval. A pending request is not approval. The applicant must also read the Privacy Policy and accept the Terms as applicable. A guardian can contact support about access, correction, withdrawal or deletion. We will assess and address accounts identified as belonging to children without the required authorization."
  ] },
  { id: "retention", title: "8. Retention, deletion and security", paragraphs: [
    "We keep account and learning information while your account is active and as needed to provide the service. After a deletion request, we remove personal records from active systems through our account-erasure process, except information needed for legal obligations, security, disputes or another lawful purpose. Backup copies may remain temporarily under provider backup cycles before expiry.",
    "Request deletion through Profile → Settings → Security → Request account deletion. This sends a support request; deletion is not immediate. Support handles identity checks and account removal. The account-erasure workflow removes personal learning and competition records and linked legal and guardian records. Shared course content and other players’ records may remain after personal attribution is removed. Support must also handle owned storage objects through the relevant storage service.",
    "Access controls, private asset delivery and restricted administrative functions help protect information. No internet service guarantees absolute security. Contact support about suspected account misuse. Deletion from active systems does not imply immediate removal from provider backups."
  ] },
  { id: "rights", title: "9. Your rights and choices", paragraphs: [
    "Subject to applicable law, you may request information about processing, access, correction, erasure, restriction, portability, objection to processing, or withdrawal of consent. You may also raise concerns about decisions made solely through automated processing that significantly affect you and request human review where applicable. Automated quiz scoring and XP do not represent university admission, accreditation or official examination decisions.",
    "Use Profile to update available settings and notification or leaderboard choices. For other requests, contact johnnwaokolo01@gmail.com; existing account holders can also use Profile → Settings → Support & privacy → Contact support. We may verify identity or guardian authority before responding and explain lawful limits.",
    "You may complain to the Nigeria Data Protection Commission (NDPC), whose website is linked below. This notice describes our practices and your options under applicable Nigerian data-protection law."
  ] },
  { id: "updates", title: "10. Updates and contact", paragraphs: [
    "We will identify policy versions and update dates and provide appropriate notice of material changes. Where new consent is required, publishing an update alone will not replace obtaining it. The current policy takes effect on 22 October 2026.",
    "Operator: David Mba. Privacy and support: johnnwaokolo01@gmail.com."
  ] }
];

export const termsSections: PolicySection[] = [
  { id: "agreement", title: "1. Operator and agreement", paragraphs: [
    "SCHOLAU is operated by David Mba. Contact: johnnwaokolo01@gmail.com. These draft Terms describe the proposed conditions for using our learning platform. No effective date has been set.",
    "Registration requires affirmative acceptance of the displayed version. We record that version and a server timestamp. Our Privacy Policy explains data handling separately. Accepting these Terms does not authorize unrelated optional processing."
  ] },
  { id: "eligibility", title: "2. Eligibility and guardian consent", paragraphs: [
    "Provide accurate account and academic information and select your age group truthfully. University entrants under 18 require verified parent or guardian consent before account creation, with an age-appropriate review. There is no fixed minimum age for that proposed pathway, but it is currently closed until our contacts and verification process are operational.",
    "When the pathway opens, support must verify the guardian’s authority and consent and issue an email-bound approval code. Pending, rejected, expired or previously used approvals do not authorize registration. Guardians must read these Terms and the Privacy Policy with the student and contact support about consent withdrawal. A student’s declaration cannot replace required guardian authorization.",
    "Lecturer accounts require review of affiliation and teaching access. Email confirmation does not grant lecturer privileges. Do not claim to represent an institution without authority."
  ] },
  { id: "accounts", title: "3. Your account", paragraphs: [
    "Keep credentials secure, use an email you control, and notify support of suspected misuse. Do not share accounts, impersonate others, give misleading academic details or access another person’s records. You are responsible for activity you authorize, subject to applicable law and any failure attributable to SCHOLAU.",
    "Some features require email verification, approved roles, published content or matching academic enrollment. Keep your profile current. We may ask for reasonable verification before sensitive changes or support actions."
  ] },
  { id: "conduct", title: "4. Acceptable use and academic integrity", paragraphs: [
    "Use the service lawfully and treat others respectfully. Do not harass, discriminate, threaten, disclose another person’s private information, upload malware, interfere with service operation or misuse reporting tools.",
    "Do not cheat, automate answers or battles, manipulate XP or rankings, collude, exploit vulnerabilities, collect other users’ information without authority or evade access restrictions.",
    "Respect your institution’s assessment and academic-integrity rules. SCHOLAU practice access does not authorize assistance during a restricted examination. Report errors or abuse through the available controls; do not distribute private assessment answers or restricted content."
  ] },
  { id: "education", title: "5. Educational limits", paragraphs: [
    "SCHOLAU supports study through lessons, practice, feedback and competition. Content may contain errors, become outdated or differ from your institution’s curriculum. Check important information against official teaching materials and report mistakes.",
    "We do not guarantee grades, examination success, admission, accreditation or professional qualification. Results, XP and badges are learning indicators, not official university awards. Naming a university, department or course does not imply its endorsement or affiliation."
  ] },
  { id: "competition", title: "6. Battles, XP and rewards", paragraphs: [
    "Battles and leaderboards operate under the published feature rules and availability of eligible participants and content. Scoring, timing, connectivity and incomplete matches can affect results. We may investigate suspected manipulation and correct erroneous or abusive records fairly.",
    "XP, streaks, rankings and badges have no stated cash value and do not create a right to money, transferable property or an academic credential. Do not sell or trade accounts or rewards. We will give appropriate notice of material changes to feature rules."
  ] },
  { id: "content", title: "7. Intellectual property and submissions", paragraphs: [
    "SCHOLAU software, branding and original materials belong to their respective rights holders. You may use available materials for intended personal learning or authorized teaching, subject to access restrictions. Do not redistribute restricted materials, remove rights notices or claim others’ work. Statutory exceptions remain available.",
    "You retain rights you hold in submitted materials. By submitting content, you grant the operator non-exclusive permission to host, copy, display and process it only as needed to deliver, review, moderate and secure the service. Submit only materials you have authority to provide and avoid unnecessary information about others.",
    "Authorized shared teaching content may remain after account deletion with personal attribution removed, subject to applicable rights and removal requests. Report alleged infringement to johnnwaokolo01@gmail.com with the material location, your rights and contact details."
  ] },
  { id: "moderation", title: "8. Moderation, suspension and leaving", paragraphs: [
    "We may review reported content, restrict access or suspend or terminate accounts where reasonably necessary to address violations, security issues, unlawful conduct or legal requirements. Where appropriate we will explain the reason and allow a support review; urgent security or legal circumstances may require immediate action.",
    "You may stop using SCHOLAU and request deletion through Profile → Settings → Security. Support processes deletion rather than deleting the account immediately. Shared content, other users’ records and lawful retention exceptions are explained in the Privacy Policy. Challenge a moderation decision through Contact support or johnnwaokolo01@gmail.com."
  ] },
  { id: "availability", title: "9. Availability and third parties", paragraphs: [
    "Features and content may be interrupted, changed or unavailable because of maintenance, connectivity, security or other operational needs. We do not promise continuous availability or published materials for every course. We will provide reasonable notice of material service changes where practicable.",
    "Third-party websites and services may have their own terms and notices. Review them when using those services. These Terms do not set prices, subscriptions, payment obligations or refund rules. Any future paid offer must disclose its terms before purchase."
  ] },
  { id: "liability", title: "10. Responsibility and liability", paragraphs: [
    "We will exercise the care required by applicable law. To the extent permitted by law, we do not warrant uninterrupted operation, error-free content or particular educational outcomes, and are not responsible for losses that are not reasonably foreseeable or caused by circumstances for which we are not legally responsible.",
    "Nothing here excludes or limits rights, remedies or liability that cannot lawfully be excluded or limited, including applicable consumer and data-protection rights, fraud or other mandatory protections. No blanket waiver of statutory rights is intended."
  ] },
  { id: "law", title: "11. Nigerian law and disputes", paragraphs: [
    "Nigerian law governs these Terms, subject to mandatory protections that apply to you. Contact support first so we can try to resolve concerns fairly. This does not prevent regulator complaints, access to a competent court or other lawful remedies. These Terms do not require mandatory arbitration."
  ] },
  { id: "updates", title: "12. Updates and contact", paragraphs: [
    "We will identify each version and its update date, notify users appropriately of material changes, and obtain fresh acceptance where required. This draft must be completed before publication; its update date is not an effective date.",
    "Operator: David Mba. Support and legal requests: johnnwaokolo01@gmail.com."
  ] }
];
