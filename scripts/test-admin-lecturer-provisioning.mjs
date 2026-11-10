import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createChallengeTestDatabase } from "./lib/course-challenge-test-db.mjs";

const { db, id, admin, offering, otherOffering, login } = await createChallengeTestDatabase();
try {
  for (const migration of [
    "20261016000400_admin_created_accounts.sql",
    "20261016000500_admin_auth_creation_order.sql",
    "20261110074409_admin_lecturer_atomic_provisioning.sql",
  ]) {
    await db.exec(readFileSync(`supabase/migrations/${migration}`, "utf8"));
  }

  // The fixture substitutes a minimal auth.users table for GoTrue.
  await db.exec("create unique index on auth.users (email)");
  await login(admin);
  const { rows: [access] } = await db.query("select public.admin_user_creation_access_v1() as result");
  assert.equal(access.result.atomic_lecturer_provisioning, true);
  await db.exec("reset role");

  const email = n => `lecturer${n}@example.invalid`;
  const provision = (n, courses, address = email(n)) => db.transaction(async tx => {
    const userId = id(n);
    await tx.query("insert into auth.users(id,email,raw_user_meta_data) values($1,$2,$3)", [
      userId, address, { display_name: "Taylor Lecturer", signup_kind: "admin_managed", managed_role: "lecturer" },
    ]);
    await tx.query("update auth.users set raw_app_meta_data=$2,email_confirmed_at=now() where id=$1", [
      userId, { scholau_provision: { actor_id: admin, role: "lecturer", request_key: userId, offering_ids: courses } },
    ]);
  });

  await assert.rejects(provision(510, []), /VALIDATION_FAILED/);
  await provision(511, [offering]);
  await provision(512, [offering, otherOffering, otherOffering]);
  await assert.rejects(provision(513, [offering], email(511)), /duplicate key/);
  await db.query("update public.course_offerings set status='retired' where id=$1", [otherOffering]);
  await assert.rejects(provision(514, [offering, otherOffering]), /VALIDATION_FAILED/);

  const { rows } = await db.query(`
    select u.email, count(a.offering_id)::int as courses
    from auth.users u join public.lecturer_course_assignments a on a.user_id=u.id
    where u.email_confirmed_at is not null and u.email like 'lecturer%@example.invalid'
    group by u.email order by u.email
  `);
  assert.deepEqual(rows, [{ email: email(511), courses: 1 }, { email: email(512), courses: 2 }]);
  const { rows: [rollback] } = await db.query("select count(*)::int as n from auth.users where id = any($1)", [[id(510), id(513), id(514)]]);
  assert.equal(rollback.n, 0);
  const recipient = async n => (await db.query("select public.admin_provision_welcome_recipient_v1($1) as result", [id(n)])).rows[0].result;
  assert.deepEqual(await recipient(511), { email: email(511), display_name: "Taylor Lecturer" });
  assert.equal(await recipient(510), null);
  const { rows: [permission] } = await db.query("select has_function_privilege('authenticated','public.admin_provision_welcome_recipient_v1(uuid)','execute') as allowed");
  assert.equal(permission.allowed, false);
  console.log("Atomic lecturer provisioning scenarios passed.");
} finally {
  await db.close();
}
