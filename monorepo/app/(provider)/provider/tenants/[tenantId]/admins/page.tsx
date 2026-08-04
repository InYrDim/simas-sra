
import { getProviderPageAccess } from "@/lib/provider/provider-access";
import { getProviderSchoolAdminRoster } from "@/lib/provider/provider-school-admin-roster";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SchoolAdminRecoveryWorkflow } from "./recovery-workflow";

export default async function ProviderSchoolAdminRosterPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  await getProviderPageAccess();
  const roster = await getProviderSchoolAdminRoster(tenantId);
  
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">School Admin Roster</h1>
        <p className="text-muted-foreground">Kelola School Admin untuk Tenant {tenantId}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Daftar School Admin</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {roster.map(admin => (
              <div key={admin.authorityId} className="flex justify-between items-center p-4 border rounded-md">
                <div>
                  <div className="font-semibold">{admin.userName}</div>
                  <div className="text-sm text-muted-foreground">{admin.userEmail}</div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant={admin.state === 'active' ? 'default' : 'secondary'}>{admin.state}</Badge>
                  {admin.state === "disabled" ? <SchoolAdminRecoveryWorkflow tenantId={tenantId} authorityId={admin.authorityId} authorityVersion={admin.version} /> : null}
                </div>
              </div>
            ))}
            {roster.length === 0 && <p className="text-sm text-muted-foreground">Belum ada School Admin.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
