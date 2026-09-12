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

import { db } from "@/db";
import { providerSettings } from "@/db/schema";

export async function completeTenantOnboarding(payload: TenantOnboardingSettings) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new TenantOnboardingError("forbidden");
  
  const [settings] = await db.select().from(providerSettings).limit(1);
  const defaultTrialDays = settings?.defaultTrialDays ?? 31;
  
  return completeForAuthenticatedUser(session.user.id, { ...payload, defaultTrialDays });
}
