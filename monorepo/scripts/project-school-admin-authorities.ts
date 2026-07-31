import { randomUUID } from "node:crypto";

import { closeDatabasePool } from "@/db";
import {
  listLegacySchoolAdminProjectionCandidates,
  projectSchoolAdminCompatibility,
  recordGlobalSchoolAdminProjectionFinding,
} from "@/lib/authorization/school-admin-authority-data";

const batchSize = 100;
let cursor = "";
let examined = 0;
let projected = 0;
let unchanged = 0;
let findings = 0;

try {
  for (;;) {
    const candidates = await listLegacySchoolAdminProjectionCandidates(cursor, batchSize);
    if (candidates.length === 0) break;
    for (const candidate of candidates) {
      cursor = candidate.userId;
      examined += 1;
      if (!candidate.tenantId) {
        findings += 1;
        await recordGlobalSchoolAdminProjectionFinding({
          userId: candidate.userId,
          reasonCode: "school-admin-tenant-missing",
          idempotencyKey: `school_admin_finding_${candidate.userId.replaceAll("-", "_")}`,
          correlationId: randomUUID(),
        });
        console.error({ event: "school_admin_projection_missing_tenant", userId: candidate.userId });
        continue;
      }
      const result = await projectSchoolAdminCompatibility({
        principal: {
          kind: "system",
          service: "school-admin-compatibility-projection",
          context: { kind: "tenant", contextId: candidate.tenantId, tenantId: candidate.tenantId },
        },
        tenantId: candidate.tenantId,
        userId: candidate.userId,
        idempotencyKey: `school_admin_projection_${candidate.userId.replaceAll("-", "_")}`,
        correlationId: randomUUID(),
      });
      if (result.status === "projected") projected += 1;
      else if (result.status === "unchanged") unchanged += 1;
      else if (result.status === "finding") findings += 1;
    }
  }
  console.info({ event: "school_admin_projection_completed", examined, projected, unchanged, findings });
  if (findings > 0) process.exitCode = 1;
} finally {
  await closeDatabasePool();
}
