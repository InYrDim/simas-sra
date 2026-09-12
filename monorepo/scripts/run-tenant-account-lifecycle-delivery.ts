import "dotenv/config";

import { deliverPendingLifecycleEvents, sendToInternalLifecycleAdapter } from "@/lib/tenancy/tenant-account-lifecycle-delivery";

const deliveries = await deliverPendingLifecycleEvents({
  send: sendToInternalLifecycleAdapter,
});
for (const delivery of deliveries) {
  console.log(JSON.stringify({ event: "tenant-account-lifecycle-delivered", caseId: delivery.caseId, tenantId: delivery.tenantId, userId: delivery.userId, kind: delivery.kind }));
}
