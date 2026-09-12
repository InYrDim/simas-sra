import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";
import { buildSecurityAuditCsv, projectSecurityAuditEvents } from "@/lib/authorization/security-audit";
import { getSecurityAuditHead, getTenantSecurityContext, listTenantSecurityAuditEvents, recordSecurityAuditIntegrityFindings, verifyAndRecordSecurityAuditChain } from "@/lib/authorization/security-audit-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const operationId = "tenant.authorization-audit.export";
  const result = await evaluator.evaluate({ surface: "api", domain, operationId });
  const principal = enforceAuthorizedTenantOperation(result, { domain, operationId });
  const context = getTenantSecurityContext(principal.tenantId);
  const [events, head] = await Promise.all([
    listTenantSecurityAuditEvents(principal.tenantId),
    getSecurityAuditHead(context),
  ]);
  const integrity = head
    ? await verifyAndRecordSecurityAuditChain({ events, context, headHash: head.headHash, nextSequence: head.nextSequence })
    : { valid: events.length === 0, findings: events.length === 0 ? [] : [{ code: "unanchored" as const }], checkedEvents: events.length };
  if (!head && events.length > 0) await recordSecurityAuditIntegrityFindings({ context, findings: integrity.findings });
  if (!integrity.valid) {
    console.error({ event: "security_audit_integrity_failure", context: context.contextId, findings: integrity.findings });
    return Response.json({ error: "audit-integrity-unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const projected = projectSecurityAuditEvents(events, {
    scope: "tenant",
    tenantId: principal.tenantId,
    userId: principal.userId,
  });
  return new Response(buildSecurityAuditCsv(projected), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "attachment; filename=security-history.csv",
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
