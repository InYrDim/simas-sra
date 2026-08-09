import { createHash } from "node:crypto";

export const PERMISSION_REGISTRY_VERSION = "tenant-permissions@2";
export const OPERATION_MAP_VERSION = "tenant-operations@4";

export const LEGACY_NON_ADMIN_ROLES = ["pimpinan", "staff", "guru", "siswa", "guest"] as const;

export type PermissionRisk = "low" | "medium" | "sensitive" | "critical";
export type PermissionAssignment = "tenant-assignable" | "school-admin-only" | "system-internal";
export type PermissionLifecycle = "active" | "deprecated" | "reserved";

export type PermissionDefinition = Readonly<{
  key: string;
  module: string;
  resource: string;
  action: string;
  labelId: string;
  descriptionId: string;
  groupId: string;
  order: number;
  dependencies: readonly string[];
  risk: PermissionRisk;
  assignment: PermissionAssignment;
  lifecycle: PermissionLifecycle;
  replacements: readonly string[];
}>;

export type OperationClassification = "tenant-rbac" | "system-policy" | "placeholder" | "provider" | "public-authentication";
export type OperationGate = "read" | "write" | "none";
export type OperationEntitlement = "MD" | "PPDB-R" | "PPDB-W" | "QUIZ-R" | "QUIZ-W" | "none";
export type ContextualPolicy = "tenant-wide" | "assigned" | "self" | "assigned-or-self" | "school-admin-only" | "none";

export type TenantOperationDefinition = Readonly<{
  id: string;
  entryPoints: readonly string[];
  classification: OperationClassification;
  requiredPermissions: readonly string[];
  permissionMode: "all" | "any" | "conditional";
  accountTenantGate: boolean;
  operationalGate: OperationGate;
  entitlement: OperationEntitlement;
  contextualPolicy: ContextualPolicy;
  contextualArms: readonly string[];
  relationship: string;
  effectiveTime: "request-time" | "transaction-time" | "none";
  collectionScope: "tenant-qualified-before-results" | "record-concealment" | "not-applicable";
  supplementalPermissions: readonly string[];
  transaction: Readonly<{
    reauthorize: boolean;
    tenantQualifiedTarget: boolean;
    concurrency: boolean;
    domainInvariants: boolean;
    atomicAudit: boolean;
  }>;
  risk: PermissionRisk;
  externalDenial: "403" | "404" | "redirect-or-401" | "not-applicable";
  lifecycle: PermissionLifecycle;
  registryVersion: string;
  operationMapVersion: string;
  legacyAuthority: readonly string[];
}>;

type CatalogSeed = readonly [key: string, dependencies?: readonly string[], risk?: PermissionRisk, assignment?: PermissionAssignment, lifecycle?: PermissionLifecycle];

const activeSeeds: readonly CatalogSeed[] = [
  ["tenant.dashboard.view"],
  ["tenant.onboarding.complete", [], "critical", "school-admin-only"],
  ["tenant.users.view"],
  ["tenant.users.view-contact", ["tenant.users.view"], "sensitive"],
  ["tenant.users.view-sensitive", ["tenant.users.view"], "sensitive"],
  ["tenant.accounts.view", [], "sensitive", "school-admin-only"],
  ["tenant.accounts.create", [], "critical", "school-admin-only"],
  ["tenant.accounts.issue-activation", [], "critical", "school-admin-only"],
  ["tenant.accounts.activate", [], "critical", "school-admin-only"],
  ["tenant.accounts.deactivate", [], "critical", "school-admin-only"],
  ["tenant.accounts.reactivate", [], "critical", "school-admin-only"],
  ["tenant.accounts.recovery", [], "critical", "school-admin-only"],
  ["tenant.accounts.delete", [], "critical", "school-admin-only"],
  ["tenant.accounts.link", [], "critical", "school-admin-only"],
  ["tenant.accounts.unlink", [], "critical", "school-admin-only"],
  ["tenant.authorization-audit.view", [], "sensitive", "school-admin-only"],
  ["tenant.authorization-audit.export", [], "critical", "school-admin-only"],
  ["tenant.roles.list", [], "sensitive", "school-admin-only"],
  ["tenant.roles.view", [], "sensitive", "school-admin-only"],
  ["tenant.roles.create", [], "critical", "school-admin-only"],
  ["tenant.roles.rename", [], "critical", "school-admin-only"],
  ["tenant.roles.change-permissions", [], "critical", "school-admin-only"],
  ["tenant.roles.activate", [], "critical", "school-admin-only"],
  ["tenant.roles.draft", [], "critical", "school-admin-only"],
  ["tenant.roles.archive", [], "critical", "school-admin-only"],
  ["tenant.roles.restore", [], "critical", "school-admin-only"],
  ["tenant.roles.delete", [], "critical", "school-admin-only"],
  ["tenant.assignments.view", [], "sensitive", "school-admin-only"],
  ["tenant.assignments.replace", [], "critical", "school-admin-only"],
  ["tenant.assignments.bulk", [], "critical", "school-admin-only"],
  ["tenant.effective-access.view", [], "sensitive", "school-admin-only"],
  ["tenant-settings.landing-page.view"],
  ["tenant-settings.landing-page.update", [], "medium"],
  ["school-profile.profile.view"],
  ["school-profile.profile.view-sensitive", ["school-profile.profile.view"], "sensitive"],
  ["school-profile.profile.update", [], "medium"],
  ["school-profile.headmaster.assign", [], "critical"],
  ["school-profile.accreditations.create", [], "medium"],
  ["school-profile.accreditations.correct", [], "sensitive"],
  ["school-profile.logo.upload", [], "sensitive"],
  ["academic-years.years.view"],
  ["academic-years.years.create", [], "medium"],
  ["academic-years.years.manage-lifecycle", [], "sensitive"],
  ["academic-years.years.archive", [], "sensitive"],
  ["academic-years.years.restore", [], "sensitive"],
  ["subjects.subjects.view"],
  ["subjects.subjects.create", [], "medium"],
  ["subjects.subjects.update", [], "medium"],
  ["subjects.subjects.archive", [], "sensitive"],
  ["subjects.subjects.restore", [], "sensitive"],
  ["class-groups.groups.view"],
  ["class-groups.groups.create", [], "medium"],
  ["class-groups.groups.update", [], "medium"],
  ["class-groups.groups.manage-lifecycle", [], "sensitive"],
  ["class-groups.groups.archive", [], "sensitive"],
  ["class-groups.groups.restore", [], "sensitive"],
  ["class-groups.memberships.assign", [], "sensitive"],
  ["class-groups.memberships.transfer", [], "critical"],
  ["class-groups.homerooms.assign", [], "critical"],
  ["people.people.view"],
  ["people.people.view-contact", ["people.people.view"], "sensitive"],
  ["people.people.view-sensitive", ["people.people.view"], "sensitive"],
  ["people.people.create", [], "medium"],
  ["people.people.update", [], "medium"],
  ["people.people.archive", [], "sensitive"],
  ["students.students.view"],
  ["students.students.view-sensitive", ["students.students.view"], "sensitive"],
  ["students.students.create", [], "medium"],
  ["students.students.update", [], "medium"],
  ["students.students.manage-lifecycle", [], "sensitive"],
  ["students.students.archive", [], "sensitive"],
  ["students.students.restore", [], "sensitive"],
  ["teachers.teachers.view"],
  ["teachers.teachers.view-sensitive", ["teachers.teachers.view"], "sensitive"],
  ["teachers.teachers.create", [], "medium"],
  ["teachers.teachers.update", [], "medium"],
  ["teachers.teachers.manage-lifecycle", [], "sensitive"],
  ["teachers.teachers.archive", [], "sensitive"],
  ["teachers.teachers.restore", [], "sensitive"],
  ["staff.staff.view"],
  ["staff.staff.view-sensitive", ["staff.staff.view"], "sensitive"],
  ["staff.staff.create", [], "medium"],
  ["staff.staff.update", [], "medium"],
  ["staff.staff.manage-lifecycle", [], "sensitive"],
  ["staff.staff.archive", [], "sensitive"],
  ["staff.staff.restore", [], "sensitive"],
  ["people-imports.revisions.view"],
  ["people-imports.revisions.view-sensitive", ["people-imports.revisions.view"], "sensitive"],
  ["people-imports.templates.download", [], "low"],
  ["people-imports.revisions.import", [], "sensitive"],
  ["people-imports.revisions.update", [], "sensitive"],
  ["people-imports.revisions.execute", [], "critical"],
  ["people-imports.revisions.export", ["people-imports.revisions.view"], "critical"],
  ["facilities.locations.view"],
  ["facilities.locations.create", [], "medium"],
  ["facilities.locations.update", [], "medium"],
  ["facilities.locations.archive", [], "sensitive"],
  ["facilities.locations.restore", [], "sensitive"],
  ["assets.assets.view"],
  ["assets.assets.create", [], "medium"],
  ["assets.assets.update", [], "medium"],
  ["assets.inventory.adjust", [], "critical"],
  ["assets.assets.archive", [], "sensitive"],
  ["assets.assets.restore", [], "sensitive"],
  ["student-organizations.organizations.view"],
  ["student-organizations.organizations.create", [], "medium"],
  ["student-organizations.organizations.archive", [], "sensitive"],
  ["student-organizations.periods.create", [], "medium"],
  ["student-organizations.periods.manage-lifecycle", [], "sensitive"],
  ["student-organizations.periods.correct", [], "sensitive"],
  ["student-organizations.memberships.assign", [], "sensitive"],
  ["student-organizations.memberships.unassign", [], "sensitive"],
  ["student-organizations.leadership.assign", [], "critical"],
  ["student-organizations.leadership.unassign", [], "critical"],
  ["extracurriculars.extracurriculars.view"],
  ["extracurriculars.extracurriculars.create", [], "medium"],
  ["extracurriculars.extracurriculars.archive", [], "sensitive"],
  ["extracurriculars.groups.create", [], "medium"],
  ["extracurriculars.groups.manage-lifecycle", [], "sensitive"],
  ["extracurriculars.advisors.assign", [], "sensitive"],
  ["extracurriculars.advisors.unassign", [], "sensitive"],
  ["extracurriculars.participants.assign", [], "sensitive"],
  ["extracurriculars.participants.unassign", [], "sensitive"],
  ["ppdb.sessions.view"],
  ["ppdb.sessions.create", [], "medium"],
  ["ppdb.sessions.update", [], "medium"],
  ["ppdb.sessions.publish", [], "critical"],
  ["ppdb.sessions.close", [], "sensitive"],
  ["ppdb.submissions.view"],
  ["ppdb.submissions.view-sensitive", ["ppdb.submissions.view"], "sensitive"],
  ["ppdb.documents.view-sensitive", ["ppdb.submissions.view", "ppdb.submissions.view-sensitive"], "critical"],
  ["ppdb.documents.download", [], "critical"],
  ["ppdb.submissions.decide", [], "critical"],
  ["ppdb.submissions.export", ["ppdb.submissions.view"], "critical"],
  ["ppdb.results.view"],
  ["ppdb.results.publish", [], "critical"],
  ["ppdb.results.manage-access", [], "critical"],
  ["quizzes.sessions.view"],
  ["quizzes.sessions.create", [], "medium"],
  ["quizzes.sessions.publish", [], "sensitive"],
  ["quizzes.sessions.close", [], "sensitive"],
  ["quizzes.questions.view"],
  ["quizzes.questions.view-sensitive", ["quizzes.questions.view"], "sensitive"],
  ["quizzes.questions.create", [], "medium"],
  ["quizzes.questions.remove", [], "sensitive"],
  ["quizzes.attendance.view"],
  ["quizzes.attendance.adjust", [], "sensitive"],
  ["quizzes.grades.view", [], "sensitive"],
  ["quizzes.grades.adjust", [], "critical"],
  ["quizzes.grades.execute", [], "critical"],
  ["absensi.attendance.view"],
  ["tenant.permissions.view", [], "sensitive", "school-admin-only"],
];

const reservedKeys = [
  "tenant.roles.copy",
  "tenant.accounts.invite", "tenant.accounts.resend",
  "tenant.accounts.reissue", "tenant.accounts.initiate-recovery",
] as const;

const moduleMetadata: Record<string, { label: string; group: string }> = {
  tenant: { label: "Tenant", group: "Pengguna & Keamanan" },
  "tenant-settings": { label: "Pengaturan Tenant", group: "Pengaturan Tenant" },
  "school-profile": { label: "Profil Sekolah", group: "Profil Sekolah" },
  "academic-years": { label: "Tahun Ajaran", group: "Akademik" },
  subjects: { label: "Mata Pelajaran", group: "Akademik" },
  "class-groups": { label: "Rombongan Belajar", group: "Akademik" },
  people: { label: "Warga Sekolah", group: "Warga Sekolah" },
  students: { label: "Siswa", group: "Warga Sekolah" },
  teachers: { label: "Guru", group: "Warga Sekolah" },
  staff: { label: "Staf", group: "Warga Sekolah" },
  "people-imports": { label: "Impor Warga Sekolah", group: "Impor Data" },
  facilities: { label: "Lokasi/Ruang", group: "Sarana & Prasarana" },
  assets: { label: "Aset/Barang", group: "Sarana & Prasarana" },
  "student-organizations": { label: "Organisasi Siswa", group: "Kegiatan Siswa" },
  extracurriculars: { label: "Ekstrakurikuler", group: "Kegiatan Siswa" },
  ppdb: { label: "PPDB", group: "PPDB" },
  quizzes: { label: "Ulangan", group: "Ulangan" },
  absensi: { label: "Absensi", group: "Absensi" },
};

const resourceLabels: Record<string, string> = {
  dashboard: "Dashboard", onboarding: "Onboarding Tenant", users: "Akun Pengguna", "landing-page": "Halaman landing",
  profile: "Profil sekolah", headmaster: "Kepala sekolah", accreditations: "Akreditasi", logo: "Logo sekolah",
  years: "Tahun ajaran", subjects: "Mata pelajaran", groups: "Kelompok", memberships: "Keanggotaan", homerooms: "Wali kelas",
  people: "Warga Sekolah", students: "Profil Siswa", teachers: "Profil Guru", staff: "Profil Staf", revisions: "Revisi impor",
  templates: "Template impor", locations: "Lokasi/Ruang", assets: "Aset/Barang", inventory: "Inventaris", organizations: "Organisasi siswa",
  periods: "Periode kepengurusan", leadership: "Kepengurusan", extracurriculars: "Ekstrakurikuler", advisors: "Pembina",
  participants: "Peserta", sessions: "Sesi", submissions: "Pengajuan", documents: "Dokumen", results: "Hasil",
  questions: "Pertanyaan", attendance: "Kehadiran", grades: "Nilai", roles: "Role Tenant", assignments: "Assignment role",
  "effective-access": "Akses efektif", "authorization-audit": "Audit otorisasi", accounts: "Akun non-admin", permissions: "Permission",
};

const actionLabels: Record<string, string> = {
  view: "Lihat", "view-contact": "Lihat kontak", "view-sensitive": "Lihat data sensitif", create: "Buat", update: "Ubah",
  archive: "Arsipkan", restore: "Pulihkan", "manage-lifecycle": "Kelola lifecycle", assign: "Tetapkan", unassign: "Akhiri penetapan",
  transfer: "Pindahkan", import: "Impor", export: "Ekspor", download: "Unduh", execute: "Eksekusi", adjust: "Sesuaikan",
  publish: "Publikasikan", close: "Tutup", decide: "Putuskan", correct: "Koreksi", upload: "Unggah", complete: "Selesaikan",
  list: "Daftar", copy: "Salin", rename: "Ganti nama", "change-permissions": "Ubah permission", activate: "Aktifkan",
  draft: "Kembalikan ke draf", replace: "Ganti assignment", bulk: "Ubah massal", invite: "Undang", link: "Tautkan",
  unlink: "Lepaskan tautan", resend: "Kirim ulang", reissue: "Terbitkan ulang", deactivate: "Nonaktifkan",
  reactivate: "Aktifkan kembali", "initiate-recovery": "Mulai pemulihan", "manage-access": "Kelola akses publik", remove: "Hapus",
};

function riskForReserved(key: string): PermissionRisk {
  return key.includes("view") || key.endsWith(".list") ? "sensitive" : "critical";
}

function toDefinition(seed: CatalogSeed, order: number): PermissionDefinition {
  const [key, dependencies = [], risk = "low", assignment = "tenant-assignable", lifecycle = "active"] = seed;
  const [module, resource, action] = key.split(".");
  const moduleInfo = moduleMetadata[module];
  const resourceLabel = resourceLabels[resource] ?? resource;
  const actionLabel = actionLabels[action] ?? action;
  return Object.freeze({
    key, module, resource, action,
    labelId: `${actionLabel} ${resourceLabel}`,
    descriptionId: `${actionLabel} ${resourceLabel} dalam Tenant sesuai batas data dan kebijakan sistem.`,
    groupId: moduleInfo?.group ?? "Pengguna & Keamanan",
    order,
    dependencies: Object.freeze([...dependencies]),
    risk,
    assignment,
    lifecycle,
    replacements: Object.freeze([]),
  });
}

export const permissionRegistry: readonly PermissionDefinition[] = Object.freeze([
  ...activeSeeds.map((seed, index) => toDefinition(seed, index + 1)),
  ...reservedKeys.map((key, index) => toDefinition([key, [], riskForReserved(key), "school-admin-only", "reserved"], activeSeeds.length + index + 1)),
]);

const p = (path: string) => `page:app/(tenant)/[domain]/(authenticated)/${path}/page.tsx`;
const a = (path: string, name: string) => `action:app/(tenant)/[domain]/(authenticated)/${path}#${name}`;
const r = (path: string, method: "GET" | "POST") => `route:app/(tenant)/[domain]/(authenticated)/${path}/route.ts#${method}`;
const w = (path: string) => `worker:${path}`;

type OperationSeed = Readonly<{
  id: string;
  entryPoints: readonly string[];
  permissions?: readonly string[];
  mode?: "all" | "any" | "conditional";
  classification?: OperationClassification;
  gate?: OperationGate;
  entitlement?: OperationEntitlement;
  context?: ContextualPolicy;
  supplemental?: readonly string[];
  risk?: PermissionRisk;
  legacy?: readonly string[];
}>;

const profilePage = p("master/profil");
const studentPage = p("master/siswa");
const teacherPage = p("master/guru");
const staffPage = p("master/staf");
const importPage = p("master/import");
const importReviewPage = p("master/import/[revisionId]");
const importExecutionPage = p("master/import/[revisionId]/execution/[executionId]");
const ppdbHistoryPage = p("ppdb/riwayat/[sessionId]");
const quizSessionPage = p("ulangan/[sessionId]");
const quizHistoryDetailPage = p("ulangan/riwayat/[sessionId]");

const seeds: OperationSeed[] = [
  { id: "tenant.dashboard.load", entryPoints: [p("dashboard")], permissions: ["tenant.dashboard.view"], legacy: ["tenantRole"] },
  { id: "tenant.onboarding.complete", entryPoints: [a("dashboard/actions.ts", "completeOnboardingAction")], permissions: ["tenant.onboarding.complete"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },

  { id: "tenant.users.load", entryPoints: [p("users")], permissions: ["tenant.users.view", "tenant.users.view-contact", "tenant.users.view-sensitive"], mode: "conditional", supplemental: ["tenant.users.view-contact", "tenant.users.view-sensitive"], legacy: ["tenantRole"] },
  { id: "tenant.accounts.view", entryPoints: [a("users/actions.ts", "getLifecycleWorkspaceAction")], permissions: ["tenant.accounts.view"], context: "school-admin-only", legacy: ["legacy-school-admin"] },
  { id: "tenant.accounts.create", entryPoints: [a("users/actions.ts", "createTenantAccountAction")], permissions: ["tenant.accounts.create"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.accounts.issue-activation", entryPoints: [a("users/actions.ts", "issueTenantActivationAction")], permissions: ["tenant.accounts.issue-activation"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.accounts.activate", entryPoints: [a("users/actions.ts", "activateTenantAccountAction")], permissions: ["tenant.accounts.activate"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.accounts.deactivate", entryPoints: [a("users/actions.ts", "deactivateTenantAccountAction")], permissions: ["tenant.accounts.deactivate"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.accounts.reactivate", entryPoints: [a("users/actions.ts", "reactivateTenantAccountAction")], permissions: ["tenant.accounts.reactivate"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.accounts.recovery", entryPoints: [a("users/actions.ts", "initiateTenantRecoveryAction")], permissions: ["tenant.accounts.recovery"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.accounts.delete", entryPoints: [a("users/actions.ts", "deleteTenantAccountAction")], permissions: ["tenant.accounts.delete"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.accounts.link", entryPoints: [a("users/actions.ts", "linkTenantAccountAction")], permissions: ["tenant.accounts.link"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.accounts.unlink", entryPoints: [a("users/actions.ts", "unlinkTenantAccountAction")], permissions: ["tenant.accounts.unlink"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.authorization-audit.load", entryPoints: [p("security-history")], permissions: ["tenant.authorization-audit.view"], context: "school-admin-only", risk: "sensitive", legacy: ["legacy-school-admin"] },
  { id: "tenant.authorization-audit.self", entryPoints: [p("security-history")], permissions: ["tenant.users.view"], context: "self", risk: "sensitive", legacy: ["tenantRole"] },
  { id: "tenant.authorization-audit.export", entryPoints: [r("security-history/export", "GET")], permissions: ["tenant.authorization-audit.export"], gate: "read", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.roles.list", entryPoints: [p("settings/roles"), a("settings/roles/actions.ts", "getRoles")], permissions: ["tenant.roles.list"], context: "school-admin-only", legacy: ["legacy-school-admin"] },
  { id: "tenant.roles.view", entryPoints: [a("settings/roles/actions.ts", "getRole")], permissions: ["tenant.roles.view"], context: "school-admin-only", legacy: ["legacy-school-admin"] },
  { id: "tenant.roles.create", entryPoints: [a("settings/roles/actions.ts", "createRole")], permissions: ["tenant.roles.create"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.roles.update", entryPoints: [a("settings/roles/actions.ts", "updateRole")], permissions: ["tenant.roles.rename", "tenant.roles.change-permissions"], mode: "conditional", gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.roles.lifecycle", entryPoints: [a("settings/roles/actions.ts", "changeRoleStatus")], permissions: ["tenant.roles.activate", "tenant.roles.draft", "tenant.roles.archive", "tenant.roles.restore", "tenant.roles.delete"], mode: "conditional", gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.assignments.view", entryPoints: [p("settings/assignments"), a("settings/assignments/actions.ts", "getAssignmentRolesAction"), a("settings/assignments/actions.ts", "searchEligibleAccountsAction")], permissions: ["tenant.assignments.view"], context: "school-admin-only", legacy: ["legacy-school-admin"] },
  { id: "tenant.assignments.replace", entryPoints: [a("settings/assignments/actions.ts", "replaceRoleSetAction")], permissions: ["tenant.assignments.replace"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.assignments.bulk", entryPoints: [a("settings/assignments/actions.ts", "previewBulkRoleChangeAction"), a("settings/assignments/actions.ts", "commitBulkRoleChangeAction")], permissions: ["tenant.assignments.bulk"], gate: "write", context: "school-admin-only", risk: "critical", legacy: ["legacy-school-admin"] },
  { id: "tenant.effective-access.view", entryPoints: [a("settings/assignments/actions.ts", "getEffectiveAccessAction")], permissions: ["tenant.effective-access.view"], context: "school-admin-only", legacy: ["legacy-school-admin"] },
  { id: "tenant.permissions.view", entryPoints: [p("settings/permissions")], permissions: ["tenant.permissions.view"], context: "school-admin-only", risk: "sensitive", legacy: ["legacy-school-admin"] },
  { id: "tenant-settings.landing-page.load", entryPoints: [p("settings")], permissions: ["tenant-settings.landing-page.view"], legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "tenant-settings.landing-page.update", entryPoints: [a("settings/actions.ts", "updateLandingPageAction")], permissions: ["tenant-settings.landing-page.update"], gate: "write", legacy: ["broad-master-data"] },

  { id: "school-profile.load", entryPoints: [profilePage], permissions: ["school-profile.profile.view", "school-profile.profile.view-sensitive"], mode: "conditional", supplemental: ["school-profile.profile.view-sensitive"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "school-profile.update", entryPoints: [a("master/profil/actions.ts", "updateSchoolProfileAction")], permissions: ["school-profile.profile.update"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "school-profile.headmaster.assign", entryPoints: [a("master/profil/actions.ts", "assignHeadmasterAction")], permissions: ["school-profile.headmaster.assign"], gate: "write", entitlement: "MD", risk: "critical", legacy: ["broad-master-data"] },
  { id: "school-profile.logo.upload", entryPoints: [a("master/profil/history-actions.ts", "uploadSchoolLogoAction")], permissions: ["school-profile.logo.upload"], gate: "write", entitlement: "MD", risk: "sensitive", legacy: ["broad-master-data"] },
  { id: "school-profile.accreditations.create", entryPoints: [a("master/profil/history-actions.ts", "addSchoolAccreditationAction")], permissions: ["school-profile.accreditations.create"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "school-profile.accreditations.correct", entryPoints: [a("master/profil/history-actions.ts", "correctSchoolAccreditationAction")], permissions: ["school-profile.accreditations.correct"], gate: "write", entitlement: "MD", risk: "sensitive", legacy: ["broad-master-data"] },

  { id: "academic-years.load", entryPoints: [p("master/tahun-ajaran")], permissions: ["academic-years.years.view"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "academic-years.create", entryPoints: [a("master/tahun-ajaran/actions.ts", "createAcademicYearAction"), a("master/tahun-ajaran/actions.ts", "createAcademicYearQuickAction")], permissions: ["academic-years.years.create"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "academic-years.manage-lifecycle", entryPoints: [a("master/tahun-ajaran/actions.ts", "transitionAcademicYearAction")], permissions: ["academic-years.years.manage-lifecycle"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "academic-years.archive", entryPoints: [a("master/tahun-ajaran/actions.ts", "archiveAcademicYearAction")], permissions: ["academic-years.years.archive", "academic-years.years.restore"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },

  { id: "subjects.load", entryPoints: [p("master/mapel")], permissions: ["subjects.subjects.view"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "subjects.create", entryPoints: [a("master/mapel/actions.ts", "createSubjectAction")], permissions: ["subjects.subjects.create"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "subjects.update", entryPoints: [a("master/mapel/actions.ts", "editSubjectAction")], permissions: ["subjects.subjects.update"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "subjects.archive-or-restore", entryPoints: [a("master/mapel/actions.ts", "archiveSubjectAction")], permissions: ["subjects.subjects.archive", "subjects.subjects.restore"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },

  { id: "class-groups.load", entryPoints: [p("master/rombel")], permissions: ["class-groups.groups.view", "people.people.view", "students.students.view", "teachers.teachers.view"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "class-groups.create", entryPoints: [a("master/rombel/actions.ts", "createClassGroupAction")], permissions: ["class-groups.groups.create"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "class-groups.update", entryPoints: [a("master/rombel/actions.ts", "editClassGroupAction")], permissions: ["class-groups.groups.update"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "class-groups.lifecycle", entryPoints: [a("master/rombel/actions.ts", "manageClassGroupAction")], permissions: ["class-groups.groups.manage-lifecycle", "class-groups.groups.archive", "class-groups.groups.restore"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "class-groups.memberships.assign", entryPoints: [a("master/rombel/actions.ts", "addClassMembershipsAction"), a("master/rombel/actions.ts", "manageClassRelationshipAction")], permissions: ["class-groups.memberships.assign"], gate: "write", entitlement: "MD", risk: "sensitive", legacy: ["broad-master-data"] },
  { id: "class-groups.relationships.manage", entryPoints: [a("master/rombel/actions.ts", "manageClassRelationshipAction")], permissions: ["class-groups.memberships.transfer", "class-groups.homerooms.assign"], mode: "conditional", gate: "write", entitlement: "MD", risk: "critical", legacy: ["broad-master-data"] },

  { id: "students.load", entryPoints: [studentPage], permissions: ["people.people.view", "people.people.view-contact", "people.people.view-sensitive", "students.students.view", "students.students.view-sensitive"], context: "assigned-or-self", supplemental: ["people.people.view-contact", "people.people.view-sensitive", "students.students.view-sensitive"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "students.create", entryPoints: [a("master/siswa/actions.ts", "createStudentAction")], permissions: ["students.students.create", "people.people.create"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "students.update", entryPoints: [a("master/siswa/actions.ts", "editStudentAction")], permissions: ["students.students.update", "people.people.update"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "students.lifecycle", entryPoints: [a("master/siswa/actions.ts", "manageStudentLifecycleAction")], permissions: ["students.students.manage-lifecycle", "students.students.archive", "students.students.restore"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "people.archive", entryPoints: [a("master/warga-sekolah/actions.ts", "archiveSchoolPersonAction")], permissions: ["people.people.archive"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },

  { id: "teachers.load", entryPoints: [teacherPage], permissions: ["people.people.view", "people.people.view-contact", "people.people.view-sensitive", "teachers.teachers.view", "teachers.teachers.view-sensitive"], context: "self", supplemental: ["people.people.view-contact", "people.people.view-sensitive", "teachers.teachers.view-sensitive"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "teachers.create", entryPoints: [a("master/guru/actions.ts", "createTeacherAction")], permissions: ["teachers.teachers.create", "people.people.create"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "teachers.update", entryPoints: [a("master/guru/actions.ts", "editTeacherAction")], permissions: ["teachers.teachers.update", "people.people.update"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "teachers.lifecycle", entryPoints: [a("master/guru/actions.ts", "manageTeacherLifecycleAction")], permissions: ["teachers.teachers.manage-lifecycle", "teachers.teachers.archive", "teachers.teachers.restore"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },

  { id: "staff.load", entryPoints: [staffPage], permissions: ["people.people.view", "people.people.view-contact", "people.people.view-sensitive", "staff.staff.view", "staff.staff.view-sensitive"], context: "self", supplemental: ["people.people.view-contact", "people.people.view-sensitive", "staff.staff.view-sensitive"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "staff.create", entryPoints: [a("master/staf/actions.ts", "createStaffAction")], permissions: ["staff.staff.create", "people.people.create"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "staff.update", entryPoints: [a("master/staf/actions.ts", "editStaffAction")], permissions: ["staff.staff.update", "people.people.update"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "staff.lifecycle", entryPoints: [a("master/staf/actions.ts", "manageStaffLifecycleAction")], permissions: ["staff.staff.manage-lifecycle", "staff.staff.archive", "staff.staff.restore"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },

  { id: "people-imports.load", entryPoints: [importPage, importReviewPage, importExecutionPage], permissions: ["people-imports.revisions.view", "people-imports.revisions.view-sensitive"], supplemental: ["people-imports.revisions.view-sensitive"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "people-imports.template.download", entryPoints: [r("master/import/template/[kind]", "GET")], permissions: ["people-imports.templates.download"], entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "people-imports.upload", entryPoints: [r("master/import/upload", "POST"), r("master/import/[revisionId]/revision", "POST"), w("scripts/run-people-import-validation.ts")], permissions: ["people-imports.revisions.import"], gate: "write", entitlement: "MD", risk: "sensitive", legacy: ["broad-master-data"] },
  { id: "people-imports.decision.update", entryPoints: [a("master/import/[revisionId]/actions.ts", "saveDecisionAction")], permissions: ["people-imports.revisions.update"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "people-imports.execute", entryPoints: [a("master/import/[revisionId]/actions.ts", "executeImportAction"), a("master/import/actions.ts", "importDemoMasterDataAction"), w("scripts/run-people-import-execution.ts")], permissions: ["people-imports.revisions.execute", "people.people.create", "people.people.update", "students.students.create", "students.students.update", "teachers.teachers.create", "teachers.teachers.update", "staff.staff.create", "staff.staff.update"], mode: "conditional", gate: "write", entitlement: "MD", risk: "critical", legacy: ["broad-master-data"] },
  { id: "people-imports.export", entryPoints: [r("master/import/[revisionId]/correction", "GET"), r("master/import/[revisionId]/execution/[executionId]/result", "GET")], permissions: ["people-imports.revisions.export", "people-imports.revisions.view-sensitive"], mode: "conditional", supplemental: ["people-imports.revisions.view-sensitive"], entitlement: "MD", risk: "critical", legacy: ["entitlement"] },

  { id: "facilities.load", entryPoints: [p("master/sarpras")], permissions: ["facilities.locations.view"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "facilities.create", entryPoints: [a("master/sarpras/actions.ts", "createLocationAction")], permissions: ["facilities.locations.create"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "facilities.update", entryPoints: [a("master/sarpras/actions.ts", "editLocationAction")], permissions: ["facilities.locations.update"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "facilities.archive-or-restore", entryPoints: [a("master/sarpras/actions.ts", "manageLocationAction")], permissions: ["facilities.locations.archive", "facilities.locations.restore"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "assets.load", entryPoints: [p("master/sarpras/aset")], permissions: ["assets.assets.view", "facilities.locations.view"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "assets.create", entryPoints: [a("master/sarpras/aset/actions.ts", "createAssetAction")], permissions: ["assets.assets.create"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "assets.update", entryPoints: [a("master/sarpras/aset/actions.ts", "editAssetAction")], permissions: ["assets.assets.update"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "assets.inventory.adjust", entryPoints: [a("master/sarpras/aset/actions.ts", "changeInventoryAction")], permissions: ["assets.inventory.adjust"], gate: "write", entitlement: "MD", risk: "critical", legacy: ["broad-master-data"] },
  { id: "assets.archive-or-restore", entryPoints: [a("master/sarpras/aset/actions.ts", "manageAssetAction")], permissions: ["assets.assets.archive", "assets.assets.restore"], mode: "conditional", gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },

  { id: "student-organizations.load", entryPoints: [p("master/organisasi")], permissions: ["student-organizations.organizations.view", "people.people.view", "students.students.view"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "student-organizations.create", entryPoints: [a("master/organisasi/actions.ts", "createOrganizationAction")], permissions: ["student-organizations.organizations.create"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "student-organizations.archive", entryPoints: [a("master/organisasi/actions.ts", "archiveOrganizationAction")], permissions: ["student-organizations.organizations.archive"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "student-organizations.periods.create", entryPoints: [a("master/organisasi/actions.ts", "createPeriodAction")], permissions: ["student-organizations.periods.create"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "student-organizations.periods.lifecycle", entryPoints: [a("master/organisasi/actions.ts", "transitionPeriodAction")], permissions: ["student-organizations.periods.manage-lifecycle"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "student-organizations.periods.correct", entryPoints: [a("master/organisasi/actions.ts", "correctPeriodAction")], permissions: ["student-organizations.periods.correct"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "student-organizations.memberships.assign", entryPoints: [a("master/organisasi/actions.ts", "addMembershipAction")], permissions: ["student-organizations.memberships.assign"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "student-organizations.memberships.unassign", entryPoints: [a("master/organisasi/actions.ts", "endMembershipAction")], permissions: ["student-organizations.memberships.unassign"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "student-organizations.leadership.assign", entryPoints: [a("master/organisasi/actions.ts", "assignLeadershipAction")], permissions: ["student-organizations.leadership.assign"], gate: "write", entitlement: "MD", risk: "critical", legacy: ["broad-master-data"] },
  { id: "student-organizations.leadership.unassign", entryPoints: [a("master/organisasi/actions.ts", "endLeadershipAction")], permissions: ["student-organizations.leadership.unassign"], gate: "write", entitlement: "MD", risk: "critical", legacy: ["broad-master-data"] },

  { id: "extracurriculars.load", entryPoints: [p("master/organisasi/ekstrakurikuler")], permissions: ["extracurriculars.extracurriculars.view", "people.people.view", "students.students.view", "teachers.teachers.view", "staff.staff.view"], entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "extracurriculars.create", entryPoints: [a("master/organisasi/ekstrakurikuler/actions.ts", "createExtracurricularAction")], permissions: ["extracurriculars.extracurriculars.create"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "extracurriculars.archive", entryPoints: [a("master/organisasi/ekstrakurikuler/actions.ts", "archiveExtracurricularAction")], permissions: ["extracurriculars.extracurriculars.archive"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "extracurriculars.groups.create", entryPoints: [a("master/organisasi/ekstrakurikuler/actions.ts", "createGroupAction")], permissions: ["extracurriculars.groups.create"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "extracurriculars.groups.lifecycle", entryPoints: [a("master/organisasi/ekstrakurikuler/actions.ts", "transitionGroupAction")], permissions: ["extracurriculars.groups.manage-lifecycle"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "extracurriculars.advisors.assign", entryPoints: [a("master/organisasi/ekstrakurikuler/actions.ts", "assignAdvisorAction")], permissions: ["extracurriculars.advisors.assign"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "extracurriculars.advisors.unassign", entryPoints: [a("master/organisasi/ekstrakurikuler/actions.ts", "endAdvisorAction")], permissions: ["extracurriculars.advisors.unassign"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "extracurriculars.participants.assign", entryPoints: [a("master/organisasi/ekstrakurikuler/actions.ts", "enrollParticipantAction")], permissions: ["extracurriculars.participants.assign"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },
  { id: "extracurriculars.participants.unassign", entryPoints: [a("master/organisasi/ekstrakurikuler/actions.ts", "endParticipantAction")], permissions: ["extracurriculars.participants.unassign"], gate: "write", entitlement: "MD", legacy: ["broad-master-data"] },

  { id: "ppdb.sessions.load", entryPoints: [p("ppdb/settings"), p("ppdb/riwayat"), ppdbHistoryPage, p("ppdb/results")], permissions: ["ppdb.sessions.view"], entitlement: "PPDB-R", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "ppdb.sessions.create", entryPoints: [a("ppdb/actions.ts", "createSessionAction")], permissions: ["ppdb.sessions.create"], gate: "write", entitlement: "PPDB-W", legacy: ["entitlement"] },
  { id: "ppdb.sessions.update", entryPoints: [a("ppdb/actions.ts", "updateFieldsAction"), a("ppdb/actions.ts", "updateResultSettingsAction")], permissions: ["ppdb.sessions.update"], gate: "write", entitlement: "PPDB-W", legacy: ["entitlement"] },
  { id: "ppdb.sessions.publish", entryPoints: [a("ppdb/actions.ts", "publishSessionAction")], permissions: ["ppdb.sessions.publish"], gate: "write", entitlement: "PPDB-W", risk: "critical", legacy: ["entitlement"] },
  { id: "ppdb.sessions.close", entryPoints: [a("ppdb/actions.ts", "endSessionAction")], permissions: ["ppdb.sessions.close"], gate: "write", entitlement: "PPDB-W", legacy: ["entitlement"] },
  { id: "ppdb.submissions.load", entryPoints: [p("ppdb"), ppdbHistoryPage], permissions: ["ppdb.submissions.view", "ppdb.submissions.view-sensitive", "ppdb.submissions.export"], mode: "conditional", supplemental: ["ppdb.submissions.view-sensitive", "ppdb.submissions.export"], entitlement: "PPDB-R", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "ppdb.documents.load", entryPoints: [r("ppdb/submissions/[submissionId]/documents/[documentId]", "GET")], permissions: ["ppdb.documents.view-sensitive"], supplemental: ["ppdb.documents.view-sensitive"], entitlement: "PPDB-R", context: "tenant-wide", risk: "critical", legacy: ["entitlement"] },
  { id: "ppdb.documents.download", entryPoints: [r("ppdb/submissions/[submissionId]/documents/[documentId]", "GET")], permissions: ["ppdb.documents.download", "ppdb.documents.view-sensitive"], mode: "all", supplemental: ["ppdb.documents.view-sensitive"], entitlement: "PPDB-R", context: "tenant-wide", risk: "critical", legacy: ["entitlement"] },
  { id: "ppdb.submissions.export", entryPoints: [r("ppdb/submissions/export", "GET")], permissions: ["ppdb.submissions.export", "ppdb.submissions.view-sensitive"], mode: "all", supplemental: ["ppdb.submissions.view-sensitive"], entitlement: "PPDB-R", context: "tenant-wide", risk: "critical", legacy: ["entitlement"] },
  { id: "ppdb.submissions.decide", entryPoints: [a("ppdb/actions.ts", "decideSubmissionAction")], permissions: ["ppdb.submissions.decide"], gate: "write", entitlement: "PPDB-W", risk: "critical", legacy: ["entitlement"] },
  { id: "ppdb.results.load", entryPoints: [p("ppdb/results"), ppdbHistoryPage], permissions: ["ppdb.results.view"], entitlement: "PPDB-R", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "ppdb.results.publish", entryPoints: [a("ppdb/actions.ts", "publishResultsAction")], permissions: ["ppdb.results.publish"], gate: "write", entitlement: "PPDB-W", risk: "critical", legacy: ["entitlement"] },
  { id: "ppdb.results.manage-access", entryPoints: [a("ppdb/actions.ts", "updateResultCheckAccessAction")], permissions: ["ppdb.results.manage-access"], gate: "write", entitlement: "PPDB-W", risk: "critical", legacy: ["entitlement"] },

  { id: "quizzes.sessions.load", entryPoints: [p("ulangan"), p("ulangan/create"), quizSessionPage, p("ulangan/riwayat"), quizHistoryDetailPage], permissions: ["quizzes.sessions.view"], entitlement: "QUIZ-R", context: "assigned", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "quizzes.sessions.create", entryPoints: [a("ulangan/actions.ts", "createSessionAction")], permissions: ["quizzes.sessions.create"], gate: "write", entitlement: "QUIZ-W", context: "assigned", legacy: ["entitlement"] },
  { id: "quizzes.sessions.publish", entryPoints: [a("ulangan/actions.ts", "activateSessionAction")], permissions: ["quizzes.sessions.publish"], gate: "write", entitlement: "QUIZ-W", context: "assigned", legacy: ["entitlement"] },
  { id: "quizzes.sessions.close", entryPoints: [a("ulangan/actions.ts", "endSessionAction")], permissions: ["quizzes.sessions.close", "quizzes.attendance.adjust"], mode: "conditional", gate: "write", entitlement: "QUIZ-W", context: "assigned", legacy: ["entitlement"] },
  { id: "quizzes.questions.load", entryPoints: [quizSessionPage, p("ulangan/[sessionId]/penilaian"), quizHistoryDetailPage], permissions: ["quizzes.questions.view", "quizzes.questions.view-sensitive"], supplemental: ["quizzes.questions.view-sensitive"], entitlement: "QUIZ-R", context: "assigned", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "quizzes.questions.create", entryPoints: [a("ulangan/actions.ts", "addQuestionAction"), a("ulangan/actions.ts", "addDemoQuestionsAction")], permissions: ["quizzes.questions.create"], gate: "write", entitlement: "QUIZ-W", context: "assigned", legacy: ["entitlement"] },
  { id: "quizzes.questions.remove", entryPoints: [a("ulangan/actions.ts", "removeQuestionAction")], permissions: ["quizzes.questions.remove"], gate: "write", entitlement: "QUIZ-W", context: "assigned", legacy: ["entitlement"] },
  { id: "quizzes.attendance.load", entryPoints: [quizSessionPage, p("ulangan/[sessionId]/absensi"), quizHistoryDetailPage], permissions: ["quizzes.attendance.view"], entitlement: "QUIZ-R", context: "assigned", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "quizzes.attendance.adjust", entryPoints: [a("ulangan/actions.ts", "saveAttendanceBatchAction"), a("ulangan/actions.ts", "markAttendanceAction")], permissions: ["quizzes.attendance.adjust"], gate: "write", entitlement: "QUIZ-W", context: "assigned", legacy: ["entitlement"] },
  { id: "quizzes.grades.load", entryPoints: [p("ulangan/[sessionId]/penilaian"), quizHistoryDetailPage], permissions: ["quizzes.grades.view"], entitlement: "QUIZ-R", context: "assigned", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "quizzes.grades.adjust", entryPoints: [a("ulangan/actions.ts", "saveOfflineScoresAction")], permissions: ["quizzes.grades.adjust"], gate: "write", entitlement: "QUIZ-W", context: "assigned", risk: "critical", legacy: ["entitlement"] },
  { id: "quizzes.grades.execute", entryPoints: [a("ulangan/actions.ts", "prepareOfflineGradingAction"), a("ulangan/actions.ts", "finalizeOfflineGradingAction"), a("ulangan/actions.ts", "gradeSessionAction")], permissions: ["quizzes.grades.execute"], gate: "write", entitlement: "QUIZ-W", context: "assigned", risk: "critical", legacy: ["entitlement"] },

  { id: "master-data.overview.load", entryPoints: [p("master")], permissions: activeSeeds.map(([key]) => key).filter((key) => key.endsWith(".view") && !key.startsWith("tenant.")), mode: "any", entitlement: "MD", legacy: ["broad-master-data", "capability-aggregate"] },
  { id: "authenticated.layout", entryPoints: ["layout:app/(tenant)/[domain]/(authenticated)/layout.tsx"], classification: "system-policy", context: "none", legacy: ["tenantRole"] },
  { id: "dashboard.demo-action", entryPoints: [a("dashboard/actions.ts", "dummyUpdateSettings")], classification: "placeholder", gate: "none", context: "none", legacy: ["legacy-school-admin"] },
  { id: "absensi.attendance.load", entryPoints: [p("absensi")], permissions: ["absensi.attendance.view"], legacy: [] },
  { id: "e-library.load", entryPoints: [p("e-library")], permissions: ["tenant.authorization-audit.view"], context: "school-admin-only", legacy: [] },
  { id: "jadwal.mengajar.load", entryPoints: [p("jadwal/mengajar")], permissions: ["tenant.authorization-audit.view"], context: "school-admin-only", legacy: [] },
  { id: "jadwal.events.load", entryPoints: [p("jadwal/events")], permissions: ["tenant.authorization-audit.view"], context: "school-admin-only", legacy: [] },
  { id: "persuratan.load", entryPoints: [p("persuratan")], permissions: ["tenant.authorization-audit.view"], context: "school-admin-only", legacy: [] },
  { id: "settings.backup-restore.load", entryPoints: [p("settings/backup-restore")], permissions: ["tenant.authorization-audit.view"], context: "school-admin-only", legacy: ["broad-master-data"] },
  { id: "integrasi.whatsapp-bot.load", entryPoints: [p("integrasi/whatsapp-bot")], permissions: ["tenant.authorization-audit.view"], context: "school-admin-only", legacy: ["broad-master-data"] },
];

for (const key of reservedKeys) {
  seeds.push({ id: `reserved.${key}`, entryPoints: [`target:${key}`], permissions: [key], classification: "system-policy", gate: key.endsWith(".view") || key.endsWith(".list") ? "read" : "write", context: "school-admin-only", risk: riskForReserved(key) });
}

function defaultEntitlement(permissions: readonly string[], gate: OperationGate): OperationEntitlement {
  const key = permissions[0] ?? "";
  if (key.startsWith("ppdb.")) return gate === "write" ? "PPDB-W" : "PPDB-R";
  if (key.startsWith("quizzes.")) return gate === "write" ? "QUIZ-W" : "QUIZ-R";
  if (["tenant.", "tenant-settings."].some((prefix) => key.startsWith(prefix))) return "none";
  return permissions.length ? "MD" : "none";
}

function operationRisk(permissions: readonly string[], fallback?: PermissionRisk): PermissionRisk {
  if (fallback) return fallback;
  const ranks: PermissionRisk[] = ["low", "medium", "sensitive", "critical"];
  return permissions.reduce<PermissionRisk>((highest, key) => {
    const risk = permissionRegistry.find((entry) => entry.key === key)?.risk ?? "critical";
    return ranks.indexOf(risk) > ranks.indexOf(highest) ? risk : highest;
  }, "low");
}

function toOperation(seed: OperationSeed): TenantOperationDefinition {
  const permissions = Object.freeze([...(seed.permissions ?? [])]);
  const gate = seed.gate ?? "read";
  const context = seed.context ?? "tenant-wide";
  const mutation = gate === "write";
  const classification = seed.classification ?? "tenant-rbac";
  const lifecycle = permissions.some((key) => permissionRegistry.find((entry) => entry.key === key)?.lifecycle === "reserved") ? "reserved" : "active";
  return Object.freeze({
    id: seed.id,
    entryPoints: Object.freeze([...seed.entryPoints]),
    classification,
    requiredPermissions: permissions,
    permissionMode: seed.mode ?? "all",
    accountTenantGate: classification === "tenant-rbac" || classification === "system-policy",
    operationalGate: gate,
    entitlement: seed.entitlement ?? defaultEntitlement(permissions, gate),
    contextualPolicy: context,
    contextualArms: Object.freeze(context === "assigned-or-self" ? ["assigned", "self"] : context === "none" ? [] : [context]),
    relationship: context === "assigned" || context === "assigned-or-self" ? "current canonical assignment; complete class-subject tuple required where applicable" : context === "self" ? "same-Tenant school_person.accountUserId" : context === "tenant-wide" ? "verified same-Tenant identity" : "system policy",
    effectiveTime: mutation ? "transaction-time" : permissions.length ? "request-time" : "none",
    collectionScope: seed.entryPoints.some((entry) => entry.startsWith("page:")) ? "tenant-qualified-before-results" : permissions.length ? "record-concealment" : "not-applicable",
    supplementalPermissions: Object.freeze([...(seed.supplemental ?? [])]),
    transaction: Object.freeze({ reauthorize: mutation, tenantQualifiedTarget: mutation, concurrency: mutation, domainInvariants: mutation, atomicAudit: mutation }),
    risk: operationRisk(permissions, seed.risk),
    externalDenial: classification === "placeholder" ? "not-applicable" : seed.entryPoints.some((entry) => entry.startsWith("page:")) ? "redirect-or-401" : context === "assigned" || context === "assigned-or-self" || context === "self" ? "404" : "403",
    lifecycle,
    registryVersion: PERMISSION_REGISTRY_VERSION,
    operationMapVersion: OPERATION_MAP_VERSION,
    legacyAuthority: Object.freeze([...(seed.legacy ?? [])]),
  });
}

export const tenantOperationMap: readonly TenantOperationDefinition[] = Object.freeze(seeds.map(toOperation));

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function digest(version: string, value: unknown): string {
  return createHash("sha256").update(canonicalize({ version, value })).digest("hex");
}

export const permissionRegistryDigest = digest(PERMISSION_REGISTRY_VERSION, permissionRegistry);
export const tenantOperationMapDigest = digest(OPERATION_MAP_VERSION, tenantOperationMap);

export type RegistryValidationIssue = Readonly<{
  code: "malformed-key" | "duplicate-key" | "metadata-mismatch" | "invalid-classification" | "unknown-dependency" | "dependency-cycle" | "deprecated-without-replacement" | "invalid-replacement";
  key: string;
  detail?: string;
}>;

const keyPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*\.[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validatePermissionRegistry(entries: readonly PermissionDefinition[] = permissionRegistry): RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = [];
  const byKey = new Map<string, PermissionDefinition>();
  for (const entry of entries) {
    if (!keyPattern.test(entry.key)) issues.push({ code: "malformed-key", key: entry.key });
    if (byKey.has(entry.key)) issues.push({ code: "duplicate-key", key: entry.key });
    byKey.set(entry.key, entry);
    if (entry.key !== `${entry.module}.${entry.resource}.${entry.action}`) issues.push({ code: "metadata-mismatch", key: entry.key });
    if (!["tenant-assignable", "school-admin-only", "system-internal"].includes(entry.assignment)) issues.push({ code: "invalid-classification", key: entry.key });
    if (entry.lifecycle === "deprecated" && entry.replacements.length === 0) issues.push({ code: "deprecated-without-replacement", key: entry.key });
  }
  for (const entry of entries) {
    for (const dependency of entry.dependencies) if (!byKey.has(dependency)) issues.push({ code: "unknown-dependency", key: entry.key, detail: dependency });
    for (const replacement of entry.replacements) {
      const target = byKey.get(replacement);
      if (!target || target.lifecycle !== "active") issues.push({ code: "invalid-replacement", key: entry.key, detail: replacement });
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (key: string): void => {
    if (visiting.has(key)) {
      issues.push({ code: "dependency-cycle", key });
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    for (const dependency of byKey.get(key)?.dependencies ?? []) if (byKey.has(dependency)) walk(dependency);
    visiting.delete(key);
    visited.add(key);
  };
  for (const key of byKey.keys()) walk(key);
  return issues;
}

export function resolveActivePermission(key: string): PermissionDefinition | null {
  const permission = permissionRegistry.find((entry) => entry.key === key);
  return permission?.lifecycle === "active" ? permission : null;
}

export type CustomRolePermissionIssue = Readonly<{
  code: "unknown-permission" | "permission-not-active" | "permission-not-assignable" | "missing-dependency";
  key: string;
  dependency?: string;
}>;

export function validateCustomRolePermissions(keys: readonly string[]): { ok: true; permissions: string[] } | { ok: false; issues: CustomRolePermissionIssue[] } {
  const selected = [...new Set(keys)];
  const selectedSet = new Set(selected);
  const byKey = new Map(permissionRegistry.map((entry) => [entry.key, entry]));
  const issues: CustomRolePermissionIssue[] = [];
  for (const key of selected) {
    const entry = byKey.get(key);
    if (!entry) {
      issues.push({ code: "unknown-permission", key });
      continue;
    }
    if (entry.lifecycle !== "active") {
      issues.push({ code: "permission-not-active", key });
      continue;
    }
    if (entry.assignment !== "tenant-assignable") {
      issues.push({ code: "permission-not-assignable", key });
      continue;
    }
    for (const dependency of entry.dependencies) if (!selectedSet.has(dependency)) issues.push({ code: "missing-dependency", key, dependency });
  }
  return issues.length ? { ok: false, issues } : { ok: true, permissions: selected };
}

const legacyMinimum = Object.freeze(["tenant.dashboard.view", "tenant.users.view", "tenant.users.view-contact", "tenant.users.view-sensitive"]);

export function resolveLegacyPermissionKeys(role: string | null | undefined): readonly string[] {
  return LEGACY_NON_ADMIN_ROLES.includes(role as (typeof LEGACY_NON_ADMIN_ROLES)[number]) ? [...legacyMinimum] : [];
}

export type ContractValidationIssue = Readonly<{ code: string; key?: string; operation?: string; detail?: string }>;

export function validateTenantRbacContract(): ContractValidationIssue[] {
  const issues: ContractValidationIssue[] = [...validatePermissionRegistry()];
  const registry = new Map(permissionRegistry.map((entry) => [entry.key, entry]));
  const mappedKeys = new Set<string>();
  const operationIds = new Set<string>();
  for (const operation of tenantOperationMap) {
    if (operationIds.has(operation.id)) issues.push({ code: "duplicate-operation", operation: operation.id });
    operationIds.add(operation.id);
    if (operation.classification === "placeholder" && operation.requiredPermissions.length) issues.push({ code: "placeholder-has-permission", operation: operation.id });
    for (const key of operation.requiredPermissions) {
      mappedKeys.add(key);
      const permission = registry.get(key);
      if (!permission) issues.push({ code: "operation-unknown-permission", operation: operation.id, key });
      else if (operation.lifecycle === "active" && permission.lifecycle !== "active") issues.push({ code: "operation-inactive-permission", operation: operation.id, key });
    }
    for (const key of operation.supplementalPermissions) if (!operation.requiredPermissions.includes(key)) issues.push({ code: "missing-supplemental-permission", operation: operation.id, key });
    if (operation.operationalGate === "write" && !Object.values(operation.transaction).every(Boolean)) issues.push({ code: "mutation-contract-incomplete", operation: operation.id });
  }
  for (const permission of permissionRegistry) if (!mappedKeys.has(permission.key)) issues.push({ code: "unmapped-permission", key: permission.key });
  return issues;
}
