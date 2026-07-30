import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/platform/auth";
import {
  createCompleteTenantOnboardingCommand,
  TenantOnboardingError,
  type TenantOnboardingSettings,
} from "@/lib/tenancy/tenant-onboarding";
import { tenantOnboardingStore } from "@/lib/tenancy/tenant-onboarding-data";

const completeForAuthenticatedUser = createCompleteTenantOnboardingCommand({
  store: tenantOnboardingStore,
});

export async function completeTenantOnboarding(payload: TenantOnboardingSettings) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new TenantOnboardingError("forbidden");
  return completeForAuthenticatedUser(session.user.id, payload);
}
