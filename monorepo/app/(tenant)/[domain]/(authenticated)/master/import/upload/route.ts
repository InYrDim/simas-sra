import { createPeopleImportService } from "@/lib/people-import";
import { peopleImportStore } from "@/lib/people-import-data";
import { createProtectedFileStorage } from "@/lib/protected-file-storage";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
export async function POST(request: Request, context: { params: Promise<{ domain: string }> }) {
  const { domain } = await context.params, principal = await enforceMasterDataAccess(domain, "validate-import");
  const form = await request.formData(), file = form.get("file");
  if (!(file instanceof File) || file.size === 0 || file.size > 10 * 1024 * 1024) return Response.json({ code: "invalid-file" }, { status: 400 });
  const root = process.env.PROTECTED_FILE_STORAGE_ROOT; if (!root) return Response.json({ code: "storage-unavailable" }, { status: 503 });
  const service = createPeopleImportService({ store: peopleImportStore, storage: createProtectedFileStorage(root) });
  const result = await service.upload(principal, new Uint8Array(await file.arrayBuffer()));
  return Response.json(result, { status: result.ok ? 202 : 400, headers: { "Cache-Control": "no-store" } });
}
