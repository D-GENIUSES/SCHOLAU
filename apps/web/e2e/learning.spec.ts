import { expect, test, type Page } from "@playwright/test";

async function signUp(page: Page, username: string, email: string) {
  await page.goto("/sign-up?role=student&method=email");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse");
  await page.getByRole("checkbox", { name: /Terms of Use/ }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("combobox", { name: "University" }).fill("Adeleke");
  await page.getByRole("option", { name: /Adeleke University/ }).click();
  await page.getByLabel("Faculty").selectOption("Faculty of Science");
  await page.getByLabel("Department").selectOption("Computing Sciences");
  await page.getByLabel("Level").selectOption("100 Level");
  await page.getByLabel("Academic period").selectOption("2026/2027");
  await page.getByLabel("Current semester").selectOption("First semester");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Your account is ready" })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
  await page.goto(`/auth/callback?code=${encodeURIComponent(`e2e-${email}`)}`);
  await expect(page).toHaveURL(/\/home/);
}

test("general knowledge stays the default and course samples are optional", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Try ScholAu" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sample lessons" })).toBeVisible();
  await page.getByRole("link", { name: /Science and Nature/ }).click();
  await expect(page.getByRole("heading", { name: "Why is Mars called the Red Planet?" })).toBeVisible();
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Adeleke University samples" })).toBeVisible();
  const content = await page.content();
  expect(content).not.toContain("maximum-scale=1");
  expect(content).not.toContain("user-scalable=no");
  await page.getByRole("link", { name: /STA 111/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Arithmetic|means|Biology|Introduction/i);
  await expect(page.getByText("not past papers")).toBeVisible();
});

test("sign-up verifies email, finishes a mock, and saves lesson progress", async ({ page }) => {
  await signUp(page, "learnerone", "learnerone@example.com");
  await page.goto("/study/courses/11111111-1111-4111-8111-111111111111");
  await page.getByRole("link", { name: "Start STA practice mock" }).click();
  await page.getByRole("button", { name: "Start mock exam" }).click();
  await page.getByRole("button", { name: "Start now" }).click();
  await page.getByText("Descriptive statistics", { exact: true }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByText("A parameter", { exact: true }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await page.getByRole("button", { name: "Submit", exact: true }).click();
  await expect(page.getByText("100%")).toBeVisible();
  await page.goto("/study/lessons/33333333-3333-4333-8333-333333333333");
  await page.getByRole("button", { name: "Mark as complete" }).click();
  await expect(page.getByText("Lesson complete", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Completed 1 Nov 2026/)).toBeVisible();
});

test("two browsers play one direct battle", async ({ browser }) => {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const host = await hostContext.newPage();
  const guest = await guestContext.newPage();
  await signUp(host, "alicehost", "alicehost@example.com");
  await signUp(guest, "bobbyguest", "bobbyguest@example.com");
  await host.goto("/battles");
  await host.getByRole("radio", { name: /Challenge someone/ }).check();
  await host.getByRole("button", { name: /bobbyguest/ }).click();
  await host.getByRole("button", { name: "Send challenge" }).click();
  await expect(host).toHaveURL(/\/battles\/bbbbbbbb-/);
  await guest.goto("/battles/invite/invite-alicehost");
  await guest.getByRole("button", { name: "Accept challenge" }).click();
  await expect(guest.getByRole("button", { name: "I'm ready" })).toBeVisible();
  await host.getByRole("button", { name: "I'm ready" }).click();
  await guest.getByRole("button", { name: "I'm ready" }).click();
  await expect(host.getByText("Which activity summarises observed data?")).toBeVisible();
  await expect(guest.getByText("Which activity summarises observed data?")).toBeVisible();
  await host.getByText("Descriptive statistics", { exact: true }).click();
  await host.getByRole("button", { name: "Submit answer" }).click();
  await guest.getByText("Descriptive statistics", { exact: true }).click();
  await guest.getByRole("button", { name: "Submit answer" }).click();
  await expect(host.getByRole("heading", { name: "Draw" })).toBeVisible();
  await expect(guest.getByRole("heading", { name: "Draw" })).toBeVisible();
  await hostContext.close();
  await guestContext.close();
});
