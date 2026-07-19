export type ApplicantApplicationSnapshot = Readonly<{
  id: string;
  attemptNumber: number;
  status: "pending" | "approved" | "rejected";
  schoolName: string;
  npsn: string;
  educationLevel: string;
  address: string;
  contactName: string;
  contactPosition: string;
  contactEmail: string;
  contactWhatsapp: string;
  needsNote: string | null;
  submittedAt: Date;
    decidedAt: Date | null;
    rejectionReason: string | null;
  }>;

export type ApplicantPortalStore = {
  isApplicant(userId: string): Promise<boolean>;
  listApplications(userId: string): Promise<ApplicantApplicationSnapshot[]>;
};

type ApplicantPortalState =
  | { kind: "empty" }
  | { kind: "pending"; current: ApplicantApplicationSnapshot; history: readonly ApplicantApplicationSnapshot[] }
    | { kind: "rejected"; current: ApplicantApplicationSnapshot; history: readonly ApplicantApplicationSnapshot[] }
    | { kind: "history"; history: readonly ApplicantApplicationSnapshot[] };

export function createApplicantPortalQuery(store: ApplicantPortalStore) {
  return async (userId: string): Promise<{ ok: true; state: ApplicantPortalState } | { ok: false; code: "forbidden" }> => {
    if (!await store.isApplicant(userId)) return { ok: false, code: "forbidden" };
    const rows = await store.listApplications(userId);
    if (rows.length === 0) return { ok: true, state: { kind: "empty" } };

    const history = Object.freeze(rows
      .map((row) => Object.freeze({ ...row }))
      .sort((left, right) => left.attemptNumber - right.attemptNumber));
    const current = history.at(-1)!;
    if (current.status === "pending") return { ok: true, state: { kind: "pending", current, history } };
        if (current.status === "rejected") return { ok: true, state: { kind: "rejected", current, history } };
        return { ok: true, state: { kind: "history", history } };
  };
}
