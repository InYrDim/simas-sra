import { createHash, randomUUID } from "node:crypto";

import { prepareSimasApplication, type NewSimasApplication, type SimasApplicationInput } from "@/lib/simas-applications";

type Binding = { id: string; canonicalNpsn: string };
type ExistingApplication = { id: string; payloadHash: string };
type LatestApplication = ExistingApplication & { status: "pending" | "approved" | "rejected" };
type OwnedApplication = NewSimasApplication & {
  ownerUserId: string;
  bindingId: string;
  attemptNumber: number;
  idempotencyKey: string;
  payloadHash: string;
};
type Transaction = {
  isApplicant(userId: string): Promise<boolean>;
  lockApplicant(userId: string): Promise<boolean>;
  getBinding(userId: string): Promise<Binding | null>;
  createBinding(binding: Binding & { userId: string }): Promise<void>;
  findByIdempotencyKey(userId: string, idempotencyKey: string): Promise<ExistingApplication | null>;
  findPending(bindingId: string): Promise<ExistingApplication | null>;
  findLatest(bindingId: string): Promise<LatestApplication | null>;
  nextAttemptNumber(bindingId: string): Promise<number>;
  createApplication(application: OwnedApplication): Promise<void>;
};

export type ApplicantApplicationSubmissionStore = {
  transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
};

export class SubmissionConflict extends Error {
  constructor(readonly code: "npsn-conflict" | "binding-conflict" | "idempotency-conflict" | "existing-pending") {
    super(code);
  }
}

type Result =
  | { ok: true; applicationId: string; existing: boolean }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; code: "forbidden" | "npsn-conflict" | "idempotency-conflict" | "resubmit-conflict" }
  | { ok: false; code: "existing-pending"; applicationId: string };

function presentationNpsn(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function payloadHash(application: NewSimasApplication): string {
  const snapshot = {
    schoolName: application.schoolName,
    npsn: application.npsn,
    educationLevel: application.educationLevel,
    address: application.address,
    contactName: application.contactName,
    contactPosition: application.contactPosition,
    contactEmail: application.contactEmail,
    contactWhatsapp: application.contactWhatsapp,
    needsNote: application.needsNote,
  };
  return createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
}

function validIdempotencyKey(value: string): boolean {
  return value.length >= 8 && value.length <= 255 && /^[A-Za-z0-9_-]+$/.test(value);
}

export function createApplicantApplicationSubmission(dependencies: {
  store: ApplicantApplicationSubmissionStore;
  createId?: () => string;
  now?: () => Date;
}) {
  const createId = dependencies.createId ?? randomUUID;
  return async (userId: string, idempotencyKey: string, input: SimasApplicationInput): Promise<Result> => {
    if (!validIdempotencyKey(idempotencyKey)) {
      return { ok: false, errors: { idempotencyKey: "Permintaan pengajuan tidak valid. Muat ulang halaman lalu coba lagi." } };
    }
    const prepared = prepareSimasApplication(input, { createId, now: dependencies.now });
    if (!prepared.ok) return prepared as { ok: false; errors: Record<string, string> };
    const canonicalNpsn = prepared.application.npsn;
    const application = { ...prepared.application, npsn: presentationNpsn(input.npsn) };
    const hash = payloadHash(application);

    try {
      return await dependencies.store.transaction(async (tx) => {
        if (!await tx.isApplicant(userId)) return { ok: false, code: "forbidden" } as const;

        let binding = await tx.getBinding(userId);
        let idempotent = binding ? await tx.findByIdempotencyKey(userId, idempotencyKey) : null;
        if (idempotent) {
          if (idempotent.payloadHash !== hash) return { ok: false, code: "idempotency-conflict" } as const;
          return { ok: true, applicationId: idempotent.id, existing: true } as const;
        }
        if (binding) {
          if (binding.canonicalNpsn !== canonicalNpsn) return { ok: false, code: "npsn-conflict" } as const;
          const pending = await tx.findPending(binding.id);
          if (pending) return { ok: false, code: "existing-pending", applicationId: pending.id } as const;
          const latest = await tx.findLatest(binding.id);
          if (latest && latest.status !== "rejected") return { ok: false, code: "resubmit-conflict" } as const;
        }

        if (!await tx.lockApplicant(userId)) return { ok: false, code: "forbidden" } as const;
        if (!binding) {
          binding = await tx.getBinding(userId);
          idempotent = binding ? await tx.findByIdempotencyKey(userId, idempotencyKey) : null;
          if (idempotent) {
            if (idempotent.payloadHash !== hash) return { ok: false, code: "idempotency-conflict" } as const;
            return { ok: true, applicationId: idempotent.id, existing: true } as const;
          }
          if (binding) {
            if (binding.canonicalNpsn !== canonicalNpsn) return { ok: false, code: "npsn-conflict" } as const;
            const pending = await tx.findPending(binding.id);
            if (pending) return { ok: false, code: "existing-pending", applicationId: pending.id } as const;
            const latest = await tx.findLatest(binding.id);
            if (latest && latest.status !== "rejected") return { ok: false, code: "resubmit-conflict" } as const;
          } else {
            binding = { id: createId(), canonicalNpsn };
            await tx.createBinding({ ...binding, userId });
          }
        }

        const attemptNumber = await tx.nextAttemptNumber(binding.id);
        await tx.createApplication({
          ...application,
          ownerUserId: userId,
          bindingId: binding.id,
          attemptNumber,
          idempotencyKey,
          payloadHash: hash,
        });
        return { ok: true, applicationId: prepared.application.id, existing: false } as const;
      });
    } catch (error) {
      if (error instanceof SubmissionConflict) {
        if (error.code === "npsn-conflict" || error.code === "binding-conflict") {
          return { ok: false, code: "npsn-conflict" };
        }
        if (error.code === "idempotency-conflict") return { ok: false, code: "idempotency-conflict" };
        if (error.code === "existing-pending") return { ok: false, code: "existing-pending", applicationId: "" };
      }
      throw error;
    }
  };
}
