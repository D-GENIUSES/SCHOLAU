-- =============================================================================================
-- ScholAu LOCAL DEVELOPMENT FIXTURES ONLY
-- =============================================================================================
-- Everything in this file is placeholder fixture data for local development and automated tests.
-- Per D01, no fabricated institution or course content may be shipped to staging/production:
-- the real university, academic period and reviewed course content must come from the content
-- owner through the admin import + review + publish workflow.
--
-- Local test accounts (local only, never reuse elsewhere):
--   student@scholau.local / ScholauStudent#2026   (student)
--   admin@scholau.local   / ScholauAdmin#2026     (student + admin)
-- =============================================================================================

-- ---------------------------------------------------------------------------
-- Configuration rows (D04, D08). These are configuration, not content, but values remain proposals.
-- ---------------------------------------------------------------------------
insert into private.point_rules (code, version, amount, daily_cap, policy, effective_from) values
  ('lesson_complete', 1, 5, 100, '{"category":"learning","note":"first completion per logical lesson"}', '2026-01-01T00:00:00Z'),
  ('review_correct', 1, 2, 100, '{"category":"learning","note":"first correct review answer per logical question"}', '2026-01-01T00:00:00Z'),
  ('practice_first', 1, 10, 100, '{"category":"learning","note":"first completion per logical practice assessment"}', '2026-01-01T00:00:00Z'),
  ('mock_first', 1, 20, 100, '{"category":"learning","note":"first completion per logical mock assessment"}', '2026-01-01T00:00:00Z'),
  ('battle_win', 1, 25, null, '{"category":"battle","uncapped":true}', '2026-01-01T00:00:00Z'),
  ('battle_draw', 1, 10, null, '{"category":"battle","uncapped":true}', '2026-01-01T00:00:00Z'),
  ('battle_loss', 1, 5, null, '{"category":"battle","uncapped":true}', '2026-01-01T00:00:00Z')
on conflict (code, version) do nothing;

insert into public.battle_rules (id, version, round_count, seconds_per_round, ready_seconds, countdown_seconds,
                                 queue_seconds, invite_seconds, win_xp, draw_xp, loss_xp, published_at)
values ('40000000-0000-4000-8000-000000000001', 1, 5, 20, 10, 5, 60, 300, 25, 10, 5, '2026-01-01T00:00:00Z')
on conflict (version) do nothing;

insert into public.app_config (platform, minimum_build, minimum_api_version, maintenance, message, feature_flags) values
  ('web', 1, 1, false, null, '{"battles":true,"daily_challenges":false}'),
  ('ios', 1, 1, false, null, '{"battles":true,"daily_challenges":false}'),
  ('android', 1, 1, false, null, '{"battles":true,"daily_challenges":false}')
on conflict (platform) do nothing;

-- ---------------------------------------------------------------------------
-- Test users (the on_auth_user_created trigger creates profiles + student role)
-- ---------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'student@scholau.local', extensions.crypt('ScholauStudent#2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Fixture Student"}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '90000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'admin@scholau.local', extensions.crypt('ScholauAdmin#2026', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{"display_name":"Fixture Admin"}', now(), now(), '', '', '', '')
on conflict (id) do nothing;

do $$
begin
  if to_regclass('auth.identities') is not null then
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    select gen_random_uuid(), u.id, u.id::text,
           jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
    from auth.users u
    where u.id in ('90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002')
      and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');
  end if;
end
$$;

insert into public.user_roles (user_id, role, granted_by)
values ('90000000-0000-4000-8000-000000000002', 'admin', '90000000-0000-4000-8000-000000000002')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Academic hierarchy (fixture)
-- ---------------------------------------------------------------------------
insert into public.universities (id, name, slug) values
  ('10000000-0000-4000-8000-000000000001', 'Fixture University (local dev)', 'fixture-university')
on conflict do nothing;
insert into public.faculties (id, university_id, name) values
  ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Faculty of Computing (fixture)')
on conflict do nothing;
insert into public.departments (id, university_id, faculty_id, name) values
  ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Cybersecurity (fixture)'),
  ('10000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Computer Science (fixture)')
on conflict do nothing;
insert into public.levels (id, university_id, label, sort_order) values
  ('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '100 Level', 1),
  ('10000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000001', '200 Level', 2)
on conflict do nothing;
insert into public.academic_periods (id, university_id, label, starts_on, ends_on) values
  ('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '2026/2027', '2026-09-01', '2027-08-31')
on conflict do nothing;
insert into public.semesters (id, university_id, academic_period_id, label, sort_order) values
  ('10000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'First Semester', 1),
  ('10000000-0000-4000-8000-000000000016', '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'Second Semester', 2)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Course + offering (fixture placeholder)
-- ---------------------------------------------------------------------------
insert into public.courses (id, code, title, description) values
  ('20000000-0000-4000-8000-000000000001', 'CYB101-FIXTURE', 'Cybersecurity Fundamentals (fixture)',
   'Placeholder fixture course for local development. Not reviewed content.')
on conflict do nothing;
insert into public.course_offerings (id, course_id, university_id, department_id, level_id, semester_id, status) values
  ('20000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000006', 'published'),
  -- Same reusable course offered to a second department (shared course, no duplicated content).
  ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001',
   '10000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000006', 'published')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Module, lessons, structured blocks
-- ---------------------------------------------------------------------------
insert into public.modules (id, course_id, title, position) values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Foundations of Security (fixture)', 1)
on conflict do nothing;
insert into public.lessons (id, course_id, module_id, position) values
  ('22000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 1),
  ('22000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 2),
  ('22000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000001', 3)
on conflict do nothing;

insert into public.lesson_versions (id, lesson_id, version, title, objective, blocks, estimated_minutes, source_reference) values
  ('23000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 1,
   'The CIA Triad', 'Explain confidentiality, integrity and availability with an example of each.',
   $json$[
     {"type":"heading","level":2,"text":"Why security goals matter"},
     {"type":"paragraph","text":"Security teams describe what they protect using three goals, often called the CIA triad."},
     {"type":"list","ordered":false,"items":["Confidentiality: only authorised people can read data","Integrity: data is not altered without authorisation","Availability: systems and data are usable when needed"]},
     {"type":"callout","tone":"example","text":"Disk encryption protects confidentiality; checksums detect integrity problems; redundant servers improve availability."},
     {"type":"code","language":"bash","code":"sha256sum report.pdf  # compare with the published hash to check integrity"}
   ]$json$::jsonb, 8, 'FIXTURE - placeholder, not reviewed'),
  ('23000000-0000-4000-8000-000000000002', '22000000-0000-4000-8000-000000000002', 1,
   'Authentication and Access', 'Distinguish authentication factors and apply least privilege.',
   $json$[
     {"type":"heading","level":2,"text":"Proving who you are"},
     {"type":"paragraph","text":"Authentication factors are grouped as something you know, something you have and something you are."},
     {"type":"list","ordered":true,"items":["Know: password or PIN","Have: hardware key or phone","Are: fingerprint or face"]},
     {"type":"callout","tone":"tip","text":"Multi-factor authentication combines factors from different categories."},
     {"type":"heading","level":3,"text":"Least privilege"},
     {"type":"paragraph","text":"Give each account only the access it needs to do its job, and nothing more."}
   ]$json$::jsonb, 10, 'FIXTURE - placeholder, not reviewed'),
  ('23000000-0000-4000-8000-000000000003', '22000000-0000-4000-8000-000000000003', 1,
   'Malware and Phishing', 'Recognise common malware types and phishing warning signs.',
   $json$[
     {"type":"heading","level":2,"text":"Common threats"},
     {"type":"paragraph","text":"Malware is software designed to harm systems or steal data. Phishing tricks people into revealing secrets or running malware."},
     {"type":"list","ordered":false,"items":["Virus: attaches to files and spreads when they run","Worm: spreads across networks on its own","Ransomware: encrypts data and demands payment"]},
     {"type":"callout","tone":"warning","text":"Urgent requests, mismatched sender addresses and unexpected attachments are classic phishing signs."},
     {"type":"code","language":"text","code":"From: it-support@examp1e.com\nSubject: URGENT: verify your password today"}
   ]$json$::jsonb, 9, 'FIXTURE - placeholder, not reviewed')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Question bank helper (session-local) and fixture questions
-- ---------------------------------------------------------------------------
create or replace function pg_temp.seed_question(
  p_key text, p_pool text, p_usage text[], p_difficulty text, p_prompt text, p_options text[], p_correct integer,
  p_explanation text, p_lesson uuid)
returns uuid
language plpgsql
as $$
declare
  v_q uuid;
  v_v uuid;
  v_opt uuid;
  v_correct uuid;
  i integer;
begin
  select id into v_q from public.questions where course_id = '20000000-0000-4000-8000-000000000001' and logical_key = p_key;
  if v_q is not null then
    select id into v_v from public.question_versions where question_id = v_q order by version desc limit 1;
    return v_v;
  end if;
  insert into public.questions (course_id, lesson_id, pool, logical_key)
  values ('20000000-0000-4000-8000-000000000001', p_lesson, p_pool, p_key) returning id into v_q;
  insert into public.question_versions (question_id, version, prompt, difficulty, usage, source_reference)
  values (v_q, 1, p_prompt, p_difficulty, p_usage, 'FIXTURE - placeholder, not reviewed') returning id into v_v;
  for i in 1..cardinality(p_options) loop
    insert into public.question_options (question_version_id, label, body, position)
    values (v_v, chr(64 + i), p_options[i], i) returning id into v_opt;
    if i = p_correct then
      v_correct := v_opt;
    end if;
  end loop;
  insert into private.question_answer_keys (question_version_id, correct_option_id, explanation)
  values (v_v, v_correct, p_explanation);
  perform private.publish_question_version(v_v, '90000000-0000-4000-8000-000000000002');
  return v_v;
end;
$$;

do $$
declare
  l1 constant uuid := '22000000-0000-4000-8000-000000000001';
  l2 constant uuid := '22000000-0000-4000-8000-000000000002';
  l3 constant uuid := '22000000-0000-4000-8000-000000000003';
  lp constant text[] := array['review', 'practice', 'mock'];
begin
  -- Publish lessons through the same validation path admins use.
  perform private.publish_lesson_version('23000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002');
  perform private.publish_lesson_version('23000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000002');
  perform private.publish_lesson_version('23000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000002');

  -- Learning pool (review/practice/mock)
  perform pg_temp.seed_question('L1-Q1', 'learning', lp, 'beginner',
    'Which security goal ensures data is not altered without authorisation?',
    array['Confidentiality', 'Integrity', 'Availability', 'Anonymity'], 2,
    'Integrity is about preventing or detecting unauthorised modification.', l1);
  perform pg_temp.seed_question('L1-Q2', 'learning', lp, 'beginner',
    'A denial-of-service attack mainly threatens which goal?',
    array['Availability', 'Confidentiality', 'Integrity', 'Non-repudiation'], 1,
    'Denial of service makes systems unusable, which is an availability failure.', l1);
  perform pg_temp.seed_question('L1-Q3', 'learning', lp, 'beginner',
    'Full-disk encryption on a laptop primarily protects which goal if the laptop is stolen?',
    array['Availability', 'Integrity', 'Confidentiality', 'Accountability'], 3,
    'Encryption keeps the data unreadable to the thief, protecting confidentiality.', l1);
  perform pg_temp.seed_question('L1-Q4', 'learning', lp, 'intermediate',
    'Comparing a file''s SHA-256 hash with a published value helps verify what?',
    array['That the file is encrypted', 'That the file has not been modified', 'That the server is online', 'Who downloaded the file'], 2,
    'Matching hashes indicate the content is unchanged, supporting integrity.', l1);
  perform pg_temp.seed_question('L2-Q1', 'learning', lp, 'beginner',
    'Which is an example of "something you have"?',
    array['A password', 'A fingerprint', 'A hardware security key', 'Your date of birth'], 3,
    'A physical token or key is a possession factor.', l2);
  perform pg_temp.seed_question('L2-Q2', 'learning', lp, 'beginner',
    'Multi-factor authentication requires factors from...',
    array['the same category twice', 'two or more different categories', 'two different passwords', 'two different devices only'], 2,
    'MFA combines different factor categories, such as knowledge plus possession.', l2);
  perform pg_temp.seed_question('L2-Q3', 'learning', lp, 'intermediate',
    'What is the recommended way to store user passwords?',
    array['Plain text in a protected table', 'Reversible encryption', 'A salted, slow password hash such as Argon2 or bcrypt', 'An unsalted MD5 hash'], 3,
    'Slow salted hashes resist offline cracking; plain text or fast hashes do not.', l2);
  perform pg_temp.seed_question('L2-Q4', 'learning', lp, 'beginner',
    'The principle of least privilege means...',
    array['everyone gets admin rights to avoid delays', 'accounts get only the access they need', 'passwords must be short', 'only managers can log in'], 2,
    'Least privilege limits damage by granting only necessary access.', l2);
  perform pg_temp.seed_question('L3-Q1', 'learning', lp, 'beginner',
    'Which is a common phishing warning sign?',
    array['A message from a known colleague about lunch', 'An urgent request to verify your password via a link', 'A calendar invite you created', 'A software update from your OS settings page'], 2,
    'Urgency combined with a credential request is a classic phishing pattern.', l3);
  perform pg_temp.seed_question('L3-Q2', 'learning', lp, 'beginner',
    'What does ransomware typically do?',
    array['Speeds up the computer', 'Encrypts data and demands payment', 'Only displays adverts', 'Backs up files to the cloud'], 2,
    'Ransomware denies access to data, usually by encryption, and demands a ransom.', l3);
  perform pg_temp.seed_question('L3-Q3', 'learning', lp, 'intermediate',
    'How does a worm differ from a virus?',
    array['A worm spreads by itself across networks', 'A worm only affects phones', 'A worm cannot cause damage', 'A worm needs a printer'], 1,
    'Worms self-propagate without needing a user to run an infected file.', l3);
  perform pg_temp.seed_question('L3-Q4', 'learning', lp, 'intermediate',
    'You clicked a suspicious link at work. What should you do first?',
    array['Ignore it', 'Report it to the security/IT team promptly', 'Forward it to colleagues to check', 'Delete your browser history'], 2,
    'Prompt reporting lets responders contain any compromise quickly.', l3);

  -- Battle pool (separate from learning; never shown in learning feedback)
  perform pg_temp.seed_question('B-01', 'battle', array['battle'], 'beginner', 'What does HTTPS add to HTTP?',
    array['Compression', 'TLS encryption and server authentication', 'Faster DNS', 'Ad blocking'], 2, 'HTTPS is HTTP over TLS.', null);
  perform pg_temp.seed_question('B-02', 'battle', array['battle'], 'beginner', 'Which service commonly uses TCP port 22?',
    array['HTTP', 'SMTP', 'SSH', 'DNS'], 3, 'SSH listens on port 22 by default.', null);
  perform pg_temp.seed_question('B-03', 'battle', array['battle'], 'beginner', 'A network firewall primarily...',
    array['filters traffic according to rules', 'stores backups', 'encrypts hard drives', 'generates passwords'], 1, 'Firewalls allow or block traffic by policy.', null);
  perform pg_temp.seed_question('B-04', 'battle', array['battle'], 'beginner', 'Social engineering attacks target...',
    array['CPU caches', 'people', 'power supplies', 'compilers'], 2, 'Social engineering manipulates human behaviour.', null);
  perform pg_temp.seed_question('B-05', 'battle', array['battle'], 'beginner', 'Which password is strongest?',
    array['password123', 'Summer2026', 'a long random passphrase of several words', 'qwerty'], 3, 'Length and randomness drive strength.', null);
  perform pg_temp.seed_question('B-06', 'battle', array['battle'], 'beginner', 'A VPN mainly provides...',
    array['an encrypted tunnel between networks or devices', 'free storage', 'antivirus scanning', 'faster CPUs'], 1, 'VPNs encrypt traffic in a tunnel.', null);
  perform pg_temp.seed_question('B-07', 'battle', array['battle'], 'intermediate', 'SQL injection exploits...',
    array['weak Wi-Fi signals', 'unsanitised input inserted into database queries', 'expired TLS certificates', 'slow disks'], 2, 'Parameterised queries prevent SQL injection.', null);
  perform pg_temp.seed_question('B-08', 'battle', array['battle'], 'beginner', 'Regular patching mainly reduces risk from...',
    array['known vulnerabilities', 'power cuts', 'user typos', 'screen glare'], 1, 'Patches fix publicly known flaws.', null);
  perform pg_temp.seed_question('B-09', 'battle', array['battle'], 'intermediate', 'Which is a symmetric encryption algorithm?',
    array['RSA', 'AES', 'Diffie-Hellman', 'ECDSA'], 2, 'AES uses the same key to encrypt and decrypt.', null);
  perform pg_temp.seed_question('B-10', 'battle', array['battle'], 'intermediate', 'A zero-day vulnerability is one that...',
    array['is fixed on day zero', 'has no patch available when it is exploited', 'only affects old systems', 'cannot be exploited'], 2, 'Zero-days are exploited before a fix exists.', null);
  perform pg_temp.seed_question('B-11', 'battle', array['battle'], 'beginner', 'What is the main purpose of backups?',
    array['Recover data after loss or attack', 'Increase screen brightness', 'Block phishing', 'Replace passwords'], 1, 'Backups enable recovery, including from ransomware.', null);
  perform pg_temp.seed_question('B-12', 'battle', array['battle'], 'intermediate', 'Which log helps investigate failed logins?',
    array['Authentication logs', 'Printer queue', 'Font cache', 'Clipboard history'], 1, 'Authentication logs record sign-in attempts.', null);
end
$$;

-- ---------------------------------------------------------------------------
-- Assessments (review per lesson, one practice, one timed mock)
-- ---------------------------------------------------------------------------
insert into public.assessments (id, course_id, lesson_id, kind, title, position) values
  ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000001', 'review', 'Review: The CIA Triad', 1),
  ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000002', 'review', 'Review: Authentication and Access', 2),
  ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', '22000000-0000-4000-8000-000000000003', 'review', 'Review: Malware and Phishing', 3),
  ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', null, 'practice', 'Practice: Foundations', 1),
  ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', null, 'mock', 'Mock exam: Foundations', 1)
on conflict do nothing;

insert into public.assessment_versions (id, assessment_id, version, question_count, duration_seconds, feedback_mode) values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 1, 3, null, 'immediate'),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 1, 3, null, 'immediate'),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 1, 3, null, 'immediate'),
  ('31000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 1, 6, null, 'after_submit'),
  ('31000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005', 1, 10, 900, 'after_submit')
on conflict do nothing;

insert into public.assessment_questions (assessment_version_id, question_version_id, position)
select av.id, qv.id, row_number() over (partition by av.id order by q.logical_key)::integer
from (values
  ('31000000-0000-4000-8000-000000000001'::uuid, 'L1-%'),
  ('31000000-0000-4000-8000-000000000002'::uuid, 'L2-%'),
  ('31000000-0000-4000-8000-000000000003'::uuid, 'L3-%'),
  ('31000000-0000-4000-8000-000000000004'::uuid, 'L%'),
  ('31000000-0000-4000-8000-000000000005'::uuid, 'L%')
) as av(id, pattern)
join public.questions q on q.course_id = '20000000-0000-4000-8000-000000000001' and q.pool = 'learning' and q.logical_key like av.pattern
join public.question_versions qv on qv.question_id = q.id and qv.status = 'published'
on conflict do nothing;

select private.publish_assessment_version(id, '90000000-0000-4000-8000-000000000002')
from public.assessment_versions where assessment_id in (
  '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000005') and status = 'draft';

-- ---------------------------------------------------------------------------
-- Onboard + enroll both fixture users so local battles can be played between them.
-- ---------------------------------------------------------------------------
select private.apply_academic_profile(u.id, u.id,
  '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000006',
  'initial', null, null)
from (values ('90000000-0000-4000-8000-000000000001'::uuid), ('90000000-0000-4000-8000-000000000002'::uuid)) as u(id)
where not exists (select 1 from public.profiles p where p.id = u.id and p.university_id is not null);

insert into public.enrollments (user_id, offering_id)
values ('90000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002'),
       ('90000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002')
on conflict do nothing;
