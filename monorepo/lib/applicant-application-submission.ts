import { createHash, randomUUID } from "node:crypto";

import { prepareSimasApplication, type NewSimasApplication, type SimasApplicationInput } from "@/lib/simas-applications";

type Binding = { id: string; canonicalNpsn: string };
type OwnedApplication = NewSimasApplication & { ownerUserId: string; bindingId: string; attemptNumber: number; idempotencyKey: string; payloadHash: string };
type Transaction = {
  lockApplicant(userId: string): Promise<boolean>;
  getBinding(userId: string): Promise<Binding | null>;
  createBinding(binding: Binding & { userId: string }): Promise<void>;
  nextAttemptNumber(bindingId: string): Promise<number>;
  createApplication(application: OwnedApplication): Promise<void>;
};

export type ApplicantApplicationSubmissionStore = { transaction<T>(work: (tx: Transaction) => Promise<T>): Promise<T> };

type Result =
  | { ok: true; applicationId: string }
  | { ok: false; errors: Record<string, string> }
  | { ok: false; code: "forbidden" | "npsn-conflict" };

export function createApplicantApplicationSubmission(dependencies: {
  store: ApplicantApplicationSubmissionStore;
  createId?: () => string;
  now?: () => Date;
}) {
  const createId = dependencies.createId ?? randomUUID;
  return async (userId: string, input: SimasApplicationInput): Promise<Result> => {
    const prepared = prepareSimasApplication(input, { createId, now: dependencies.now });
    if (!prepared.ok) return prepared;

    return dependencies.store.transaction(async (tx) => {
      if (!await tx.lockApplicant(userId)) return { ok: false, code: "forbidden" } as const;
      let binding = await tx.getBinding(userId);
      if (binding && binding.canonicalNpsn !== prepared.application.npsn) return { ok: false, code: "npsn-conflict" } as const;
      if (!binding) {
        binding = { id: createId(), canonicalNpsn: prepared.application.npsn };
        await tx.createBinding({ ...binding, userId });
      }
      const attemptNumber = await tx.nextAttemptNumber(binding.id);
      const payloadHash = createHash("sha256").update(JSON.stringify(prepared.application)).digest("hex");
      await tx.createApplication({
        ...prepared.application,
        ownerUserId: userId,
        bindingId: binding.id,
        attemptNumber,
        idempotencyKey: prepared.application.id,
        payloadHash,
      });
      return { ok: true, applicationId: prepared.application.id } as const;
    });
  };
}
