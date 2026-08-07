"use server";

import { requireProviderActionAccess } from "@/lib/provider/provider-access";
import { db } from "@/db";
import { providerSettings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function updateProviderSettingsAction(formData: FormData) {
  await requireProviderActionAccess();
  const defaultTrialDays = Number(formData.get("defaultTrialDays"));

  if (!Number.isInteger(defaultTrialDays) || defaultTrialDays < 1) {
    throw new Error("Invalid default trial days");
  }

  const existing = await db.select().from(providerSettings).limit(1);
  if (existing.length > 0) {
    await db.update(providerSettings).set({ defaultTrialDays }).where(eq(providerSettings.id, existing[0].id));
  } else {
    await db.insert(providerSettings).values({ id: 1, defaultTrialDays });
  }

  revalidatePath("/provider/settings");
}
