import { createHttpTenantAuthorizationEvaluator } from "@/lib/authorization/tenant-authorization-data";
import { enforceAuthorizedTenantOperation } from "@/lib/authorization/tenant-operation-route-access";

export default async function WhatsAppBotPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  const evaluator = await createHttpTenantAuthorizationEvaluator();
  const operationId = "placeholder.integrasi.whatsapp-bot";
  const result = await evaluator.evaluate({ surface: "page", domain, operationId });
  enforceAuthorizedTenantOperation(result, { domain, operationId });

  return <main />;
}
