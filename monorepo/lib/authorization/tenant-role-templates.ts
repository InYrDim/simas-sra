import { permissionRegistry } from "@/lib/authorization/tenant-rbac-contract";
import { tenantMenuItems } from "@/components/tenant-nav-menu/config";
import { isNavigationItemAuthorized } from "@/lib/authorization/tenant-nav-item-authorization";

/**
 * Provider-defined role templates a tenant can instantiate with one click.
 *
 * Templates are a code constant (not DB-managed) so they stay in lockstep with
 * the permission registry. Each template lists the *intent* permissions; the
 * dependency closure is computed at module load so every emitted key set passes
 * `validatePermissions` (no school-admin-only / reserved keys, deps satisfied).
 */

export const TENANT_ROLE_TEMPLATE_VERSION = "1";

export type TenantRoleTemplate = Readonly<{
  key: string;
  name: string;
  description: string;
  permissions: readonly string[];
  /** Menu keys hidden for this template; absent keys default to visible. */
  menuVisibility: Readonly<Record<string, boolean>>;
}>;

function closeDependencies(keys: readonly string[]): string[] {
  const resolved = new Set<string>();
  const queue = [...keys];
  while (queue.length) {
    const key = queue.shift()!;
    if (resolved.has(key)) continue;
    const def = permissionRegistry.find((p) => p.key === key);
    // Skip keys that are not tenant-assignable/active; templates must only emit
    // assignable keys so instantiation never fails validation.
    if (!def || def.assignment !== "tenant-assignable" || def.lifecycle === "reserved") continue;
    resolved.add(key);
    for (const dep of def.dependencies) {
      if (!resolved.has(dep)) queue.push(dep);
    }
  }
  return [...resolved];
}

function template(
  key: string,
  name: string,
  description: string,
  permissions: readonly string[],
  hiddenMenus?: readonly string[],
): TenantRoleTemplate {
  const resolved = closeDependencies(permissions);
  // Hide every sidebar item the resolved permission set cannot open, so a
  // template only surfaces the pages its users can actually reach.
  const permissionSet = new Set(resolved);
  const menuVisibility: Record<string, boolean> = {};
  for (const item of tenantMenuItems) {
    if (!isNavigationItemAuthorized(item, permissionSet)) menuVisibility[item.key] = false;
    for (const child of item.items ?? []) {
      if (!isNavigationItemAuthorized(child, permissionSet)) menuVisibility[child.key] = false;
    }
  }
  // Explicit overrides (e.g. a template that may open a page but should not
  // surface it in the sidebar).
  for (const menuKey of hiddenMenus ?? []) menuVisibility[menuKey] = false;
  return { key, name, description, permissions: resolved, menuVisibility };
}

export const TENANT_ROLE_TEMPLATES: readonly TenantRoleTemplate[] = Object.freeze([
  template("guru", "Guru", "Akses input nilai, kehadiran, dan data warga sekolah untuk pembelajaran.", [
    "people.people.view",
    "people.people.view-contact",
    "people.people.view-sensitive",
    "people.people.update",
    "students.students.view",
    "students.students.view-sensitive",
    "students.students.update",
    "teachers.teachers.view",
    "teachers.teachers.view-sensitive",
    "teachers.teachers.update",
    "class-groups.groups.view",
    "subjects.subjects.view",
    "quizzes.sessions.view",
    "quizzes.questions.view",
    "quizzes.questions.view-sensitive",
    "quizzes.grades.view",
    "quizzes.attendance.view",
    "absensi.attendance.view",
    "absensi.kelas.record",
    "absensi.kelas.manage",
    "absensi.self.view",
    "academic-years.years.view",
  ]),
  template("staff", "Staff", "Akses data warga sekolah dan administrasi umum.", [
    "people.people.view",
    "people.people.view-contact",
    "people.people.view-sensitive",
    "people.people.update",
    "staff.staff.view",
    "staff.staff.view-sensitive",
    "staff.staff.update",
    "students.students.view",
    "students.students.view-sensitive",
    "class-groups.groups.view",
    "subjects.subjects.view",
    "academic-years.years.view",
    "absensi.attendance.view",
  ]),
  template("wali-kelas", "Wali Kelas", "Kelola siswa di rombongan belajar dan input nilai/kehadiran kelas.", [
    "people.people.view",
    "people.people.view-contact",
    "people.people.view-sensitive",
    "students.students.view",
    "students.students.view-sensitive",
    "students.students.update",
    "class-groups.groups.view",
    "class-groups.memberships.assign",
    "subjects.subjects.view",
    "quizzes.grades.view",
    "quizzes.attendance.view",
    "absensi.attendance.view",
    "academic-years.years.view",
  ]),
  template("siswa", "Siswa", "Akses lihat data sendiri: profil, nilai, kehadiran, jadwal, dan kegiatan.", [
    "tenant.dashboard.view",
    "students.students.view",
    "students.students.view-sensitive",
    "class-groups.groups.view",
    "subjects.subjects.view",
    "academic-years.years.view",
    "quizzes.sessions.view",
    "quizzes.questions.view",
    "quizzes.grades.view",
    "quizzes.attendance.view",
    "absensi.attendance.view",
    "absensi.self.view",
    "ppdb.submissions.view",
    "ppdb.submissions.view-sensitive",
    "ppdb.results.view",
    "extracurriculars.extracurriculars.view",
    "student-organizations.organizations.view",
  ], ["master-overview", "master-data", "master-import", "e-library", "persuratan", "ppdb", "ulangan", "penjadwalan", "pengguna", "security-history", "settings-system", "backup-restore"]),
  template("pimpinan", "Pimpinan", "Akses luas untuk kepala sekolah dan manajemen: kelola warga, akademik, dan kegiatan.", [
    "people.people.view",
    "people.people.view-contact",
    "people.people.view-sensitive",
    "people.people.update",
    "students.students.view",
    "students.students.view-sensitive",
    "students.students.update",
    "students.students.manage-lifecycle",
    "students.students.archive",
    "students.students.restore",
    "teachers.teachers.view",
    "teachers.teachers.view-sensitive",
    "teachers.teachers.update",
    "teachers.teachers.manage-lifecycle",
    "teachers.teachers.archive",
    "teachers.teachers.restore",
    "staff.staff.view",
    "staff.staff.view-sensitive",
    "staff.staff.update",
    "staff.staff.manage-lifecycle",
    "staff.staff.archive",
    "staff.staff.restore",
    "class-groups.groups.view",
    "class-groups.groups.create",
    "class-groups.groups.update",
    "class-groups.groups.manage-lifecycle",
    "class-groups.groups.archive",
    "class-groups.groups.restore",
    "class-groups.memberships.assign",
    "class-groups.memberships.transfer",
    "class-groups.homerooms.assign",
    "subjects.subjects.view",
    "subjects.subjects.create",
    "subjects.subjects.update",
    "subjects.subjects.archive",
    "subjects.subjects.restore",
    "academic-years.years.view",
    "academic-years.years.create",
    "academic-years.years.manage-lifecycle",
    "academic-years.years.archive",
    "academic-years.years.restore",
    "quizzes.sessions.view",
    "quizzes.questions.view",
    "quizzes.questions.view-sensitive",
    "quizzes.grades.view",
    "quizzes.grades.adjust",
    "quizzes.attendance.view",
    "quizzes.attendance.adjust",
    "absensi.attendance.view",
    "absensi.settings.update",
    "absensi.gerbang.record",
    "absensi.gerbang.manage",
    "absensi.kelas.record",
    "absensi.kelas.manage",
    "absensi.qr.record",
    "absensi.history.delete",
    "absensi.self.view",
    "ppdb.sessions.view",
    "ppdb.submissions.view",
    "ppdb.submissions.view-sensitive",
    "ppdb.results.view",
    "facilities.locations.view",
    "assets.assets.view",
    "student-organizations.organizations.view",
    "extracurriculars.extracurriculars.view",
  ]),
]);

export function getTenantRoleTemplate(key: string): TenantRoleTemplate | undefined {
  return TENANT_ROLE_TEMPLATES.find((t) => t.key === key);
}

export type TemplateAccessiblePage = Readonly<{
  /** Top-level menu title, or the item title when it has no children. */
  title: string;
  /** Child page titles when the item is a collapsible group. */
  children: readonly string[];
}>;

/**
 * Pages a template surfaces in the sidebar: top-level items not hidden by the
 * template's `menuVisibility`, with their visible children. Pure and server-
 * safe so both the reference page and the role dialog can reuse it.
 */
export function getTemplateAccessiblePages(template: TenantRoleTemplate): TemplateAccessiblePage[] {
  const pages: TemplateAccessiblePage[] = [];
  for (const item of tenantMenuItems) {
    if (template.menuVisibility[item.key] === false) continue;
    if (item.items?.length) {
      const children = item.items
        .filter((child) => template.menuVisibility[child.key] !== false)
        .map((child) => child.title);
      if (children.length) pages.push({ title: item.title, children });
    } else {
      pages.push({ title: item.title, children: [] });
    }
  }
  return pages;
}
