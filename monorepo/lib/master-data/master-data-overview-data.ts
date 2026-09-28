import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import {
    academicYear,
    classGroup,
    classGroupHistory,
    classMembership,
    extracurricular,
    homeroomAssignment,
    inventoryAsset,
    inventoryAssetHistory,
    staffAudit,
    staffProfile,
    studentAudit,
    studentOrganization,
    studentProfile,
    subject,
    subjectHistory,
    teacherAudit,
    teacherProfile,
    user,
} from "@/db/schema";
import { buildMasterDataOverview, type OverviewState, type UnsafeOverviewActivity } from "@/lib/master-data/master-data-overview";

/**
 * Postgres data layer for the Master Data overview page (MySQL cleanup:
 * the raw mysql2 pool + hand-written SQL is replaced with Drizzle against the
 * same tables; `s.status='active'` booleans become explicit selects).
 */

export async function getMasterDataOverview(tenantId: string, domain: string) {
    const [studentRows, teacherRows, staffRows, subjectRows, classGroupRows, assetRows, organizationRows, extracurricularRows, academicYearRows] = await Promise.all([
        db
            .select({
                id: studentProfile.id,
                active: sql<boolean>`${studentProfile.status} = 'active'`,
                archived: studentProfile.archived,
                currentClassGroupId: classMembership.classGroupId,
            })
            .from(studentProfile)
            .leftJoin(
                classMembership,
                and(
                    eq(classMembership.tenantId, studentProfile.tenantId),
                    eq(classMembership.studentId, studentProfile.id),
                    isNull(classMembership.endedAt),
                    eq(classMembership.planned, false),
                ),
            )
            .where(eq(studentProfile.tenantId, tenantId)),
        db
            .select({ id: teacherProfile.id, active: sql<boolean>`${teacherProfile.status} = 'active'`, archived: teacherProfile.archived })
            .from(teacherProfile)
            .where(eq(teacherProfile.tenantId, tenantId)),
        db
            .select({ id: staffProfile.id, active: sql<boolean>`${staffProfile.status} = 'active'`, archived: staffProfile.archived })
            .from(staffProfile)
            .where(eq(staffProfile.tenantId, tenantId)),
        db
            .select({ id: subject.id, archived: subject.archived })
            .from(subject)
            .where(eq(subject.tenantId, tenantId)),
        db
            .select({
                id: classGroup.id,
                active: sql<boolean>`${classGroup.lifecycle} = 'active'`,
                archived: classGroup.archived,
                homeroomTeacherId: homeroomAssignment.teacherId,
            })
            .from(classGroup)
            .leftJoin(
                homeroomAssignment,
                and(
                    eq(homeroomAssignment.tenantId, classGroup.tenantId),
                    eq(homeroomAssignment.classGroupId, classGroup.id),
                    isNull(homeroomAssignment.endedAt),
                ),
            )
            .where(eq(classGroup.tenantId, tenantId)),
        db
            .select({ id: inventoryAsset.id, archived: inventoryAsset.archived, condition: inventoryAsset.condition })
            .from(inventoryAsset)
            .where(eq(inventoryAsset.tenantId, tenantId)),
        db
            .select({ id: studentOrganization.id, archived: studentOrganization.archived })
            .from(studentOrganization)
            .where(eq(studentOrganization.tenantId, tenantId)),
        db
            .select({ id: extracurricular.id, archived: extracurricular.archived })
            .from(extracurricular)
            .where(eq(extracurricular.tenantId, tenantId)),
        db
            .select({ id: academicYear.id, active: sql<boolean>`${academicYear.lifecycle} = 'active'`, archived: academicYear.archived })
            .from(academicYear)
            .where(eq(academicYear.tenantId, tenantId)),
    ]);

    // Recent activity across the six audit tables (student/teacher/staff audit
    // + subject/class-group/asset history), newest first, limited to 10.
    const actorUser = user;
    const [studentActivity, teacherActivity, staffActivity, subjectActivity, classGroupActivity, assetActivity] = await Promise.all([
        db
            .select({ id: studentAudit.id, entity: sql<string>`'Siswa'`, operation: studentAudit.operation, actorLabel: actorUser.name, occurredAt: studentAudit.occurredAt })
            .from(studentAudit)
            .innerJoin(actorUser, and(eq(actorUser.id, studentAudit.actorUserId), eq(actorUser.tenantId, studentAudit.tenantId)))
            .where(eq(studentAudit.tenantId, tenantId)),
        db
            .select({ id: teacherAudit.id, entity: sql<string>`'Guru'`, operation: teacherAudit.operation, actorLabel: actorUser.name, occurredAt: teacherAudit.occurredAt })
            .from(teacherAudit)
            .innerJoin(actorUser, and(eq(actorUser.id, teacherAudit.actorUserId), eq(actorUser.tenantId, teacherAudit.tenantId)))
            .where(eq(teacherAudit.tenantId, tenantId)),
        db
            .select({ id: staffAudit.id, entity: sql<string>`'Staf'`, operation: staffAudit.operation, actorLabel: actorUser.name, occurredAt: staffAudit.occurredAt })
            .from(staffAudit)
            .innerJoin(actorUser, and(eq(actorUser.id, staffAudit.actorUserId), eq(actorUser.tenantId, staffAudit.tenantId)))
            .where(eq(staffAudit.tenantId, tenantId)),
        db
            .select({ id: subjectHistory.id, entity: sql<string>`'Mata Pelajaran'`, operation: subjectHistory.operation, actorLabel: actorUser.name, occurredAt: subjectHistory.occurredAt })
            .from(subjectHistory)
            .innerJoin(actorUser, and(eq(actorUser.id, subjectHistory.actorUserId), eq(actorUser.tenantId, subjectHistory.tenantId)))
            .where(eq(subjectHistory.tenantId, tenantId)),
        db
            .select({ id: classGroupHistory.id, entity: sql<string>`'Rombongan Belajar'`, operation: classGroupHistory.operation, actorLabel: actorUser.name, occurredAt: classGroupHistory.occurredAt })
            .from(classGroupHistory)
            .innerJoin(actorUser, and(eq(actorUser.id, classGroupHistory.actorUserId), eq(actorUser.tenantId, classGroupHistory.tenantId)))
            .where(eq(classGroupHistory.tenantId, tenantId)),
        db
            .select({ id: inventoryAssetHistory.id, entity: sql<string>`'Sarana & Prasarana'`, operation: inventoryAssetHistory.operation, actorLabel: actorUser.name, occurredAt: inventoryAssetHistory.occurredAt })
            .from(inventoryAssetHistory)
            .innerJoin(actorUser, and(eq(actorUser.id, inventoryAssetHistory.actorUserId), eq(actorUser.tenantId, inventoryAssetHistory.tenantId)))
            .where(eq(inventoryAssetHistory.tenantId, tenantId)),
    ]);
    const activity = [...studentActivity, ...teacherActivity, ...staffActivity, ...subjectActivity, ...classGroupActivity, ...assetActivity]
        .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
        .slice(0, 10)
        .map((x) => ({ id: String(x.id), entity: String(x.entity), operation: String(x.operation), actorLabel: String(x.actorLabel), occurredAt: new Date(x.occurredAt) }));

    const state: OverviewState = {
        students: studentRows.map((row) => ({ ...row, archived: Boolean(row.archived), active: Boolean(row.active), currentClassGroupId: row.currentClassGroupId ?? null })),
        teachers: teacherRows.map((row) => ({ ...row, archived: Boolean(row.archived), active: Boolean(row.active) })),
        staff: staffRows.map((row) => ({ ...row, archived: Boolean(row.archived), active: Boolean(row.active) })),
        subjects: subjectRows.map((row) => ({ ...row, archived: Boolean(row.archived) })),
        classGroups: classGroupRows.map((row) => ({ ...row, archived: Boolean(row.archived), active: Boolean(row.active), homeroomTeacherId: row.homeroomTeacherId ?? null })),
        assets: assetRows.map((row) => ({ ...row, archived: Boolean(row.archived), condition: String(row.condition) })),
        organizations: organizationRows.map((row) => ({ ...row, archived: Boolean(row.archived) })),
        extracurriculars: extracurricularRows.map((row) => ({ ...row, archived: Boolean(row.archived) })),
        academicYears: academicYearRows.map((row) => ({ ...row, archived: Boolean(row.archived), active: Boolean(row.active) })),
        activities: [],
    };
    return buildMasterDataOverview(domain, state, activity as UnsafeOverviewActivity[]);
}
