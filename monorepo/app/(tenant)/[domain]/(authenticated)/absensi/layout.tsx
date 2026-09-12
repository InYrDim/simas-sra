import { enforceTenantFeatureEnabled } from "@/lib/features/tenant-feature-route-access";
import { tenantAuthorizationStore } from "@/lib/authorization/tenant-authorization-data";
import { MasterDataWarningBanner } from "@/components/dashboard/master-data-warning-banner";

export default async function AbsensiLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: Promise<{ domain: string }>;
}>) {
    const { domain } = await params;
    await enforceTenantFeatureEnabled(domain, "absensi");

    const tenant = await tenantAuthorizationStore.loadTenantByDomain(domain);

    return (
        <div className="flex flex-col gap-4">
            {tenant ? <MasterDataWarningBanner tenantId={tenant.id} domain={domain} /> : null}
            {children}
        </div>
    );
}
