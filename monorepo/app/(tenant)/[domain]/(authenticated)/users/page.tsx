import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { enforceTenantPageAccess } from "@/lib/tenant-access";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default async function UsersPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const tenantData = await enforceTenantPageAccess(domain);

  const users = await db
    .select()
    .from(user)
    .where(eq(user.tenantId, tenantData.id));

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Manajemen Pengguna</h2>
        <p className="text-muted-foreground mt-2">
          Daftar akun pengguna yang memiliki akses ke tenant ini.
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Peran</TableHead>
              <TableHead>Status Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Tidak ada pengguna ditemukan.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {u.tenantRole?.replace("-", " ") || "Tidak ada"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {u.emailVerified ? (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white border-transparent">Terverifikasi</Badge>
                    ) : (
                      <Badge variant="secondary">Belum Verifikasi</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
