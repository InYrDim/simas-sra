import { buildSecurityAuditCsv, projectSecurityAuditEvents } from "@/lib/authorization/security-audit";
import { getProviderSecurityContext, getSecurityAuditHead, listProviderSecurityAuditEvents, recordSecurityAuditIntegrityFindings, verifyAndRecordSecurityAuditChain } from "@/lib/authorization/security-audit-data";
import { getProviderRouteAccess } from "@/lib/provider/provider-access";

export async function GET() {
  const access = await getProviderRouteAccess();
  if (access.response) return access.response;
  const events = await listProviderSecurityAuditEvents();
  const context = getProviderSecurityContext();
  const head = await getSecurityAuditHead(context);
  const integrity = head
    ? await verifyAndRecordSecurityAuditChain({ events, context, headHash: head.headHash, nextSequence: head.nextSequence })
    : { valid: events.length === 0, findings: events.length === 0 ? [] : [{ code: "unanchored" as const }], checkedEvents: events.length };
  if (!head && events.length > 0) await recordSecurityAuditIntegrityFindings({ context, findings: integrity.findings });
  if (!integrity.valid) {
    console.error({ event: "security_audit_integrity_failure", context: context.contextId, findings: integrity.findings });
    return Response.json({ error: "audit-integrity-unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const projected = projectSecurityAuditEvents(events, { scope: "provider", providerContextId: context.providerContextId });
  return new Response(buildSecurityAuditCsv(projected), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "attachment; filename=provider-audit-log.csv",
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
