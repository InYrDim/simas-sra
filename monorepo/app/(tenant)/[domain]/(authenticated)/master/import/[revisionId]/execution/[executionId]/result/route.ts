import { buildPeopleImportResultWorkbook } from "@/lib/imports/people-import-execution-data";
import { enforceTenantMasterDataOperation } from "@/lib/master-data/tenant-master-data-route-access";

export async function GET(_request: Request, { params }: { params: Promise<{ domain: string; revisionId: string; executionId: string }> }) {
  const { domain, revisionId, executionId } = await params;
  const principal = await enforceTenantMasterDataOperation(domain, "people-imports.export", [
    "people-imports.revisions.export",
    "people-imports.revisions.view-sensitive",
  ]);
  const bytes = await buildPeopleImportResultWorkbook(principal.tenantId, executionId, revisionId);
  if (!bytes) return new Response(null, { status: 404 });
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="hasil-impor-${executionId}.xlsx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
