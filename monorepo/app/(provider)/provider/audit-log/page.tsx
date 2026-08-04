import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { projectSecurityAuditEvents } from "@/lib/authorization/security-audit";
import { getProviderSecurityContext, getSecurityAuditHead, listProviderSecurityAuditEvents, recordSecurityAuditIntegrityFindings, verifyAndRecordSecurityAuditChain } from "@/lib/authorization/security-audit-data";
import { getProviderPageAccess } from "@/lib/provider/provider-access";

export const metadata = { title: "Audit Log Provider" };

export default async function ProviderAuditLogPage() {
  await getProviderPageAccess();
  const context = getProviderSecurityContext();
  const [events, head] = await Promise.all([
    listProviderSecurityAuditEvents(),
    getSecurityAuditHead(context),
  ]);
  const integrity = head
    ? await verifyAndRecordSecurityAuditChain({ events, context, headHash: head.headHash, nextSequence: head.nextSequence })
    : { valid: events.length === 0, findings: events.length === 0 ? [] : [{ code: "unanchored" as const }], checkedEvents: events.length };
  if (!head && events.length > 0) await recordSecurityAuditIntegrityFindings({ context, findings: integrity.findings });
  const projected = projectSecurityAuditEvents(events, { scope: "provider", providerContextId: context.providerContextId });
  if (!integrity.valid) {
    console.error({ event: "security_audit_integrity_failure", context: context.contextId, findings: integrity.findings });
  }

  return (
    <main className="space-y-6 p-4 md:p-6" aria-labelledby="provider-audit-title">
      <header>
        <h1 id="provider-audit-title" className="text-2xl font-bold tracking-tight">Audit Log Provider</h1>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="mt-2 text-muted-foreground">Riwayat lifecycle Provider dan operasi keamanan lintas Tenant.</p>
          {integrity.valid ? <Link className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted" href="/provider/audit-log/export">Ekspor aman</Link> : null}
        </div>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>Verifikasi integritas</CardTitle>
          <CardDescription>Rantai audit diperiksa tanpa mengubah event tersimpan.</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant={integrity.valid ? "default" : "destructive"}>{integrity.valid ? "Rantai valid" : `Perlu perhatian · ${integrity.findings.length} temuan`}</Badge>
          {!integrity.valid ? <p className="mt-3 text-sm text-destructive" role="alert">Sinyal operasional integritas audit perlu ditangani sebelum data digunakan sebagai bukti.</p> : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Peristiwa Provider</CardTitle><CardDescription>{projected.length} peristiwa tersedia.</CardDescription></CardHeader>
        <CardContent className="overflow-x-auto">
          {projected.length === 0 ? <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada riwayat administratif Provider.</p> : (
            <Table className="min-w-[720px]">
              <TableCaption className="sr-only">Audit log Provider</TableCaption>
              <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Peristiwa</TableHead><TableHead>Aktor</TableHead><TableHead>Correlation ID</TableHead></TableRow></TableHeader>
              <TableBody>{projected.map((event) => <TableRow key={event.id}><TableCell>{new Date(event.occurredAt).toLocaleString("id-ID")}</TableCell><TableCell>{event.eventType}{event.reason ? <div className="mt-1 text-muted-foreground">{event.reason}</div> : null}</TableCell><TableCell>{event.actor.label}</TableCell><TableCell className="font-mono text-xs">{event.correlationId}</TableCell></TableRow>)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
