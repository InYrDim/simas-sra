import Link from "next/link";
import { MessageCircle, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";

const INTEGRATIONS = [
  {
    key: "whatsapp-bot",
    title: "WhatsApp Bot",
    description:
      "Kirim notifikasi otomatis (nilai, absensi, PPDB, dan pengumuman) ke pengguna melalui WhatsApp.",
    icon: MessageCircle,
    href: "/integrasi/whatsapp-bot",
    status: "Belum terhubung",
    available: true,
  },
  {
    key: "email",
    title: "Notifikasi Email",
    description: "Kirim pemberitahuan melalui email sekolah untuk berbagai kejadian sistem.",
    icon: Send,
    href: undefined,
    status: "Segera hadir",
    available: false,
  },
] as const;

export default async function IntegrasiPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const operationId = "integrasi.load";
  const result = await evaluator.evaluate({ surface: "page", domain, operationId });
  enforceAuthorizedTenantOperation(result, { domain, operationId });

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Integrasi</h1>
        <p className="mt-2 text-muted-foreground">
          Hubungkan SIMAS dengan layanan eksternal untuk notifikasi dan otomatisasi.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((integration) => {
          const Icon = integration.icon;
          const card = (
            <Card className={integration.available ? "h-full transition-colors hover:bg-muted" : "h-full opacity-60"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Icon aria-hidden="true" className="size-5" />
                  {integration.title}
                </CardTitle>
                <CardDescription>{integration.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant={integration.available ? "secondary" : "outline"}>{integration.status}</Badge>
              </CardContent>
            </Card>
          );

          return integration.available ? (
            <Link key={integration.key} href={`/${domain}${integration.href}`} className="block h-full">
              {card}
            </Link>
          ) : (
            <div key={integration.key}>{card}</div>
          );
        })}
      </div>
    </main>
  );
}