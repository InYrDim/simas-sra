import { buildPeopleImportTemplate, type PeopleImportKind } from "@/lib/people-import";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";
const kinds = new Set(["student", "teacher", "staff"]);
export async function GET(_request: Request, context: { params: Promise<{ domain: string; kind: string }> }) {
  const { domain, kind } = await context.params; await enforceMasterDataAccess(domain, "download-template");
  if (!kinds.has(kind)) return new Response("Not found", { status: 404 });
  const bytes = await buildPeopleImportTemplate(kind as PeopleImportKind);
  return new Response(bytes, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="template-${kind}-v1.0.0.xlsx"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
