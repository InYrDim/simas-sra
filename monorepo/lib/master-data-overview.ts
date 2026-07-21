export type OverviewRecord = Readonly<{ id: string; archived: boolean }>;
export type OverviewState = Readonly<{
  students: readonly (OverviewRecord & { active: boolean; currentClassGroupId: string | null })[];
  teachers: readonly (OverviewRecord & { active: boolean })[];
  staff: readonly (OverviewRecord & { active: boolean })[];
  subjects: readonly OverviewRecord[];
  classGroups: readonly (OverviewRecord & { active: boolean; homeroomTeacherId: string | null })[];
  assets: readonly (OverviewRecord & { condition: string })[];
  organizations: readonly OverviewRecord[];
  extracurriculars: readonly OverviewRecord[];
  academicYears: readonly (OverviewRecord & { active: boolean })[];
  activities: readonly unknown[];
}>;
export type UnsafeOverviewActivity = Readonly<{ id: string; entity: string; operation: string; actorLabel: string; occurredAt: Date; sensitiveBefore?: unknown; sensitiveAfter?: unknown }>;

export function buildMasterDataOverview(domain: string, state: OverviewState, activity: readonly UnsafeOverviewActivity[] = []) {
  const base = `/${domain}/master`;
  const counts = [
    { key: "active-students", label: "Siswa aktif", value: state.students.filter((x) => x.active && !x.archived).length, href: `${base}/siswa?status=active` },
    { key: "active-teachers", label: "Guru aktif", value: state.teachers.filter((x) => x.active && !x.archived).length, href: `${base}/guru?status=active` },
    { key: "active-staff", label: "Staf aktif", value: state.staff.filter((x) => x.active && !x.archived).length, href: `${base}/staf?status=active` },
    { key: "active-subjects", label: "Mata Pelajaran aktif", value: state.subjects.filter((x) => !x.archived).length, href: `${base}/mapel?archive=active` },
  ] as const;
  const exceptions = [
    { key: "active-students-review", label: "Siswa aktif perlu ditinjau", value: state.students.filter((x) => x.active && !x.archived).length, explanation: "Tinjau penempatan dan kelengkapan Siswa aktif.", href: `${base}/siswa?status=active` },
    { key: "active-classes-review", label: "Rombongan Belajar aktif perlu ditinjau", value: state.classGroups.filter((x) => x.active && !x.archived).length, explanation: "Tinjau anggota dan Wali Kelas pada Rombongan Belajar aktif.", href: `${base}/rombel?lifecycle=active` },
    { key: "damaged-assets-review", label: "Aset rusak perlu ditinjau", value: state.assets.filter((x) => !x.archived && x.condition === "damaged").length, explanation: "Tinjau kondisi dan tindak lanjut aset rusak.", href: `${base}/sarpras?condition=damaged` },
  ].filter((x) => x.value > 0);
  return { counts, exceptions, recentActivity: activity.slice(0, 10).map(({ id, entity, operation, actorLabel, occurredAt }) => ({ id, entity, operation, actorLabel, occurredAt })) };
}
