import { Inbox, MessageCircle, MessageSquareText, Send, Smartphone } from "lucide-react";
import Link from "next/link";

import { WhatsAppBotComposer } from "@/components/integrations/whatsapp-bot-composer";
import { WhatsAppBotConnectionForm } from "@/components/integrations/whatsapp-bot-connection-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { listRecentMessages, readConnectionByTenantId } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";
import { readTenantOpenWaCredential } from "@/lib/integrations/whatsapp-bot/tenant-openwa-credential";

const timeFormat = new Intl.DateTimeFormat("id-ID", { dateStyle: "short", timeStyle: "short" });

export default async function WhatsAppIntegrasiPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();

  const loadResult = await evaluator.evaluate({ surface: "page", domain, operationId: "integrasi.load" });
  enforceAuthorizedTenantOperation(loadResult, { domain, operationId: "integrasi.load" });

  const whatsappResult = await evaluator.evaluate({ surface: "page", domain, operationId: "integrasi.whatsapp-bot.load" });
  const principal = enforceAuthorizedTenantOperation(whatsappResult, {
    domain,
    operationId: "integrasi.whatsapp-bot.load",
  });

  const [connection, messages, openWaConfigured] = await Promise.all([
    readConnectionByTenantId(principal.tenantId),
    listRecentMessages(principal.tenantId, 50),
    readTenantOpenWaCredential(principal.tenantId).then((credential) => credential !== null),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <nav aria-label="Bagian Integrasi">
        <Link
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          href={`/${domain}/integrasi`}
        >
          ← Integrasi
        </Link>
      </nav>

      <header>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <MessageCircle aria-hidden="true" className="size-7" />
          WhatsApp Bot
        </h1>
        <p className="mt-2 text-muted-foreground">
          Aktifkan penerimaan pesan masuk dari session WhatsApp sekolah yang dipersiapkan Provider di server OpenWA.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle aria-hidden="true" className="size-5" />
            Koneksi Session
          </CardTitle>
          <CardDescription>
            Hubungkan atau putuskan session WhatsApp sekolah yang dipersiapkan Provider di server OpenWA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between gap-3">
            <Badge variant={connection ? "secondary" : "outline"}>
              {connection ? "Terhubung" : "Belum terhubung"}
            </Badge>
            {connection ? (
              <Link
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
                href={`/${domain}/integrasi/whatsapp/akun`}
              >
                <Smartphone aria-hidden="true" className="size-4" />
                Detail Akun Bot
              </Link>
            ) : null}
          </div>
          <WhatsAppBotConnectionForm
            domain={domain}
            openWaConfigured={openWaConfigured}
            connection={
              connection
                ? {
                    openwaSessionId: connection.openwaSessionId,
                    openwaSessionName: connection.openwaSessionName,
                    botPhone: connection.botPhone,
                    botPushName: connection.botPushName,
                    status: connection.status,
                  }
                : null
            }
          />
        </CardContent>
      </Card>

      {connection?.status === "connected" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send aria-hidden="true" className="size-5" />
              Kirim Pesan
            </CardTitle>
            <CardDescription>
              Kirim pesan teks WhatsApp dari nomor sekolah ke nomor atau group tujuan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <WhatsAppBotComposer domain={domain} />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox aria-hidden="true" className="size-5" />
            Riwayat pesan
          </CardTitle>
          <CardDescription>
            Pesan masuk yang diterima webhook dan pesan keluar yang dikirim dari SIMAS (50 terbaru).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {messages.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <MessageSquareText aria-hidden="true" />
              </EmptyMedia>
              <EmptyHeader>
                <EmptyTitle>Belum ada pesan</EmptyTitle>
                <EmptyDescription>
                  Setelah koneksi aktif, pesan WhatsApp yang masuk atau keluar akan tercatat di sini.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arah</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Isi pesan</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead className="text-right">Waktu</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((message) => (
                  <TableRow key={message.id}>
                    <TableCell>
                      <Badge variant={message.direction === "outbound" ? "secondary" : "outline"}>
                        {message.direction === "outbound" ? "Keluar" : "Masuk"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {message.direction === "outbound" ? message.toWa : message.fromWa}
                    </TableCell>
                    <TableCell className="max-w-md">
                      {message.body ?? (
                        <span className="text-muted-foreground">
                          {message.hasMedia ? "Media tanpa teks" : "Pesan tanpa teks"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{message.messageType ?? message.event}</Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                      {timeFormat.format(message.receivedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}