import assert from "node:assert/strict";
import test from "node:test";

import { reconcileMasterData, type ReconciliationSnapshot } from "@/lib/master-data-reconciliation";

const clean = (): ReconciliationSnapshot => ({ tenants: ["tenant-a", "tenant-b"], ownership: [], relationships: [], identifiers: [], periods: [], activeStates: [], archives: [], histories: [], imports: [], accounts: [], overviewCounts: [] });

test("reconciliation detects every release-blocking invariant category", () => {
  const snapshot = clean();
  snapshot.ownership.push({ table: "student_profile", id: "student-1", tenantId: "unknown" });
  snapshot.relationships.push({ table: "class_membership", id: "membership-1", tenantId: "tenant-a", relatedTenantId: "tenant-b" });
  snapshot.identifiers.push({ kind: "NISN", tenantId: "tenant-a", valueHash: "sha256:a", recordIds: ["student-1", "student-2"] });
  snapshot.periods.push({ kind: "student-lifecycle", tenantId: "tenant-a", ownerId: "student-1", firstId: "period-1", secondId: "period-2", overlaps: true });
  snapshot.activeStates.push({ kind: "academic-year", tenantId: "tenant-a", ownerId: "year-1", valid: false });
  snapshot.archives.push({ kind: "class-membership", tenantId: "tenant-a", recordId: "membership-1", archivedOwnerId: "student-1", prohibited: true });
  snapshot.histories.push({ kind: "student", tenantId: "tenant-a", recordId: "student-1", hasHistory: false, hasAuditActorAndTime: false });
  snapshot.imports.push({ tenantId: "tenant-a", executionId: "execution-1", rowId: "row-1", ownershipMatches: false, successMarkers: 2, resultMatches: false, aggregateMatches: false });
  snapshot.accounts.push({ tenantId: "tenant-a", personId: "person-1", createdByImport: true });
  snapshot.overviewCounts.push({ tenantId: "tenant-a", key: "active-students", overview: 2, authoritative: 1 });

  const report = reconcileMasterData(snapshot);
  assert.equal(report.ok, false);
  assert.deepEqual(new Set(report.violations.map((item) => item.code)), new Set(["unknown-tenant", "cross-tenant-relationship", "duplicate-identifier", "overlapping-period", "invalid-active-state", "archive-misuse", "missing-audit-history", "import-ownership-mismatch", "import-double-success", "import-result-mismatch", "import-aggregate-mismatch", "accidental-account-creation", "overview-count-drift"]));
  assert.equal(JSON.stringify(report).includes("sha256:a"), false, "identifier fingerprints must not be emitted");
});

test("clean reconciliation is read-only evidence with zero violations", () => {
  assert.deepEqual(reconcileMasterData(clean()), { ok: true, checked: { tenants: 2 }, violations: [] });
});
