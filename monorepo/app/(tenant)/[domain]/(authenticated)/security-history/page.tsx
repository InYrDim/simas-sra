import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { listTenantSecurityAuditEvents } from "@/lib/authorization/security-audit-data";
import { projectSecurityAuditEvents } from "@/lib/authorization/security-audit";

export const metadata = { title: "Riwayat Keamanan Tenant" };

type SearchParams = Promise<{ event?: string }>;

export default async function SecurityHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: SearchParams;
}) {
  const { domain } = await params;
  const query = await searchParams;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const [tenantAccess, selfAccess] = await Promise.all([
    evaluator.evaluate({ surface: "page", domain, operationId: "tenant.authorization-audit.load" }),
    evaluator.evaluate({ surface: "page", domain, operationId: "tenant.authorization-audit.self" }),
  ]);
  const access = tenantAccess.kind === "authorized"
    ? { principal: tenantAccess.principal, scope: "tenant" as const }
    : selfAccess.kind === "authorized"
      ? { principal: selfAccess.principal, scope: "self" as const }
      : null;
  if (!access) enforceAuthorizedTenantOperation(tenantAccess, { domain, operationId: "tenant.authorization-audit.load" });
  if (!access) return null;

  const events = await listTenantSecurityAuditEvents(access.principal.tenantId);
  const projected = projectSecurityAuditEvents(events, {
    scope: access.scope,
    tenantId: access.principal.tenantId,
    userId: access.principal.userId,
  });
  const filtered = query.event?.trim()
    ? projected.filter((event) => event.eventType.toLowerCase().includes(query.event!.trim().toLowerCase()))
    : projected;
  const canExport = tenantAccess.kind === "authorized";

  return (
    <main className="space-y-6 p-4 md:p-6" aria-labelledby="security-history-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 id="security-history-title" className="text-2xl font-bold tracking-tight">Riwayat keamanan</h1>
          <p className="mt-2 text-muted-foreground">
            {access.scope === "tenant" ? "Riwayat otorisasi Tenant sesuai kewenangan Anda." : "Riwayat keamanan yang berkaitan dengan akun Anda."}
          </p>
        </div>
        {canExport ? <Link className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted" href="/security-history/export">Ekspor aman</Link> : null}
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Peristiwa tercatat</CardTitle>
          <CardDescription>{filtered.length} peristiwa ditampilkan · Correlation ID tersedia untuk penelusuran.</CardDescription>
          <form className="flex max-w-md gap-2" method="get">
            <label className="sr-only" htmlFor="event-filter">Saring jenis peristiwa</label>
            <Input id="event-filter" name="event" defaultValue={query.event} placeholder="Saring jenis peristiwa" className="min-w-0 flex-1" />
            <Button type="submit" variant="outline" size="sm">Saring</Button>
          </form>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filtered.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              {query.event ? "Tidak ada peristiwa yang cocok dengan saringan." : "Belum ada riwayat keamanan yang dapat ditampilkan."}
            </p>
          ) : (
            <Table className="min-w-[720px]">
              <TableCaption className="sr-only">Riwayat keamanan Tenant</TableCaption>
              <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Peristiwa</TableHead><TableHead>Aktor</TableHead><TableHead>Status</TableHead><TableHead>Correlation ID</TableHead></TableRow></TableHeader>
              <TableBody>{filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>{new Date(event.occurredAt).toLocaleString("id-ID")}</TableCell>
                  <TableCell><div className="font-medium">{event.eventType}</div>{event.reason ? <div className="mt-1 text-muted-foreground">{event.reason}</div> : null}</TableCell>
                  <TableCell>{event.actor.label}</TableCell>
                  <TableCell><Badge variant={event.outcome === "succeeded" ? "default" : "secondary"}>{event.outcome}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{event.correlationId}</TableCell>
                </TableRow>
              ))}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
