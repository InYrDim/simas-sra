import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { tenantOperationMap } from "@/lib/authorization/tenant-rbac-contract";

const repositoryRoot = new URL("../..", import.meta.url);

const operation = (
  id: string,
  permissions: readonly string[],
  entryPoints: readonly string[],
  gate: "read" | "write",
) => ({ id, permissions, entryPoints, gate });

const expectedOperations = [
  operation(
    "facilities.load",
    ["facilities.locations.view"],
    ["page:app/(tenant)/[domain]/(authenticated)/master/sarpras/page.tsx"],
    "read",
  ),
  operation(
    "facilities.create",
    ["facilities.locations.create"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/sarpras/actions.ts#createLocationAction"],
    "write",
  ),
  operation(
    "facilities.update",
    ["facilities.locations.update"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/sarpras/actions.ts#editLocationAction"],
    "write",
  ),
  operation(
    "facilities.archive-or-restore",
    ["facilities.locations.archive", "facilities.locations.restore"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/sarpras/actions.ts#manageLocationAction"],
    "write",
  ),
  operation(
    "assets.load",
    ["assets.assets.view", "facilities.locations.view"],
    ["page:app/(tenant)/[domain]/(authenticated)/master/sarpras/aset/page.tsx"],
    "read",
  ),
  operation(
    "assets.create",
    ["assets.assets.create"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/sarpras/aset/actions.ts#createAssetAction"],
    "write",
  ),
  operation(
    "assets.update",
    ["assets.assets.update"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/sarpras/aset/actions.ts#editAssetAction"],
    "write",
  ),
  operation(
    "assets.inventory.adjust",
    ["assets.inventory.adjust"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/sarpras/aset/actions.ts#changeInventoryAction"],
    "write",
  ),
  operation(
    "assets.archive-or-restore",
    ["assets.assets.archive", "assets.assets.restore"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/sarpras/aset/actions.ts#manageAssetAction"],
    "write",
  ),
  operation(
    "student-organizations.load",
    ["student-organizations.organizations.view", "people.people.view", "students.students.view"],
    ["page:app/(tenant)/[domain]/(authenticated)/master/organisasi/page.tsx"],
    "read",
  ),
  operation(
    "student-organizations.create",
    ["student-organizations.organizations.create"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/actions.ts#createOrganizationAction"],
    "write",
  ),
  operation(
    "student-organizations.archive",
    ["student-organizations.organizations.archive"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/actions.ts#archiveOrganizationAction"],
    "write",
  ),
  operation(
    "student-organizations.periods.create",
    ["student-organizations.periods.create"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/actions.ts#createPeriodAction"],
    "write",
  ),
  operation(
    "student-organizations.periods.lifecycle",
    ["student-organizations.periods.manage-lifecycle"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/actions.ts#transitionPeriodAction"],
    "write",
  ),
  operation(
    "student-organizations.periods.correct",
    ["student-organizations.periods.correct"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/actions.ts#correctPeriodAction"],
    "write",
  ),
  operation(
    "student-organizations.memberships.assign",
    ["student-organizations.memberships.assign"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/actions.ts#addMembershipAction"],
    "write",
  ),
  operation(
    "student-organizations.memberships.unassign",
    ["student-organizations.memberships.unassign"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/actions.ts#endMembershipAction"],
    "write",
  ),
  operation(
    "student-organizations.leadership.assign",
    ["student-organizations.leadership.assign"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/actions.ts#assignLeadershipAction"],
    "write",
  ),
  operation(
    "student-organizations.leadership.unassign",
    ["student-organizations.leadership.unassign"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/actions.ts#endLeadershipAction"],
    "write",
  ),
  operation(
    "extracurriculars.load",
    [
      "extracurriculars.extracurriculars.view",
      "people.people.view",
      "students.students.view",
      "teachers.teachers.view",
      "staff.staff.view",
    ],
    ["page:app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/page.tsx"],
    "read",
  ),
  operation(
    "extracurriculars.create",
    ["extracurriculars.extracurriculars.create"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/actions.ts#createExtracurricularAction"],
    "write",
  ),
  operation(
    "extracurriculars.archive",
    ["extracurriculars.extracurriculars.archive"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/actions.ts#archiveExtracurricularAction"],
    "write",
  ),
  operation(
    "extracurriculars.groups.create",
    ["extracurriculars.groups.create"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/actions.ts#createGroupAction"],
    "write",
  ),
  operation(
    "extracurriculars.groups.lifecycle",
    ["extracurriculars.groups.manage-lifecycle"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/actions.ts#transitionGroupAction"],
    "write",
  ),
  operation(
    "extracurriculars.advisors.assign",
    ["extracurriculars.advisors.assign"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/actions.ts#assignAdvisorAction"],
    "write",
  ),
  operation(
    "extracurriculars.advisors.unassign",
    ["extracurriculars.advisors.unassign"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/actions.ts#endAdvisorAction"],
    "write",
  ),
  operation(
    "extracurriculars.participants.assign",
    ["extracurriculars.participants.assign"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/actions.ts#enrollParticipantAction"],
    "write",
  ),
  operation(
    "extracurriculars.participants.unassign",
    ["extracurriculars.participants.unassign"],
    ["action:app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/actions.ts#endParticipantAction"],
    "write",
  ),
] as const;

const targetedSourceFiles = [
  "app/(tenant)/[domain]/(authenticated)/master/sarpras/page.tsx",
  "app/(tenant)/[domain]/(authenticated)/master/sarpras/actions.ts",
  "app/(tenant)/[domain]/(authenticated)/master/sarpras/aset/page.tsx",
  "app/(tenant)/[domain]/(authenticated)/master/sarpras/aset/actions.ts",
  "app/(tenant)/[domain]/(authenticated)/master/organisasi/page.tsx",
  "app/(tenant)/[domain]/(authenticated)/master/organisasi/actions.ts",
  "app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/page.tsx",
  "app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/actions.ts",
] as const;

async function source(path: string) {
  return readFile(new URL(path, repositoryRoot), "utf8");
}

test("issue #27 preserves canonical operation-level authorization", () => {
  const broadPermissions = new Set(["master-data.read", "master-data.write"]);

  for (const expected of expectedOperations) {
    const actual = tenantOperationMap.find((candidate) => candidate.id === expected.id);
    assert.ok(actual, expected.id);
    assert.deepEqual(actual.requiredPermissions, expected.permissions, expected.id);
    assert.deepEqual(actual.entryPoints, expected.entryPoints, expected.id);
    assert.equal(actual.operationalGate, expected.gate, expected.id);
    assert.equal(actual.requiredPermissions.some((permission) => broadPermissions.has(permission)), false, expected.id);
  }
});

test("issue #27 pages and actions use operation enforcement without broad checks", async () => {
  for (const path of targetedSourceFiles) {
    const contents = await source(path);
    assert.match(contents, /enforceTenantMasterDataOperation/, path);
    assert.doesNotMatch(contents, /enforceMasterDataAccess/, path);
    assert.doesNotMatch(contents, /capabilities\.write/, path);
  }
});

test("issue #27 does not expose sensitive projections or unguarded exports", async () => {
  const sensitiveFields = /\b(?:nik|nip|phone|email|workUnit|positionAssignments|servicePeriods)\b/;
  for (const path of [
    "app/(tenant)/[domain]/(authenticated)/master/sarpras/page.tsx",
    "app/(tenant)/[domain]/(authenticated)/master/sarpras/aset/page.tsx",
    "app/(tenant)/[domain]/(authenticated)/master/organisasi/page.tsx",
    "app/(tenant)/[domain]/(authenticated)/master/organisasi/ekstrakurikuler/page.tsx",
  ]) {
    assert.doesNotMatch(await source(path), sensitiveFields, path);
  }

  const targetOperations = tenantOperationMap.filter((candidate) =>
    ["facilities", "assets", "student-organizations", "extracurriculars"].some((module) => candidate.id.startsWith(`${module}.`)),
  );
  for (const candidate of targetOperations) {
    assert.equal(candidate.entryPoints.some((entry) => /export|download/i.test(entry)), false, candidate.id);
    assert.equal(candidate.requiredPermissions.some((permission) => /view-sensitive|\.export$|\.download$/.test(permission)), false, candidate.id);
  }
});

test("free-text staff work units do not define delegated authorization scope", async () => {
  const staffLoad = tenantOperationMap.find((candidate) => candidate.id === "staff.load");
  assert.equal(staffLoad?.contextualPolicy, "self");
  const routeAccess = await source("lib/authorization/tenant-operation-route-access.ts");
  assert.doesNotMatch(routeAccess, /workUnit/);
});
