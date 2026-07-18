import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTenantAction } from '../actions';
import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import { getProviderPageAccess } from "@/lib/provider-access";

export default async function TenantOnboardingPage() {
  const access = await getProviderPageAccess();

  if (access.status === "forbidden") {
    return null;
  }


  return (
    <div className="flex-1 space-y-4 p-8 pt-6 max-w-3xl mx-auto">
      <div className="flex items-center space-x-4 mb-6">
        <Link href="/dashboard">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h2 className="text-3xl font-bold tracking-tight">Tambah Tenant Baru</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pendaftaran Sekolah (Tenant)</CardTitle>
          <CardDescription>
            Tenant baru akan mendapatkan masa trial otomatis selama 1 bulan. Akun admin pertama juga akan dibuatkan secara otomatis.
          </CardDescription>
        </CardHeader>
        <form action={createTenantAction}>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="tenantName">Nama Sekolah / Tenant</Label>
              <Input id="tenantName" name="tenantName" placeholder="Contoh: SMA Negeri 1 Jakarta" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="domain">Subdomain (Karakter unik, huruf kecil)</Label>
              <div className="flex items-center">
                <Input id="domain" name="domain" placeholder="sman1jkt" required className="rounded-r-none" />
                <div className="px-3 py-2 bg-muted border border-l-0 rounded-r-md text-sm text-muted-foreground whitespace-nowrap">
                  .localhost:3000
                </div>
              </div>
            </div>

            <div className="border-t pt-4 my-4">
              <h3 className="font-medium mb-4">Akun Admin Pertama</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="adminName">Nama Admin</Label>
                  <Input id="adminName" name="adminName" placeholder="Budi Santoso" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="adminEmail">Email Admin</Label>
                  <Input id="adminEmail" name="adminEmail" type="email" placeholder="budi@example.com" required />
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Daftarkan Tenant & Mulai Trial 1 Bulan
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
