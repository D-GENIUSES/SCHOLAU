import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { mkdir } from "node:fs/promises";

const runtime = createRequire(resolve(process.env.BATTLE_TEST_RUNTIME ?? "../.legal-test-runtime", "package.json"));
const { chromium } = runtime("playwright");
const origin = process.env.BATTLE_TEST_ORIGIN ?? "http://127.0.0.1:3157";
const output = resolve("../outputs/battle-ui-refresh");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors = [], checks = [], sounds = [];
const check = (condition, label) => { assert.ok(condition, label); checks.push(label); };
let position = 1, format = "standard", state = "active", expired = false, last = null;
let answers = [null, null], ready = [false, false], revision = 1;
let started = Date.now(), forfeit = false;
let queueExpired = false, queueJoined = 0, queueLeft = false;
let releaseFirstAnswer;
const firstAnswerGate = new Promise(resolve => { releaseFirstAnswer = resolve; });
const names = ["Adaeze Chukwuemeka with a very long display name", "David Chukwuemeka Nwankwo with another long name"];
const question = viewer => ({
  position, course_code: "PHY 101", answer_format: format, duration_seconds: 15,
  reading_at: new Date(started - 3000).toISOString(), opened_at: new Date(started).toISOString(),
  deadline: new Date(Date.now() + (expired ? -100 : 15000)).toISOString(),
  my_option_id: format === "fill_in_gap" ? null : answers[viewer], my_text_answer: format === "fill_in_gap" ? answers[viewer] : null,
  prompt: format === "worked_solution" ? "Calculate the force: F = ma, with m = 2 kg and a = 3 m/s²." : format === "fill_in_gap" ? "Complete the unit: force is measured in ____." : "Which description correctly identifies force and its measurement in the International System of Units?",
  options: [{ id: "correct", body: "Force is measured in newtons and equals mass multiplied by acceleration.", steps: ["F = ma", "F = 2 × 3 = 6 N"] }, { id: "wrong", body: "Force is measured in joules and describes the energy transferred by an object.", steps: ["F = m / a", "F = 2 / 3 N"] }, { id: "third", body: "Force is measured in watts and describes the rate at which work is done.", steps: ["F = m + a", "F = 2 + 3 = 5 N"] }, { id: "fourth", body: "Force is measured in kilograms and describes the amount of matter in an object.", steps: ["F = a / m", "F = 3 / 2 = 1.5 N"] }],
});
const status = answer => answer === null ? "unanswered" : answer === "correct" || answer === "newtons" ? "correct" : "incorrect";
function snapshot(viewer) {
  if (answers.every(a => a !== null) || expired) last = { position, statuses: answers.map(status) };
  return {
    server_time: new Date().toISOString(), battle_id: "ui-fixture", offering_id: "physics", mode: "direct", state, revision,
    course: { id: "physics", code: "PHY 101", title: "General Physics" }, round_count: 4, seconds_per_round: 15,
    invitation_expires_at: new Date(Date.now() + 60000).toISOString(), ready_deadline: new Date(Date.now() + 60000).toISOString(),
    starts_at: null, ends_at: null, finalized_at: null, invite_token: "preview", invited_user_id: "player-1",
    result_kind: state === "finished" ? forfeit ? "forfeit" : "completed" : null, cancel_reason: null,
    me: { seat: viewer + 1, ready: ready[viewer], forfeited: forfeit && viewer === 0 },
    participants: [0, 1].map(i => ({ user_id: `player-${i}`, seat: i + 1, display_name: names[i], avatar_path: null, is_me: i === viewer, ready: ready[i], forfeited: forfeit && i === 0, correct_count: state === "finished" ? i === 0 ? 3 : 1 : null })),
    latest_round_result: last ? { position: last.position, my_status: last.statuses[viewer], opponent_status: last.statuses[1 - viewer] } : null,
    current_question: state === "active" ? question(viewer) : null, next_question_at: null,
    my_answered_positions: answers[viewer] ? [position] : [],
    rounds: state === "finished" ? [{ position: 1, prompt: "Which unit measures force?", my_option_id: "correct", my_is_correct: viewer === 0, opponent_is_correct: viewer !== 0 }] : null,
    outcome: state === "finished" ? { result: forfeit ? viewer === 0 ? "loss" : "win" : viewer === 0 ? "win" : "loss", xp_awarded: forfeit ? 0 : 8 } : null,
  };
}
const pages = [];
try {
  for (const viewer of [0, 1]) {
    const context = await browser.newContext({ viewport: { width: viewer ? 1440 : 390, height: 844 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", e => errors.push(e.message));
    page.on("response", response => { if (/\/sounds\/battle-(win|loss)\.mp3/.test(response.url()) && response.ok()) sounds.push(response.url()); });
    await page.addInitScript(() => {
      window.__playedSounds = [];
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) { window.__playedSounds.push(this.buffer?.duration); return start.apply(this, args); };
    });
    await page.route("**/rest/v1/rpc/report_battle_integrity_v1", route => route.fulfill({ json: { strikes: 0, forfeited: false } }));
    await page.route("**/__battle-ui-fixture/*", async route => {
      const action = route.request().url().split("/").at(-1);
      const body = route.request().postDataJSON();
      let response;
      if (action === "answer") {
        if (viewer === 0 && position === 1) await firstAnswerGate;
        answers[viewer] ??= body.optionId ?? body.textAnswer;
        revision++;
        response = { battle_id: "ui-fixture", position, option_id: format === "fill_in_gap" ? null : answers[viewer], text_answer: format === "fill_in_gap" ? answers[viewer] : null, already_answered: false };
      } else if (action === "ready") { ready[viewer] = true; response = snapshot(viewer); }
      else if (action === "forfeit") { forfeit = true; state = "finished"; response = snapshot(viewer); }
      else if (action === "queue") response = { battle: null, queue: { queue_id: "preview-queue", offering_id: "physics", state: "waiting", queued_at: new Date(Date.now() - 10000).toISOString(), expires_at: new Date(Date.now() + (queueExpired ? -1000 : 60000)).toISOString() } };
      else if (action === "join") { queueExpired = false; queueJoined++; response = { battle_id: null }; }
      else if (action === "leave") { queueLeft = true; response = { state: "cancelled", battle_id: null }; }
      else if (action === "reaction") {
        response = { accepted: true };
        await pages[1 - viewer]?.evaluate(({ user_id, reaction }) => window.dispatchEvent(new CustomEvent("battle-preview-signal", { detail: { event: "reaction", payload: { user_id, reaction } } })), { user_id: `player-${viewer}`, reaction: body.reaction });
      } else if (action === "correction") response = { my_answer: "newtons", correct_answer: "newtons", explanation: "Force is measured in newtons.", steps: [] };
      else response = snapshot(viewer);
      await route.fulfill({ json: response });
    });
    await page.goto(`${origin}/design-preview/battle-flow/ui-fixture`, { waitUntil: "load", timeout: 120000 });
    await page.getByRole("heading", { name: "Question 1 of 4" }).waitFor();
    await page.locator('[data-scholau-splash]').waitFor({ state: "hidden", timeout: 30000 });
    pages.push(page);
  }
  const [a, b] = pages;
  const sync = () => Promise.all(pages.map(page => page.evaluate(() => window.dispatchEvent(new CustomEvent("battle-preview-signal", { detail: { event: "state" } })))));
  const overflow = async (page, label) => check(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), label);
  const playerText = async page => (await page.locator('[aria-label="Battle players"]').innerText()).replace(/\s+/g, " ");
  for (const width of [320, 390, 1440]) {
    await a.setViewportSize({ width, height: width === 320 ? 568 : 844 });
    await overflow(a, `Live layout fits ${width}px`);
    const targets = await a.locator(".battle-experience button:visible").evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().height >= 44));
    check(targets, `Live controls have 44px targets at ${width}px`);
    await a.locator('label:has(input[value="fourth"])').click();
    check(await a.locator('input[value="fourth"]').isChecked(), `Last answer is reachable at ${width}px`);
    await a.screenshot({ path: `${output}/live-${width}.png`, fullPage: true });
  }
  await a.setViewportSize({ width: 390, height: 844 });
  check(await a.getByText(/Round result/).count() === 0, "No premature correctness");
  await a.locator('label:has(input[value="correct"])').click();
  await a.getByRole("button", { name: "Submit answer", exact: true }).click();
  await a.getByText("Sending…", { exact: true }).waitFor();
  check(await a.getByText("Sending…", { exact: true }).isVisible(), "Pending answer is not confirmed");
  releaseFirstAnswer();
  await a.getByText("Locked in · waiting for opponent", { exact: true }).waitFor();
  check(await a.getByText(/Round result/).count() === 0, "One locked answer does not reveal correctness");
  await b.locator('label:has(input[value="wrong"])').click();
  await b.getByRole("button", { name: "Submit answer", exact: true }).click();
  // No state signal: the real polling fallback must update player A.
  await a.getByText("Q1 · Round result", { exact: true }).waitFor();
  await b.getByText("Q1 · Round result", { exact: true }).waitFor();
  check(await a.getByRole("heading", { name: "Question 1 of 4" }).isVisible(), "Early answers do not advance the question");
  check((await playerText(a)).includes("You: Correct"), "Player A sees own correctness");
  check((await playerText(b)).includes("You: Incorrect"), "Player B sees mirrored correctness");
  await a.getByRole("button", { name: "Laugh", exact: true }).click();
  await b.locator(".battle-reaction-bubble").waitFor();
  checks.push("Taunt reaches opponent after reveal");
  position = 2; format = "worked_solution"; answers = [null, null]; started = Date.now(); revision++;
  await sync();
  await a.getByRole("heading", { name: "Question 2 of 4" }).waitFor();
  check(await a.getByText("Q1 · Round result", { exact: true }).isVisible(), "Numbered previous result persists into next question");
  await a.setViewportSize({ width: 320, height: 568 });
  await overflow(a, "Worked solutions fit narrow screen");
  await a.screenshot({ path: `${output}/worked-320.png`, fullPage: true });
  answers = ["correct", null]; expired = true; await sync();
  await a.getByText("Q2 · Round result", { exact: true }).waitFor();
  check((await playerText(a)).includes("Opponent: No answer"), "Timeout is labelled No answer");
  position = 3; format = "fill_in_gap"; answers = [null, null]; expired = false; started = Date.now(); await sync();
  await a.getByRole("heading", { name: "Question 3 of 4" }).waitFor();
  await a.getByRole("textbox", { name: "Your answer", exact: true }).fill("newtons");
  await a.getByText("Selected - lock in to send your answer.", { exact: true }).waitFor();
  await a.getByRole("button", { name: "Submit answer", exact: true }).click();
  await a.getByText("Locked in · waiting for opponent", { exact: true }).waitFor();
  answers[1] = "newtons"; await sync();
  await a.getByText("Q3 · Round result", { exact: true }).waitFor();
  await a.reload();
  await a.getByText("Q3 · Round result", { exact: true }).waitFor();
  checks.push("Fill-in-gap submits and result restores after refresh");
  position = 4; format = "standard"; answers = [null, null]; expired = true; await sync();
  await a.getByText("Q4 · Round result", { exact: true }).waitFor();
  check((await playerText(a)).includes("You: No answer"), "Both timeouts reveal unanswered");
  await a.getByRole("button", { name: "Handshake", exact: true }).click();
  await a.context().setOffline(true);
  await a.getByText("Network issue: you are offline", { exact: true }).waitFor();
  await a.context().setOffline(false);
  await a.getByText("Network issue: you are offline", { exact: true }).waitFor({ state: "hidden" });
  checks.push("Offline banner clears on reconnect");
  state = "finished"; await sync();
  await a.getByRole("heading", { name: "You won", exact: true }).waitFor();
  await b.getByRole("heading", { name: "You lost", exact: true }).waitFor();
  check(await a.getByText("Q4 · Round result", { exact: true }).isVisible(), "Final result persists after completion");
  check(await a.locator('.battle-result-burst[data-result="win"]').isVisible(), "Winner confetti remains");
  check(await b.locator('.battle-result-burst[data-result="loss"]').isVisible(), "Loser crying emojis remain");
  await Promise.all(pages.map(page => page.waitForFunction(() => window.__playedSounds.length > 0)));
  check(sounds.some(s => s.includes("battle-win.mp3")) && sounds.some(s => s.includes("battle-loss.mp3")), "Existing win and loss audio invoked");
  await overflow(a, "Result fits 320px");
  await a.screenshot({ path: `${output}/result-320.png`, fullPage: true });
  await a.getByRole("button", { name: "View answer", exact: true }).click();
  await a.getByText("Force is measured in newtons.", { exact: true }).waitFor();
  checks.push("Final corrections still open");
  state = "waiting"; await sync();
  await a.getByRole("heading", { name: "Waiting for your opponent", exact: true }).waitFor();
  check(await a.getByRole("button", { name: "Cancel challenge", exact: true }).isVisible(), "Direct invitation exposes cancel action");
  await overflow(a, "Waiting room fits narrow mobile");
  state = "ready"; await sync();
  await a.getByRole("button", { name: "I'm ready", exact: true }).click();
  await a.getByRole("button", { name: "You're ready", exact: true }).waitFor();
  state = "active"; expired = false; started = Date.now(); await sync();
  await a.getByRole("button", { name: "Forfeit", exact: true }).click();
  await a.getByRole("button", { name: "Stay", exact: true }).click();
  check(state === "active", "Dismiss forfeit preserves match");
  await a.getByRole("button", { name: "Forfeit", exact: true }).click();
  await a.getByRole("button", { name: "Forfeit battle", exact: true }).click();
  await a.getByRole("heading", { name: "You lost", exact: true }).waitFor();
  checks.push("Forfeit confirmation still ends match");

  await a.goto(`${origin}/design-preview/battle-flow/queue?offering=physics`, { waitUntil: "load" });
  await a.getByRole("heading", { name: "Looking for an opponent", exact: true }).waitFor();
  await overflow(a, "Matchmaking queue fits 320px");
  await a.screenshot({ path: `${output}/queue-320.png`, fullPage: true });
  queueExpired = true;
  await a.getByRole("button", { name: "Try again", exact: true }).waitFor();
  await a.getByRole("button", { name: "Try again", exact: true }).click();
  await a.getByRole("heading", { name: "Looking for an opponent", exact: true }).waitFor();
  check(queueJoined === 1, "Expired queue can be retried");
  await a.getByRole("button", { name: "Cancel search", exact: true }).click();
  check(queueLeft, "Cancel search calls the existing leave action");

  await a.goto(`${origin}/design-preview?state=battle-lobby`, { waitUntil: "load", timeout: 120000 });
  await a.getByRole("button", { name: "Find opponent", exact: true }).waitFor();
  for (const width of [320, 390, 1440]) {
    await a.setViewportSize({ width, height: 844 });
    await overflow(a, `Lobby fits ${width}px`);
    await a.screenshot({ path: `${output}/lobby-${width}.png`, fullPage: true });
  }
  await a.getByRole("radio", { name: /Challenge someone/ }).check();
  await a.getByRole("button", { name: /Ada Obi/ }).click();
  check(await a.getByRole("button", { name: "Send challenge", exact: true }).isEnabled(), "Opponent selection enables challenge");
  await a.setViewportSize({ width: 320, height: 568 });
  await a.getByRole("searchbox").fill("david");
  const opponent = a.getByRole("button", { name: /David Chukwuemeka/ });
  await opponent.waitFor();
  check(await opponent.evaluate(node => [...node.querySelectorAll("strong, small")].every(child => child.getBoundingClientRect().bottom <= node.getBoundingClientRect().bottom)), "Opponent details stay inside card");
  await opponent.click();
  check(await a.getByRole("button", { name: "Send challenge", exact: true }).isEnabled(), "Long-name opponent remains selectable");
  await overflow(a, "Opponent search fits 320px");
  await a.screenshot({ path: `${output}/opponents-320.png`, fullPage: true });
  check(errors.length === 0, `No browser errors: ${errors.join("; ")}`);
  console.log(JSON.stringify({ checks: checks.length, passed: checks, screenshots: output }, null, 2));
} finally { await browser.close(); }
