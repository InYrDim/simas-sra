"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { requireProviderActionAccess } from "@/lib/provider/provider-access";
import { createSchoolAdminLifecycleDataService } from "@/lib/authorization/school-admin-lifecycle-data";
import { SecurityCommandError } from "@/lib/authorization/security-command";

export type RecoveryActionState = Readonly<{
  status: "idle" | "started" | "proof-completed" | "reactivated" | "stale" | "error";
  message?: string;
  correlationId?: string;
  caseId?: string;
  proofId?: string;
  secret?: string;
  authorityVersion?: number;
  proofVersion?: number;
}>;

const initialState: RecoveryActionState = { status: "idle" };

function errorState(error: unknown, correlationId: string): RecoveryActionState {
  if (error instanceof SecurityCommandError && error.code === "stale-version") {
    return { status: "stale", correlationId, message: "Data berubah. Muat ulang roster sebelum melanjutkan." };
  }
  return { status: "error", correlationId, message: "Recovery tidak dapat diproses. Gunakan correlation ID saat menghubungi operator." };
}

function requiredText(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function startSchoolAdminRecoveryAction(
  tenantId: string,
  authorityId: string,
  expectedAuthorityVersion: number,
  _previousState: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  const correlationId = randomUUID();
  try {
    const principal = await requireProviderActionAccess();
    const reason = requiredText(formData.get("reason"));
    if (!reason) return { status: "error", correlationId, message: "Alasan recovery wajib diisi." };
    const result = await createSchoolAdminLifecycleDataService().startSchoolAdminRecovery({
      principal: { kind: "authenticated-user", userId: principal.userId },
      tenantId,
      authorityId,
      expectedAuthorityVersion,
      reason,
      idempotencyKey: randomUUID(),
      correlationId,
    });
    revalidatePath(`/provider/tenants/${tenantId}/admins`);
    return { status: "started", correlationId, caseId: result.caseId, proofId: result.proofId, secret: result.secret, authorityVersion: expectedAuthorityVersion, proofVersion: 1, message: "Recovery case dibuat. Secret hanya ditampilkan sekali." };
  } catch (error) {
    return errorState(error, correlationId);
  }
}

export async function completeSchoolAdminRecoveryProofAction(
  tenantId: string,
  caseId: string,
  expectedProofVersion: number,
  authorityVersion: number,
  _previousState: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  const correlationId = randomUUID();
  try {
    const principal = await requireProviderActionAccess();
    const secret = requiredText(formData.get("secret"));
    if (!secret) return { status: "error", correlationId, caseId, authorityVersion, proofVersion: expectedProofVersion, message: "Secret proof wajib diisi." };
    await createSchoolAdminLifecycleDataService().completeRecoveryProof({
      principal: { kind: "authenticated-user", userId: principal.userId },
      tenantId,
      caseId,
      expectedProofVersion,
      secret,
      idempotencyKey: randomUUID(),
      correlationId,
    });
    return { status: "proof-completed", correlationId, caseId, authorityVersion, proofVersion: expectedProofVersion + 1, message: "Proof selesai. Authority belum aktif; konfirmasi reactivation secara terpisah." };
  } catch (error) {
    return errorState(error, correlationId);
  }
}

export async function reactivateSchoolAdminRecoveryAction(
  tenantId: string,
  caseId: string,
  authorityId: string,
  expectedAuthorityVersion: number,
  expectedProofVersion: number,
  previousState: RecoveryActionState,
  formData: FormData,
): Promise<RecoveryActionState> {
  void previousState;
  void formData;
  const correlationId = randomUUID();
  try {
    const principal = await requireProviderActionAccess();
    const result = await createSchoolAdminLifecycleDataService().reactivateSchoolAdminAuthority({
      principal: { kind: "authenticated-user", userId: principal.userId },
      tenantId,
      caseId,
      authorityId,
      expectedAuthorityVersion,
      expectedProofVersion,
      reason: "Reaktivasi setelah recovery proof selesai",
      idempotencyKey: randomUUID(),
      correlationId,
    });
    revalidatePath(`/provider/tenants/${tenantId}/admins`);
    return { status: "reactivated", correlationId, caseId, authorityVersion: expectedAuthorityVersion + 1, proofVersion: expectedProofVersion + 1, message: `Authority aktif kembali (${result.activeCount} School Admin aktif).` };
  } catch (error) {
    return errorState(error, correlationId);
  }
}

export { initialState };
