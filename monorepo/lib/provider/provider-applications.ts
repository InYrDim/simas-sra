export type ApplicationStatus = "pending" | "approved" | "rejected";

export type ProviderDecisionPrincipal = Readonly<{
  userId: string;
}>;

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending: "Menunggu peninjauan",
  approved: "Disetujui",
  rejected: "Ditolak",
};

export type LockedApplicationDecision = Readonly<{
  id: string;
  status: ApplicationStatus;
  decidedByProviderAdminId?: string | null;
  rejectionReason?: string | null;
}>;

export type RejectionDecision = Readonly<{
  applicationId: string;
  providerAdminId: string;
  reason: string;
  decidedAt: Date;
}>;

export type ApplicationDecisionTransaction = Readonly<{
  lock(applicationId: string): Promise<LockedApplicationDecision | null>;
  reject(decision: RejectionDecision): Promise<boolean>;
}>;

export type ApplicationDecisionStore = Readonly<{
  transaction<T>(work: (tx: ApplicationDecisionTransaction) => Promise<T>): Promise<T>;
}>;

export type LockedApplicationApproval = Readonly<{
  id: string;
  status: ApplicationStatus;
  schoolName: string;
  canonicalNpsn: string;
  bindingId: string;
  ownerUserId: string;
  approvedTenantId: string | null;
  approvedDomain: string | null;
}>;

export type ApprovalConflictField = "npsn" | "subdomain" | "concurrent";

export type ApprovalProvision = Readonly<{
  applicationId: string;
  bindingId: string;
  ownerUserId: string;
  providerAdminId: string;
  tenant: Readonly<{ id: string; name: string; npsn: string; subdomain: string }>;
  outboxEventId: string;
  decidedAt: Date;
}>;

export type ApplicationApprovalTransaction = Readonly<{
  lock(applicationId: string): Promise<LockedApplicationApproval | null>;
  findConflict(input: Readonly<{ npsn: string; subdomain: string }>): Promise<ApprovalConflictField | null>;
  provision(values: ApprovalProvision): Promise<void>;
}>;

export type ApplicationApprovalStore = Readonly<{
  transaction<T>(work: (tx: ApplicationApprovalTransaction) => Promise<T>): Promise<T>;
}>;

export class ApprovalConflictError extends Error {
  constructor(readonly field: ApprovalConflictField) {
    super(`Approval conflict: ${field}`);
    this.name = "ApprovalConflictError";
  }
}

export type ApproveSimasApplicationResult =
  | { ok: true; status: "approved"; tenantId: string }
  | { ok: true; status: "already-approved"; tenantId: string }
  | { ok: false; code: "not-found" }
  | { ok: false; code: "decision-conflict"; status: "approved" | "rejected" }
  | { ok: false; code: "resource-conflict"; field: ApprovalConflictField }
  | { ok: false; code: "invalid-input"; errors: { applicationId?: string; subdomain?: string } };

export type RejectSimasApplicationResult =
  | { ok: true; status: "rejected" | "already-rejected" }
  | { ok: false; code: "not-found" }
  | { ok: false; code: "decision-conflict"; status: "approved" | "rejected" }
  | {
      ok: false;
      code: "invalid-input";
      errors: { applicationId?: string; reason?: string };
    };

type RejectCommandDependencies = Readonly<{
  authorize(): Promise<ProviderDecisionPrincipal>;
  store: ApplicationDecisionStore;
  now?: () => Date;
}>;

type RejectInput = Readonly<{
  applicationId?: unknown;
  reason?: unknown;
}>;

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function normalizedSubdomain(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function suggestSubdomain(schoolName: string): string {
  return schoolName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63)
    .replace(/-+$/g, "");
}

type ApproveCommandDependencies = Readonly<{
  authorize(): Promise<ProviderDecisionPrincipal>;
  store: ApplicationApprovalStore;
  generateId?: () => string;
  now?: () => Date;
}>;

type ApproveInput = Readonly<{ applicationId?: unknown; subdomain?: unknown }>;

export function createApproveSimasApplicationCommand({
  authorize,
  store,
  generateId,
  now = () => new Date(),
}: ApproveCommandDependencies) {
  return async function approveSimasApplication(
    input: ApproveInput,
  ): Promise<ApproveSimasApplicationResult> {
    const principal = await authorize();
    const applicationId = normalizedText(input.applicationId);
    const subdomain = normalizedSubdomain(input.subdomain);
    const errors: { applicationId?: string; subdomain?: string } = {};

    if (!applicationId) errors.applicationId = "Pengajuan SIMAS tidak valid.";
    if (!subdomain) {
      errors.subdomain = "Subdomain wajib diisi.";
    } else if (subdomain.length > 63) {
      errors.subdomain = "Subdomain maksimal 63 karakter.";
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subdomain)) {
      errors.subdomain = "Subdomain hanya boleh berisi huruf kecil, angka, dan tanda hubung.";
    }
    if (Object.keys(errors).length > 0) {
      return { ok: false, code: "invalid-input", errors };
    }

    const { randomUUID } = await import("node:crypto");
    const nextId = generateId ?? randomUUID;
    const tenantId = nextId();
    const outboxEventId = nextId();

    try {
      return await store.transaction(async (tx) => {
        const application = await tx.lock(applicationId);
        if (!application) return { ok: false, code: "not-found" } as const;
        if (application.status === "approved" && application.approvedTenantId) {
          if (application.approvedDomain !== subdomain) {
            return { ok: false, code: "decision-conflict", status: "approved" } as const;
          }
          return {
            ok: true,
            status: "already-approved",
            tenantId: application.approvedTenantId,
          } as const;
        }
        if (application.status === "rejected") {
          return { ok: false, code: "decision-conflict", status: "rejected" } as const;
        }

        const conflict = await tx.findConflict({
          npsn: application.canonicalNpsn,
          subdomain,
        });
        if (conflict) throw new ApprovalConflictError(conflict);

        await tx.provision({
          applicationId,
          bindingId: application.bindingId,
          ownerUserId: application.ownerUserId,
          providerAdminId: principal.userId,
          tenant: {
            id: tenantId,
            name: application.schoolName,
            npsn: application.canonicalNpsn,
            subdomain,
          },
          outboxEventId,
          decidedAt: now(),
        });
        return {
          ok: true,
          status: "approved",
          tenantId,
        } as const;
      });
    } catch (error) {
      if (error instanceof ApprovalConflictError) {
        return { ok: false, code: "resource-conflict", field: error.field };
      }
      throw error;
    }
  };
}

export function createRejectSimasApplicationCommand({
  authorize,
  store,
  now = () => new Date(),
}: RejectCommandDependencies) {
  return async function rejectSimasApplication(
    input: RejectInput,
  ): Promise<RejectSimasApplicationResult> {
    const principal = await authorize();
    const applicationId = normalizedText(input.applicationId);
    const reason = normalizedText(input.reason);
    const errors: { applicationId?: string; reason?: string } = {};

    if (!applicationId) errors.applicationId = "Pengajuan SIMAS tidak valid.";
    if (!reason) errors.reason = "Alasan penolakan wajib diisi.";

    if (Object.keys(errors).length > 0) {
      return { ok: false, code: "invalid-input", errors };
    }

    return store.transaction(async (tx) => {
      const application = await tx.lock(applicationId);
      if (!application) return { ok: false, code: "not-found" } as const;
      if (application.status === "rejected"
        && application.decidedByProviderAdminId === principal.userId
        && application.rejectionReason === reason) {
        return { ok: true, status: "already-rejected" } as const;
      }
      if (application.status !== "pending") {
        return {
          ok: false,
          code: "decision-conflict",
          status: application.status,
        } as const;
      }

      const updated = await tx.reject({
        applicationId,
        providerAdminId: principal.userId,
        reason,
        decidedAt: now(),
      });
      if (!updated) return { ok: false, code: "decision-conflict", status: "rejected" } as const;

      return { ok: true, status: "rejected" } as const;
    });
  };
}
