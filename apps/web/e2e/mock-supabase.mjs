/**
 * Local Supabase stand-in for Playwright. It accepts the anon client at
 * http://127.0.0.1:54321 and shares battle state across browsers.
 */
import { createServer } from "node:http";

const OFFERING = "11111111-1111-4111-8111-111111111111";
const COURSE = "22222222-2222-4222-8222-222222222222";
const LESSON = "33333333-3333-4333-8333-333333333333";
const LESSON_VERSION = "44444444-4444-4444-8444-444444444444";
const ASSESSMENT_VERSION = "66666666-6666-4666-8666-666666666666";
const Q1 = "77777777-7777-4777-8777-777777777771";
const Q2 = "77777777-7777-4777-8777-777777777772";
const OPT_A = "88888888-8888-4888-8888-888888888881";
const OPT_B = "88888888-8888-4888-8888-888888888882";
const UNI = "10000000-0000-4000-8000-00000000a001";
const FAC = "10000000-0000-4000-8000-00000000a002";
const DEP = "10000000-0000-4000-8000-00000000a003";
const LEVEL = "10000000-0000-4000-8000-00000000a004";
const PERIOD = "10000000-0000-4000-8000-00000000a005";
const SEM = "10000000-0000-4000-8000-00000000a006";

const users = new Map();
const tokens = new Map();
const attempts = new Map();
const lessonsCompleted = new Set();
let battle = null;

function b64url(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function nowIso() {
  return new Date().toISOString();
}

function later(ms) {
  return new Date(Date.now() + ms).toISOString();
}

function userFromAuth(req) {
  const header = req.headers.authorization ?? "";
  const token = header.replace(/^Bearer\s+/i, "");
  return tokens.get(token) ?? null;
}

function issue(user) {
  const access = `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url({
    sub: user.id,
    email: user.email,
    role: "authenticated",
    exp: Math.floor(Date.now() / 1000) + 3600,
    user_metadata: user.metadata,
  })}.e2e`;
  tokens.set(access, user);
  return {
    access_token: access,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: `refresh-${user.id}`,
    user: publicUser(user),
  };
}

function publicUser(user) {
  return {
    id: user.id,
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    created_at: user.created_at,
    app_metadata: { provider: "email" },
    user_metadata: user.metadata,
  };
}

function envelope(body) {
  return { ...body, server_time: nowIso() };
}

function profile(user) {
  return envelope({
    id: user.id,
    username: user.metadata.username,
    display_name: user.metadata.display_name,
    avatar_path: null,
    leaderboard_visible: true,
    needs_onboarding: false,
    academic: {
      university: { id: UNI, name: "Adeleke University" },
      faculty: { id: FAC, name: "Faculty of Science" },
      department: { id: DEP, name: "Computing Sciences" },
      level: { id: LEVEL, label: "100 Level" },
      academic_period: { id: PERIOD, label: "2026/2027" },
      semester: { id: SEM, label: "First semester" },
      changed_at: null,
      self_change_used_this_period: false,
    },
    roles: ["student"],
    premium: false,
    xp_total: lessonsCompleted.has(user.id) ? 10 : 0,
    streak: { current: 1, longest: 1, active_today: true, local_date: "2026-11-01" },
    learning_totals: { lessons_completed: lessonsCompleted.has(user.id) ? 1 : 0, assessments_completed: 0, battles_completed: 0 },
    created_at: user.created_at,
  });
}

function home(user) {
  return envelope({
    display_name: user.metadata.display_name,
    needs_onboarding: false,
    xp_total: 0,
    learning_xp_today: 0,
    learning_xp_daily_cap: 40,
    streak: { current: 1, longest: 1, active_today: true, local_date: "2026-11-01" },
    premium: false,
    continue_learning: null,
    enrolled_courses: [{
      offering_id: OFFERING, course_id: COURSE, code: "STA 111", title: "Descriptive Statistics",
      lessons_total: 1, lessons_completed: lessonsCompleted.has(user.id) ? 1 : 0,
    }],
    recent_activity: [],
    live_battle: null,
    unread_notifications: 0,
  });
}

function overview() {
  return envelope({
    offering_id: OFFERING,
    course: { id: COURSE, code: "STA 111", title: "Descriptive Statistics", description: "Practice course" },
    progress: { lessons_total: 1, lessons_completed: 0, percent: 0 },
    modules: [{
      id: "99999999-9999-4999-8999-999999999999",
      title: "Statistical thinking",
      position: 1,
      lessons: [{
        lesson_id: LESSON, lesson_version_id: LESSON_VERSION, position: 1,
        title: "Meaning of statistics", objective: "Explain the subject.", estimated_minutes: 5,
        state: "not_started", completed_at: null,
      }],
    }],
    assessments: [{
      assessment_id: "55555555-5555-4555-8555-555555555555",
      assessment_version_id: ASSESSMENT_VERSION,
      kind: "mock",
      title: "STA practice mock",
      lesson_id: null,
      question_count: 2,
      duration_seconds: 600,
      feedback_mode: "after_submit",
      active_attempt_id: null,
      completed_attempts: 0,
      best_percent: null,
      first_completion_rewarded: false,
    }],
    battle_ready: true,
  });
}

function lesson(user) {
  return envelope({
    lesson_id: LESSON,
    lesson_version_id: LESSON_VERSION,
    version: 1,
    offering_id: OFFERING,
    course_id: COURSE,
    module: { id: "99999999-9999-4999-8999-999999999999", title: "Statistical thinking", position: 1 },
    position: 1,
    title: "Meaning of statistics",
    objective: "Explain the subject.",
    estimated_minutes: 5,
    blocks: [
      { type: "paragraph", text: "Statistics collects and interprets data." },
      { type: "equation", expression: "n = 40" },
    ],
    flashcards: [],
    previous_lesson_id: null,
    next_lesson_id: null,
    progress: lessonsCompleted.has(user.id) ? { state: "completed", started_at: nowIso(), completed_at: nowIso() } : null,
    review: null,
  });
}

function questions() {
  return [1, 2].map((position) => ({
    position,
    question_version_id: position === 1 ? Q1 : Q2,
    prompt: position === 1 ? "Which activity summarises observed data?" : "Which value describes a population?",
    difficulty: "beginner",
    options: [
      { id: position === 1 ? OPT_A : "88888888-8888-4888-8888-888888888883", body: "Descriptive statistics" },
      { id: position === 1 ? OPT_B : "88888888-8888-4888-8888-888888888884", body: "A parameter" },
    ],
    saved: null,
    feedback: null,
  }));
}

function battleView(user) {
  if (!battle) return null;
  const mine = battle.host.id === user.id ? "host" : "guest";
  const seat = mine === "host" ? 1 : 2;
  const other = mine === "host" ? battle.guest : battle.host;
  const participants = [
    { seat: 1, user_id: battle.host.id, display_name: battle.host.metadata.display_name, username: battle.host.metadata.username, is_me: seat === 1, ready: battle.ready.host, forfeited: false, score: 0 },
  ];
  if (battle.guest) {
    participants.push({ seat: 2, user_id: battle.guest.id, display_name: battle.guest.metadata.display_name, username: battle.guest.metadata.username, is_me: seat === 2, ready: battle.ready.guest, forfeited: false, score: 0 });
  }
  const answered = battle.answers[user.id] ?? {};
  return envelope({
    battle_id: battle.id,
    mode: "direct",
    state: battle.state,
    revision: battle.revision,
    offering_id: OFFERING,
    course: { id: COURSE, code: "STA 111", title: "Descriptive Statistics" },
    courses: [{ id: COURSE, code: "STA 111", title: "Descriptive Statistics" }],
    round_count: 1,
    seconds_per_round: 20,
    invitation_expires_at: later(300000),
    ready_deadline: later(120000),
    starts_at: battle.state === "active" || battle.state === "finished" ? new Date(Date.now() - 1000).toISOString() : null,
    ends_at: later(120000),
    finalized_at: battle.state === "finished" ? nowIso() : null,
    result_kind: battle.state === "finished" ? "draw" : null,
    cancel_reason: null,
    invite_token: battle.token,
    me: { seat, ready: battle.ready[mine], forfeited: false },
    participants,
    current_question: battle.state === "active" ? {
      position: 1,
      prompt: "Which activity summarises observed data?",
      options: [
        { id: OPT_A, body: "Descriptive statistics" },
        { id: OPT_B, body: "A parameter" },
      ],
      opened_at: new Date(Date.now() - 2000).toISOString(),
      deadline: later(60000),
      reading_at: new Date(Date.now() - 1000).toISOString(),
      my_option_id: answered[1] ?? null,
      duration_seconds: 20,
      answer_format: "standard",
    } : null,
    next_question_at: null,
    my_answered_positions: Object.keys(answered).map(Number),
    rounds: battle.state === "finished" ? [{ position: 1, prompt: "Which activity summarises observed data?", my_option_id: answered[1] ?? null, my_is_correct: true, opponent_is_correct: true }] : null,
    outcome: battle.state === "finished" ? { result: "draw", xp_awarded: 0 } : null,
    opponent: other ? other.metadata.display_name : null,
  });
}

function friend(user) {
  return {
    user_id: user.id,
    display_name: user.metadata.display_name,
    username: user.metadata.username,
    state: "accepted",
    incoming: false,
    online: true,
    battle_busy: null,
  };
}

function rpc(name, body, user) {
  if (name === "get_registration_legal_status_v1") {
    return { terms_version: "2026-10-19-draft-1", privacy_version: "2026-10-19-draft-1", guardian_enabled: false, support_email: null };
  }
  if (name === "is_username_available_v1") return ! [...users.values()].some((item) => item.metadata.username === body.p_username);
  if (name === "get_registration_options_v1") {
    return {
      university_id: UNI,
      faculties: [{ id: FAC, name: "Faculty of Science" }],
      departments: [{ id: DEP, name: "Computing Sciences", faculty_id: FAC }],
      levels: [{ id: LEVEL, label: "100 Level" }],
      academic_periods: [{ id: PERIOD, label: "2026/2027" }],
      semesters: [{ id: SEM, label: "First semester", academic_period_id: PERIOD }],
    };
  }
  if (!user) return envelope({});
  if (name === "get_my_profile_v1") return profile(user);
  if (name === "get_home_summary_v1") return home(user);
  if (name === "get_xp_progress_v1") return envelope({ xp_total: 0, level: 1, into_level: 0, next_level_at: 100, today: 0, daily_cap: 40 });
  if (name === "get_course_overview_v1") return overview();
  if (name === "get_lesson_v1") return lesson(user);
  if (name === "start_lesson_v1") return envelope({ lesson_id: LESSON, state: "started", started_at: nowIso(), completed_at: null });
  if (name === "complete_lesson_v1") {
    lessonsCompleted.add(user.id);
    return envelope({ lesson_id: LESSON, state: "completed", started_at: nowIso(), completed_at: nowIso(), already_completed: false, xp_awarded: 10, xp_capped: false, xp_total: 10, streak: { current: 1, longest: 1, active_today: true, local_date: "2026-11-01" } });
  }
  if (name === "start_configured_attempt_v1" || name === "start_attempt_v1") {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
    const attempt = envelope({
      attempt_id: id, assessment_id: "55555555-5555-4555-8555-555555555555", assessment_version_id: ASSESSMENT_VERSION,
      offering_id: OFFERING, kind: "mock", title: "STA practice mock", status: "active", feedback_mode: "after_submit",
      started_at: nowIso(), expires_at: later(600000), finalized_at: null, revision: 1, total_count: 2,
      questions: questions(), result: null,
    });
    attempts.set(id, attempt);
    return attempt;
  }
  if (name === "save_attempt_answers_v1") {
    return envelope({ attempt_id: body.p_attempt_id, revision: 2, expires_at: later(600000), saved: (body.p_answers ?? []).map((answer) => ({ question_version_id: answer.question_version_id, answer_revision: answer.answer_revision })) });
  }
  if (name === "submit_attempt_v1") {
    const attempt = attempts.get(body.p_attempt_id);
    attempt.status = "submitted";
    attempt.finalized_at = nowIso();
    attempt.result = { correct_count: 2, answered_count: 2, total_count: 2, percent: 100, xp_awarded: 2, xp_capped: false, voided_reason: null };
    return attempt;
  }
  if (name === "get_attempt_result_v1") return attempts.get(body.p_attempt_id);
  if (name === "get_friends_v1") {
    return envelope({ username: user.metadata.username, people: [...users.values()].filter((item) => item.id !== user.id).map(friend) });
  }
  if (name === "search_friends_v1") {
    const query = String(body.p_query ?? "").toLowerCase();
    return envelope({ people: [...users.values()].filter((item) => item.id !== user.id && item.metadata.username.includes(query)).map(friend) });
  }
  if (name === "get_battle_setup_v1") {
    return envelope({ courses: [{ offering_id: OFFERING, course_id: COURSE, code: "STA 111", title: "Descriptive Statistics", available_questions: 20 }] });
  }
  if (name === "get_my_live_battle_v1") return envelope({ queue: null, battle: null });
  if (name === "get_battle_invitations_v1") return envelope({ invitations: [] });
  if (name === "get_my_battles_v1") return envelope({ items: [], next_before: null });
  if (name === "get_notification_feed_v1" || name === "list_notifications_v1") return envelope({ items: [], notifications: [], unread: 0 });
  if (name === "create_scoped_battle_v1") {
    const guest = [...users.values()].find((item) => item.id === body.p_friend_id);
    battle = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      token: `invite-${user.metadata.username}`,
      host: user,
      guest,
      state: "waiting",
      ready: { host: false, guest: false },
      answers: {},
      revision: 1,
    };
    return battleView(user);
  }
  if (name === "get_battle_invite_preview_v1") {
    return envelope({ round_count: 1, courses: ["STA 111"] });
  }
  if (name === "accept_battle_v1") {
    battle.guest = user;
    battle.state = "ready";
    battle.revision += 1;
    return battleView(user);
  }
  if (name === "get_battle_state_v1") return battleView(user);
  if (name === "ready_battle_v1") {
    if (battle.host.id === user.id) battle.ready.host = true;
    else battle.ready.guest = true;
    if (battle.ready.host && battle.ready.guest) battle.state = "active";
    battle.revision += 1;
    return battleView(user);
  }
  if (name === "submit_battle_answer_v1") {
    battle.answers[user.id] = { ...(battle.answers[user.id] ?? {}), [body.p_position]: body.p_option_id };
    const both = battle.host && battle.guest && battle.answers[battle.host.id]?.[1] && battle.answers[battle.guest.id]?.[1];
    if (both) battle.state = "finished";
    battle.revision += 1;
    return envelope({ battle_id: battle.id, position: body.p_position, accepted: true, option_id: body.p_option_id });
  }
  if (name === "report_battle_integrity_v1") return { strikes: 0, forfeited: false };
  if (name === "get_notifications_v1") return envelope({ notifications: [], unread: 0 });
  console.error("unmocked rpc", name);
  return envelope({});
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:54321");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  const send = (status, body) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === "/auth/v1/signup" && req.method === "POST") {
    const body = await readBody(req);
    const user = {
      id: crypto.randomUUID(),
      email: body.email,
      created_at: nowIso(),
      metadata: body.data ?? {},
    };
    users.set(body.email, user);
    send(200, { user: publicUser(user), session: null });
    return;
  }
  if (url.pathname === "/auth/v1/token" && req.method === "POST") {
    const body = await readBody(req);
    const email = String(body.auth_code ?? body.code ?? "").replace(/^e2e-/, "");
    const user = users.get(email);
    if (!user) { send(400, { error: "invalid_grant", error_description: "unknown code" }); return; }
    send(200, issue(user));
    return;
  }
  if (url.pathname === "/auth/v1/user" && req.method === "GET") {
    const user = userFromAuth(req);
    if (!user) { send(401, { message: "no session" }); return; }
    send(200, publicUser(user));
    return;
  }
  const rpcName = url.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/)?.[1];
  if (rpcName && req.method === "POST") {
    const body = await readBody(req);
    send(200, rpc(rpcName, body, userFromAuth(req)));
    return;
  }
  send(404, { message: `unmocked ${req.method} ${url.pathname}` });
});

server.listen(54321, "127.0.0.1", () => {
  console.log("e2e supabase mock on 54321");
});
