import { createProtectedFileStorage } from "@/lib/protected-file-storage";
import { ppdbSubmissionStore } from "@/lib/ppdb-submission-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

export async function GET(
  _request: Request,
  context: { params: Promise<{ domain: string; submissionId: string; documentId: string }> },
) {
  const { domain, submissionId, documentId } = await context.params;
  const principal = await enforceMasterDataAccess(domain, "read");
  const document = await ppdbSubmissionStore.findDocument(principal.tenantId, submissionId, documentId);
  if (!document) return Response.json({ code: "not-found" }, { status: 404 });

  const storageRoot = process.env.PROTECTED_FILE_STORAGE_ROOT;
  if (!storageRoot) return Response.json({ code: "storage-unavailable" }, { status: 503 });

  try {
    const bytes = await createProtectedFileStorage(storageRoot).read(principal.tenantId, document.storageKey);
    const fallbackName = `dokumen-${document.id}.${document.mimeType === "application/pdf" ? "pdf" : document.mimeType === "image/png" ? "png" : "jpg"}`;
    return new Response(Buffer.from(bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(document.originalFileName)}`,
        "Content-Type": document.mimeType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error({ event: "ppdb_document_download_failed", tenantId: principal.tenantId, submissionId, documentId, error });
    return Response.json({ code: "file-unavailable" }, { status: 404 });
  }
}
