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
}>;

export type RejectionDecision = Readonly<{
  applicationId: string;
  providerAdminId: string;
  reason: string;
  decidedAt: Date;
}>;

export type ApplicationDecisionTransaction = Readonly<{
  lock(applicationId: string): Promise<LockedApplicationDecision | null>;
  reject(decision: RejectionDecision): Promise<void>;
}>;

export type ApplicationDecisionStore = Readonly<{
  transaction<T>(work: (tx: ApplicationDecisionTransaction) => Promise<T>): Promise<T>;
}>;

export type RejectSimasApplicationResult =
  | { ok: true; status: "rejected" }
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
      if (application.status !== "pending") {
        return {
          ok: false,
          code: "decision-conflict",
          status: application.status,
        } as const;
      }

      await tx.reject({
        applicationId,
        providerAdminId: principal.userId,
        reason,
        decidedAt: now(),
      });

      return { ok: true, status: "rejected" } as const;
    });
  };
}
