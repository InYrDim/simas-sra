import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { listTenantUserDirectory } from "@/lib/authorization/tenant-user-directory-data";

import { getLifecycleWorkspaceAction } from "./actions";
import { LifecycleWorkspace } from "./lifecycle-workspace";

export default async function UsersPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const baseRequest = { surface: "page" as const, domain, operationId: "tenant.users.load" };
  const base = await evaluator.evaluate({
    ...baseRequest,
    requestedPermissions: ["tenant.users.view"],
  });
  const principal = enforceAuthorizedTenantOperation(base, baseRequest);

  const [contact, sensitive, lifecycle] = await Promise.all([
    evaluator.evaluate({
      ...baseRequest,
      requestedPermissions: ["tenant.users.view", "tenant.users.view-contact"],
    }),
    evaluator.evaluate({
      ...baseRequest,
      requestedPermissions: ["tenant.users.view", "tenant.users.view-sensitive"],
    }),
    evaluator.evaluate({ surface: "page", domain, operationId: "tenant.accounts.view" }),
  ]);

  if (lifecycle.kind === "authorized") {
    const data = await getLifecycleWorkspaceAction(domain);
    return <LifecycleWorkspace domain={domain} initialData={data} />;
  }

  const access = {
    contact: contact.kind === "authorized",
    sensitive: sensitive.kind === "authorized",
  };
  const users = await listTenantUserDirectory(principal.tenantId, access);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Direktori Pengguna</h1>
        <p className="mt-2 text-muted-foreground">Daftar akun dalam Tenant sesuai proyeksi data yang Anda miliki.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pengguna Tenant</CardTitle>
          <CardDescription>{users.length} pengguna tersedia.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                {access.contact ? <TableHead>Email</TableHead> : null}
                {access.sensitive ? <TableHead>Role lama</TableHead> : null}
                {access.sensitive ? <TableHead>Status email</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow><TableCell colSpan={1 + Number(access.contact) + (access.sensitive ? 2 : 0)} className="h-28 text-center text-muted-foreground">Belum ada pengguna.</TableCell></TableRow>
              ) : users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  {access.contact ? <TableCell>{user.email}</TableCell> : null}
                  {access.sensitive ? <TableCell>{user.tenantRole?.replaceAll("-", " ") ?? "Tanpa role lama"}</TableCell> : null}
                  {access.sensitive ? <TableCell><Badge variant={user.emailVerified ? "default" : "secondary"}>{user.emailVerified ? "Terverifikasi" : "Belum terverifikasi"}</Badge></TableCell> : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
