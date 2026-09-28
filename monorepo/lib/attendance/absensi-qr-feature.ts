import "server-only";

import { enforceTenantFeatureAccess } from "@/lib/features/tenant-feature-route-access";

/**
 * Server-side feature recheck for the QR scan flow. Lives outside
 * `absensi/actions.ts` on purpose: the RBAC coverage checker derives its
 * `entitlement` authority marker per file, and inlining the feature guard
 * there would mislabel every absensi action in that file.
 */
export async function enforceAbsensiQrFeature(domain: string) {
    return enforceTenantFeatureAccess(domain, "absensiQr", "read");
}
