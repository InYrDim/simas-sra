export const MASTER_DATA_PAGE_SIZES = [25, 50, 100] as const;
export const MASTER_DATA_ARCHIVE_SCOPES = ["active", "archived", "all"] as const;

export type MasterDataArchiveScope = (typeof MASTER_DATA_ARCHIVE_SCOPES)[number];
export type MasterDataSearchParams = Record<string, string | string[] | undefined>;

export interface MasterDataQueryConfig {
  filters?: Record<string, readonly string[]>;
  sorts: readonly string[];
}

export interface MasterDataQuery {
  search: string;
  filters: Record<string, string[]>;
  sort: string;
  page: number;
  pageSize: (typeof MASTER_DATA_PAGE_SIZES)[number];
  archive: MasterDataArchiveScope;
  selected: string | null;
}

function values(value: string | string[] | undefined): string[] {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeMasterDataQuery(
  params: MasterDataSearchParams,
  config: MasterDataQueryConfig,
): MasterDataQuery {
  const page = Number.parseInt(values(params.page)[0] ?? "", 10);
  const requestedSize = Number.parseInt(values(params.pageSize)[0] ?? "", 10);
  const pageSize = MASTER_DATA_PAGE_SIZES.find((size) => size === requestedSize) ?? 25;
  const requestedArchive = values(params.archive)[0];
  const archive = MASTER_DATA_ARCHIVE_SCOPES.find((scope) => scope === requestedArchive) ?? "active";
  const requestedSort = values(params.sort)[0];
  const sort = config.sorts.includes(requestedSort) ? requestedSort : config.sorts[0];

  if (!sort) throw new Error("Master Data workspace requires at least one sort option");

  const filters = Object.fromEntries(Object.entries(config.filters ?? {}).flatMap(([key, allowed]) => {
    const selected = values(params[key]).filter((value) => allowed.includes(value));
    return selected.length ? [[key, selected]] : [];
  }));

  return {
    search: values(params.q)[0] ?? "",
    filters,
    sort,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize,
    archive,
    selected: values(params.selected)[0] ?? null,
  };
}

export function serializeMasterDataQuery(
  query: MasterDataQuery,
  changes: Partial<MasterDataQuery> = {},
): string {
  const next = { ...query, ...changes };
  const params = new URLSearchParams();
  if (next.search) params.set("q", next.search);
  for (const [key, selected] of Object.entries(next.filters)) {
    for (const value of selected) params.append(key, value);
  }
  params.set("sort", next.sort);
  params.set("page", String(next.page));
  params.set("pageSize", String(next.pageSize));
  params.set("archive", next.archive);
  if (next.selected) params.set("selected", next.selected);
  return params.toString();
}
