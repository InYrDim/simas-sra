import { normalizeMasterDataQuery, type MasterDataSearchParams } from "@/lib/master-data-workspace";
import type { Subject } from "@/lib/subject-catalog";

export function querySubjects(subjects: readonly Subject[], params: MasterDataSearchParams) {
  let query = normalizeMasterDataQuery(params, { sorts: ["name-asc", "name-desc", "code-asc", "code-desc"] });
  const search = query.search.trim().toLocaleLowerCase("id-ID");

  const filtered = subjects.filter((subject) =>
    (query.archive === "all" || subject.archived === (query.archive === "archived")) &&
    (!search || subject.normalizedName.includes(search) || subject.normalizedCode.toLocaleLowerCase("id-ID").includes(search)),
  ).sort((left, right) => {
    const byCode = query.sort.startsWith("code");
    const comparison = (byCode ? left.normalizedCode.localeCompare(right.normalizedCode, "id-ID") : left.normalizedName.localeCompare(right.normalizedName, "id-ID"));
    return query.sort.endsWith("desc") ? -comparison : comparison;
  });
  const pages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  if (query.page > pages) query = { ...query, page: pages };
  const offset = (query.page - 1) * query.pageSize;
  return { query, items: filtered.slice(offset, offset + query.pageSize), total: filtered.length, state: subjects.length === 0 ? "empty" as const : filtered.length === 0 ? "no-results" as const : "results" as const };
}
