import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";

export default async function PersuratanPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const operationId = "persuratan.load";
  const result = await evaluator.evaluate({ surface: "page", domain, operationId });
  enforceAuthorizedTenantOperation(result, { domain, operationId });

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold">Persuratan</h1>
      <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
        <p className="text-muted-foreground">Halaman Persuratan sedang dalam pengembangan.</p>
      </div>
    </div>
  );
}
