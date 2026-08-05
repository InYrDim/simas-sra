import { TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getTenantRbacOperationsDashboard } from "@/lib/authorization/tenant-rbac-operations-data";
import type { RolloutMode } from "@/lib/authorization/tenant-rbac-rollout";
import { getProviderPageAccess } from "@/lib/provider/provider-access";

export const metadata = { title: "Operasi Rollout RBAC" };

const modeLabels: Record<RolloutMode, string> = {
  legacy: "Legacy",
  intersection: "Intersection",
  rbac: "RBAC",
  "rbac-emergency": "RBAC emergency",
};

function value(value: string | number | null) {
  return value ?? "Bukti tidak tersedia";
}

export default async function ProviderRbacRolloutPage() {
  await getProviderPageAccess();
  const dashboard = await getTenantRbacOperationsDashboard();
  const hasOperationalBlockers = dashboard.globalBlockingFindingCount > 0 ||
    dashboard.missingEvidenceCount > 0 ||
    dashboard.tenants.some((tenant) => tenant.blockingFindingCount > 0);

  return (
    <main className="space-y-6 p-4 md:p-6" aria-labelledby="provider-rbac-rollout-title">
      <header>
        <h1 id="provider-rbac-rollout-title" className="text-2xl font-bold tracking-tight">Operasi Rollout RBAC</h1>
        <p className="mt-2 text-muted-foreground">Status operasional read-only per Tenant. Dashboard ini tidak menyediakan kontrol perubahan.</p>
      </header>

      {hasOperationalBlockers ? (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>Bukti rollout memerlukan perhatian</AlertTitle>
          <AlertDescription>
            {dashboard.missingEvidenceCount} Tenant tanpa bukti rollout, {dashboard.globalBlockingFindingCount} temuan blocking global, dan {dashboard.tenants.reduce((total, tenant) => total + tenant.blockingFindingCount, 0)} temuan blocking Tenant masih terbuka.
          </AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Ringkasan rollout">
        <Card><CardHeader><CardDescription>Tenant</CardDescription><CardTitle>{dashboard.tenants.length}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Bukti tidak tersedia</CardDescription><CardTitle>{dashboard.missingEvidenceCount}</CardTitle></CardHeader></Card>
        <Card><CardHeader><CardDescription>Temuan blocking global</CardDescription><CardTitle>{dashboard.globalBlockingFindingCount}</CardTitle></CardHeader></Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Status Tenant</CardTitle>
          <CardDescription>Versi dan bukti ditampilkan langsung dari state rollout tersimpan.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {dashboard.tenants.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada Tenant untuk ditampilkan.</p>
          ) : (
            <Table className="min-w-[1120px]">
              <TableCaption className="sr-only">Status operasi rollout RBAC per Tenant</TableCaption>
              <TableHeader><TableRow>
                <TableHead>Tenant</TableHead><TableHead>HTTP</TableHead><TableHead>Worker</TableHead>
                <TableHead>Epoch / rollout</TableHead><TableHead>Resolver</TableHead><TableHead>Registry</TableHead>
                <TableHead>Operation map</TableHead><TableHead>Emergency</TableHead><TableHead>Rollback</TableHead>
                <TableHead className="text-right">Temuan blocking</TableHead>
              </TableRow></TableHeader>
              <TableBody>{dashboard.tenants.map((tenant) => (
                <TableRow key={tenant.tenantId}>
                  <TableCell><div className="font-medium">{tenant.tenantName}</div><div className="font-mono text-xs text-muted-foreground">{tenant.tenantId}</div></TableCell>
                  <TableCell>{tenant.httpMode ? modeLabels[tenant.httpMode] : <Badge variant="destructive">Tidak diketahui</Badge>}</TableCell>
                  <TableCell>{tenant.workerMode ? modeLabels[tenant.workerMode] : <Badge variant="destructive">Tidak diketahui</Badge>}</TableCell>
                  <TableCell><div>{value(tenant.epoch)}</div><div className="text-xs text-muted-foreground">v{value(tenant.rolloutVersion)}</div></TableCell>
                  <TableCell className="font-mono text-xs">{value(tenant.resolverVersion)}</TableCell>
                  <TableCell className="font-mono text-xs">{value(tenant.registryVersion)}</TableCell>
                  <TableCell className="font-mono text-xs">{value(tenant.operationMapVersion)}</TableCell>
                  <TableCell><Badge variant={tenant.emergencyState === "active" ? "destructive" : "outline"}>{tenant.emergencyState === "active" ? "Aktif" : tenant.emergencyState === "inactive" ? "Tidak aktif" : "Tidak diketahui"}</Badge></TableCell>
                  <TableCell><Badge variant={tenant.rollbackEligibility === "eligible" ? "secondary" : "outline"}>{tenant.rollbackEligibility === "eligible" ? "Memenuhi syarat" : tenant.rollbackEligibility === "ineligible" ? "Tidak memenuhi syarat" : "Tidak diketahui"}</Badge></TableCell>
                  <TableCell className="text-right"><Badge variant={tenant.blockingFindingCount > 0 ? "destructive" : "outline"}>{tenant.blockingFindingCount}</Badge></TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
