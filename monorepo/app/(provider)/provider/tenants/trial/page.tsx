import Link from "next/link";
import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listProviderTenants } from "@/lib/provider/provider-tenant-data";
import { normalizeTenantListQuery } from "@/lib/provider/provider-tenants";
import { cn } from "@/lib/utils";
import { TrialDurationDialog } from "./trial-duration-dialog";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function valueOf(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function ProviderTenantsTrialPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = normalizeTenantListQuery({
    page: valueOf(params.page),
    search: valueOf(params.search),
    sort: valueOf(params.sort),
    stage: "in-trial",
  });
  
  const result = await listProviderTenants(query);

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Pengelolaan Trial Tenant</h1>
        <p className="mt-1 text-muted-foreground">Atur dan sesuaikan durasi masa trial untuk masing-masing tenant.</p>
      </div>

      <div className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-4">
        {result.tenants.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            Tidak ada Tenant yang sedang dalam masa trial.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sekolah</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Sisa Trial</TableHead>
                <TableHead>Berakhir Pada</TableHead>
                <TableHead className="text-right">Tindakan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.tenants.map((tenant) => {
                const now = new Date();
                const daysLeft = tenant.trialEndsAt ? Math.ceil((tenant.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                
                return (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.schoolName}</TableCell>
                    <TableCell>{tenant.domain}</TableCell>
                    <TableCell>
                      {daysLeft > 0 ? (
                        <Badge variant={daysLeft <= 7 ? "destructive" : "default"} className={daysLeft > 7 ? "bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 border-amber-500/30" : ""}>
                          {daysLeft} hari
                        </Badge>
                      ) : (
                        <Badge variant="outline">Berakhir</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {tenant.trialEndsAt?.toLocaleDateString("id-ID", { dateStyle: "medium" }) ?? "—"}
                    </TableCell>
                    <TableCell className="space-x-2 text-right">
                      <TrialDurationDialog
                        tenantId={tenant.id}
                        schoolName={tenant.schoolName}
                        currentEndsAt={tenant.trialEndsAt}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
