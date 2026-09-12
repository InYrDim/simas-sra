import { projectTenantUsageStage, type TenantUsageStage } from "@/lib/tenancy/tenant-onboarding";

export type ProviderSchoolAdminRosterEntry = Readonly<{
  authorityId: string;
  authorityState: string;
  accountLifecycle?: string | null;
  schoolAdminUserId: string;
}>;

export function projectProviderSchoolAdminRoster<T extends ProviderSchoolAdminRosterEntry>(rows: readonly T[]) {
  const active = rows.filter((row) =>
    row.authorityState === "active"
    && (row.accountLifecycle === undefined || row.accountLifecycle === null || row.accountLifecycle === "active"));
  return {
    schoolAdmins: [...rows],
    activeSchoolAdmins: active,
    activeSchoolAdminCount: active.length,
    coverage: active.length > 0 ? "managed" as const : "reconciliation-required" as const,
  };
}


export const TENANT_USAGE_STAGE_LABELS: Record<TenantUsageStage, string> = {
  "waiting-for-onboarding": "Menunggu onboarding",
  "in-trial": "Dalam trial",
  "ending-soon": "Trial segera berakhir",
  expired: "Trial berakhir",
};

export type TenantListSort = "newest" | "oldest" | "school-asc" | "school-desc";
export type TenantListQuery = Readonly<{
  page: number;
  search?: string;
  sort: TenantListSort;
  stage: TenantUsageStage | "all" | "all-trial";
}>;

const sorts: readonly TenantListSort[] = ["newest", "oldest", "school-asc", "school-desc"];
const stages: readonly TenantUsageStage[] = [
  "waiting-for-onboarding",
  "in-trial",
  "ending-soon",
  "expired",
];

export function literalLikePattern(search: string) {
  return `%${search.replaceAll("=", "==").replaceAll("%", "=%").replaceAll("_", "=_")}%`;
}

export function normalizeTenantListQuery(input: Readonly<Record<string, string | undefined>>): TenantListQuery {
  const requestedPage = Number(input.page);
  const search = input.search?.trim() || undefined;
  const sort = sorts.includes(input.sort as TenantListSort) ? input.sort as TenantListSort : "newest";
  const stage = input.stage === "all-trial" ? "all-trial" : stages.includes(input.stage as TenantUsageStage) ? input.stage as TenantUsageStage : "all";

  return {
    page: Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    search,
    sort,
    stage,
  };
}

export function tenantUsageStageLabel(
  lifecycle: { onboardingCompletedAt: Date | null; trialEndsAt: Date | null },
  now?: Date,
) {
  const stage = projectTenantUsageStage(lifecycle, now);
  return { stage, label: TENANT_USAGE_STAGE_LABELS[stage] };
}
