import "server-only";

import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import {
  createCompleteTenantOnboardingCommand,
  TenantOnboardingError,
  type TenantOnboardingSettings,
} from "@/lib/tenant-onboarding";
import { tenantOnboardingStore } from "@/lib/tenant-onboarding-data";

const completeForAuthenticatedUser = createCompleteTenantOnboardingCommand({
  store: tenantOnboardingStore,
});

export async function completeTenantOnboarding(payload: TenantOnboardingSettings) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new TenantOnboardingError("forbidden");
  return completeForAuthenticatedUser(session.user.id, payload);
}
