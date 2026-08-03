import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function NoTenantAccess({ tenantName }: { tenantName: string }) {
  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>Akses belum diberikan</CardTitle>
        <CardDescription>Anda masuk ke {tenantName}, tetapi belum memiliki Role Tenant aktif.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">Hubungi School Admin untuk meminta akses. Data operasional sekolah tidak dimuat pada halaman ini.</p>
        <Button nativeButton={false} render={<Link href="/change-password" />} variant="outline">Kelola kata sandi</Button>
      </CardContent>
    </Card>
  );
}
