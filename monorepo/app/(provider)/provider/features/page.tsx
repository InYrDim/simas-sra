import { OpenWaCredentialForm } from "@/app/(provider)/provider/features/openwa-credential-form";
import { FeatureSettingsForm } from "@/app/(provider)/provider/features/feature-settings-form";
import { MenuVisibilityForm } from "@/app/(provider)/provider/features/menu-visibility-form";
import { TenantFeatureCombobox } from "@/app/(provider)/provider/features/tenant-feature-combobox";
import {
  WhatsAppRequestReviewList,
  type WhatsAppProviderRequestView,
} from "@/components/provider/whatsapp-request-review";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { readTenantOpenWaCredential } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";
import { listWhatsAppBotRequestsForProvider } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-request-data";
import {
  getTenantFeatureConfiguration,
  listTenantsForFeatureManagement,
} from "@/lib/provider/provider-feature-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function toRequestView(request: Awaited<ReturnType<typeof listWhatsAppBotRequestsForProvider>>[number]): WhatsAppProviderRequestView {
  return {
    id: request.id,
    tenantName: request.tenantName,
    tenantNpsn: request.tenantNpsn,
    tenantDomain: request.tenantDomain,
    requestedPhone: request.requestedPhone,
    desiredSessionName: request.desiredSessionName,
    picName: request.picName,
    note: request.note,
    status: request.status,
    providerNote: request.providerNote,
    openwaSessionId: request.openwaSessionId,
    resolutionMethod: request.resolutionMethod,
    resolvedAt: request.resolvedAt ? request.resolvedAt.toISOString() : null,
    createdAt: request.createdAt.toISOString(),
  };
}

export default async function ProviderFeaturesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const tenantId = typeof params.tenantId === "string" ? params.tenantId : "";
  const [tenants, selectedTenant, openWaCredential, requests] = await Promise.all([
    listTenantsForFeatureManagement(),
    tenantId ? getTenantFeatureConfiguration(tenantId) : Promise.resolve(null),
    tenantId ? readTenantOpenWaCredential(tenantId) : Promise.resolve(null),
    tenantId ? listWhatsAppBotRequestsForProvider({ tenantId }) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Fitur Tenant</h1>
        <p className="mt-2 text-muted-foreground">
          Pilih Tenant, lalu kelola fitur berdasarkan domain fungsi atau rute halaman yang dilindungi.
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
          <CardTitle>2. Atur Fitur</CardTitle>
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

      <Card>
        <CardHeader>
          <CardTitle>3. Visibilitas Menu Sidebar</CardTitle>
          <CardDescription>
            {selectedTenant
              ? `Atur tombol mana yang ditampilkan di sidebar Tenant ${selectedTenant.name}.`
              : "Pilih Tenant terlebih dahulu untuk mengatur visibilitas menu."}
          </CardDescription>
        </CardHeader>
        {selectedTenant ? (
          <CardContent>
            <MenuVisibilityForm
              key={selectedTenant.id}
              tenantId={selectedTenant.id}
              visibility={selectedTenant.menuVisibility}
            />
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Kredensial OpenWA (WhatsApp Bot)</CardTitle>
          <CardDescription>
            {selectedTenant
              ? `Session WhatsApp dan API key untuk ${selectedTenant.name}. Tenant hanya menekan tombol Hubungkan pada halaman integrasinya.`
              : tenantId
                ? "Tenant tidak ditemukan. Pilih Tenant lain."
                : "Pilih Tenant terlebih dahulu untuk mengelola kredensial integrasi."}
          </CardDescription>
        </CardHeader>
        {selectedTenant ? (
          <CardContent>
            <OpenWaCredentialForm
              key={`${selectedTenant.id}:${openWaCredential !== null}`}
              tenantId={selectedTenant.id}
              configured={openWaCredential !== null}
              sessionKey={openWaCredential?.sessionKey ?? null}
              overrideBaseUrl={openWaCredential?.apiBaseUrl ?? null}
            />
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>5. Pengajuan WhatsApp Bot</CardTitle>
          <CardDescription>
            {selectedTenant
              ? `Tinjau pengajuan WA Bot ${selectedTenant.name}. Setujui untuk membuka penyiapan mandiri, atau tolak dengan catatan.`
              : tenantId
                ? "Tenant tidak ditemukan. Pilih Tenant lain."
                : "Pilih Tenant terlebih dahulu untuk meninjau pengajuan."}
          </CardDescription>
        </CardHeader>
        {selectedTenant ? (
          <CardContent>
            <WhatsAppRequestReviewList requests={requests.map(toRequestView)} />
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
