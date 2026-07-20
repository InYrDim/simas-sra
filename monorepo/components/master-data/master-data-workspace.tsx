import Link from "next/link";
import type { ReactNode } from "react";

import type { MasterDataQuery } from "@/lib/master-data-workspace";
import { serializeMasterDataQuery } from "@/lib/master-data-workspace";

export interface MasterDataListItem { id: string; title: string; description: string; lifecycle: string; archived: boolean }

export function MasterDataWorkspace({ title, description, basePath, query, items, total, detail, children }: {
  title: string;
  description: string;
  basePath: string;
  query: MasterDataQuery;
  items: MasterDataListItem[];
  total: number;
  detail?: ReactNode;
  children?: ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / query.pageSize));
  return <main aria-labelledby="workspace-title" className="space-y-4">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 id="workspace-title" className="text-2xl font-bold">{title}</h1><p className="text-sm text-muted-foreground">{description}</p></div>{children}</header>
    <form action={basePath} className="grid gap-3 border bg-card p-4 sm:grid-cols-2 lg:grid-cols-5" role="search">
      <label className="lg:col-span-2"><span className="text-sm font-medium">Cari</span><input name="q" defaultValue={query.search} className="mt-1 h-10 w-full border bg-background px-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
      <label><span className="text-sm font-medium">Cakupan arsip</span><select name="archive" defaultValue={query.archive} className="mt-1 h-10 w-full border bg-background px-2"><option value="active">Aktif</option><option value="archived">Diarsipkan</option><option value="all">Semua</option></select></label>
      <label><span className="text-sm font-medium">Urutkan</span><select name="sort" defaultValue={query.sort} className="mt-1 h-10 w-full border bg-background px-2"><option value="name-asc">Nama A–Z</option><option value="name-desc">Nama Z–A</option></select></label>
      <input type="hidden" name="page" value="1" /><input type="hidden" name="pageSize" value={query.pageSize} /><button className="h-10 self-end rounded-full bg-primary px-4 text-primary-foreground focus-visible:ring-3 focus-visible:ring-ring/50">Terapkan</button>
    </form>
    <div className="grid min-h-[28rem] border bg-card lg:grid-cols-[minmax(20rem,2fr)_minmax(22rem,3fr)]">
      <section aria-labelledby="list-heading" className="border-b lg:border-r lg:border-b-0"><h2 id="list-heading" className="border-b p-4 font-semibold">Daftar <span className="font-normal text-muted-foreground">({total})</span></h2><ul>{items.map((item) => { const href = `${basePath}?${serializeMasterDataQuery(query, { selected: item.id })}`; return <li key={item.id} className="border-b"><Link href={href} aria-current={query.selected === item.id ? "true" : undefined} className="block p-4 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 aria-[current=true]:bg-muted"><span className="font-medium">{item.title}</span><span className="mt-1 block text-sm text-muted-foreground">{item.description}</span><span className="mt-2 block text-xs"><span className="font-medium">Status operasional:</span> {item.lifecycle} · <span className="font-medium">Arsip:</span> {item.archived ? "Diarsipkan" : "Aktif"}</span></Link></li>; })}</ul>
        <nav aria-label="Paginasi" className="flex flex-wrap items-center justify-between gap-2 p-4 text-sm"><Link aria-disabled={query.page === 1} className="underline aria-disabled:pointer-events-none aria-disabled:opacity-50" href={`${basePath}?${serializeMasterDataQuery(query, { page: Math.max(1, query.page - 1), selected: null })}`}>Sebelumnya</Link><span>Halaman {query.page} dari {pages}</span><Link aria-disabled={query.page >= pages} className="underline aria-disabled:pointer-events-none aria-disabled:opacity-50" href={`${basePath}?${serializeMasterDataQuery(query, { page: Math.min(pages, query.page + 1), selected: null })}`}>Berikutnya</Link><form action={basePath}><input type="hidden" name="q" value={query.search} /><input type="hidden" name="archive" value={query.archive} /><input type="hidden" name="sort" value={query.sort} /><label>Per halaman <select name="pageSize" defaultValue={query.pageSize} className="ml-1 border bg-background p-1"><option>25</option><option>50</option><option>100</option></select></label><input type="hidden" name="page" value="1" /><button className="sr-only">Terapkan jumlah per halaman</button></form></nav>
      </section>
      <section aria-labelledby="detail-heading" className={`${query.selected ? "fixed inset-0 z-40 overflow-auto bg-background p-4 md:static md:z-auto md:p-0" : "hidden lg:block"}`}><div className="border-b p-4"><h2 id="detail-heading" className="font-semibold">Detail</h2>{query.selected ? <Link className="mt-2 inline-block underline md:hidden" href={`${basePath}?${serializeMasterDataQuery(query, { selected: null })}`}>Kembali ke daftar</Link> : null}</div><div className="p-4">{detail ?? <p className="text-muted-foreground">Pilih catatan untuk melihat detail hanya-baca.</p>}</div></section>
    </div>
  </main>;
}
