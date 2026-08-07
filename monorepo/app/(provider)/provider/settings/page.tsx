import { db } from "@/db";
import { providerSettings } from "@/db/schema";
import { ProviderSettingsForm } from "./provider-settings-form";

export default async function ProviderSettingsPage() {
  const [settings] = await db.select().from(providerSettings).limit(1);
  const defaultTrialDays = settings?.defaultTrialDays ?? 31;

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">Pengaturan Provider</h1>
      <ProviderSettingsForm defaultTrialDays={defaultTrialDays} />
    </div>
  );
}
