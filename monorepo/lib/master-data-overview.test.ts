import assert from "node:assert/strict";
import test from "node:test";

import { buildMasterDataOverview } from "@/lib/master-data-overview";

test("overview counts use the same deterministic predicates as their deep links", () => {
  const overview = buildMasterDataOverview("sekolah-a", {
    students: [
      { id: "student-1", active: true, archived: false, currentClassGroupId: null },
      { id: "student-2", active: true, archived: false, currentClassGroupId: "class-1" },
      { id: "student-3", active: false, archived: false, currentClassGroupId: null },
    ],
    teachers: [{ id: "teacher-1", active: true, archived: false }],
    staff: [], subjects: [{ id: "subject-1", archived: false }],
    classGroups: [{ id: "class-1", active: true, archived: false, homeroomTeacherId: null }],
    assets: [{ id: "asset-1", archived: false, condition: "damaged" }],
    organizations: [], extracurriculars: [], academicYears: [{ id: "year-1", active: true, archived: false }],
    activities: [],
  });

  assert.equal(overview.counts.find((item) => item.key === "active-students")?.value, 2);
  assert.deepEqual(overview.exceptions.map(({ key, value, href }) => ({ key, value, href })), [
    { key: "active-students-review", value: 2, href: "/sekolah-a/master/siswa?status=active" },
    { key: "active-classes-review", value: 1, href: "/sekolah-a/master/rombel?lifecycle=active" },
    { key: "damaged-assets-review", value: 1, href: "/sekolah-a/master/sarpras?condition=damaged" },
  ]);
  assert.equal("score" in overview, false);
});

test("recent activity projection never includes sensitive payloads", () => {
  const overview = buildMasterDataOverview("sekolah-a", { students: [], teachers: [], staff: [], subjects: [], classGroups: [], assets: [], organizations: [], extracurriculars: [], academicYears: [], activities: [] }, [
    { id: "audit-1", entity: "Siswa", operation: "edited", actorLabel: "Admin Sekolah", occurredAt: new Date("2026-07-21T10:00:00Z"), sensitiveBefore: { nik: "secret" }, sensitiveAfter: { nik: "secret-2" } },
  ]);
  assert.deepEqual(overview.recentActivity, [{ id: "audit-1", entity: "Siswa", operation: "edited", actorLabel: "Admin Sekolah", occurredAt: new Date("2026-07-21T10:00:00Z") }]);
});
