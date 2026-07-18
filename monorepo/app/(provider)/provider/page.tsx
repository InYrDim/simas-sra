import Link from "next/link";
import { forbidden } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProviderPageAccess } from "@/lib/provider-access";
import { APPLICATION_STATUS_LABELS } from "@/lib/provider-applications";
import { getProviderSummary } from "@/lib/provider-summary-data";

function formatDate(value: Date | null) {
  return value?.toLocaleDateString("id-ID", { dateStyle: "medium" }) ?? "—";
}

export default async function ProviderSummaryPage() {
  const access = await getProviderPageAccess();
  if (access.status === "forbidden") forbidden();

  const summary = await getProviderSummary();
  const metrics = [
    { label: "Menunggu peninjauan", value: summary.counts.pendingApplications },
    { label: "Tenant disediakan", value: summary.counts.providedTenants },
    { label: "Menunggu onboarding", value: summary.counts.waitingForOnboarding },
    { label: "Trial berakhir ≤ 7 hari", value: summary.counts.trialsEndingSoon },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Ringkasan</h1>
          <p className="mt-1 text-muted-foreground">
            Pantau aktivitas utama layanan SIMAS dari area Provider.
          </p>
        </div>
        <Link
          className={buttonVariants()}
          href="/provider/tenants?tab=applications"
        >
          Lihat Pengajuan
        </Link>
      </div>

      <section aria-label="Metrik operasional" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold tabular-nums">{metric.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Pengajuan SIMAS terbaru</CardTitle></CardHeader>
          <CardContent>
            {summary.recentApplications.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Belum ada Pengajuan SIMAS.
              </p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Sekolah</TableHead><TableHead>Status</TableHead>
                  <TableHead className="text-right">Dikirim</TableHead>
                </TableRow></TableHeader>
                <TableBody>{summary.recentApplications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/provider/tenants/applications/${application.id}`}
                      >
                        {application.schoolName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={application.status === "rejected" ? "destructive" : "outline"}>
                        {APPLICATION_STATUS_LABELS[application.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatDate(application.submittedAt)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Tenant terbaru</CardTitle></CardHeader>
          <CardContent>
            {summary.recentTenants.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Belum ada Tenant yang disediakan.
              </p>
            ) : (
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Sekolah</TableHead><TableHead>Subdomain</TableHead>
                  <TableHead className="text-right">Disetujui</TableHead>
                </TableRow></TableHeader>
                <TableBody>{summary.recentTenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <Link
                        className="font-medium hover:underline"
                        href={`/provider/tenants/${tenant.id}`}
                      >
                        {tenant.schoolName}
                      </Link>
                    </TableCell>
                    <TableCell>{tenant.domain}</TableCell>
                    <TableCell className="text-right">{formatDate(tenant.approvedAt)}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
