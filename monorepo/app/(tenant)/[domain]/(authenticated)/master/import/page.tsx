import Link from "next/link";

import { DemoDataImportDialog } from "@/app/(tenant)/[domain]/(authenticated)/master/import/demo-data-import-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getTenantFeatureAvailability } from "@/lib/features/tenant-feature-access-data";
import { listImportRevisions } from "@/lib/imports/people-import-review-data";
import { enforceTenantMasterDataOperation } from "@/lib/master-data/tenant-master-data-route-access";

const demoMessages: Record<string, string> = {
  success: "Master data demo berhasil diisi. Halaman Akademik dan Pendaftaran sekarang dapat digunakan.",
  "invalid-school-level": "Data demo tidak dapat dibuat karena jenjang sekolah belum valid.",
  error: "Data demo gagal diisi. Tidak ada perubahan parsial yang disimpan.",
};

export default async function PeopleImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ domain: string }>;
  searchParams: Promise<{ demo?: string }>;
}) {
  const [{ domain }, query] = await Promise.all([params, searchParams]);
  const principal = await enforceTenantMasterDataOperation(domain, "people-imports.load", ["people-imports.revisions.view"]);
  const [availability, revisions] = await Promise.all([
    getTenantFeatureAvailability(principal.tenantId, principal.capabilities),
    listImportRevisions(principal),
  ]);
  const demoResult = typeof query.demo === "string" ? query.demo : undefined;

  return (
    <main className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Impor Warga Sekolah</h1>
        <p>
          Unduh template resmi, isi maksimal 5.000 baris, lalu unggah untuk validasi. Validasi dan
          review tidak menulis Master Data.
        </p>
      </header>

      {demoResult && demoMessages[demoResult] ? (
        <Alert variant={demoResult === "success" ? "default" : "destructive"}>
          <AlertDescription>{demoMessages[demoResult]}</AlertDescription>
        </Alert>
      ) : null}

      {principal.capabilities.write ? (
        <section className="space-y-3 rounded-lg border p-4" aria-labelledby="demo-title">
          <div>
            <h2 className="font-semibold" id="demo-title">Data demo tenant</h2>
            <p className="text-sm text-muted-foreground">
              Isi master data urgent secara otomatis untuk mencoba alur Akademik dan Pendaftaran.
            </p>
          </div>
          <DemoDataImportDialog domain={domain} availability={availability.masterDataWrite} />
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="font-semibold">Template XLSX</h2>
        <div className="flex flex-wrap gap-3">
          {(["student", "teacher", "staff"] as const).map((kind) => (
            <Button
              featureAvailability={availability.masterDataImportDownload}
              key={kind}
              nativeButton={false}
              render={<Link href={`/${domain}/master/import/template/${kind}`} />}
              variant="outline"
            >
              Unduh {kind === "student" ? "Siswa" : kind === "teacher" ? "Guru" : "Staf"}
            </Button>
          ))}
        </div>
      </section>

      {principal.capabilities.write ? (
        <section className="space-y-3">
          <h2 className="font-semibold">Validasi workbook</h2>
          <form
            action={`/${domain}/master/import/upload`}
            method="post"
            encType="multipart/form-data"
            className="space-y-3"
          >
            <input
              aria-label="Workbook XLSX"
              required
              type="file"
              name="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={!availability.masterDataImportValidation.enabled}
            />
            <Button className="min-h-11 rounded-full px-4 py-2" featureAvailability={availability.masterDataImportValidation}>Unggah dan validasi</Button>
          </form>
          <p className="text-sm text-muted-foreground">
            Maksimal 10 MB. Jenis dan versi dibaca dari metadata workbook, bukan nama file.
          </p>
        </section>
      ) : (
        <p>Tenant sedang hanya-baca; upload validasi dinonaktifkan.</p>
      )}

      <section className="space-y-3" aria-labelledby="revision-title">
        <h2 className="font-semibold" id="revision-title">Revisi Impor</h2>
        {revisions.length ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {revisions.map((revision) => (
              <li className="rounded border p-4" key={revision.id}>
                <Link className="font-medium underline" href={`/${domain}/master/import/${revision.id}`}>
                  Review {revision.kind} · {revision.rowCount} baris
                </Link>
                <p className="text-sm text-muted-foreground">
                  {revision.createdAt.toLocaleString("id-ID")}
                  {revision.parentRevisionId ? " · revisi koreksi" : " · sumber awal"}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p>Belum ada revisi tervalidasi. Jalankan worker validasi setelah upload.</p>
        )}
      </section>
    </main>
  );
}
