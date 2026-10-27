import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const runtime = createRequire(resolve(process.env.LECTURER_TEST_RUNTIME ?? "../.legal-test-runtime", "package.json"));
const { chromium } = runtime("playwright");
const origin = process.env.LECTURER_TEST_ORIGIN ?? "http://127.0.0.1:3147";
const id = n => `85000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const catalogue = { university_id: id(1), faculties: [{ id: id(2), name: "Faculty of Science" }, { id: id(3), name: "Faculty of Engineering" }], departments: [
  { id: id(4), faculty_id: id(2), name: "Computer Science" }, { id: id(5), faculty_id: id(2), name: "Biochemistry" },
  { id: id(6), faculty_id: id(3), name: "Civil Engineering" },
] };
const courseList = [{ id: id(7), code: "CSC 101", title: "Introduction to Computing" }, { id: id(8), code: "CSC 401", title: "Advanced Topics in Distributed Computing and Communication Systems with Extended Research Applications" }];
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.setDefaultTimeout(20_000);
page.setDefaultNavigationTimeout(120_000);
const errors = [], submissions = [], requests = [];
let failCatalogue = false, failCourses = false, delayCourses = false, checks = 0;
page.on("pageerror", error => errors.push(error.message));
await context.route("http://127.0.0.1:54321/**", async route => {
  const request = route.request(), url = new URL(request.url());
  const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
  if (request.method() === "OPTIONS") return route.fulfill({ status: 200, headers });
  let body = {}, status = 200;
  if (url.pathname.endsWith("get_registration_legal_status_v1")) body = { terms_version: "2026-10-19-draft-1", privacy_version: "2026-10-19-draft-1", guardian_enabled: false, support_email: null };
  else if (url.pathname.endsWith("get_registration_options_v1")) {
    body = request.postDataJSON().p_university_slug === "adeleke-university-ede-osun-state" ? catalogue : null;
    if (failCatalogue) { status = 503; body = { message: "Catalogue unavailable" }; }
  } else if (url.pathname.endsWith("get_lecturer_registration_courses_v1")) {
    const args = request.postDataJSON(); requests.push(args);
    body = args.p_department_id === id(4) ? courseList : [];
    if (failCourses) { status = 503; body = { message: "Courses unavailable" }; }
    if (delayCourses) await new Promise(resolve => setTimeout(resolve, 500));
  } else if (url.pathname.endsWith("is_username_available_v1")) body = true;
  else if (url.pathname.includes("app_config")) body = { feature_flags: { lecturer_applications: true } };
  else if (url.pathname.endsWith("signup")) {
    submissions.push(request.postDataJSON());
    body = { id: id(90), aud: "authenticated", email: "lecturer@example.test", identities: [] };
  }
  await route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify(body) }).catch(error => { if (!/closed|cancel|abort/i.test(error.message)) throw error; });
});
const choose = async (label, name) => {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name, exact: true }).click();
};
const courseLabel = "Courses you teach or wish to manage";
async function start() {
  await page.goto(origin + "/sign-up?role=lecturer", { waitUntil: "networkidle" });
  await page.getByLabel("Email", { exact: true }).fill("lecturer@example.test");
  await page.getByLabel("Password", { exact: true }).fill("LecturerTest123!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Full name", { exact: true }).fill("Dr Lecturer Test");
  await page.getByLabel("Teaching position", { exact: true }).fill("Senior Lecturer");
}
async function selectDepartment() {
  await choose("University", "Adeleke University, Ede, Osun State");
  await choose("Faculty", "Faculty of Science");
  await choose("Department", "Computer Science");
  await page.getByRole("combobox", { name: courseLabel, exact: true }).click();
  await page.getByRole("option", { name: "CSC 101 — Introduction to Computing", exact: true }).waitFor();
  await page.keyboard.press("Escape");
}
await mkdir(".lecturer-verification", { recursive: true });
try {
  await start();
  assert.equal(await page.getByRole("combobox", { name: "Faculty", exact: true }).isDisabled(), true); checks++;
  assert.equal(await page.getByRole("combobox", { name: "Department", exact: true }).isDisabled(), true); checks++;
  assert.equal(await page.getByRole("combobox", { name: courseLabel, exact: true }).isDisabled(), true); checks++;
  await selectDepartment();
  assert.deepEqual(requests.at(-1), { p_university_id: id(1), p_faculty_id: id(2), p_department_id: id(4) }); checks++;
  await page.getByRole("combobox", { name: courseLabel, exact: true }).fill("CSC 101");
  await page.keyboard.press("ArrowDown"); await page.keyboard.press("ArrowUp"); await page.keyboard.press("Enter");
  await page.getByRole("list", { name: "Selected courses" }).getByText("CSC 101 — Introduction to Computing").waitFor(); checks++;
  await page.getByRole("combobox", { name: courseLabel, exact: true }).fill("Distributed");
  await page.getByRole("option", { name: /CSC 401/ }).click();
  assert.equal(await page.getByRole("list", { name: "Selected courses" }).getByRole("listitem").count(), 2); checks++;
  await page.getByRole("combobox", { name: courseLabel, exact: true }).click();
  assert.equal(await page.getByRole("option", { name: /CSC 101/ }).count(), 0); checks++;
  await page.keyboard.press("Escape");
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true); checks++;
    assert.equal(await page.locator(".lecturer-fields").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length), width < 640 ? 1 : 2); checks++;
    assert.ok(await page.getByRole("button", { name: /Remove CSC 401/ }).evaluate(el => el.getBoundingClientRect().height >= 44)); checks++;
    await page.screenshot({ path: `.lecturer-verification/signup-${width}.png`, fullPage: true });
  }
  assert.equal(await page.getByLabel("Institutional profile URL", { exact: true }).isVisible(), false); checks++;
  await page.locator("summary").click();
  await page.getByLabel("Institutional profile URL", { exact: true }).fill("https://university.example/staff/lecturer");
  await page.getByRole("button", { name: "Back to account details" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(await page.getByRole("list", { name: "Selected courses" }).getByRole("listitem").count(), 2); checks++;
  await page.getByRole("button", { name: /Remove CSC 401/ }).click();
  assert.equal(await page.getByRole("list", { name: "Selected courses" }).getByRole("listitem").count(), 1); checks++;
  await page.getByRole("button", { name: "Submit lecturer application" }).click();
  await page.getByRole("heading", { name: "Your account is ready" }).waitFor();
  assert.equal(submissions.at(-1).data.signup_kind, "lecturer");
  assert.equal(submissions.at(-1).data.lecturer_application.requested_courses, "CSC 101 — Introduction to Computing");
  assert.equal(submissions.at(-1).data.lecturer_application.faculty, "Faculty of Science"); checks += 3;

  await start(); await selectDepartment();
  await choose(courseLabel, "CSC 101 — Introduction to Computing");
  await choose("Faculty", "Faculty of Engineering");
  assert.equal(await page.getByRole("combobox", { name: "Department", exact: true }).inputValue(), "");
  assert.equal(await page.getByRole("list", { name: "Selected courses" }).count(), 0); checks += 2;
  await page.getByRole("combobox", { name: "Department", exact: true }).click();
  assert.equal(await page.getByRole("option", { name: "Computer Science", exact: true }).count(), 0); checks++;
  await page.getByRole("option", { name: "Civil Engineering", exact: true }).click();
  await page.getByText("No catalogue options available.", { exact: false }).waitFor(); checks++;

  await page.getByRole("combobox", { name: "University", exact: true }).fill("A university absent from the catalogue");
  await page.getByRole("option", { name: "Not listed", exact: true }).click(); checks++;
  await page.getByLabel("University name", { exact: true }).fill("Independent University");
  await choose("Faculty", "Not listed"); await page.getByLabel("Faculty name", { exact: true }).fill("Creative Faculty");
  await choose("Department", "Not listed"); await page.getByLabel("Department name", { exact: true }).fill("Creative Department");
  await choose(courseLabel, "Not listed");
  await page.getByRole("button", { name: "Submit lecturer application" }).click();
  assert.equal(submissions.length, 1); checks++;
  await page.getByLabel("Other courses", { exact: true }).fill("CRT 101 — Creative Methods\nCRT 201 — Applied Methods");
  await page.getByRole("button", { name: "Submit lecturer application" }).click();
  await page.getByRole("heading", { name: "Your account is ready" }).waitFor();
  assert.equal(submissions.at(-1).data.lecturer_application.university, "Independent University");
  assert.equal(submissions.at(-1).data.lecturer_application.requested_courses, "CRT 101 — Creative Methods\nCRT 201 — Applied Methods"); checks += 2;

  failCatalogue = true;
  await start(); await choose("University", "Adeleke University, Ede, Osun State");
  await page.getByRole("alert").filter({ hasText: "Options could not be loaded" }).waitFor(); checks++;
  failCatalogue = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await choose("Faculty", "Faculty of Science");
  failCourses = true;
  await choose("Department", "Computer Science");
  await page.getByRole("alert").filter({ hasText: "Options could not be loaded" }).waitFor(); checks++;
  failCourses = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await choose(courseLabel, "CSC 101 — Introduction to Computing");
  await choose(courseLabel, "Not listed");
  await page.getByRole("button", { name: "Submit lecturer application" }).click();
  assert.equal(submissions.length, 2); checks++;
  await page.getByRole("button", { name: "Remove other courses" }).click();
  delayCourses = true;
  await choose("Department", "Biochemistry"); await choose("Department", "Computer Science"); await choose("Department", "Biochemistry");
  await page.waitForTimeout(750);
  await page.getByRole("combobox", { name: courseLabel, exact: true }).click();
  assert.equal(await page.getByRole("option", { name: /CSC 101/ }).count(), 0); checks++;
  await page.keyboard.press("Escape");
  await choose("University", "Not listed");
  assert.equal(await page.getByRole("combobox", { name: "Department", exact: true }).isDisabled(), true); checks++;
  await page.goto(origin + "/sign-up?role=student&method=email", { waitUntil: "networkidle" });
  await page.getByLabel("Username", { exact: true }).fill("lecturerregression");
  await page.getByLabel("Email", { exact: true }).fill("student@example.test");
  await page.getByLabel("Password", { exact: true }).fill("StudentTest123!");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await choose("University", "Abia State University, Uturu");
  await page.getByLabel("Faculty", { exact: true }).fill("Science");
  await page.getByLabel("Department", { exact: true }).fill("Physics");
  await page.getByLabel("Current semester", { exact: true }).selectOption("first");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await page.getByRole("heading", { name: "Your account is ready" }).waitFor();
  assert.equal(submissions.length, 3); checks++;
  assert.equal(submissions.at(-1).data.signup_kind, undefined); checks++;
  assert.equal(submissions.at(-1).data.lecturer_application, undefined); checks++;
  assert.equal(submissions.at(-1).data.academic_profile.department, "Physics"); checks++;
  assert.deepEqual(errors, []); checks++;
  console.log(JSON.stringify({ checks, pageErrors: errors, submissions: submissions.length, screenshots: ".lecturer-verification" }));
} finally { await browser.close(); }
