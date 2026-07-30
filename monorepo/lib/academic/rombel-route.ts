export function rombelResultPath(
  domain: string,
  result: { ok: boolean; code?: string },
  selected?: string,
) {
  const search = new URLSearchParams({
    result: result.ok ? "saved" : result.code ?? "error",
  });
  if (selected) search.set("selected", selected);
  return `/${domain}/master/rombel?${search.toString()}`;
}
