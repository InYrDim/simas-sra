import * as React from 'react';
import Link from 'next/link';
import { db } from '@/db';
import { tenant } from '@/db/schema';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getProviderPageAccess } from "@/lib/provider-access";

export const dynamic = 'force-dynamic';

export default async function ProviderDashboardPage() {
  const access = await getProviderPageAccess();

  if (access.status === "forbidden") {
    return null;
  }

  const tenants = await db.select().from(tenant);

  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Provider Dashboard</h2>
        <div className="flex items-center space-x-2">
          <Link href="/dashboard/onboarding">
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Tambah Tenant
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sekolah</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenants.length}</div>
            <p className="text-xs text-muted-foreground">
              Sekolah terdaftar di sistem
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="col-span-4 mt-8">
        <CardHeader>
          <CardTitle>Daftar Tenant (Sekolah)</CardTitle>
          <CardDescription>
            Kelola semua sekolah yang menggunakan layanan SIMAS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama Tenant</TableHead>
                <TableHead>Subdomain</TableHead>
                <TableHead>Terdaftar Sejak</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tenants.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <span className="font-mono bg-muted px-2 py-1 rounded text-sm text-primary">
                      {t.domain}
                    </span>
                  </TableCell>
                  <TableCell>{new Date(t.createdAt).toLocaleDateString('id-ID')}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {tenants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                    Belum ada tenant yang terdaftar.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
