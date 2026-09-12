import { Inbox, MessageCircle } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { readConnectionByTenantId } from "@/lib/integrations/whatsapp-bot/whatsapp-bot-data";

export default async function IntegrasiPage({
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

  const connection = await readConnectionByTenantId(principal.tenantId);

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Integrasi</h1>
        <p className="mt-2 text-muted-foreground">
          Hubungkan SIMAS dengan layanan eksternal untuk notifikasi dan otomatisasi.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href={`/${domain}/integrasi/whatsapp`} className="group">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle aria-hidden="true" className="size-5" />
                WhatsApp Bot
              </CardTitle>
              <CardDescription>
                Terima dan kirim pesan WhatsApp menggunakan session sekolah yang dikelola Provider.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Badge variant={connection ? "secondary" : "outline"}>
                {connection ? "Terhubung" : "Belum terhubung"}
              </Badge>
              <p className="text-sm font-medium text-primary group-hover:underline">Kelola & kirim pesan →</p>
            </CardContent>
          </Card>
        </Link>

        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox aria-hidden="true" className="size-5" />
              Notifikasi Email
            </CardTitle>
            <CardDescription>Kirim pemberitahuan melalui email sekolah untuk berbagai kejadian sistem.</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">Segera hadir</Badge>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}