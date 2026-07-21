import Link from "next/link";
import { getMasterDataOverview } from "@/lib/master-data-overview-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

export default async function MasterDataOverviewPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  const principal = await enforceMasterDataAccess(domain, "read");
  const overview = await getMasterDataOverview(principal.tenantId, domain);
  const quickActions = [
    ["Tambah Siswa", `/${domain}/master/siswa`], ["Tambah Guru", `/${domain}/master/guru`], ["Tambah Staf", `/${domain}/master/staf`],
    ["Kelola Tahun Ajaran", `/${domain}/master/tahun-ajaran`], ["Impor Warga Sekolah", `/${domain}/master/import`],
  ] as const;
  return <main className="space-y-8 p-4 md:p-6">
    <header><h1 className="text-2xl font-semibold">Master Data</h1><p className="text-muted-foreground">Ringkasan tindakan dan data referensi sekolah yang memerlukan perhatian.</p>{!principal.capabilities.write ? <p role="status" className="mt-3 rounded border p-3">Tenant sedang hanya-baca. Data tetap dapat ditinjau, tetapi perubahan dinonaktifkan.</p> : null}</header>
    <section aria-labelledby="count-title"><h2 id="count-title" className="text-lg font-semibold">Ringkasan authoritative</h2><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{overview.counts.map((item) => <Link className="min-h-28 rounded-lg border p-4 hover:bg-muted" href={item.href} key={item.key}><span className="block text-sm text-muted-foreground">{item.label}</span><strong className="mt-2 block text-3xl tabular-nums">{item.value}</strong><span className="text-sm underline">Buka daftar</span></Link>)}</div></section>
    <section aria-labelledby="exception-title"><h2 id="exception-title" className="text-lg font-semibold">Perlu tindakan</h2>{overview.exceptions.length ? <ul className="mt-3 grid gap-3 md:grid-cols-2">{overview.exceptions.map((item) => <li key={item.key}><Link className="block rounded-lg border p-4" href={item.href}><strong>{item.value} {item.label}</strong><p className="text-sm text-muted-foreground">{item.explanation}</p><span className="text-sm underline">Tinjau record</span></Link></li>)}</ul> : <p className="mt-3 rounded border p-4">Tidak ada exception authoritative yang memerlukan tindakan.</p>}</section>
    <section aria-labelledby="quick-title"><h2 id="quick-title" className="text-lg font-semibold">Tindakan cepat</h2><div className="mt-3 flex flex-wrap gap-3">{quickActions.map(([label, href]) => <Link className="min-h-11 rounded-full border px-4 py-2" href={href} key={href}>{label}</Link>)}</div></section>
    <section aria-labelledby="activity-title"><h2 id="activity-title" className="text-lg font-semibold">Aktivitas terbaru</h2>{overview.recentActivity.length ? <ol className="mt-3 divide-y rounded border">{overview.recentActivity.map((item) => <li className="p-4" key={item.id}><strong>{item.entity}</strong> · {item.operation}<p className="text-sm text-muted-foreground">{item.actorLabel} · {item.occurredAt.toLocaleString("id-ID")}</p></li>)}</ol> : <p className="mt-3 rounded border p-4">Belum ada aktivitas Master Data yang tercatat.</p>}<p className="mt-2 text-sm text-muted-foreground">Ringkasan tidak menampilkan nilai sebelum/sesudah atau payload sensitif.</p></section>
  </main>;
}
