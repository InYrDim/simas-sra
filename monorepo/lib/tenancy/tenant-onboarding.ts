import type { TenantRole } from "@/types/TenantRole";

export type TenantOnboardingSettings = Readonly<{
  schoolYear: string;
  timezone: string;
}>;

type TenantLifecycle = Readonly<{
  onboardingCompletedAt: Date | null;
  trialStartedAt: Date | null;
  trialEndsAt: Date | null;
}>;

type LockedTenantPrincipal = TenantLifecycle & Readonly<{
  tenantId: string;
  tenantRole: TenantRole;
  hasTemporaryCredentialActivation: boolean;
  firstAuthenticatedAt: Date | null;
  passwordChangeRequired: boolean;
  passwordChangedAt: Date | null;
}>;

type CompletedTenantLifecycle = Readonly<{
  onboardingCompletedAt: Date;
  trialStartedAt: Date;
  trialEndsAt: Date;
}>;

type TenantOnboardingTransaction = Readonly<{
  lockTenantForPrincipal(userId: string): Promise<LockedTenantPrincipal | null>;
  complete(
    tenantId: string,
    settings: TenantOnboardingSettings,
    lifecycle: CompletedTenantLifecycle,
  ): Promise<void>;
}>;

export type TenantOnboardingStore = Readonly<{
  transaction<T>(work: (tx: TenantOnboardingTransaction) => Promise<T>): Promise<T>;
}>;

export class TenantOnboardingError extends Error {
  readonly code: "forbidden" | "password-change-required" | "invalid-configuration";

  constructor(code: TenantOnboardingError["code"]) {
    super(code);
    this.name = "TenantOnboardingError";
    this.code = code;
  }
}

function validateSettings(payload: TenantOnboardingSettings): TenantOnboardingSettings {
  const schoolYear = payload.schoolYear.trim();
  const timezone = payload.timezone.trim();
  if (!schoolYear || !timezone) throw new TenantOnboardingError("invalid-configuration");

  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
  } catch {
    throw new TenantOnboardingError("invalid-configuration");
  }

  return { schoolYear, timezone };
}

function addOneUtcCalendarMonth(date: Date): Date {
  const targetYear = date.getUTCFullYear() + Math.floor((date.getUTCMonth() + 1) / 12);
  const targetMonth = (date.getUTCMonth() + 1) % 12;
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    targetYear,
    targetMonth,
    Math.min(date.getUTCDate(), lastTargetDay),
    date.getUTCHours(),
    date.getUTCMinutes(),
    date.getUTCSeconds(),
    date.getUTCMilliseconds(),
  ));
}

export function createCompleteTenantOnboardingCommand(dependencies: {
  store: TenantOnboardingStore;
  now?: () => Date;
}) {
  const now = dependencies.now ?? (() => new Date());

  return (authenticatedUserId: string, payload: TenantOnboardingSettings) =>
    dependencies.store.transaction(async (tx) => {
      const principal = await tx.lockTenantForPrincipal(authenticatedUserId);
      if (!principal || principal.tenantRole !== "school-admin") {
        throw new TenantOnboardingError("forbidden");
      }
      if (principal.hasTemporaryCredentialActivation) {
        if (principal.passwordChangeRequired) {
          throw new TenantOnboardingError("password-change-required");
        }
        if (!principal.firstAuthenticatedAt || !principal.passwordChangedAt) {
          throw new TenantOnboardingError("forbidden");
        }
      }
      if (
        principal.onboardingCompletedAt &&
        principal.trialStartedAt &&
        principal.trialEndsAt
      ) {
        return {
          status: "already-completed",
          tenantId: principal.tenantId,
          onboardingCompletedAt: principal.onboardingCompletedAt,
          trialStartedAt: principal.trialStartedAt,
          trialEndsAt: principal.trialEndsAt,
        } as const;
      }

      const settings = validateSettings(payload);
      const completedAt = now();
      const lifecycle = {
        onboardingCompletedAt: completedAt,
        trialStartedAt: completedAt,
        trialEndsAt: addOneUtcCalendarMonth(completedAt),
      };
      await tx.complete(principal.tenantId, settings, lifecycle);

      return {
        status: "completed",
        tenantId: principal.tenantId,
        ...lifecycle,
      } as const;
    });
}

export const TENANT_ENDING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export type TenantUsageStage =
  | "waiting-for-onboarding"
  | "in-trial"
  | "ending-soon"
  | "expired";

export function projectTenantUsageStage(
  lifecycle: Pick<TenantLifecycle, "onboardingCompletedAt" | "trialEndsAt">,
  now: Date = new Date(),
): TenantUsageStage {
  if (!lifecycle.onboardingCompletedAt) return "waiting-for-onboarding";
  if (!lifecycle.trialEndsAt) {
    throw new Error("Completed onboarding requires a trial end");
  }
  if (lifecycle.trialEndsAt.getTime() <= now.getTime()) return "expired";

  return lifecycle.trialEndsAt.getTime() - now.getTime() <= TENANT_ENDING_SOON_WINDOW_MS
    ? "ending-soon"
    : "in-trial";
}
