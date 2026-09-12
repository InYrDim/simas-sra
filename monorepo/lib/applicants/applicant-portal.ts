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
  findPromotedTenant(userId: string): Promise<{ id: string; name: string; domain: string } | null>;
  listApplications(userId: string): Promise<ApplicantApplicationSnapshot[]>;
};

type ApplicantPortalState =
  | { kind: "empty" }
  | { kind: "pending"; current: ApplicantApplicationSnapshot; history: readonly ApplicantApplicationSnapshot[] }
    | { kind: "rejected"; current: ApplicantApplicationSnapshot; history: readonly ApplicantApplicationSnapshot[] }
    | { kind: "history"; history: readonly ApplicantApplicationSnapshot[] }
    | { kind: "approved"; current: ApplicantApplicationSnapshot; history: readonly ApplicantApplicationSnapshot[]; tenant: Readonly<{ id: string; name: string; href: string }> };

export function createApplicantPortalQuery(store: ApplicantPortalStore) {
  return async (userId: string): Promise<{ ok: true; state: ApplicantPortalState } | { ok: false; code: "forbidden" }> => {
    const isApplicant = await store.isApplicant(userId);
    const promotedTenant = isApplicant ? null : await store.findPromotedTenant(userId);
    if (!isApplicant && !promotedTenant) return { ok: false, code: "forbidden" };
    const rows = await store.listApplications(userId);
    if (rows.length === 0) return { ok: true, state: { kind: "empty" } };

    const history = Object.freeze(rows
      .map((row) => Object.freeze({ ...row }))
      .sort((left, right) => left.attemptNumber - right.attemptNumber));
    const current = history.at(-1)!;
    if (current.status === "pending") return { ok: true, state: { kind: "pending", current, history } };
        if (current.status === "rejected") return { ok: true, state: { kind: "rejected", current, history } };
        if (promotedTenant && current.status === "approved") {
          return {
            ok: true,
            state: {
              kind: "approved",
              current,
              history,
              tenant: Object.freeze({ id: promotedTenant.id, name: promotedTenant.name, href: `/${promotedTenant.domain}/dashboard` }),
            },
          };
        }
        return { ok: true, state: { kind: "history", history } };
  };
}
