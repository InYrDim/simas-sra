import type { Extracurricular } from "@/lib/extracurricular";
import { normalizeMasterDataQuery, type MasterDataSearchParams } from "@/lib/master-data-workspace";

export function queryExtracurriculars(records: readonly Extracurricular[], raw: MasterDataSearchParams) {
  const query = normalizeMasterDataQuery(raw, {
    filters: { location: ["assigned", "unassigned"] },
    sorts: ["name-asc", "name-desc", "code-asc"],
  });
  const needle = query.search.toLocaleLowerCase("id-ID").replace(/\s+/g, "");
  const filtered = records
    .filter((item) => query.archive === "all" || item.archived === (query.archive === "archived"))
    .filter((item) => !query.filters.location?.length || query.filters.location.includes(item.defaultLocationId ? "assigned" : "unassigned"))
    .filter((item) => !needle || `${item.name}${item.code}`.toLocaleLowerCase("id-ID").replace(/\s+/g, "").includes(needle))
    .sort((left, right) => query.sort === "name-desc" ? right.name.localeCompare(left.name, "id-ID") : query.sort === "code-asc" ? left.code.localeCompare(right.code, "id-ID") : left.name.localeCompare(right.name, "id-ID"));
  const pages = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const page = Math.min(query.page, pages);
  return { query: { ...query, page }, total: filtered.length, items: filtered.slice((page - 1) * query.pageSize, page * query.pageSize), state: records.length === 0 ? "empty" as const : filtered.length === 0 ? "no-results" as const : "ready" as const };
}
