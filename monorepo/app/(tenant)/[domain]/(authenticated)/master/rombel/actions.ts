"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createClassGroupService,
  type ClassGroupEducationLevel,
} from "@/lib/academic/class-group";
import { classGroupStore } from "@/lib/academic/class-group-data";
import { createClassMembershipService } from "@/lib/academic/class-membership";
import { classMembershipStore } from "@/lib/academic/class-membership-data";
import { commitAuthorizedAcademicPreview, createAuthorizedAcademicPreview } from "@/lib/academic/academic-preview-server";
import { rombelResultPath } from "@/lib/academic/rombel-route";
import { enforceAcademicAccess } from "@/lib/master-data/tenant-master-data-route-access";

const service = createClassGroupService({ store: classGroupStore });
const relationshipService = createClassMembershipService({
  store: classMembershipStore,
});

function finish(
  domain: string,
  result: { ok: boolean; code?: string },
  selected?: string,
): never {
  revalidatePath(`/${domain}/master/rombel`);
  redirect(rombelResultPath(domain, result, selected));
}

function fields(form: FormData) {
  const value = (name: string) => String(form.get(name) ?? "");
  return {
    academicYearId: value("academicYearId"),
    educationLevel: value("educationLevel") as ClassGroupEducationLevel,
    grade: Number(value("grade")),
    groupName: value("groupName"),
    code: value("code") || null,
    capacity: value("capacity") ? Number(value("capacity")) : null,
    primaryLocationId: value("primaryLocationId") || null,
  };
}

export async function createClassGroupAction(domain: string, form: FormData) {
  const principal = await enforceAcademicAccess(domain, "class-groups.create");
  const result = await service.create(principal, fields(form));
  finish(domain, result, result.ok ? result.record.id : undefined);
}

export async function editClassGroupAction(domain: string, form: FormData) {
  const principal = await enforceAcademicAccess(domain, "class-groups.update");
  const id = String(form.get("id"));
  finish(
    domain,
    await service.edit(
      principal,
      id,
      fields(form),
      Number(form.get("expectedVersion")),
    ),
    id,
  );
}

export async function manageClassGroupAction(domain: string, form: FormData) {
  const operation = String(form.get("operation"));
  if (!["archive", "reactivate", "activate", "close", "cancel"].includes(operation)) finish(domain, { ok: false, code: "invalid-input" }, String(form.get("id") ?? ""));
  const principal = await enforceAcademicAccess(domain, "class-groups.lifecycle", [operation === "archive" ? "class-groups.groups.archive" : operation === "reactivate" ? "class-groups.groups.restore" : "class-groups.groups.manage-lifecycle"]);
  const id = String(form.get("id"));
  const input = {
    expectedVersion: Number(form.get("expectedVersion")),
    reason: String(form.get("reason") ?? ""),
  };
  const result =
    operation === "archive"
      ? await service.archive(principal, id, input)
      : operation === "reactivate"
        ? await service.reactivate(principal, id, input)
        : await service.transition(
            principal,
            id,
            operation as "activate" | "close" | "cancel",
            input,
          );
  finish(domain, result, id);
}

export type AddClassMembershipsState =
  | { status: "idle" }
  | { status: "preview"; message: string; token: string; idempotencyKey: string; intent: { studentIds: string[]; classGroupId: string; effectiveDate: string; reason: string } }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

export async function addClassMembershipsAction(
  domain: string,
  previous: AddClassMembershipsState,
  form: FormData,
): Promise<AddClassMembershipsState> {
  const operationId = "class-groups.memberships.assign";
  const principal = await enforceAcademicAccess(domain, operationId);
  const intent = previous.status === "preview" ? previous.intent : {
    studentIds: [...new Set(form.getAll("studentIds").map(String))].sort(),
    classGroupId: String(form.get("classGroupId") ?? ""),
    effectiveDate: String(form.get("effectiveDate") ?? ""),
    reason: "Penempatan siswa ke rombel",
  };
  if (previous.status !== "preview") {
    if (intent.studentIds.length === 0 || intent.studentIds.length > 100 || !/^\d{4}-\d{2}-\d{2}$/.test(intent.effectiveDate)) {
      return { status: "error", message: "Pilih 1 sampai 100 siswa dan tanggal efektif yang valid." };
    }
    const [references, memberships] = await Promise.all([relationshipService.references(principal), relationshipService.listMemberships(principal)]);
    const group = references.groups.find((candidate) => candidate.id === intent.classGroupId && candidate.tenantId === principal.tenantId && !candidate.archived && ["draft", "active"].includes(candidate.lifecycle));
    const students = new Set(references.students.filter((student) => student.tenantId === principal.tenantId && student.active && !student.archived).map((student) => student.id));
    const occupied = memberships.some((membership) => intent.studentIds.includes(membership.studentId) && membership.startedAt <= intent.effectiveDate && (membership.endedAt === null || intent.effectiveDate < membership.endedAt));
    if (!group || intent.studentIds.some((studentId) => !students.has(studentId)) || occupied) {
      return { status: "error", message: "Pratinjau tidak dapat dibuat karena salah satu target tidak lagi valid." };
    }
    const preview = await createAuthorizedAcademicPreview({ domain, operationId, payload: intent });
    if (!preview.ok) return { status: "error", message: "Pratinjau tidak dapat dibuat. Coba lagi." };
    return { status: "preview", message: `Tinjau penambahan ${intent.studentIds.length} siswa sebelum menyimpan.`, token: preview.token, idempotencyKey: crypto.randomUUID(), intent };
  }
  const committed = await commitAuthorizedAcademicPreview({
    domain,
    operationId,
    token: previous.token,
    idempotencyKey: previous.idempotencyKey,
    payload: intent,
    mutate: () => relationshipService.addMemberships(principal, intent),
  });
  if (!committed.ok) return { status: "error", message: "Pratinjau tidak lagi berlaku. Muat ulang data dan tinjau kembali sebelum melanjutkan." };
  const result = committed.outcome as Awaited<ReturnType<typeof relationshipService.addMemberships>>;
  if (!result.ok) {
    const messages: Record<string, string> = {
      "invalid-input": "Pilih siswa dan tanggal efektif.",
      "invalid-student": "Pilihan memuat siswa yang tidak aktif atau tidak valid.",
      "invalid-class-group": "Rombel tidak valid atau tidak dapat menerima siswa.",
      "active-membership-exists": "Salah satu siswa sudah memiliki rombel aktif dan harus ditransfer.",
      "planned-membership-exists": "Salah satu siswa sudah memiliki rombel draft.",
    };
    return {
      status: "error",
      message: messages[result.code] ?? `Siswa gagal ditambahkan: ${result.code}.`,
    };
  }
  revalidatePath(`/${domain}/master/rombel`);
  return {
    status: "saved",
    message: `${result.records.length} siswa berhasil ditambahkan ke rombel.`,
  };
}

type RelationshipIntent = { operation: string; studentId: string; teacherId: string; classGroupId: string; toClassGroupId: string; effectiveDate: string; reason: string };
export type ManageClassRelationshipState =
  | { status: "idle" }
  | { status: "preview"; message: string; token: string; idempotencyKey: string; operationId: string; requestedPermission: string; intent: RelationshipIntent }
  | { status: "error"; message: string };

export async function manageClassRelationshipAction(
  domain: string,
  previous: ManageClassRelationshipState,
  form: FormData,
): Promise<ManageClassRelationshipState> {
  const operation = previous.status === "preview" ? previous.intent.operation : String(form.get("operation"));
  if (!["bulk-membership", "transfer", "homeroom", "membership"].includes(operation)) finish(domain, { ok: false, code: "invalid-input" }, String(form.get("toClassGroupId") ?? form.get("classGroupId") ?? ""));
  const operationId = operation === "transfer" || operation === "homeroom" ? "class-groups.relationships.manage" : "class-groups.memberships.assign";
  const requestedPermission = operation === "transfer" ? "class-groups.memberships.transfer" : operation === "homeroom" ? "class-groups.homerooms.assign" : "class-groups.memberships.assign";
  const principal = await enforceAcademicAccess(domain, operationId, [requestedPermission]);
  const input: RelationshipIntent = previous.status === "preview" ? previous.intent : {
    operation,
    studentId: String(form.get("studentId") ?? ""),
    teacherId: String(form.get("teacherId") ?? ""),
    classGroupId: String(form.get("classGroupId") ?? ""),
    toClassGroupId: String(form.get("toClassGroupId") ?? ""),
    effectiveDate: String(form.get("effectiveDate") ?? ""),
    reason: String(form.get("reason") ?? ""),
  };
  if (previous.status !== "preview") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveDate) || !input.reason.trim()) return { status: "error", message: "Tanggal efektif dan alasan wajib diisi." };
    const [references, memberships, homerooms] = await Promise.all([relationshipService.references(principal), relationshipService.listMemberships(principal), relationshipService.listHomerooms(principal)]);
    const groupId = operation === "transfer" ? input.toClassGroupId : input.classGroupId;
    const group = references.groups.find((candidate) => candidate.id === groupId && candidate.tenantId === principal.tenantId && !candidate.archived && ["draft", "active"].includes(candidate.lifecycle));
    const effective = <T extends { startedAt: string; endedAt: string | null }>(relationship: T) => relationship.startedAt <= input.effectiveDate && (relationship.endedAt === null || input.effectiveDate < relationship.endedAt);
    const validTransfer = operation !== "transfer" || Boolean(group && references.students.some((student) => student.id === input.studentId && student.tenantId === principal.tenantId && student.active && !student.archived) && memberships.some((membership) => membership.studentId === input.studentId && membership.academicYearId === group.academicYearId && membership.classGroupId !== group.id && effective(membership)));
    const validHomeroom = operation !== "homeroom" || Boolean(group && references.teachers.some((teacher) => teacher.id === input.teacherId && teacher.tenantId === principal.tenantId && teacher.active && !teacher.archived) && !homerooms.some((assignment) => assignment.teacherId === input.teacherId && assignment.academicYearId === group.academicYearId && assignment.classGroupId !== group.id && effective(assignment)));
    if (!group || !validTransfer || !validHomeroom) return { status: "error", message: "Pratinjau tidak dapat dibuat karena relasi akademik tidak lagi valid." };
    const preview = await createAuthorizedAcademicPreview({ domain, operationId, requestedPermissions: [requestedPermission], payload: input });
    if (!preview.ok) return { status: "error", message: "Pratinjau tidak dapat dibuat. Coba lagi." };
    return { status: "preview", message: operation === "transfer" ? "Tinjau transfer siswa sebelum menyimpan." : "Tinjau perubahan Wali Kelas sebelum menyimpan.", token: preview.token, idempotencyKey: crypto.randomUUID(), operationId, requestedPermission, intent: input };
  }
  const committed = await commitAuthorizedAcademicPreview({ domain, operationId: previous.operationId, requestedPermissions: [previous.requestedPermission], token: previous.token, idempotencyKey: previous.idempotencyKey, payload: input, mutate: async () => operation === "transfer" ? relationshipService.transfer(principal, input) : operation === "homeroom" ? relationshipService.assignHomeroom(principal, input) : relationshipService.addMembership(principal, input) });
  if (!committed.ok) return { status: "error", message: "Pratinjau tidak lagi berlaku. Muat ulang data dan tinjau kembali sebelum melanjutkan." };
  const result = committed.outcome as { ok: boolean; code?: string };
  finish(domain, result, input.toClassGroupId || input.classGroupId);
}
