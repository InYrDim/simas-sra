import { KeyRound, MessageCircle, Smartphone } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@/components/ui/table";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { readConnectionByTenantId } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import { readTenantOpenWaCredential } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";

const timeFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short" });

export default async function WhatsAppAkunPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const loadResult = await evaluator.evaluate({ surface: "page", domain, operationId: "integrasi.whatsapp-bot.load" });
  const principal = enforceAuthorizedTenantOperation(loadResult, {
    domain,
    operationId: "integrasi.whatsapp-bot.load",
  });

  const [connection, credential] = await Promise.all([
    readConnectionByTenantId(principal.tenantId),
    readTenantOpenWaCredential(principal.tenantId),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <nav aria-label="Bagian Integrasi">
        <Link
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          href={`/${domain}/integrasi/whatsapp`}
        >
          ← WhatsApp Bot
        </Link>
      </nav>

      <header>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Smartphone aria-hidden="true" className="size-7" />
          Akun Bot WhatsApp
        </h1>
        <p className="mt-2 text-muted-foreground">
          Detail nomor WhatsApp yang terhubung sebagai bot sekolah dan status kredensial OpenWA di server Provider.
        </p>
      </header>

      {connection ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle aria-hidden="true" className="size-5" />
              Profil Akun Bot
            </CardTitle>
            <CardDescription>
              Informasi nomor WhatsApp yang terhubung sebagai bot sekolah.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableHead className="w-1/3">Nomor WhatsApp</TableHead>
                  <TableCell className="font-mono">{connection.botPhone ?? "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableHead>Nama tampilan</TableHead>
                  <TableCell>{connection.botPushName ?? "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableHead>Status koneksi</TableHead>
                  <TableCell>
                    <Badge variant={connection.status === "connected" ? "secondary" : "outline"}>
                      {connection.status === "connected" ? "Terhubung" : "Error"}
                    </Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead>Session OpenWA</TableHead>
                  <TableCell className="font-mono text-sm">{connection.openwaSessionName}</TableCell>
                </TableRow>
                <TableRow>
                  <TableHead>ID Session</TableHead>
                  <TableCell className="font-mono text-sm">{connection.openwaSessionId}</TableCell>
                </TableRow>
                {connection.lastError ? (
                  <TableRow>
                    <TableHead>Pesan galat terakhir</TableHead>
                    <TableCell className="text-destructive">{connection.lastError}</TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle aria-hidden="true" className="size-5" />
              Profil Akun Bot
            </CardTitle>
          </CardHeader>
          <CardContent className="text-muted-foreground">
            Belum ada session WhatsApp yang terhubung. Hubungkan session terlebih dahulu dari halaman{" "}
            <Link className="underline underline-offset-4 hover:text-foreground" href={`/${domain}/integrasi/whatsapp`}>
              WhatsApp Bot
            </Link>
            .
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound aria-hidden="true" className="size-5" />
            Kredensial OpenWA
          </CardTitle>
          <CardDescription>
            Kredensial API disiapkan dan dikelola sepenuhnya oleh Provider; SIMAS terhubung otomatis sehingga tenant
            tidak memerlukan salinan kunci API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {credential ? (
            <Table>
              <TableBody>
                <TableRow>
                  <TableHead className="w-1/3">Status</TableHead>
                  <TableCell>
                    <Badge variant="secondary">Dikonfigurasi oleh Provider</Badge>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead>API Key</TableHead>
                  <TableCell className="text-muted-foreground">
                    Tidak ditampilkan — dikelola oleh Provider
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableHead>Session Key</TableHead>
                  <TableCell className="font-mono">{credential.sessionKey}</TableCell>
                </TableRow>
                <TableRow>
                  <TableHead>Server API</TableHead>
                  <TableCell className="font-mono text-sm">{credential.apiBaseUrl ?? "—"}</TableCell>
                </TableRow>
                <TableRow>
                  <TableHead>Diperbarui</TableHead>
                  <TableCell>{timeFormat.format(credential.updatedAt)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground">
              Kredensial OpenWA belum dikonfigurasi untuk tenant ini. Silakan hubungi Provider (admin@simas.com).
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}