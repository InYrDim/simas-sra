import {
  OPERATION_MAP_VERSION,
  PERMISSION_REGISTRY_VERSION,
  permissionRegistryDigest,
  tenantOperationMapDigest,
} from "@/lib/authorization/tenant-rbac-contract";
import { checkTenantAuthorizationCoverage } from "@/lib/authorization/tenant-rbac-coverage";

async function main() {
  const report = await checkTenantAuthorizationCoverage(new URL("../", import.meta.url));
  const result = {
    permissionRegistry: {
      version: PERMISSION_REGISTRY_VERSION,
      digest: permissionRegistryDigest,
    },
    operationMap: {
      version: OPERATION_MAP_VERSION,
      digest: tenantOperationMapDigest,
    },
    discoveredEntryPoints: report.discoveredEntryPoints.length,
    mappedEntryPoints: report.mappedEntryPoints.length,
    issues: report.issues,
  };

  if (report.issues.length > 0) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

void main();
