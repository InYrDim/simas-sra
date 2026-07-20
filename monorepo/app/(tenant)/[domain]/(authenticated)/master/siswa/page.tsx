import { MasterDataWorkspace, type MasterDataListItem } from "@/components/master-data/master-data-workspace";
import { MasterDataEmpty, MasterDataNotice } from "@/components/master-data/workspace-states";
import { WorkspaceFormExample } from "@/components/master-data/workspace-form-example";
import { normalizeMasterDataQuery, type MasterDataSearchParams } from "@/lib/master-data-workspace";

const examples: MasterDataListItem[] = [
  { id: "example-active", title: "Andi Pratama", description: "NIS 00127", lifecycle: "Aktif", archived: false },
  { id: "example-graduated", title: "Budi Santoso", description: "NIS 00042", lifecycle: "Lulus", archived: false },
  { id: "example-archived", title: "Citra Lestari", description: "NIS 00018", lifecycle: "Keluar", archived: true },
];

export default async function DataSiswaPage({ params, searchParams }: { params: Promise<{ domain: string }>; searchParams: Promise<MasterDataSearchParams> }) {
  const [{ domain }, raw] = await Promise.all([params, searchParams]);
  const query = normalizeMasterDataQuery(raw, { filters: { status: ["aktif", "lulus", "keluar"] }, sorts: ["name-asc", "name-desc"] });
  const visible = examples.filter((item) => (query.archive === "all" || (query.archive === "archived") === item.archived) && item.title.toLocaleLowerCase("id").includes(query.search.toLocaleLowerCase("id")));
  if (query.sort === "name-desc") visible.reverse();
  const selected = examples.find((item) => item.id === query.selected);
  const basePath = `/${domain}/master/siswa`;

  return <div className="space-y-8">
    <MasterDataWorkspace title="Pola workspace Master Data" description="Contoh bersama untuk list, detail, URL state, responsif, arsip, dan aksesibilitas. Data di bawah bukan data Siswa tersimpan." basePath={basePath} query={query} items={visible} total={visible.length} detail={selected ? <div className="space-y-4"><MasterDataNotice kind={selected.archived ? "archived" : "read-only"} /><dl className="grid gap-3"><div><dt className="text-sm text-muted-foreground">Nama</dt><dd className="font-medium">{selected.title}</dd></div><div><dt className="text-sm text-muted-foreground">Status operasional</dt><dd>{selected.lifecycle}</dd></div><div><dt className="text-sm text-muted-foreground">Status arsip</dt><dd>{selected.archived ? "Diarsipkan" : "Aktif"}</dd></div></dl><p className="text-sm text-muted-foreground">Edit, perubahan lifecycle, dan arsip menggunakan alur tindakan terpisah—bukan edit inline.</p></div> : visible.length ? undefined : <MasterDataEmpty filtered={Boolean(query.search)} />} />
    <section aria-labelledby="state-patterns" className="space-y-4 border bg-card p-5"><h2 id="state-patterns" className="text-xl font-semibold">Pola keadaan dan formulir</h2><div className="grid gap-3 md:grid-cols-3"><MasterDataNotice kind="read-only" /><MasterDataNotice kind="archived" /><MasterDataNotice kind="conflict" /></div><WorkspaceFormExample /></section>
  </div>;
}
