import { projectTenantUsageStage, type TenantUsageStage } from "@/lib/tenant-onboarding";

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
  stage: TenantUsageStage | "all";
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
  const stage = stages.includes(input.stage as TenantUsageStage) ? input.stage as TenantUsageStage : "all";

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
