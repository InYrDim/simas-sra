import Link from "next/link";
import { notFound } from "next/navigation";
import { executeImportAction, saveDecisionAction } from "./actions";
import { queryImportReview, type ReviewRow } from "@/lib/people-import-review";
import { getImportReview } from "@/lib/people-import-review-data";
import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

const stateLabels = { ready: "Siap", warning: "Perlu keputusan", rejected: "Ditolak" } as const;
const decisionLabels: Record<string, string> = {
  link: "Tautkan ke Warga Sekolah dan tambahkan Profil",
  "create-distinct": "Buat Warga Sekolah baru",
  skip: "Lewati baris",
};
const profileLabels: Record<string, string> = {
  student: "Profil Siswa",
  teacher: "Profil Guru",
  staff: "Profil Staf",
};

type PageProps = {
  params: Promise<{ domain: string; revisionId: string }>;
  searchParams: Promise<{ search?: string; state?: string; column?: string; result?: string }>;
};

export default async function ImportReviewPage({ params, searchParams }: PageProps) {
  const [{ domain, revisionId }, query] = await Promise.all([params, searchParams]);
  const principal = await enforceMasterDataAccess(domain, "read");
  const review = await getImportReview(principal, revisionId);
  if (!review) notFound();

  const filteredRows = queryImportReview(review.rows, query);
  const findingColumns = [...new Set(review.rows.flatMap((row) => row.findings.map((finding) => finding.field)))];
  const profileLabel = profileLabels[review.revision.kind] ?? review.revision.kind;

  return (
    <main className="space-y-5 p-4 md:p-6">
      <nav aria-label="Breadcrumb">
        <Link className="underline" href={`/${domain}/master/import`}>
          Batch Impor Orang
        </Link>{" "}
        / Tinjau Revisi Impor
      </nav>
      <header>
        <h1 className="text-2xl font-semibold">Tinjau Revisi Impor</h1>
        <p className="text-muted-foreground">
          {profileLabel} · {review.revision.rowCount} baris · Revisi Impor tidak dapat diubah dan peninjauan ini
          belum menulis Master Data.
        </p>
      </header>
      {query.result ? (
        <p role={query.result === "saved" ? "status" : "alert"} className="rounded border p-3">
          {query.result === "saved"
            ? "Keputusan tersimpan beserta identitas pengambil keputusan."
            : "Keputusan ditolak karena baris atau Warga Sekolah tujuan tidak lagi valid."}
        </p>
      ) : null}
      <form className="grid gap-3 rounded border p-4 sm:grid-cols-3" role="search">
        <label>
          <span className="text-sm font-medium">Cari baris, nama, atau pengenal</span>
          <input className="mt-1 h-11 w-full border px-3" name="search" defaultValue={query.search} />
        </label>
        <label>
          <span className="text-sm font-medium">Status</span>
          <select className="mt-1 h-11 w-full border px-3" name="state" defaultValue={query.state ?? ""}>
            <option value="">Semua</option>
            {Object.entries(stateLabels).map(([value, label]) => (
              <option value={value} key={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-medium">Kolom bermasalah</span>
          <select className="mt-1 h-11 w-full border px-3" name="column" defaultValue={query.column ?? ""}>
            <option value="">Semua</option>
            {findingColumns.map((column) => (
              <option key={column}>{column}</option>
            ))}
          </select>
        </label>
        <button className="min-h-11 rounded bg-primary px-4 text-primary-foreground sm:col-span-3">
          Terapkan filter
        </button>
      </form>
      <div className="flex flex-wrap gap-3">
        <Link
          className="min-h-11 rounded border px-4 py-2"
          href={`/${domain}/master/import/${revisionId}/correction`}
        >
          Unduh lembar kerja koreksi
        </Link>
        {principal.capabilities.write ? (
          <form
            action={`/${domain}/master/import/${revisionId}/revision`}
            method="post"
            encType="multipart/form-data"
            className="flex flex-wrap items-center gap-2"
          >
            <label className="min-h-11">
              <span className="sr-only">Lembar kerja koreksi XLSX</span>
              <input
                required
                name="file"
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              />
            </label>
            <button className="min-h-11 rounded border px-4">Unggah sebagai Revisi Impor baru</button>
          </form>
        ) : null}
      </div>
      {principal.capabilities.write ? (
        <ExecutionConfirmation domain={domain} revisionId={revisionId} rows={review.rows} />
      ) : null}
      <p aria-live="polite">
        Menampilkan {filteredRows.length} dari {review.rows.length} baris.
      </p>
      <div className="space-y-3 md:hidden">
        {filteredRows.map((row) => (
          <RowCard
            key={row.id}
            row={row}
            domain={domain}
            revisionId={revisionId}
            writable={principal.capabilities.write}
          />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded border md:block">
        <table className="w-full text-left">
          <caption className="sr-only">Hasil validasi Revisi Impor</caption>
          <thead>
            <tr>
              <th className="p-3">Baris</th>
              <th className="p-3">Nilai</th>
              <th className="p-3">Temuan</th>
              <th className="p-3">Status/keputusan</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row) => (
              <tr className="border-t align-top" key={row.id}>
                <td className="p-3">{row.rowNumber}</td>
                <td className="p-3">
                  <Values values={row.values} />
                </td>
                <td className="p-3">
                  <Findings row={row} />
                </td>
                <td className="p-3">
                  <Decision row={row} domain={domain} revisionId={revisionId} writable={principal.capabilities.write} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function RowCard({ row, ...props }: { row: ReviewRow; domain: string; revisionId: string; writable: boolean }) {
  return (
    <article className="rounded border p-4">
      <h2 className="font-semibold">
        Baris {row.rowNumber} · {stateLabels[row.state]}
      </h2>
      <Values values={row.values} />
      <Findings row={row} />
      <Decision row={row} {...props} />
    </article>
  );
}

function Values({ values }: { values: Record<string, string> }) {
  return (
    <dl className="mt-2 grid gap-1">
      {Object.entries(values)
        .filter(([, value]) => value)
        .map(([key, value]) => (
          <div key={key}>
            <dt className="inline font-medium">{key}: </dt>
            <dd className="inline wrap-break-word">{value}</dd>
          </div>
        ))}
    </dl>
  );
}

function Findings({ row }: { row: Pick<ReviewRow, "findings" | "candidates"> }) {
  return (
    <div>
      <ul className="list-disc pl-5">
        {row.findings.map((finding, index) => (
          <li key={`${finding.field}-${finding.code}-${index}`}>
            {finding.field}: {finding.code}
          </li>
        ))}
      </ul>
      {row.candidates.map((candidate) => (
        <div className="mt-2 rounded bg-muted p-2 text-sm" key={candidate.id}>
          <strong>{candidate.fullName}</strong>
          <br />
          {candidate.birthPlace}, {candidate.birthDate}
          <br />
          {Object.entries(candidate.identifiers)
            .map(([key, value]) => `${key}: ${value}`)
            .join(" · ")}
        </div>
      ))}
    </div>
  );
}

function Decision({
  row,
  domain,
  revisionId,
  writable,
}: {
  row: Pick<ReviewRow, "id" | "state" | "decision" | "candidates">;
  domain: string;
  revisionId: string;
  writable: boolean;
}) {
  if (row.state !== "warning") return <span>{stateLabels[row.state]}</span>;

  if (!writable) {
    return (
      <span>
        {row.decision
          ? `${decisionLabels[row.decision.action] ?? row.decision.action} · oleh ${row.decision.actorId}`
          : "Belum diputuskan"}
      </span>
    );
  }

  return (
    <form action={saveDecisionAction.bind(null, domain, revisionId)} className="grid gap-2">
      <input type="hidden" name="rowId" value={row.id} />
      <label>
        <span className="text-sm font-medium">Keputusan untuk peringatan</span>
        <select
          required
          name="action"
          defaultValue={row.decision?.action ?? ""}
          className="mt-1 h-11 w-full border px-2"
        >
          <option value="">Pilih keputusan</option>
          {row.candidates.length ? <option value="link">Tautkan dan tambahkan Profil</option> : null}
          <option value="create-distinct">Buat Warga Sekolah baru karena berbeda</option>
          <option value="skip">Lewati baris</option>
        </select>
      </label>
      {row.candidates.length ? (
        <label>
          <span className="text-sm font-medium">Warga Sekolah tujuan</span>
          <select name="targetPersonId" className="mt-1 h-11 w-full border px-2">
            <option value="">Pilih Warga Sekolah</option>
            {row.candidates.map((candidate) => (
              <option value={candidate.id} key={candidate.id}>
                {candidate.fullName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button className="min-h-11 rounded border px-3">Simpan keputusan</button>
      {row.decision ? (
        <small>
          Terakhir: {decisionLabels[row.decision.action] ?? row.decision.action} oleh {row.decision.actorId}
        </small>
      ) : null}
    </form>
  );
}

function ExecutionConfirmation({ domain, revisionId, rows }: { domain: string; revisionId: string; rows: ReviewRow[] }) {
  const counts = { create: 0, link: 0, skip: 0, reject: 0 };
  for (const row of rows) {
    if (row.state === "rejected") counts.reject++;
    else if (row.decision?.action === "skip") counts.skip++;
    else if (row.decision?.action === "link") counts.link++;
    else counts.create++;
  }

  const unresolved = rows.some((row) => row.state === "warning" && !row.decision);
  const summaries = [
    ["Warga Sekolah baru", counts.create],
    ["Ditautkan", counts.link],
    ["Dilewati", counts.skip],
    ["Ditolak", counts.reject],
  ] as const;

  return (
    <section className="rounded border p-4" aria-labelledby="execution-confirmation">
      <h2 id="execution-confirmation" className="text-lg font-semibold">
        Konfirmasi eksekusi
      </h2>
      <p>
        Revisi Impor: <code>{revisionId}</code>. Pilih baris yang akan dibekukan untuk eksekusi.
      </p>
      <dl className="my-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {summaries.map(([label, count]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="font-semibold">{count}</dd>
          </div>
        ))}
      </dl>
      <form action={executeImportAction.bind(null, domain, revisionId)} className="space-y-3">
        <fieldset>
          <legend className="font-medium">Baris terpilih</legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {rows.map((row) => (
              <label key={row.id} className="flex gap-2">
                <input type="checkbox" name="rowId" value={row.id} defaultChecked />
                <span>
                  Baris {row.rowNumber} · {stateLabels[row.state]}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {unresolved ? <p role="alert">Semua peringatan wajib memiliki keputusan sebelum eksekusi.</p> : null}
        <button
          disabled={unresolved}
          className="min-h-11 rounded bg-primary px-4 text-primary-foreground disabled:opacity-50"
        >
          Bekukan pilihan baris dan antrekan eksekusi
        </button>
      </form>
    </section>
  );
}
