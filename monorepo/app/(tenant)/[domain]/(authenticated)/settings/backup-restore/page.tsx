import { DatabaseBackup, RotateCcw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function BackupRestorePage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  await params;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Backup &amp; Restore</h1>
        <p className="mt-2 text-muted-foreground">
          Kelola salinan cadangan data tenant dan pemulihan data sekolah.
        </p>
      </header>

      <Alert>
        <DatabaseBackup aria-hidden="true" />
        <AlertTitle>Eksekusi backup dan restore belum tersedia</AlertTitle>
        <AlertDescription>
          Menu sudah disiapkan. Pembuatan arsip, enkripsi, penyimpanan, audit, dan proses pemulihan
          harus diselesaikan sebelum kontrol ini dapat digunakan dengan aman.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseBackup aria-hidden="true" className="size-5" />
              Backup data
            </CardTitle>
            <CardDescription>
              Buat salinan data tenant yang dapat digunakan untuk pemulihan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled>Buat backup</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw aria-hidden="true" className="size-5" />
              Restore data
            </CardTitle>
            <CardDescription>
              Pulihkan data tenant dari salinan cadangan yang telah diverifikasi.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled variant="outline">Pilih backup untuk restore</Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
