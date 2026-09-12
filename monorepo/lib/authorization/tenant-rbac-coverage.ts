import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { tenantOperationMap, type OperationClassification } from "@/lib/authorization/tenant-rbac-contract";

export type AuthorityMarker = "broad-master-data" | "entitlement" | "legacy-school-admin" | "tenantRole" | "capability-aggregate";

export type DiscoveredEntryPoint = Readonly<{
  id: string;
  authorityMarkers: readonly AuthorityMarker[];
}>;

export type MappedEntryPoint = Readonly<{
  id: string;
  classification: OperationClassification;
  permissions: readonly string[];
  declaredAuthorityMarkers: readonly string[];
}>;

export type CoverageIssue = Readonly<{
  code: "unmapped-entry-point" | "missing-entry-point" | "undeclared-authority-decision" | "placeholder-has-permission";
  entryPoint: string;
  marker?: string;
}>;

export type CoverageReport = Readonly<{
  discoveredEntryPoints: readonly DiscoveredEntryPoint[];
  mappedEntryPoints: readonly MappedEntryPoint[];
  issues: readonly CoverageIssue[];
}>;

export function analyzeTenantAuthorizationCoverage(input: {
  discoveredEntryPoints: readonly DiscoveredEntryPoint[];
  mappedEntryPoints: readonly MappedEntryPoint[];
}): CoverageReport {
  const issues: CoverageIssue[] = [];
  const discovered = new Map(input.discoveredEntryPoints.map((entry) => [entry.id, entry]));
  const mapped = new Map(input.mappedEntryPoints.map((entry) => [entry.id, entry]));

  for (const entry of input.discoveredEntryPoints) {
    const contract = mapped.get(entry.id);
    if (!contract) issues.push({ code: "unmapped-entry-point", entryPoint: entry.id });
    for (const marker of entry.authorityMarkers) {
      if (!contract?.declaredAuthorityMarkers.includes(marker)) {
        issues.push({ code: "undeclared-authority-decision", entryPoint: entry.id, marker });
      }
    }
  }
  for (const entry of input.mappedEntryPoints) {
    if (!discovered.has(entry.id)) issues.push({ code: "missing-entry-point", entryPoint: entry.id });
    if (entry.classification === "placeholder" && entry.permissions.length) issues.push({ code: "placeholder-has-permission", entryPoint: entry.id });
  }
  return {
    discoveredEntryPoints: [...input.discoveredEntryPoints].sort((left, right) => left.id.localeCompare(right.id)),
    mappedEntryPoints: [...input.mappedEntryPoints].sort((left, right) => left.id.localeCompare(right.id)),
    issues,
  };
}

function authorityMarkers(source: string): AuthorityMarker[] {
  const markers: AuthorityMarker[] = [];
  if (source.includes("enforceMasterDataAccess")) markers.push("broad-master-data");
  if (source.includes("enforceTenantFeatureAccess")) markers.push("entitlement");
  if (source.includes("requireTenantFeatureAccess") || source.includes("tenantProtectedAction")) markers.push("legacy-school-admin");
  if (/\btenantRole\b/.test(source)) markers.push("tenantRole");
  if (/principal\.capabilities/.test(source)) markers.push("capability-aggregate");
  return markers;
}

async function filesBelow(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(root, entry.name);
    return entry.isDirectory() ? filesBelow(fullPath) : [fullPath];
  }));
  return nested.flat();
}

function relative(root: string, file: string): string {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

async function discoverEntryPoints(root: string): Promise<DiscoveredEntryPoint[]> {
  const authenticatedRoot = path.join(root, "app", "(tenant)", "[domain]", "(authenticated)");
  const files = await filesBelow(authenticatedRoot);
  const discovered: DiscoveredEntryPoint[] = [];
  for (const file of files) {
    if (!/\.(?:ts|tsx)$/.test(file)) continue;
    const source = await readFile(file, "utf8");
    const markers = authorityMarkers(source);
    const filePath = relative(root, file);
    if (file.endsWith(`${path.sep}page.tsx`)) {
      discovered.push({ id: `page:${filePath}`, authorityMarkers: markers });
      continue;
    }
    if (filePath === "app/(tenant)/[domain]/(authenticated)/layout.tsx") {
      discovered.push({ id: `layout:${filePath}`, authorityMarkers: markers });
      continue;
    }
    if (file.endsWith(`${path.sep}route.ts`)) {
      for (const match of source.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)) {
        discovered.push({ id: `route:${filePath.slice(0, -"/route.ts".length)}/route.ts#${match[1]}`, authorityMarkers: markers });
      }
      continue;
    }
    if (/^[\s\S]*?["']use server["'];/.test(source)) {
      for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|export\s+const\s+([A-Za-z_$][\w$]*)/g)) {
        const name = match[1] ?? match[2];
        discovered.push({ id: `action:${filePath}#${name}`, authorityMarkers: markers });
      }
    }
  }
  for (const worker of ["scripts/run-people-import-validation.ts", "scripts/run-people-import-execution.ts"]) {
    const source = await readFile(path.join(root, worker), "utf8");
    discovered.push({ id: `worker:${worker}`, authorityMarkers: authorityMarkers(source) });
  }
  return discovered;
}

function mappedEntryPoints(): MappedEntryPoint[] {
  const entries = new Map<string, { classification: OperationClassification; permissions: Set<string>; markers: Set<string> }>();
  for (const operation of tenantOperationMap) {
    for (const id of operation.entryPoints) {
      if (id.startsWith("target:") || id.startsWith("command:")) continue;
      const current = entries.get(id) ?? { classification: operation.classification, permissions: new Set(), markers: new Set() };
      if (operation.classification === "tenant-rbac") current.classification = "tenant-rbac";
      for (const permission of operation.requiredPermissions) current.permissions.add(permission);
      for (const marker of operation.legacyAuthority) current.markers.add(marker);
      entries.set(id, current);
    }
  }
  return [...entries].map(([id, entry]) => ({
    id,
    classification: entry.classification,
    permissions: [...entry.permissions],
    declaredAuthorityMarkers: [...entry.markers],
  }));
}

export async function checkTenantAuthorizationCoverage(root: URL | string): Promise<CoverageReport> {
  const rootPath = root instanceof URL ? fileURLToPath(root) : root;
  return analyzeTenantAuthorizationCoverage({
    discoveredEntryPoints: await discoverEntryPoints(rootPath),
    mappedEntryPoints: mappedEntryPoints(),
  });
}
