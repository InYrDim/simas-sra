import { FeatureSettingsForm } from "@/app/(provider)/provider/features/feature-settings-form";
import { TenantFeatureCombobox } from "@/app/(provider)/provider/features/tenant-feature-combobox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getTenantFeatureConfiguration,
  listTenantsForFeatureManagement,
} from "@/lib/provider-feature-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProviderFeaturesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : "";
  const [tenants, selectedTenant] = await Promise.all([
    listTenantsForFeatureManagement(),
    tenantId ? getTenantFeatureConfiguration(tenantId) : Promise.resolve(null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fitur Tenant</h1>
        <p className="mt-2 text-muted-foreground">
          Pilih Tenant, lalu tentukan fitur yang dapat digunakan oleh sekolah tersebut.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Pilih Tenant</CardTitle>
          <CardDescription>Konfigurasi fitur disimpan secara terpisah untuk setiap Tenant.</CardDescription>
        </CardHeader>
        <CardContent>
          {tenants.length ? (
            <TenantFeatureCombobox
              selectedTenantId={selectedTenant?.id ?? ""}
              tenants={tenants}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada Tenant yang dapat dikonfigurasi.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Set Fitur</CardTitle>
          <CardDescription>
            {selectedTenant
              ? `${selectedTenant.name} · ${selectedTenant.domain}`
              : tenantId
                ? "Tenant tidak ditemukan. Pilih Tenant lain."
                : "Pilih Tenant terlebih dahulu untuk menampilkan konfigurasi fitur."}
          </CardDescription>
        </CardHeader>
        {selectedTenant ? (
          <CardContent>
            <FeatureSettingsForm
              features={selectedTenant.features}
              tenantId={selectedTenant.id}
            />
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
