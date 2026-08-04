import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { parsePeopleImportWorkbook } from "@/lib/imports/people-import";
import { createCorrectionRevision, getImportReview } from "@/lib/imports/people-import-review-data";
import { createProtectedFileStorage } from "@/lib/platform/protected-file-storage";
import { enforceTenantMasterDataOperation } from "@/lib/master-data/tenant-master-data-route-access";

export async function POST(request: Request, { params }: { params: Promise<{ domain: string; revisionId: string }> }) {
  const { domain, revisionId } = await params;
  const principal = await enforceTenantMasterDataOperation(domain, "people-imports.upload");
  const review = await getImportReview(principal, revisionId);
  if (!review) return Response.json({ code: "not-found" }, { status: 404 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) return Response.json({ code: "invalid-file" }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const parsed = await parsePeopleImportWorkbook(bytes);
  if (!parsed.ok || parsed.kind !== review.revision.kind) return Response.json({ code: parsed.ok ? "wrong-kind" : parsed.code }, { status: 400 });
  const root = process.env.PROTECTED_FILE_STORAGE_ROOT;
  if (!root) return Response.json({ code: "storage-unavailable" }, { status: 503 });
  const key = `tenants/${principal.tenantId}/people-import/${review.revision.batchId}/revision-${randomUUID()}.xlsx`;
  const storage = createProtectedFileStorage(root);
  await storage.write(principal.tenantId, key, bytes);
  try {
    const id = await createCorrectionRevision(principal, revisionId, key, parsed.kind, parsed.version, parsed.rows);
    redirect(`/${domain}/master/import/${id}`);
  } catch (error) {
    await storage.remove(principal.tenantId, key);
    throw error;
  }
}
