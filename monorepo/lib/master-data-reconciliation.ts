export type ReconciliationSnapshot = {
  tenants: string[];
  ownership: { table: string; id: string; tenantId: string | null }[];
  relationships: { table: string; id: string; tenantId: string; relatedTenantId: string | null }[];
  identifiers: { kind: string; tenantId: string; valueHash: string; recordIds: string[] }[];
  periods: { kind: string; tenantId: string; ownerId: string; firstId: string; secondId: string; overlaps: boolean }[];
  activeStates: { kind: string; tenantId: string; ownerId: string; valid: boolean }[];
  archives: { kind: string; tenantId: string; recordId: string; archivedOwnerId: string; prohibited: boolean }[];
  histories: { kind: string; tenantId: string; recordId: string; hasHistory: boolean; hasAuditActorAndTime: boolean }[];
  imports: { tenantId: string; executionId: string; rowId: string; ownershipMatches: boolean; successMarkers: number; resultMatches: boolean; aggregateMatches: boolean }[];
  accounts: { tenantId: string; personId: string; createdByImport: boolean }[];
  overviewCounts: { tenantId: string; key: string; overview: number; authoritative: number }[];
};
export type ReconciliationViolation = Readonly<{ code: string; tenantId?: string | null; kind: string; ids: readonly string[]; count: number }>;

export function reconcileMasterData(snapshot: ReconciliationSnapshot) {
  const known = new Set(snapshot.tenants), violations: ReconciliationViolation[] = [];
  const add = (code: string, tenantId: string | null | undefined, kind: string, ids: string[]) => violations.push({ code, tenantId, kind, ids, count: ids.length });
  for (const x of snapshot.ownership) if (!x.tenantId || !known.has(x.tenantId)) add("unknown-tenant", x.tenantId, x.table, [x.id]);
  for (const x of snapshot.relationships) if (!x.relatedTenantId || x.tenantId !== x.relatedTenantId) add("cross-tenant-relationship", x.tenantId, x.table, [x.id]);
  for (const x of snapshot.identifiers) if (x.recordIds.length > 1) add("duplicate-identifier", x.tenantId, x.kind, x.recordIds);
  for (const x of snapshot.periods) if (x.overlaps) add("overlapping-period", x.tenantId, x.kind, [x.ownerId, x.firstId, x.secondId]);
  for (const x of snapshot.activeStates) if (!x.valid) add("invalid-active-state", x.tenantId, x.kind, [x.ownerId]);
  for (const x of snapshot.archives) if (x.prohibited) add("archive-misuse", x.tenantId, x.kind, [x.recordId, x.archivedOwnerId]);
  for (const x of snapshot.histories) if (!x.hasHistory || !x.hasAuditActorAndTime) add("missing-audit-history", x.tenantId, x.kind, [x.recordId]);
  for (const x of snapshot.imports) {
    if (!x.ownershipMatches) add("import-ownership-mismatch", x.tenantId, "import", [x.executionId, x.rowId]);
    if (x.successMarkers > 1) add("import-double-success", x.tenantId, "import", [x.executionId, x.rowId]);
    if (!x.resultMatches) add("import-result-mismatch", x.tenantId, "import", [x.executionId, x.rowId]);
    if (!x.aggregateMatches) add("import-aggregate-mismatch", x.tenantId, "import", [x.executionId]);
  }
  for (const x of snapshot.accounts) if (x.createdByImport) add("accidental-account-creation", x.tenantId, "school-person", [x.personId]);
  for (const x of snapshot.overviewCounts) if (x.overview !== x.authoritative) add("overview-count-drift", x.tenantId, x.key, []);
  return { ok: violations.length === 0, checked: { tenants: snapshot.tenants.length }, violations };
}
