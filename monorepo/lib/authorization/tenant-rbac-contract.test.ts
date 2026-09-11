import assert from "node:assert/strict";
import test from "node:test";

import {
  LEGACY_NON_ADMIN_ROLES,
  OPERATION_MAP_VERSION,
  PERMISSION_REGISTRY_VERSION,
  permissionRegistry,
  permissionRegistryDigest,
  resolveActivePermission,
  resolveLegacyPermissionKeys,
  tenantOperationMap,
  tenantOperationMapDigest,
  validateCustomRolePermissions,
  validatePermissionRegistry,
  validateTenantRbacContract,
  type PermissionDefinition,
} from "@/lib/authorization/tenant-rbac-contract";

const legacyMinimum = [
  "tenant.dashboard.view",
  "tenant.users.view",
  "tenant.users.view-contact",
  "tenant.users.view-sensitive",
];

test("the approved registry and operation map form a valid executable contract", () => {
  assert.equal(PERMISSION_REGISTRY_VERSION, "tenant-permissions@2");
  assert.equal(OPERATION_MAP_VERSION, "tenant-operations@4");
  assert.equal(permissionRegistry.length, 166);
  assert.match(permissionRegistryDigest, /^[a-f0-9]{64}$/);
  assert.match(tenantOperationMapDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(validateTenantRbacContract(), []);
});

test("PPDB document and export operations require explicit sensitive permissions", () => {
  const document = tenantOperationMap.find((operation) => operation.id === "ppdb.documents.download");
  assert.deepEqual(document?.requiredPermissions, ["ppdb.documents.download", "ppdb.documents.view-sensitive"]);
  assert.deepEqual(document?.supplementalPermissions, ["ppdb.documents.view-sensitive"]);

  const exportOperation = tenantOperationMap.find((operation) => operation.id === "ppdb.submissions.export");
  assert.deepEqual(exportOperation?.requiredPermissions, ["ppdb.submissions.export", "ppdb.submissions.view-sensitive"]);
  assert.equal(exportOperation?.entryPoints.some((entry) => entry.includes("ppdb/submissions/export")), true);
});

test("every permission exposes stable Indonesian catalog metadata", () => {
  for (const permission of permissionRegistry) {
    assert.equal(permission.key, `${permission.module}.${permission.resource}.${permission.action}`);
    assert.ok(permission.labelId.trim().length > 0, permission.key);
    assert.ok(permission.descriptionId.trim().length > 0, permission.key);
    assert.ok(permission.groupId.trim().length > 0, permission.key);
    assert.ok(Number.isSafeInteger(permission.order), permission.key);
    assert.ok(Array.isArray(permission.dependencies), permission.key);
    assert.ok(Array.isArray(permission.replacements), permission.key);
  }
});

test("absensi module wires a real operation and excluded placeholders become tenant-rbac admin-only", () => {
  const absensiKey = resolveActivePermission("absensi.attendance.view");
  assert.equal(absensiKey?.lifecycle, "active");
  assert.equal(absensiKey?.assignment, "tenant-assignable");
  assert.deepEqual(validateCustomRolePermissions(["absensi.attendance.view"]), {
    ok: true,
    permissions: ["absensi.attendance.view"],
  });

  const absensiLoad = tenantOperationMap.find((operation) => operation.id === "absensi.attendance.load");
  assert.ok(absensiLoad);
  assert.equal(absensiLoad.classification, "tenant-rbac");
  assert.deepEqual(absensiLoad.requiredPermissions, ["absensi.attendance.view"]);
  assert.ok(absensiLoad.entryPoints.some((entry) => entry === "page:app/(tenant)/[domain]/(authenticated)/absensi/page.tsx"));

  const absensiDelete = tenantOperationMap.find((operation) => operation.id === "absensi.history.delete");
  assert.ok(absensiDelete);
  assert.equal(absensiDelete.classification, "tenant-rbac");
  assert.equal(absensiDelete.operationalGate, "write");
  assert.deepEqual(absensiDelete.requiredPermissions, ["absensi.history.delete"]);
  assert.ok(absensiDelete.entryPoints.some((entry) => entry === "action:app/(tenant)/[domain]/(authenticated)/absensi/actions.ts#deleteHistorySessionAction"));
  assert.ok(absensiDelete.entryPoints.some((entry) => entry === "action:app/(tenant)/[domain]/(authenticated)/absensi/actions.ts#deleteHistoryRecordAction"));

  assert.equal(tenantOperationMap.some((operation) => operation.id === "placeholder.absensi"), false);

  const absensiSave = tenantOperationMap.find((operation) => operation.id === "absensi.settings.save");
  assert.ok(absensiSave);
  assert.equal(absensiSave.classification, "tenant-rbac");
  assert.equal(absensiSave.operationalGate, "write");
  assert.deepEqual(absensiSave.requiredPermissions, ["absensi.settings.update"]);
  assert.ok(absensiSave.entryPoints.some((entry) => entry === "action:app/(tenant)/[domain]/(authenticated)/absensi/actions.ts#saveAbsensiConfigAction"));

  for (const id of ["e-library.load", "jadwal.mengajar.load", "jadwal.events.load", "persuratan.load", "settings.backup-restore.load", "integrasi.load", "integrasi.whatsapp-bot.load", "integrasi.whatsapp-bot.update", "integrasi.whatsapp-bot.send", "integrasi.whatsapp-bot.history.load"]) {
    const operation = tenantOperationMap.find((candidate) => candidate.id === id);
    assert.ok(operation, id);
    assert.equal(operation.classification, "tenant-rbac", id);
    assert.deepEqual(operation.requiredPermissions, ["tenant.authorization-audit.view"], id);
  }

  const whatsappBotLoad = tenantOperationMap.find((candidate) => candidate.id === "integrasi.whatsapp-bot.load");
  assert.ok(whatsappBotLoad);
  assert.ok(whatsappBotLoad.entryPoints.some((entry) => entry === "page:app/(tenant)/[domain]/(authenticated)/integrasi/whatsapp/akun/page.tsx"));

  const whatsappBotUpdate = tenantOperationMap.find((candidate) => candidate.id === "integrasi.whatsapp-bot.update");
  assert.ok(whatsappBotUpdate);
  assert.equal(whatsappBotUpdate.operationalGate, "write");
  assert.ok(whatsappBotUpdate.entryPoints.some((entry) => entry === "action:app/(tenant)/[domain]/(authenticated)/integrasi/whatsapp/actions.ts#connectWhatsAppBotAction"));
  assert.ok(whatsappBotUpdate.entryPoints.some((entry) => entry === "action:app/(tenant)/[domain]/(authenticated)/integrasi/whatsapp/actions.ts#disconnectWhatsAppBotAction"));

  const whatsappBotSend = tenantOperationMap.find((candidate) => candidate.id === "integrasi.whatsapp-bot.send");
  assert.ok(whatsappBotSend);
  assert.equal(whatsappBotSend.operationalGate, "write");
  assert.ok(whatsappBotSend.entryPoints.some((entry) => entry === "action:app/(tenant)/[domain]/(authenticated)/integrasi/whatsapp/actions.ts#sendWhatsAppMessageAction"));
});

test("role and assignment administration permissions are active but remain non-assignable", () => {
  assert.equal(resolveActivePermission("tenant.dashboard.view")?.key, "tenant.dashboard.view");
  assert.equal(resolveActivePermission("tenant.roles.change-permissions")?.key, "tenant.roles.change-permissions");
  assert.equal(resolveActivePermission("tenant.accounts.deactivate")?.key, "tenant.accounts.deactivate");
  assert.equal(resolveActivePermission("unknown.resource.view"), null);

  const privileged = permissionRegistry.find((entry) => entry.key === "tenant.roles.change-permissions");
  assert.equal(privileged?.lifecycle, "active");
  assert.equal(privileged?.assignment, "school-admin-only");

  assert.deepEqual(validateCustomRolePermissions(["tenant.roles.change-permissions"]), {
    ok: false,
    issues: [{ code: "permission-not-assignable", key: "tenant.roles.change-permissions" }],
  });
  assert.deepEqual(validateCustomRolePermissions(["unknown.resource.view"]), {
    ok: false,
    issues: [{ code: "unknown-permission", key: "unknown.resource.view" }],
  });
});

test("dashboard, directory, settings, and school profile use exact operations and projections", () => {
  const dashboard = tenantOperationMap.find((operation) => operation.id === "tenant.dashboard.load");
  assert.deepEqual(dashboard?.requiredPermissions, ["tenant.dashboard.view"]);

  const directory = tenantOperationMap.find((operation) => operation.id === "tenant.users.load");
  assert.deepEqual(directory?.requiredPermissions, [
    "tenant.users.view",
    "tenant.users.view-contact",
    "tenant.users.view-sensitive",
  ]);
  assert.equal(directory?.permissionMode, "conditional");
  assert.deepEqual(directory?.supplementalPermissions, [
    "tenant.users.view-contact",
    "tenant.users.view-sensitive",
  ]);
  assert.deepEqual(directory?.legacyAuthority, ["tenantRole"]);

  const accountLifecycle = tenantOperationMap.find((operation) => operation.id === "tenant.accounts.view");
  assert.equal(accountLifecycle?.entryPoints.some((entry) => entry.includes("/users/page.tsx")), false);
  assert.deepEqual(accountLifecycle?.requiredPermissions, ["tenant.accounts.view"]);

  const settings = tenantOperationMap.find((operation) => operation.id === "tenant-settings.landing-page.load");
  assert.deepEqual(settings?.requiredPermissions, ["tenant-settings.landing-page.view"]);
  assert.equal(settings?.entitlement, "none");

  const profile = tenantOperationMap.find((operation) => operation.id === "school-profile.load");
  assert.equal(profile?.permissionMode, "conditional");
  assert.deepEqual(profile?.supplementalPermissions, ["school-profile.profile.view-sensitive"]);
});

test("academic operations use exact operation permissions and independent write gates", () => {
  const expected = {
    "academic-years.load": ["academic-years.years.view"],
    "academic-years.create": ["academic-years.years.create"],
    "academic-years.manage-lifecycle": ["academic-years.years.manage-lifecycle"],
    "academic-years.archive": ["academic-years.years.archive", "academic-years.years.restore"],
    "subjects.load": ["subjects.subjects.view"],
    "subjects.create": ["subjects.subjects.create"],
    "subjects.update": ["subjects.subjects.update"],
    "subjects.archive-or-restore": ["subjects.subjects.archive", "subjects.subjects.restore"],
    "class-groups.load": [
      "class-groups.groups.view",
      "people.people.view",
      "students.students.view",
      "teachers.teachers.view",
    ],
    "class-groups.create": ["class-groups.groups.create"],
    "class-groups.update": ["class-groups.groups.update"],
    "class-groups.lifecycle": [
      "class-groups.groups.manage-lifecycle",
      "class-groups.groups.archive",
      "class-groups.groups.restore",
    ],
    "class-groups.memberships.assign": ["class-groups.memberships.assign"],
    "class-groups.relationships.manage": [
      "class-groups.memberships.transfer",
      "class-groups.homerooms.assign",
    ],
  } as const;

  for (const [id, permissions] of Object.entries(expected)) {
    const operation = tenantOperationMap.find((candidate) => candidate.id === id);
    assert.ok(operation, id);
    assert.deepEqual(operation.requiredPermissions, permissions, id);
    assert.ok(operation.entryPoints.length > 0, id);
    assert.equal(operation.legacyAuthority.includes("broad-master-data"), true, id);
    assert.equal(operation.requiredPermissions.some((key) => new Set<string>(["master-data.read", "master-data.write"]).has(key)), false, id);
    if (id.endsWith(".load")) {
      assert.equal(operation.operationalGate, "read", id);
    } else {
      assert.equal(operation.operationalGate, "write", id);
    }
  }
});

test("custom roles reject privileged keys and incomplete dependency selections", () => {
  assert.deepEqual(validateCustomRolePermissions(["tenant.onboarding.complete"]), {
    ok: false,
    issues: [{ code: "permission-not-assignable", key: "tenant.onboarding.complete" }],
  });
  assert.deepEqual(validateCustomRolePermissions(["tenant.users.view-sensitive"]), {
    ok: false,
    issues: [{ code: "missing-dependency", key: "tenant.users.view-sensitive", dependency: "tenant.users.view" }],
  });
  assert.deepEqual(validateCustomRolePermissions(["tenant.users.view", "tenant.users.view-sensitive"]), {
    ok: true,
    permissions: ["tenant.users.view", "tenant.users.view-sensitive"],
  });
});

test("registry validation rejects malformed keys, duplicates, cycles, and invalid deprecation", () => {
  const base: PermissionDefinition = {
    key: "tenant.widgets.view",
    module: "tenant",
    resource: "widgets",
    action: "view",
    labelId: "Lihat widget",
    descriptionId: "Melihat widget Tenant.",
    groupId: "Pengguna & Keamanan",
    order: 1,
    dependencies: [],
    risk: "low",
    assignment: "tenant-assignable",
    lifecycle: "active",
    replacements: [],
  };

  const malformed = { ...base, key: "Tenant.widgets.view" };
  const deprecated = { ...base, key: "tenant.widgets.old", action: "old", lifecycle: "deprecated" as const };
  const first = { ...base, dependencies: ["tenant.gadgets.view"] };
  const second = {
    ...base,
    key: "tenant.gadgets.view",
    resource: "gadgets",
    dependencies: ["tenant.widgets.view"],
  };
  const issues = validatePermissionRegistry([base, base, malformed, deprecated, first, second]);
  assert.ok(issues.some((issue) => issue.code === "duplicate-key"));
  assert.ok(issues.some((issue) => issue.code === "malformed-key"));
  assert.ok(issues.some((issue) => issue.code === "deprecated-without-replacement"));
  assert.ok(issues.some((issue) => issue.code === "dependency-cycle"));
});

test("legacy non-admin equivalence grants exactly L0 and unknown roles fail closed", () => {
  assert.deepEqual(LEGACY_NON_ADMIN_ROLES, ["pimpinan", "staff", "guru", "siswa", "guest"]);
  for (const role of LEGACY_NON_ADMIN_ROLES) {
    assert.deepEqual(resolveLegacyPermissionKeys(role), legacyMinimum, role);
  }
  assert.deepEqual(resolveLegacyPermissionKeys("school-admin"), []);
  assert.deepEqual(resolveLegacyPermissionKeys("future-role"), []);

  const currentKeys = tenantOperationMap
    .filter((operation) => operation.lifecycle === "active")
    .flatMap((operation) => operation.requiredPermissions);
  for (const key of currentKeys) {
    if (!legacyMinimum.includes(key)) {
      assert.equal(resolveLegacyPermissionKeys("guru").includes(key), false, key);
    }
  }
});

test("digests are deterministic and bind versions to canonical content", async () => {
  const first = await import("@/lib/authorization/tenant-rbac-contract");
  const second = await import("@/lib/authorization/tenant-rbac-contract");
  assert.equal(first.permissionRegistryDigest, second.permissionRegistryDigest);
  assert.equal(first.tenantOperationMapDigest, second.tenantOperationMapDigest);
  assert.notEqual(permissionRegistryDigest, tenantOperationMapDigest);
});
