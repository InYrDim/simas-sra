import { Home, Database, Calendar, ClipboardCheck, FileCheck, LayoutDashboard, Library, Mail, Settings, Upload, UserPlus, QrCode, Users } from "lucide-react"
import { type TenantNavItem } from "@/types/components/TenantNavItem"

export const tenantMenuItems: TenantNavItem[] = [
  {
    key: "dashboard",
    title: "Dasbor",
    icon: Home,
    url: "/dashboard",
    requiredPermissions: ["tenant.dashboard.view"]
  },
  {
    key: "absensi",
    title: "Absensi",
    icon: ClipboardCheck,
    url: "/absensi",
    requiredPermissions: ["absensi.attendance.view"],
    feature: "absensi",
    items: [
      { key: "absensi-overview", title: "Ikhtisar", url: "/absensi", requiredPermissions: ["absensi.attendance.view"] },
      { key: "absensi-history", title: "Riwayat", url: "/absensi/history", requiredPermissions: ["absensi.attendance.view"] },
      { key: "absensi-settings", title: "Pengaturan", url: "/absensi/settings", requiredPermissions: ["absensi.settings.update"] },
      { key: "absensi-saya", title: "Absensi Saya", url: "/absensi/saya", requiredPermissions: ["absensi.self.view"] },
    ]
  },
  {
    key: "e-library",
    title: "E-Library",
    icon: Library,
    url: "/e-library",
    requiredPermissions: ["tenant.authorization-audit.view"]
  },
  {
    key: "persuratan",
    title: "Persuratan",
    icon: Mail,
    url: "/persuratan",
    requiredPermissions: ["tenant.authorization-audit.view"]
  },
  {
    key: "ppdb",
    title: "PPDB",
    icon: UserPlus,
    group: "Pendaftaran",
    feature: "ppdbRead",
    items: [
      { key: "ppdb-review", title: "Review Pendaftar", url: "/ppdb", requiredPermissions: ["ppdb.submissions.view"] },
      { key: "ppdb-settings", title: "Sesi & Form", url: "/ppdb/settings", requiredPermissions: ["ppdb.sessions.view"] },
      { key: "ppdb-riwayat", title: "Riwayat PPDB", url: "/ppdb/riwayat", requiredPermissions: ["ppdb.sessions.view"] }
    ]
  },
  {
    key: "ulangan",
    title: "Ulangan",
    icon: FileCheck,
    group: "Akademik",
    feature: "ulanganRead",
    items: [
      { key: "ulangan-sesi", title: "Sesi Ulangan", url: "/ulangan", requiredPermissions: ["quizzes.sessions.view"] },
      { key: "ulangan-riwayat", title: "Riwayat", url: "/ulangan/riwayat", requiredPermissions: ["quizzes.sessions.view"] }
    ]
  },
  {
    key: "kelas",
    title: "Kelas",
    icon: Users,
    url: "/kelas",
    group: "Akademik",
    requiredPermissions: ["class-groups.roster.view"]
  },
  {
    key: "penjadwalan",
    title: "Penjadwalan",
    icon: Calendar,
    items: [
      { key: "jadwal-mengajar", title: "Jadwal Mengajar", url: "/jadwal/mengajar", requiredPermissions: ["tenant.authorization-audit.view"] },
      { key: "jadwal-events", title: "Events", url: "/jadwal/events", requiredPermissions: ["tenant.authorization-audit.view"] }
    ]
  },
  {
    key: "master-overview",
    title: "Overview",
    icon: LayoutDashboard,
    url: "/master",
    requiredPermissions: ["school-profile.profile.view", "academic-years.years.view", "subjects.subjects.view", "class-groups.groups.view", "people.people.view", "students.students.view", "teachers.teachers.view", "staff.staff.view", "facilities.locations.view", "assets.assets.view", "student-organizations.organizations.view", "extracurriculars.extracurriculars.view"],
    permissionMode: "any",
    group: "Administrasi",
    feature: "masterDataRead"
  },
  {
    key: "master-import",
    title: "Import",
    icon: Upload,
    url: "/master/import",
    requiredPermissions: ["people-imports.revisions.view"],
    group: "Administrasi",
    feature: "masterDataRead"
  },
  {
    key: "master-data",
    title: "Master Data",
    icon: Database,
    group: "Administrasi",
    feature: "masterDataRead",
    items: [
      { key: "master-profil", title: "Profil Sekolah", url: "/master/profil", requiredPermissions: ["school-profile.profile.view"] },
      { key: "master-tahun-ajaran", title: "Tahun Ajaran", url: "/master/tahun-ajaran", requiredPermissions: ["academic-years.years.view"] },
      { key: "master-siswa", title: "Siswa", url: "/master/siswa", requiredPermissions: ["students.students.view"] },
      { key: "master-guru", title: "Guru", url: "/master/guru", requiredPermissions: ["teachers.teachers.view"] },
      { key: "master-staf", title: "Staf", url: "/master/staf", requiredPermissions: ["staff.staff.view"] },
      { key: "master-mapel", title: "Mata Pelajaran", url: "/master/mapel", requiredPermissions: ["subjects.subjects.view"] },
      { key: "master-rombel", title: "Rombongan Belajar", url: "/master/rombel", requiredPermissions: ["class-groups.groups.view"] },
      { key: "master-sarpras", title: "Sarana & Prasarana", url: "/master/sarpras", requiredPermissions: ["facilities.locations.view"] },
      { key: "master-aset", title: "Aset/Barang", url: "/master/sarpras/aset", requiredPermissions: ["assets.assets.view"] },
      { key: "master-organisasi", title: "Organisasi", url: "/master/organisasi", requiredPermissions: ["student-organizations.organizations.view"] },
      { key: "master-ekstrakurikuler", title: "Ekstrakurikuler", url: "/master/organisasi/ekstrakurikuler", requiredPermissions: ["extracurriculars.extracurriculars.view"] }
    ]
  },
  {
    key: "pengguna",
    title: "Pengguna",
    icon: Settings,
    group: "Manajemen",
    items: [
      { key: "users", title: "Manajemen Akun", url: "/users", requiredPermissions: ["tenant.users.view"] },
      { key: "settings-assignments", title: "Pemberian Role", url: "/settings/assignments", requiredPermissions: ["tenant.assignments.view"] },
      { key: "settings-roles", title: "Roles", url: "/settings/roles", requiredPermissions: ["tenant.roles.list"] },
      { key: "settings-permissions", title: "Permission", url: "/settings/permissions", requiredPermissions: ["tenant.permissions.view"] },
    ],
  },
  {
    key: "security-history",
    title: "Riwayat Keamanan",
    icon: Settings,
    url: "/security-history",
    group: "Sistem & Keamanan",
    requiredPermissions: ["tenant.users.view"],
  },
  {
    key: "settings-system",
    title: "Pengaturan Sistem",
    icon: Settings,
    url: "/settings",
    group: "Sistem & Keamanan",
    requiredPermissions: ["tenant-settings.landing-page.view"],
  },
  {
    key: "backup-restore",
    title: "Backup & Restore",
    icon: Settings,
    url: "/settings/backup-restore",
    group: "Sistem & Keamanan",
    requiredPermissions: ["tenant.authorization-audit.view"],
  },
]
