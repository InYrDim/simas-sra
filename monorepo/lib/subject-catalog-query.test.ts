import assert from "node:assert/strict";
import test from "node:test";

import { querySubjects } from "@/lib/subject-catalog-query";
import type { Subject } from "@/lib/subject-catalog";

const base = { tenantId: "tenant-1", description: null, version: 1, createdAt: new Date(), updatedAt: new Date(), archivedAt: null };
const subjects: Subject[] = [
  { ...base, id: "1", code: "MAT", normalizedCode: "MAT", name: "Matematika", normalizedName: "matematika", educationLevels: ["SMA"], archived: false },
  { ...base, id: "2", code: "BIO", normalizedCode: "BIO", name: "Biologi", normalizedName: "biologi", educationLevels: ["SMA", "SMP"], archived: false },
  { ...base, id: "3", code: "IPA", normalizedCode: "IPA", name: "Ilmu Pengetahuan Alam", normalizedName: "ilmu pengetahuan alam", educationLevels: ["SMP"], archived: true },
];

test("queries Mata Pelajaran by normalized code/name, archive, sort, and page", () => {
  const result = querySubjects(subjects, { q: "  bio ", level: "SMP", archive: "active", sort: "name-desc", page: "1", pageSize: "25", selected: "2" });
  assert.deepEqual(result.items.map((subject) => subject.id), ["2"]);
  assert.equal(result.total, 1);
  assert.equal(result.query.selected, "2");
  assert.deepEqual(result.query.filters, {});
});

test("distinguishes true empty from filtered no-results and clamps out-of-range pages", () => {
  assert.equal(querySubjects([], {}).state, "empty");
  const noResults = querySubjects(subjects, { q: "tidak ada" });
  assert.equal(noResults.state, "no-results");
  const paged = querySubjects(subjects, { archive: "all", page: "99", pageSize: "25" });
  assert.equal(paged.query.page, 1);
  assert.equal(paged.items.length, 3);
});
