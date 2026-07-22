"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  createClassGroupService,
  type ClassGroupEducationLevel,
} from "@/lib/class-group";
import { classGroupStore } from "@/lib/class-group-data";
import { createClassMembershipService } from "@/lib/class-membership";
import { classMembershipStore } from "@/lib/class-membership-data";
import { rombelResultPath } from "@/lib/rombel-route";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

const service = createClassGroupService({ store: classGroupStore });
const relationshipService = createClassMembershipService({
  store: classMembershipStore,
});

function finish(
  domain: string,
  result: { ok: boolean; code?: string },
  selected?: string,
) {
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
  const principal = await enforceMasterDataAccess(domain, "write");
  const result = await service.create(principal, fields(form));
  finish(domain, result, result.ok ? result.record.id : undefined);
}

export async function editClassGroupAction(domain: string, form: FormData) {
  const principal = await enforceMasterDataAccess(domain, "write");
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
  const principal = await enforceMasterDataAccess(domain, "write");
  const id = String(form.get("id"));
  const operation = String(form.get("operation"));
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
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

export async function addClassMembershipsAction(
  domain: string,
  _previous: AddClassMembershipsState,
  form: FormData,
): Promise<AddClassMembershipsState> {
  const principal = await enforceMasterDataAccess(domain, "write");
  const result = await relationshipService.addMemberships(principal, {
    studentIds: form.getAll("studentIds").map(String),
    classGroupId: String(form.get("classGroupId") ?? ""),
    effectiveDate: String(form.get("effectiveDate") ?? ""),
    reason: "Penempatan siswa ke rombel",
  });
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

export async function manageClassRelationshipAction(
  domain: string,
  form: FormData,
) {
  const principal = await enforceMasterDataAccess(domain, "write");
  const operation = String(form.get("operation"));
  const input = {
    studentId: String(form.get("studentId") ?? ""),
    teacherId: String(form.get("teacherId") ?? ""),
    classGroupId: String(form.get("classGroupId") ?? ""),
    toClassGroupId: String(form.get("toClassGroupId") ?? ""),
    effectiveDate: String(form.get("effectiveDate") ?? ""),
    reason: String(form.get("reason") ?? ""),
  };
  const result =
    operation === "bulk-membership"
      ? await relationshipService.addMemberships(principal, {
          studentIds: form.getAll("studentIds").map(String),
          classGroupId: input.classGroupId,
          effectiveDate: input.effectiveDate,
          reason: input.reason,
        })
      : operation === "transfer"
        ? await relationshipService.transfer(principal, input)
        : operation === "homeroom"
          ? await relationshipService.assignHomeroom(principal, input)
          : await relationshipService.addMembership(principal, input);
  finish(domain, result, input.toClassGroupId || input.classGroupId);
}
