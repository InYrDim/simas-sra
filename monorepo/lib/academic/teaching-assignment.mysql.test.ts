import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import mysql from "mysql2/promise";

import { closeDatabasePool } from "@/db";
import { listEffectiveTeachingAssignmentsForUser, teachingAssignmentStore } from "@/lib/academic/teaching-assignment-data";

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;

after(() => closeDatabasePool());

mysqlTest("teaching assignment transactions isolate Tenants and preserve atomic versioned history", async () => {
  const connection = await mysql.createConnection(databaseUrl!);
  const tenantA = randomUUID();
  const tenantB = randomUUID();
  const actorA = randomUUID();
  const actorB = randomUUID();
  const assignmentA = randomUUID();
  const eventA = randomUUID();
  const personA = randomUUID();
  const teacherA = randomUUID();
  const subjectA = randomUUID();
  const yearA = randomUUID();
  const groupA = randomUUID();
  const now = new Date();

  const assignment = (id: string, tenantId: string, actorUserId: string) => ({
    id,
    tenantId,
    teacherProfileId: randomUUID(),
    subjectId: randomUUID(),
    classGroupId: randomUUID(),
    academicYearId: randomUUID(),
    startsOn: "2026-07-01",
    endsOn: null,
    status: "planned" as const,
    reason: "Integration test",
    version: 1,
    createdByUserId: actorUserId,
    createdAt: now,
    updatedAt: now,
  });

  try {
    await connection.execute("SET FOREIGN_KEY_CHECKS=0");
    await connection.execute(
      "INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?, 'Teaching assignment test', ?, ?, ?, NOW(3), 'active', NOW(3), NOW(3)), (?, 'Teaching assignment test B', ?, ?, ?, NOW(3), 'active', NOW(3), NOW(3))",
      [tenantA, `teaching-${tenantA}`, tenantA.slice(0, 8), randomUUID(), tenantB, `teaching-${tenantB}`, tenantB.slice(0, 8), randomUUID()],
    );
    await connection.execute(
      "INSERT INTO `user` (`id`,`tenant_id`,`tenant_role`,`name`,`email`,`email_verified`) VALUES (?,?,'school-admin','Actor A',?,true),(?,?,'school-admin','Actor B',?,true)",
      [actorA, tenantA, `${actorA}@test.invalid`, actorB, tenantB, `${actorB}@test.invalid`],
    );
    await connection.execute(
      "INSERT INTO `school_person` (`id`,`tenant_id`,`full_name`,`normalized_name`,`birth_place`,`normalized_birth_place`,`birth_date`,`gender`,`street`,`account_user_id`,`archived`,`version`,`created_at`,`updated_at`) VALUES (?,?, 'Teacher A','teacher a','Test','test','1990-01-01','male','Test',?,false,1,NOW(3),NOW(3))",
      [personA, tenantA, actorA],
    );
    await connection.execute(
      "INSERT INTO `teacher_profile` (`id`,`tenant_id`,`person_id`,`teacher_number`,`normalized_teacher_number`,`employment_type`,`service_start_date`,`status`,`archived`,`version`,`created_at`,`updated_at`) VALUES (?,?,?,'T-TEST','t-test','honorary','2020-01-01','active',false,1,NOW(3),NOW(3))",
      [teacherA, tenantA, personA],
    );
    await connection.execute(
      "INSERT INTO `academic_year` (`id`,`tenant_id`,`label`,`start_date`,`end_date`,`lifecycle`,`archived`,`version`,`created_at`,`updated_at`) VALUES (?,?, '2026/2027','2026-07-01','2027-06-30','draft',false,1,NOW(3),NOW(3))",
      [yearA, tenantA],
    );
    await connection.execute(
      "INSERT INTO `class_group` (`id`,`tenant_id`,`academic_year_id`,`education_level`,`grade`,`group_name`,`normalized_group_name`,`code`,`normalized_code`,`capacity`,`lifecycle`,`archived`,`version`,`created_at`,`updated_at`) VALUES (?,?,?,'SMA',10,'A','a','10-A','10-a',32,'draft',false,1,NOW(3),NOW(3))",
      [groupA, tenantA, yearA],
    );
    await connection.execute(
      "INSERT INTO `subject` (`id`,`tenant_id`,`code`,`normalized_code`,`name`,`normalized_name`,`education_levels`,`archived`,`version`,`created_at`,`updated_at`) VALUES (?,?, 'MAT','mat','Matematika','matematika','SMA',false,1,NOW(3),NOW(3))",
      [subjectA, tenantA],
    );

    const first = { ...assignment(assignmentA, tenantA, actorA), teacherProfileId: teacherA, subjectId: subjectA, classGroupId: groupA, academicYearId: yearA };
    await teachingAssignmentStore.transaction(tenantA, async (tx) => {
      await tx.insert(first);
      await tx.audit({ id: eventA, tenantId: tenantA, teachingAssignmentId: first.id, actorUserId: actorA, operation: "created", fromVersion: 0, toVersion: 1, effectiveOn: first.startsOn, reason: first.reason, occurredAt: now });
    });
    await connection.execute("UPDATE `teaching_assignment` SET `status`='active' WHERE id=?", [assignmentA]);
    assert.deepEqual((await listEffectiveTeachingAssignmentsForUser(tenantA, actorA, "2026-08-01")).map((row) => row.id), [assignmentA]);
    assert.deepEqual((await listEffectiveTeachingAssignmentsForUser(tenantA, actorA, "2027-06-30")).map((row) => row.id), [assignmentA]);

    assert.equal((await teachingAssignmentStore.list(tenantA)).length, 1);
    assert.equal((await teachingAssignmentStore.list(tenantB)).length, 0);
    assert.equal((await teachingAssignmentStore.actor(tenantA, actorB)), false);

    const updated = { ...first, reason: "Updated", version: 2, updatedAt: new Date() };
    await teachingAssignmentStore.transaction(tenantA, async (tx) => {
      assert.equal(await tx.update(updated, 1), true);
      assert.equal(await tx.update({ ...updated, version: 3 }, 1), false);
    });

    await assert.rejects(
      teachingAssignmentStore.transaction(tenantA, async (tx) => {
        await tx.insert({ ...assignment(randomUUID(), tenantA, actorA), teacherProfileId: teacherA, subjectId: subjectA, classGroupId: groupA, academicYearId: yearA });
        throw new Error("rollback sentinel");
      }),
      /rollback sentinel/,
    );
    assert.equal((await teachingAssignmentStore.list(tenantA)).length, 1);

    let secondTransactionSawFirst = false;
    const firstLock = teachingAssignmentStore.transaction(tenantA, async (tx) => {
      await tx.lockScope(first);
      await new Promise((resolve) => setTimeout(resolve, 50));
      await tx.insert({ ...first, id: randomUUID(), version: 1, reason: "Serialized insert" });
    });
    const secondLock = teachingAssignmentStore.transaction(tenantA, async (tx) => {
      await tx.lockScope(first);
      secondTransactionSawFirst = (await tx.list()).length === 2;
    });
    await Promise.all([firstLock, secondLock]);
    assert.equal(secondTransactionSawFirst, true);

    const [events] = await connection.execute<mysql.RowDataPacket[]>("SELECT operation, from_version, to_version FROM `teaching_assignment_event` WHERE tenant_id=? AND teaching_assignment_id=?", [tenantA, assignmentA]);
    assert.deepEqual(events.map((row) => [row.operation, row.from_version, row.to_version]), [["created", 0, 1]]);
  } finally {
    await connection.execute("SET FOREIGN_KEY_CHECKS=0");
    await connection.execute("DELETE FROM `teaching_assignment_event` WHERE tenant_id IN (?,?)", [tenantA, tenantB]);
    await connection.execute("DELETE FROM `teaching_assignment` WHERE tenant_id IN (?,?)", [tenantA, tenantB]);
    await connection.execute("DELETE FROM `subject` WHERE tenant_id=?", [tenantA]);
    await connection.execute("DELETE FROM `class_group` WHERE tenant_id=?", [tenantA]);
    await connection.execute("DELETE FROM `academic_year` WHERE tenant_id=?", [tenantA]);
    await connection.execute("DELETE FROM `teacher_profile` WHERE tenant_id=?", [tenantA]);
    await connection.execute("DELETE FROM `school_person` WHERE tenant_id=?", [tenantA]);
    await connection.execute("DELETE FROM `user` WHERE id IN (?,?)", [actorA, actorB]);
    await connection.execute("DELETE FROM `tenant` WHERE id IN (?,?)", [tenantA, tenantB]);
    await connection.execute("SET FOREIGN_KEY_CHECKS=1");
    await connection.end();
  }
});
