import assert from "node:assert/strict";
import test from "node:test";
import { queryClassGroups } from "@/lib/class-group-query";
import type { ClassGroup } from "@/lib/class-group";
const record = (id: string, name: string, lifecycle: ClassGroup["lifecycle"] = "draft", archived = false): ClassGroup => ({ id, tenantId: "tenant", academicYearId: id === "2" ? "year-2" : "year-1", educationLevel: "SMA", grade: 10, groupName: name, normalizedGroupName: name.toLowerCase(), code: `C-${id}`, normalizedCode: `c-${id}`, capacity: 30, primaryLocationId: null, lifecycle, archived, archivedAt: null, archiveReason: null, version: 1, createdAt: new Date(), updatedAt: new Date() });
test("normalizes Rombel URL search, filters, sort, pagination, archive, and selected state", () => { const result = queryClassGroups([record("2", "B", "closed", true), record("1", "A"), record("3", "C", "active")], { q: " c-3 ", lifecycle: "active", year: "year-1", archive: "active", sort: "name-desc", page: "99", pageSize: "25", selected: "3" }); assert.equal(result.total, 1); assert.equal(result.items[0].id, "3"); assert.equal(result.query.page, 1); assert.equal(result.query.selected, "3"); });
