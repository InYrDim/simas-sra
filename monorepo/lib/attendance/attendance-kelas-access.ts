import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { schoolPerson, teacherProfile } from "@/db/schema";
import { enforceTenantOperation } from "@/lib/features/tenant-feature-route-access";
import { listEffectiveTeachingAssignmentsForUser } from "@/lib/academic/teaching-assignment-data";
import { getKelasSessionTeacherProfileId, listHomeroomClassGroupIdsForUser } from "@/lib/attendance/attendance-kelas-data";

/**
 * Access helper for the per-slot Kelas attendance page (wayfinder 04 + ticket
 * 06): Guru pengampu see only their own lessons, School Admin supervises
 * everything, homeroom teachers read their rombel. Authorization follows the
 * quiz pattern — the exact operation-map entry with a contextual
 * "assigned-or-self" policy resolved server-side.
 */

export type KelasAttendancePrincipal = {
    userId: string;
    tenantId: string;
    /** Resolved teacher profile for this account, when the account IS a teacher. */
    teacherProfileId: string | null;
    schoolAdmin: boolean;
    permissions: ReadonlySet<string>;
};

/** The account's active teacher profile id within the tenant, or null. */
export async function resolveTeacherProfileId(tenantId: string, userId: string): Promise<string | null> {
    const [row] = await db
        .select({ id: teacherProfile.id })
        .from(teacherProfile)
        .innerJoin(
            schoolPerson,
            and(eq(schoolPerson.tenantId, teacherProfile.tenantId), eq(schoolPerson.id, teacherProfile.personId)),
        )
        .where(
            and(
                eq(teacherProfile.tenantId, tenantId),
                eq(schoolPerson.accountUserId, userId),
                eq(teacherProfile.status, "active"),
                eq(teacherProfile.archived, false),
                eq(schoolPerson.archived, false),
            ),
        )
        .limit(1);
    return row?.id ?? null;
}

/**
 * Authorizes the Absensi Kelas page (and any session list load). Non-admins
 * pass only when they hold a current teaching assignment ("assigned" arm),
 * are the person themselves ("self" arm), or are a current homeroom teacher
 * (read-only supervision of their rombel, wayfinder 04). Returns the
 * principal plus the teacher profile id used to scope the per-Guru view.
 */
export async function enforceKelasAttendancePageAccess(
    domain: string,
    operationId: string,
): Promise<KelasAttendancePrincipal> {
    const principal = await enforceTenantOperation(domain, operationId, undefined, {
        policy: "assigned-or-self",
        async evaluate(current) {
            if (current.schoolAdmin) return { allowed: true, arm: "assigned" as const };
            const assignments = await listEffectiveTeachingAssignmentsForUser(
                current.tenantId,
                current.userId,
                new Date().toISOString().slice(0, 10),
            );
            if (assignments.length > 0) return { allowed: true, arm: "assigned" as const };
            if (current.selfPersonId) return { allowed: true, arm: "self" as const };
            // Homeroom fallback: current homeroom teachers keep read access to
            // their rombel's sessions even without a teaching assignment.
            const homeroom = await listHomeroomClassGroupIdsForUser(current.tenantId, current.userId);
            return { allowed: homeroom.size > 0, arm: "self" as const };
        },
    });

    const teacherProfileId = await resolveTeacherProfileId(principal.tenantId, principal.userId);
    return {
        userId: principal.userId,
        tenantId: principal.tenantId,
        teacherProfileId,
        schoolAdmin: principal.schoolAdmin,
        permissions: principal.permissions,
    };
}

/**
 * Builds a `KelasAttendancePrincipal` from an already-authorized operation
 * principal (action path) — resolves the teacher profile for row guards.
 */
export async function buildKelasPrincipal(
    tenantId: string,
    userId: string,
    schoolAdmin: boolean,
): Promise<KelasAttendancePrincipal> {
    return {
        userId,
        tenantId,
        teacherProfileId: await resolveTeacherProfileId(tenantId, userId),
        schoolAdmin,
        permissions: new Set<string>(),
    };
}

/**
 * Row-level write guard shared by every mutating Kelas action: the operator
 * must be the School Admin OR the lesson's pengampu (the session's slot must
 * belong to one of their effective teaching assignments). Fails closed.
 */
export async function assertKelasSessionWriteAccess(
    principal: KelasAttendancePrincipal,
    sessionId: string,
): Promise<boolean> {
    if (principal.schoolAdmin) return true;

    const ownerProfileId = await getKelasSessionTeacherProfileId(principal.tenantId, sessionId);
    return Boolean(ownerProfileId && principal.teacherProfileId && ownerProfileId === principal.teacherProfileId);
}
