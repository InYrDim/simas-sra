import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test, { after } from "node:test";
import mysql from "mysql2/promise";
import { closeDatabasePool } from "@/db";
import { recordAttendance, resolveStudentIdentity, openSession, closeSession, resolveOpenSession, listGerbangRecordsBySession } from "@/lib/attendance/attendance-record-write";
import { civilDateInZone, zonedWallClockToUtc } from "@/lib/attendance/attendance-date";

const databaseUrl = process.env.DATABASE_URL;
const mysqlTest = databaseUrl ? test : test.skip;
after(() => closeDatabasePool());

async function seedTenant(connection: mysql.Connection, ids: { tenant: string; owner: string; student: string; person: string; npsn: string; application: string; binding: string; provider: string }) {
    await connection.execute(
        "INSERT INTO `user` (`id`,`name`,`email`,`email_verified`,`created_at`,`updated_at`) VALUES (?, 'Operator', ?, false, NOW(3), NOW(3)), (?, 'Provider', ?, false, NOW(3), NOW(3))",
        [ids.owner, `${ids.owner}@test.invalid`, ids.provider, `${ids.provider}@test.invalid`],
    );
    await connection.execute(
        "INSERT INTO `provider_admin` (`user_id`,`created_at`) VALUES (?, NOW(3))",
        [ids.provider],
    );
    await connection.execute(
        "INSERT INTO `applicant_school_binding` (`id`,`user_id`,`canonical_npsn`,`created_at`) VALUES (?, ?, ?, NOW(3))",
        [ids.binding, ids.owner, ids.npsn],
    );
    await connection.execute(
        "INSERT INTO `simas_application` (`id`,`school_name`,`npsn`,`education_level`,`address`,`contact_name`,`contact_position`,`contact_email`,`contact_whatsapp`,`status`,`submitted_at`,`owner_user_id`,`binding_id`,`attempt_number`,`idempotency_key`,`payload_hash`) VALUES (?, 'Sekolah Uji', ?, 'SMA', 'Alamat', 'Kontak', 'Operator', ?, '0812', 'pending', NOW(3), ?, ?, 1, ?, REPEAT('a',64))",
        [ids.application, ids.npsn, `${ids.application}@test.invalid`, ids.owner, ids.binding, randomUUID()],
    );
    await connection.execute(
        "INSERT INTO `tenant` (`id`,`name`,`domain`,`npsn`,`source_application_id`,`approved_at`,`operational_status`,`created_at`,`updated_at`) VALUES (?, 'Sekolah Uji', ?, ?, ?, NOW(3), 'active', NOW(3), NOW(3))",
        [ids.tenant, `absensi-${randomUUID()}`, ids.npsn, ids.application],
    );
    await connection.execute(
        "UPDATE `simas_application` SET `status`='approved',`decided_at`=NOW(3),`decided_by_provider_admin_id`=?,`approved_tenant_id`=? WHERE `id`=?",
        [ids.provider, ids.tenant, ids.application],
    );
    await connection.execute(
        "INSERT INTO `school_person` (`id`,`tenant_id`,`full_name`,`normalized_name`,`birth_place`,`normalized_birth_place`,`birth_date`,`gender`,`street`,`created_at`,`updated_at`) VALUES (?, ?, 'Siswa Uji', 'siswa uji', 'Palu', 'palu', '2012-01-01', 'female', 'Jalan Melati', NOW(3), NOW(3))",
        [ids.person, ids.tenant],
    );
    await connection.execute(
        "INSERT INTO `student_profile` (`id`,`tenant_id`,`person_id`,`nis`,`normalized_nis`,`entry_date`,`status`,`archived`,`version`,`created_at`,`updated_at`) VALUES (?, ?, ?, '12345', '12345', '2026-07-01', 'active', false, 1, NOW(3), NOW(3))",
        [ids.student, ids.tenant, ids.person],
    );
    await connection.execute(
        "UPDATE `user` SET `tenant_id`=?,`tenant_role`='school-admin' WHERE `id`=?",
        [ids.tenant, ids.owner],
    );
}

async function cleanup(connection: mysql.Connection, ids: { tenant: string; owner: string; student: string; person: string; application: string; binding: string; provider: string }) {
    await connection.execute("SET FOREIGN_KEY_CHECKS=0");
    await connection.execute("DELETE FROM `attendance_record` WHERE tenant_id=?", [ids.tenant]);
    await connection.execute("DELETE FROM `attendance_session` WHERE tenant_id=?", [ids.tenant]);
    await connection.execute("DELETE FROM `student_profile` WHERE tenant_id=?", [ids.tenant]);
    await connection.execute("DELETE FROM `school_person` WHERE tenant_id=?", [ids.tenant]);
    await connection.execute("DELETE FROM `tenant` WHERE id=?", [ids.tenant]);
    await connection.execute("DELETE FROM `simas_application` WHERE id=?", [ids.application]);
    await connection.execute("DELETE FROM `applicant_school_binding` WHERE id=?", [ids.binding]);
    await connection.execute("DELETE FROM `provider_admin` WHERE user_id=?", [ids.provider]);
    await connection.execute("DELETE FROM `user` WHERE id IN (?,?)", [ids.owner, ids.provider]);
    await connection.execute("SET FOREIGN_KEY_CHECKS=1");
}

mysqlTest("recordAttendance writes a gerbang record and resolves student by id", async () => {
    const connection = await mysql.createConnection(databaseUrl!);
    const ids = {
        tenant: randomUUID(),
        owner: randomUUID(),
        student: randomUUID(),
        person: randomUUID(),
        application: randomUUID(),
        binding: randomUUID(),
        provider: randomUUID(),
        npsn: String(Math.floor(10_000_000 + Math.random() * 90_000_000)),
    };
    try {
        await seedTenant(connection, ids);

        const resolved = await resolveStudentIdentity(ids.tenant, ids.student);
        assert.equal(resolved?.studentId, ids.student);

        const result = await recordAttendance({
            tenantId: ids.tenant,
            studentId: ids.student,
            layer: "gerbang",
            mode: "manual",
            status: "masuk",
            actorUserId: ids.owner,
        });
        assert.equal(result.ok, true);
        if (!result.ok) return;

        const [rows] = await connection.execute(
            "SELECT `layer`,`mode`,`status`,`student_id`,`recorded_by_user_id` FROM `attendance_record` WHERE `id`=?",
            [result.id],
        );
        const row = (rows as unknown[])[0] as Record<string, string>;
        assert.equal(row.layer, "gerbang");
        assert.equal(row.mode, "manual");
        assert.equal(row.status, "masuk");
        assert.equal(row.student_id, ids.student);
        assert.equal(row.recorded_by_user_id, ids.owner);
    } finally {
        await cleanup(connection, ids);
        await connection.end();
    }
});

mysqlTest("recordAttendance rejects student from another tenant (isolation)", async () => {
    const connection = await mysql.createConnection(databaseUrl!);
    const tenantA = {
        tenant: randomUUID(),
        owner: randomUUID(),
        student: randomUUID(),
        person: randomUUID(),
        application: randomUUID(),
        binding: randomUUID(),
        provider: randomUUID(),
        npsn: String(Math.floor(10_000_000 + Math.random() * 90_000_000)),
    };
    const tenantB = {
        tenant: randomUUID(),
        owner: randomUUID(),
        student: randomUUID(),
        person: randomUUID(),
        application: randomUUID(),
        binding: randomUUID(),
        provider: randomUUID(),
        npsn: String(Math.floor(10_000_000 + Math.random() * 90_000_000)),
    };
    try {
        await seedTenant(connection, tenantA);
        await seedTenant(connection, tenantB);

        // Student id from tenantB must not resolve inside tenantA.
        const resolved = await resolveStudentIdentity(tenantA.tenant, tenantB.student);
        assert.equal(resolved, null);

        const result = await recordAttendance({
            tenantId: tenantA.tenant,
            studentId: tenantB.student,
            layer: "gerbang",
            mode: "manual",
            status: "masuk",
            actorUserId: tenantA.owner,
        });
        assert.equal(result.ok, false);
        if (result.ok) return;
        assert.equal(result.code, "student-not-found");
    } finally {
        await cleanup(connection, tenantA);
        await cleanup(connection, tenantB);
        await connection.end();
    }
});

mysqlTest("recordAttendance rejects invalid status for layer", async () => {
    const connection = await mysql.createConnection(databaseUrl!);
    const ids = {
        tenant: randomUUID(),
        owner: randomUUID(),
        student: randomUUID(),
        person: randomUUID(),
        application: randomUUID(),
        binding: randomUUID(),
        provider: randomUUID(),
        npsn: String(Math.floor(10_000_000 + Math.random() * 90_000_000)),
    };
    try {
        await seedTenant(connection, ids);
        const result = await recordAttendance({
            tenantId: ids.tenant,
            studentId: ids.student,
            layer: "gerbang",
            mode: "manual",
            status: "hadir",
            actorUserId: ids.owner,
        });
        assert.equal(result.ok, false);
        if (result.ok) return;
        assert.equal(result.code, "invalid-status");
    } finally {
        await cleanup(connection, ids);
        await connection.end();
    }
});

mysqlTest("openSession creates an open session and rejects a second open on the same day", async () => {
    const connection = await mysql.createConnection(databaseUrl!);
    const ids = {
        tenant: randomUUID(),
        owner: randomUUID(),
        student: randomUUID(),
        person: randomUUID(),
        application: randomUUID(),
        binding: randomUUID(),
        provider: randomUUID(),
        npsn: String(Math.floor(10_000_000 + Math.random() * 90_000_000)),
    };
    try {
        await seedTenant(connection, ids);

        const first = await openSession({
            tenantId: ids.tenant,
            layer: "gerbang",
            openedByUserId: ids.owner,
            plannedStart: "06:30",
            plannedEnd: "07:30",
        });
        assert.equal(first.ok, true);
        if (!first.ok) return;

        const second = await openSession({
            tenantId: ids.tenant,
            layer: "gerbang",
            openedByUserId: ids.owner,
            plannedStart: "06:30",
            plannedEnd: "07:30",
        });
        assert.equal(second.ok, false);
        if (second.ok) return;
        assert.equal(second.code, "already-open");

        const resolved = await resolveOpenSession(ids.tenant, "gerbang");
        assert.equal(resolved?.id, first.id);
        assert.ok(resolved?.plannedStart.startsWith("06:30"));
        assert.ok(resolved?.plannedEnd.startsWith("07:30"));
    } finally {
        await cleanup(connection, ids);
        await connection.end();
    }
});

mysqlTest("openSession rejects invalid window (end <= start)", async () => {
    const connection = await mysql.createConnection(databaseUrl!);
    const ids = {
        tenant: randomUUID(),
        owner: randomUUID(),
        student: randomUUID(),
        person: randomUUID(),
        application: randomUUID(),
        binding: randomUUID(),
        provider: randomUUID(),
        npsn: String(Math.floor(10_000_000 + Math.random() * 90_000_000)),
    };
    try {
        await seedTenant(connection, ids);
        const result = await openSession({
            tenantId: ids.tenant,
            layer: "gerbang",
            openedByUserId: ids.owner,
            plannedStart: "07:30",
            plannedEnd: "07:30",
        });
        assert.equal(result.ok, false);
        if (result.ok) return;
        assert.equal(result.code, "invalid-window");
    } finally {
        await cleanup(connection, ids);
        await connection.end();
    }
});

mysqlTest("closeSession flips status and resolveOpenSession returns null afterwards", async () => {
    const connection = await mysql.createConnection(databaseUrl!);
    const ids = {
        tenant: randomUUID(),
        owner: randomUUID(),
        student: randomUUID(),
        person: randomUUID(),
        application: randomUUID(),
        binding: randomUUID(),
        provider: randomUUID(),
        npsn: String(Math.floor(10_000_000 + Math.random() * 90_000_000)),
    };
    try {
        await seedTenant(connection, ids);
        const opened = await openSession({
            tenantId: ids.tenant,
            layer: "gerbang",
            openedByUserId: ids.owner,
            plannedStart: "06:30",
            plannedEnd: "07:30",
        });
        assert.equal(opened.ok, true);
        if (!opened.ok) return;

        const closed = await closeSession(ids.tenant, opened.id);
        assert.equal(closed.ok, true);

        const resolved = await resolveOpenSession(ids.tenant, "gerbang");
        assert.equal(resolved, null);

        const [rows] = await connection.execute(
            "SELECT `status`,`closed_at` FROM `attendance_session` WHERE `id`=?",
            [opened.id],
        );
        const row = (rows as unknown[])[0] as Record<string, string | null>;
        assert.equal(row.status, "closed");
        assert.ok(row.closed_at !== null);
    } finally {
        await cleanup(connection, ids);
        await connection.end();
    }
});

mysqlTest("recordAttendance inside an open window links session and clears outOfSession", async () => {
    const connection = await mysql.createConnection(databaseUrl!);
    const ids = {
        tenant: randomUUID(),
        owner: randomUUID(),
        student: randomUUID(),
        person: randomUUID(),
        application: randomUUID(),
        binding: randomUUID(),
        provider: randomUUID(),
        npsn: String(Math.floor(10_000_000 + Math.random() * 90_000_000)),
    };
    try {
        await seedTenant(connection, ids);
        const opened = await openSession({
            tenantId: ids.tenant,
            layer: "gerbang",
            openedByUserId: ids.owner,
            plannedStart: "06:30",
            plannedEnd: "07:30",
        });
        assert.equal(opened.ok, true);
        if (!opened.ok) return;

        // Record at 06:45 WIB (inside the 06:30–07:30 window) on the session's
        // civil date, so resolveOpenSession finds the same day's session.
        const day = civilDateInZone(new Date(), "Asia/Jakarta");
        const [y, m, d] = day.split("-").map(Number);
        const recordedAt = zonedWallClockToUtc(new Date(Date.UTC(y, m - 1, d, 6, 45, 0)), "Asia/Jakarta");
        const result = await recordAttendance({
            tenantId: ids.tenant,
            studentId: ids.student,
            layer: "gerbang",
            mode: "manual",
            status: "masuk",
            actorUserId: ids.owner,
            timezone: "Asia/Jakarta",
            recordedAt,
        });
        assert.equal(result.ok, true);
        if (!result.ok) return;

        const [rows] = await connection.execute(
            "SELECT `session_id`,`out_of_session` FROM `attendance_record` WHERE `id`=?",
            [result.id],
        );
        const row = (rows as unknown[])[0] as Record<string, string | number>;
        assert.equal(row.session_id, opened.id);
        assert.equal(row.out_of_session, 0);

        const bySession = await listGerbangRecordsBySession(ids.tenant, opened.id);
        assert.equal(bySession.length, 1);
        assert.equal(bySession[0].id, result.id);
    } finally {
        await cleanup(connection, ids);
        await connection.end();
    }
});

mysqlTest("recordAttendance outside an open window marks outOfSession and leaves session null", async () => {
    const connection = await mysql.createConnection(databaseUrl!);
    const ids = {
        tenant: randomUUID(),
        owner: randomUUID(),
        student: randomUUID(),
        person: randomUUID(),
        application: randomUUID(),
        binding: randomUUID(),
        provider: randomUUID(),
        npsn: String(Math.floor(10_000_000 + Math.random() * 90_000_000)),
    };
    try {
        await seedTenant(connection, ids);
        const opened = await openSession({
            tenantId: ids.tenant,
            layer: "gerbang",
            openedByUserId: ids.owner,
            plannedStart: "06:30",
            plannedEnd: "07:30",
        });
        assert.equal(opened.ok, true);
        if (!opened.ok) return;

        // Record at 09:00 UTC (outside the window).
        const recordedAt = new Date();
        recordedAt.setUTCHours(9, 0, 0, 0);
        const result = await recordAttendance({
            tenantId: ids.tenant,
            studentId: ids.student,
            layer: "gerbang",
            mode: "manual",
            status: "masuk",
            actorUserId: ids.owner,
            recordedAt,
        });
        assert.equal(result.ok, true);
        if (!result.ok) return;

        const [rows] = await connection.execute(
            "SELECT `session_id`,`out_of_session` FROM `attendance_record` WHERE `id`=?",
            [result.id],
        );
        const row = (rows as unknown[])[0] as Record<string, string | number>;
        assert.equal(row.session_id, null);
        assert.equal(row.out_of_session, 1);
    } finally {
        await cleanup(connection, ids);
        await connection.end();
    }
});

mysqlTest("recordAttendance without any open session marks outOfSession", async () => {
    const connection = await mysql.createConnection(databaseUrl!);
    const ids = {
        tenant: randomUUID(),
        owner: randomUUID(),
        student: randomUUID(),
        person: randomUUID(),
        application: randomUUID(),
        binding: randomUUID(),
        provider: randomUUID(),
        npsn: String(Math.floor(10_000_000 + Math.random() * 90_000_000)),
    };
    try {
        await seedTenant(connection, ids);
        const result = await recordAttendance({
            tenantId: ids.tenant,
            studentId: ids.student,
            layer: "gerbang",
            mode: "manual",
            status: "masuk",
            actorUserId: ids.owner,
        });
        assert.equal(result.ok, true);
        if (!result.ok) return;

        const [rows] = await connection.execute(
            "SELECT `session_id`,`out_of_session` FROM `attendance_record` WHERE `id`=?",
            [result.id],
        );
        const row = (rows as unknown[])[0] as Record<string, string | number>;
        assert.equal(row.session_id, null);
        assert.equal(row.out_of_session, 1);
    } finally {
        await cleanup(connection, ids);
        await connection.end();
    }
});
