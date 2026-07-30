export type UrgentMasterDataPresence = Readonly<{
  academicYears: boolean;
  students: boolean;
  teachers: boolean;
  subjects: boolean;
  classGroups: boolean;
}>;

export type MissingUrgentMasterData = Readonly<{
  key: keyof UrgentMasterDataPresence;
  label: string;
  href: string;
}>;

export type MasterDataGatedArea = "Akademik" | "Pendaftaran";

const gatedPaths = [
  { prefix: "/ulangan", area: "Akademik" },
  { prefix: "/ppdb", area: "Pendaftaran" },
] as const;

const urgentMasterData = [
  { key: "academicYears", label: "Tahun Ajaran", path: "tahun-ajaran" },
  { key: "students", label: "Siswa", path: "siswa" },
  { key: "teachers", label: "Guru", path: "guru" },
  { key: "subjects", label: "Mata Pelajaran", path: "mapel" },
  { key: "classGroups", label: "Rombongan Belajar", path: "rombel" },
] as const;

export function getMasterDataGatedArea(pathname: string): MasterDataGatedArea | null {
  const match = gatedPaths.find(
    ({ prefix }) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  return match?.area ?? null;
}

export function getTenantRelativePath(domain: string, pathname: string): string {
  const tenantPrefix = `/${domain}`;
  if (pathname === tenantPrefix) return "/";
  if (pathname.startsWith(`${tenantPrefix}/`)) return pathname.slice(tenantPrefix.length);
  return pathname;
}

export function getMissingUrgentMasterData(
  domain: string,
  presence: UrgentMasterDataPresence,
): MissingUrgentMasterData[] {
  return urgentMasterData
    .filter(({ key }) => !presence[key])
    .map(({ key, label, path }) => ({
      key,
      label,
      href: `/${domain}/master/${path}`,
    }));
}
