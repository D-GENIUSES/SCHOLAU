import type { PolicySection } from "@/components/legal/policy-layout";

export const privacySections: PolicySection[] = [
  { id: "operator", title: "1. About this policy", paragraphs: [
    "SCHOLAU is a university learning platform. This policy explains how we handle your information when you use our website and learning accounts. For questions or requests, email johnnwaokolo01@gmail.com.",
    "University names and course titles describe learning content. They do not imply a partnership or endorsement. Other websites and university systems have their own privacy policies."
  ] },
  { id: "information", title: "2. Information we collect", paragraphs: [
    "We collect account details such as your email, username, display name, optional profile photo, age declaration and acceptance of our terms. Supabase Auth handles sign-in credentials.",
    "We save your academic details, course choices, lesson progress, quiz answers, scores, XP, streaks and rewards. Social features also use friend connections, invitations and battle results.",
    "We handle lecturer applications, support messages, notification preferences and push subscriptions when enabled. Our hosting and sign-in services may process browser details, IP addresses and security logs. If guardian verification becomes available, we will also keep the information needed to verify consent."
  ] },
  { id: "google-sign-in", title: "3. Google sign-in", paragraphs: [
    "If you sign in with Google, we receive your Google account identifier, email, name and profile picture through Supabase Auth. We use them to sign you in, manage your account and show your profile. We do not receive your Google password or request access to Gmail, Drive, calendars or contacts. You can use email and password instead.",
    "We do not sell Google user data, use it for advertising or use it to train AI models. We share it only with providers needed to run and secure these features, or when required by law. Authorized administrators may access account details for support and security.",
    "You can disconnect SCHOLAU through your Google Account’s third-party connections settings. This stops future authorization but does not delete your SCHOLAU account. Request deletion in Profile or by email. The retention and deletion rules below also apply to Google account information."
  ] },
  { id: "purposes", title: "4. How we use information", paragraphs: [
    "We use your information to run your account, match courses, save progress, provide quizzes and battles, deliver notifications, answer support requests and prevent abuse.",
    "Depending on the activity, we rely on providing the service under a contract, legitimate interests such as security and support, legal requirements or consent where required. Optional push notifications need your permission. You can withdraw consent, although the affected feature may stop working. Accepting our terms does not give permission for unrelated uses."
  ] },
  { id: "visibility", title: "5. Who can see it", paragraphs: [
    "Other users may see your username, display name, profile picture, XP and relevant battle results in profiles, social features and competitions. You can change leaderboard visibility in Profile. This does not remove your identity from friendships or battle history. Your email and detailed XP records are not public leaderboard fields.",
    "Authorized administrators can access information needed for support, safety and account management. Approved lecturers have access limited to their assigned role and courses.",
    "We use Supabase for accounts, databases and storage, Vercel for hosting, and Cloudflare R2 for private learning assets. Email and browser push providers handle delivery. Providers may process information outside Nigeria. Contact us for details about transfers and applicable safeguards. We may also share information when legally required or needed to protect rights and security."
  ] },
  { id: "cookies", title: "6. Cookies and browser storage", paragraphs: [
    "We use cookies and browser storage to keep you signed in, remember preferences and support the installed app and caching. You can manage site data in your browser, but blocking essential storage may stop some features from working. Sign out when using a shared device.",
    "No external product analytics or session replay is currently configured. Service records and hosting or security logs are still used. We will explain any future optional analytics and ask for consent where required."
  ] },
  { id: "children", title: "7. Students under 18", paragraphs: [
    "Registration for students under 18 is currently closed. Before opening it, we will require verified parent or guardian consent and an age-appropriate review. Selecting under 18 does not create a learning account.",
    "When available, support will verify guardian authority and consent before issuing an approval code. Guardians can contact support about access, corrections, consent withdrawal or deletion. We will review accounts found to lack required authorization."
  ] },
  { id: "retention", title: "8. Storage, security and deletion", paragraphs: [
    "We keep account and learning information while needed to provide the service, handle support and meet security or legal requirements. We use access controls and restricted administrative access to protect it, but no internet service can guarantee complete security.",
    "To request deletion, open Profile → Settings → Security → Request account deletion, or email us. Support verifies and processes the request; deletion is not immediate. We remove personal account, learning, competition and linked consent records and handle files in storage. Shared course content and other users’ records may remain without your personal attribution.",
    "Some information may be kept for legal obligations, security or disputes. Backup copies may remain temporarily until the provider’s backup cycle expires."
  ] },
  { id: "rights", title: "9. Your choices and rights", paragraphs: [
    "You can update available profile settings and notification or leaderboard preferences. Subject to applicable law, you can request access, correction, deletion, a copy of your data, limits on processing or withdrawal of consent. You can also object to processing or request human review of significant decisions made only by automated systems, where applicable.",
    "Email johnnwaokolo01@gmail.com or use Profile → Settings → Support & privacy → Contact support. We may verify your identity or guardian authority and explain any lawful limits. You can also complain to the Nigeria Data Protection Commission (NDPC). Quiz scores and XP are learning results, not official university decisions."
  ] },
  { id: "updates", title: "10. Changes and contact", paragraphs: [
    "We will update this page and give appropriate notice of important changes. If a change requires new consent, we will ask for it. Privacy and support: johnnwaokolo01@gmail.com."
  ] }
];

export const termsSections: PolicySection[] = [
  { id: "agreement", title: "1. Using SCHOLAU", paragraphs: [
    "These terms explain the rules for using SCHOLAU. Registration requires you to accept the displayed version. Our Privacy Policy explains how we handle your information. For help, email johnnwaokolo01@gmail.com."
  ] },
  { id: "eligibility", title: "2. Accounts and eligibility", paragraphs: [
    "Give accurate account and academic details, use an email you control and keep your password safe. Do not share accounts, impersonate someone else or access another person’s records. Tell support if you suspect misuse.",
    "Registration for students under 18 is currently closed. When available, it will require verified parent or guardian consent and an age-appropriate review before account creation. A pending request or a student’s declaration is not guardian approval.",
    "Some features require email verification, matching enrollment or an approved role. Lecturer access requires a separate review; confirming an email does not grant teaching privileges."
  ] },
  { id: "conduct", title: "3. Keep it fair and respectful", paragraphs: [
    "Use SCHOLAU lawfully and respect other users. Do not harass others, share their private information, upload harmful software or interfere with the service.",
    "Do not cheat, automate answers, manipulate XP or rankings, exploit security weaknesses or bypass access restrictions. Follow your institution’s academic-integrity rules, including restrictions during exams. Report errors and abuse through the available controls."
  ] },
  { id: "education", title: "4. Learning and rewards", paragraphs: [
    "SCHOLAU provides study materials, practice, feedback and competitions. Content may contain mistakes or differ from your curriculum, so check important information against official course materials. We do not guarantee grades, admission or examination success. University names do not imply endorsement.",
    "XP, streaks, badges and rankings are learning indicators. They have no stated cash value and are not official academic awards. Do not sell or trade accounts or rewards. Connection problems and incomplete battles can affect results. We may investigate cheating and correct unfair or mistaken results."
  ] },
  { id: "content", title: "5. Content and ownership", paragraphs: [
    "Respect the rights of SCHOLAU and other content owners. Use materials for personal learning or authorized teaching. Do not redistribute restricted content or claim someone else’s work as your own. Rights and exceptions provided by law still apply.",
    "You keep your rights in content you submit. You give SCHOLAU permission to host, display and process it as needed to provide, review and secure the service. Only submit material you have permission to share. Shared teaching content may remain after account deletion with your personal attribution removed, subject to applicable rights and removal requests.",
    "To report copyright concerns, email johnnwaokolo01@gmail.com with the content location, your rights and contact details."
  ] },
  { id: "moderation", title: "6. Restrictions and account deletion", paragraphs: [
    "We may restrict or close accounts to address rule violations, security issues or legal requirements. Where appropriate, we will explain why and let you ask support to review the decision. Urgent situations may require immediate action.",
    "You can stop using SCHOLAU at any time. Request account deletion through Profile → Settings → Security or email support. Support processes the request after verification. Our Privacy Policy explains what is deleted and what may need to be kept."
  ] },
  { id: "availability", title: "7. Availability and responsibility", paragraphs: [
    "Features and content may change or be unavailable because of maintenance, connectivity or other operational needs. We do not promise uninterrupted access or materials for every course. We will give reasonable notice of major changes where possible. Other services have their own terms and privacy policies.",
    "We will take the care required by law. Where the law allows, we are not responsible for losses we could not reasonably foresee or for events for which we are not legally responsible. Nothing in these terms removes rights or liability that cannot legally be excluded, including consumer and data-protection rights.",
    "These terms do not create payment or subscription obligations. Any future paid offer will explain its price and conditions before purchase."
  ] },
  { id: "law", title: "8. Questions and changes", paragraphs: [
    "Nigerian law applies, along with any mandatory protections available to you. Contact johnnwaokolo01@gmail.com about questions or disputes. You can still contact a regulator or use the courts and other lawful remedies.",
    "We will identify updates, give appropriate notice of important changes and ask for fresh acceptance where required. These terms remain a draft under review and have no effective date."
  ] }
];
