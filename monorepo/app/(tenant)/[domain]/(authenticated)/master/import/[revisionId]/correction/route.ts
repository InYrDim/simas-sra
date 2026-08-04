import { buildCorrectionWorkbook } from "@/lib/imports/people-import-review";
import { getImportReview } from "@/lib/imports/people-import-review-data";
import { enforceTenantMasterDataOperation } from "@/lib/master-data/tenant-master-data-route-access";

export async function GET(_request: Request, { params }: { params: Promise<{ domain: string; revisionId: string }> }) {
  const { domain, revisionId } = await params;
  const principal = await enforceTenantMasterDataOperation(domain, "people-imports.export", [
    "people-imports.revisions.export",
    "people-imports.revisions.view-sensitive",
  ]);
  const review = await getImportReview(principal, revisionId);
  if (!review) return new Response(null, { status: 404 });
  const bytes = await buildCorrectionWorkbook(review.revision.kind, review.rows);
  return new Response(bytes as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="koreksi-${review.revision.kind}-${revisionId}.xlsx"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
