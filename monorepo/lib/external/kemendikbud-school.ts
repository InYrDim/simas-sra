// Server-only: fetches school data from the official Kemendikdasmen "SekolahKita"
// directory by NPSN and maps it onto SIMAS tenant-application fields.
import "server-only";

const ENDPOINT = "https://sekolah.data.kemendikdasmen.go.id/v1/sekolah-service/sekolah/cari-sekolah";

export type KemendikbudSchool = {
  npsn: string;
  nama: string;
  bentuk_pendidikan: string;
  status_sekolah: string;
  akreditasi: string | null;
  alamat_jalan: string | null;
  rt: number | null;
  rw: number | null;
  dusun: string | null;
  kelurahan: string | null;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  kode_pos: string | null;
  sekolah_id: string;
  path_file: string | null;
};

export type SchoolLookupResult =
  | { found: true; school: KemendikbudSchool }
  | { found: false; reason: "not-found" | "error" };

function mapRow(row: Record<string, unknown>): KemendikbudSchool {
  return {
    npsn: String(row.npsn ?? ""),
    nama: String(row.nama ?? ""),
    bentuk_pendidikan: String(row.bentuk_pendidikan ?? ""),
    status_sekolah: String(row.status_sekolah ?? ""),
    akreditasi: row.akreditasi == null ? null : String(row.akreditasi),
    alamat_jalan: row.alamat_jalan == null ? null : String(row.alamat_jalan),
    rt: typeof row.rt === "number" ? row.rt : null,
    rw: typeof row.rw === "number" ? row.rw : null,
    dusun: row.nama_dusun == null ? null : String(row.nama_dusun),
    kelurahan: row.kelurahan == null ? null : String(row.kelurahan),
    kecamatan: row.kecamatan == null ? null : String(row.kecamatan),
    kabupaten: row.kabupaten == null ? null : String(row.kabupaten),
    provinsi: row.provinsi == null ? null : String(row.provinsi),
    kode_pos: row.kode_pos == null ? null : String(row.kode_pos),
    sekolah_id: String(row.sekolah_id ?? ""),
    path_file: row.path_file == null ? null : String(row.path_file),
  };
}

// Builds a single-line address string from the structured fields.
export function formatSchoolAddress(s: KemendikbudSchool): string {
  const parts = [
    s.alamat_jalan,
    s.rt != null || s.rw != null ? `RT ${s.rt ?? 0} RW ${s.rw ?? 0}` : null,
    s.dusun,
    s.kecamatan,
    s.kabupaten,
    s.provinsi,
    s.kode_pos,
  ].filter(Boolean);
  return parts.join(", ");
}

export async function lookupSchoolByNpsn(npsn: string): Promise<SchoolLookupResult> {
  const clean = npsn.trim();
  if (!/^\d{4,20}$/.test(clean)) return { found: false, reason: "not-found" };

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 (compatible; SIMAS/1.0)",
        origin: "https://sekolah.data.kemendikdasmen.go.id",
      },
      body: JSON.stringify({
        page: 0,
        size: 12,
        keyword: clean,
        kabupaten_kota: "",
        bentuk_pendidikan: "",
        status_sekolah: "",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return { found: false, reason: "error" };
    const json = (await response.json()) as { data?: Record<string, unknown>[] };
    const row = json.data?.[0];
    if (!row) return { found: false, reason: "not-found" };
    return { found: true, school: mapRow(row) };
  } catch {
    return { found: false, reason: "error" };
  }
}
