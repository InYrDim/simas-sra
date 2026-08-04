import { buildPpdbSubmissionsCsv } from "@/lib/admissions/ppdb-export";
import { ppdbSubmissionStore } from "@/lib/admissions/ppdb-submission-data";
import { enforceTenantFeatureAccess, enforceTenantOperation } from "@/lib/features/tenant-feature-route-access";

export async function GET(
  request: Request,
  context: { params: Promise<{ domain: string }> },
) {
  const { domain } = await context.params;

  await enforceTenantOperation(domain, "ppdb.submissions.export");
  const principal = await enforceTenantFeatureAccess(domain, "ppdbRead", "read");
  const sessionId = new URL(request.url).searchParams.get("sessionId") || undefined;
  const submissions = await ppdbSubmissionStore.list(principal.tenantId, sessionId);
  const csv = buildPpdbSubmissionsCsv(submissions);

  return new Response(csv, {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": "attachment; filename=ppdb-submissions.csv",
      "Content-Type": "text/csv; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
