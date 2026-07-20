import "server-only";

import { forbidden, notFound } from "next/navigation";

import type { MasterDataOperation } from "@/lib/tenant-master-data-access";
import { getMasterDataAccess } from "@/lib/tenant-master-data-access-data";

export async function enforceMasterDataAccess(domain: string, operation: MasterDataOperation) {
  const access = await getMasterDataAccess(domain, operation);
  if (access.kind === "not-found") notFound();
  if (access.kind === "forbidden") {
    console.warn({
      event: "master_data_access_denied",
      domain,
      operation,
      reason: access.reason,
    });
    forbidden();
  }
  return access.principal;
}
