import assert from "node:assert/strict";
import test from "node:test";

import {
  createCompleteTenantOnboardingCommand,
  projectTenantUsageStage,
  TenantOnboardingError,
  type TenantOnboardingStore,
} from "@/lib/tenant-onboarding";

const completedAt = new Date("2026-01-31T18:30:00.000Z");
const trialEndsAt = new Date("2026-02-28T18:30:00.000Z");

function onboardingStore(options: {
  tenantId?: string;
  tenantRole?: string;
  firstAuthenticatedAt?: Date | null;
  passwordChangeRequired?: boolean;
  passwordChangedAt?: Date | null;
  alreadyCompleted?: boolean;
} = {}) {
  const events: string[] = [];
  let lifecycle = options.alreadyCompleted
    ? { onboardingCompletedAt: completedAt, trialStartedAt: completedAt, trialEndsAt }
    : { onboardingCompletedAt: null, trialStartedAt: null, trialEndsAt: null };

  const store: TenantOnboardingStore = {
    transaction: async (work) => {
      events.push("transaction");
      return work({
        lockTenantForPrincipal: async (userId) => {
          events.push(`lock:${userId}`);
          if (options.tenantRole === "missing") return null;
          return {
            tenantId: options.tenantId ?? "tenant-1",
            tenantRole: (options.tenantRole ?? "school-admin") as "school-admin" | "staff",
            firstAuthenticatedAt: options.firstAuthenticatedAt === undefined ? completedAt : options.firstAuthenticatedAt,
            passwordChangeRequired: options.passwordChangeRequired ?? false,
            passwordChangedAt: options.passwordChangedAt === undefined ? completedAt : options.passwordChangedAt,
            ...lifecycle,
          };
        },
        complete: async (tenantId, settings, dates) => {
          events.push(`complete:${tenantId}:${JSON.stringify(settings)}`);
          lifecycle = dates;
        },
      });
    },
  };

  return { events, getLifecycle: () => lifecycle, store };
}

test("School Admin completes onboarding and starts the trial atomically from their principal", async () => {
  const fixture = onboardingStore();
  const complete = createCompleteTenantOnboardingCommand({
    now: () => completedAt,
    store: fixture.store,
  });

  const result = await complete("school-admin-1", {
    schoolYear: "2026/2027",
    timezone: "Asia/Jakarta",
  });

  assert.deepEqual(result, {
    status: "completed",
    tenantId: "tenant-1",
    onboardingCompletedAt: completedAt,
    trialStartedAt: completedAt,
    trialEndsAt,
  });
  assert.deepEqual(fixture.events, [
    "transaction",
    "lock:school-admin-1",
    'complete:tenant-1:{"schoolYear":"2026/2027","timezone":"Asia/Jakarta"}',
  ]);
  assert.deepEqual(fixture.getLifecycle(), {
    onboardingCompletedAt: completedAt,
    trialStartedAt: completedAt,
    trialEndsAt,
  });
});

test("repeated completion is idempotent and preserves every trial date", async () => {
  const fixture = onboardingStore({ alreadyCompleted: true });
  const complete = createCompleteTenantOnboardingCommand({
    now: () => new Date("2026-07-18T12:00:00.000Z"),
    store: fixture.store,
  });

  assert.deepEqual(await complete("school-admin-1", { schoolYear: "ignored", timezone: "UTC" }), {
    status: "already-completed",
    tenantId: "tenant-1",
    onboardingCompletedAt: completedAt,
    trialStartedAt: completedAt,
    trialEndsAt,
  });
  assert.deepEqual(fixture.events, ["transaction", "lock:school-admin-1"]);
});

test("completion rejects missing, cross-role, and credential-change-pending principals", async () => {
  for (const fixture of [
    onboardingStore({ tenantRole: "missing" }),
    onboardingStore({ tenantRole: "staff" }),
    onboardingStore({ firstAuthenticatedAt: null }),
    onboardingStore({ passwordChangeRequired: true }),
    onboardingStore({ passwordChangedAt: null }),
  ]) {
    const complete = createCompleteTenantOnboardingCommand({ store: fixture.store });
    await assert.rejects(
      () => complete("user-1", { schoolYear: "2026/2027", timezone: "Asia/Jakarta" }),
      TenantOnboardingError,
    );
    assert.deepEqual(fixture.events, ["transaction", "lock:user-1"]);
  }
});

test("completion rejects invalid required configuration without mutation", async () => {
  const fixture = onboardingStore();
  const complete = createCompleteTenantOnboardingCommand({ store: fixture.store });

  await assert.rejects(
    () => complete("school-admin-1", { schoolYear: " ", timezone: "Asia/Jakarta" }),
    (error: unknown) => (error as { code?: string }).code === "invalid-configuration",
  );
  assert.deepEqual(fixture.events, ["transaction", "lock:school-admin-1"]);
});

test("usage-stage projection covers waiting, trial, ending soon, and expired boundaries", () => {
  assert.equal(projectTenantUsageStage({ onboardingCompletedAt: null, trialEndsAt: null }, completedAt), "waiting-for-onboarding");
  assert.equal(projectTenantUsageStage({ onboardingCompletedAt: completedAt, trialEndsAt }, new Date("2026-02-20T18:29:59.999Z")), "in-trial");
  assert.equal(projectTenantUsageStage({ onboardingCompletedAt: completedAt, trialEndsAt }, new Date("2026-02-21T18:30:00.000Z")), "ending-soon");
  assert.equal(projectTenantUsageStage({ onboardingCompletedAt: completedAt, trialEndsAt }, trialEndsAt), "expired");
  assert.throws(
    () => projectTenantUsageStage({ onboardingCompletedAt: completedAt, trialEndsAt: null }, completedAt),
    /requires a trial end/,
  );
});
