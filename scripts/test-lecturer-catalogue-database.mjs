import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const runtime = createRequire(resolve(process.env.LECTURER_TEST_RUNTIME ?? "../.legal-test-runtime", "package.json"));
const { PGlite } = runtime("@electric-sql/pglite");
const { pgcrypto } = runtime("@electric-sql/pglite/contrib/pgcrypto");
const db = new PGlite({ extensions: { pgcrypto } });
try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as $$select null::uuid$$;`);
  await db.exec(readFileSync("supabase/migrations/20261012000100_hierarchy_identity.sql", "utf8"));
  // Use the actual curriculum table DDL, without unrelated data seeding or later migrations.
  const curriculum = readFileSync("supabase/migrations/20261015000200_adeleke_course_curriculum.sql", "utf8");
  await db.exec(curriculum.slice(curriculum.indexOf("create table public.curriculum_courses ("), curriculum.indexOf("alter table public.curriculum_courses enable row level security;")));
  await db.exec(readFileSync("supabase/migrations/20261029001300_lecturer_registration_courses.sql", "utf8"));
  await db.exec(`set search_path=public,extensions;
    grant usage on schema extensions to anon,authenticated;
    create function extensions.no_plan() returns text language sql as $$select 'plan'::text$$;
    create function extensions.finish() returns setof text language sql as $$select 'done'::text$$;
    create function extensions.ok(value boolean,label text) returns text language sql as $$select case when value is true then 'ok: ' else 'FAIL: ' end||label$$;
    create function extensions.is(actual anycompatible,expected anycompatible,label text) returns text language sql as $$select case when actual is not distinct from expected then 'ok: ' else 'FAIL: ' end||label$$;
    grant execute on function extensions.no_plan(),extensions.finish(),extensions.ok(boolean,text),extensions.is(anycompatible,anycompatible,text) to anon,authenticated;`);
  const results = await db.exec(readFileSync("supabase/tests/database/55_lecturer_registration_courses.test.sql", "utf8").replace("create extension if not exists pgtap with schema extensions;", ""));
  const assertions = results.flatMap(result => result.rows.flatMap(row => Object.values(row))).filter(value => typeof value === "string" && /^(ok|FAIL):/.test(value));
  assert.ok(assertions.length >= 11);
  assert.deepEqual(assertions.filter(value => value.startsWith("FAIL:")), []);
  console.log(JSON.stringify({ passed: assertions.length, failed: 0, environment: "isolated PostgreSQL, actual schema and migration" }));
} finally { await db.close(); }
