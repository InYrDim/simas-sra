import { Home, Database, Calendar, ClipboardCheck, FileCheck, LayoutDashboard, Library, Mail, Settings, Upload, UserPlus } from "lucide-react"
import { type TenantNavItem } from "@/types/components/TenantNavItem"

export const tenantMenuItems: TenantNavItem[] = [
  {
    title: "Dasbor",
    icon: Home,
    url: "/dashboard",
    requiredPermissions: ["tenant.dashboard.view"]
  },
  {
    title: "Absensi",
    icon: ClipboardCheck,
    url: "/absensi",
    requiredPermissions: ["absensi.attendance.view"]
  },
  {
    title: "E-Library",
    icon: Library,
    url: "/e-library",
    requiredPermissions: ["tenant.authorization-audit.view"]
  },
  {
    title: "Persuratan",
    icon: Mail,
    url: "/persuratan",
    requiredPermissions: ["tenant.authorization-audit.view"]
  },
  {
    title: "PPDB",
    icon: UserPlus,
    group: "Pendaftaran",
    feature: "ppdbRead",
    items: [
      { title: "Review Pendaftar", url: "/ppdb", requiredPermissions: ["ppdb.submissions.view"] },
      { title: "Sesi & Form", url: "/ppdb/settings", requiredPermissions: ["ppdb.sessions.view"] },
      { title: "Riwayat PPDB", url: "/ppdb/riwayat", requiredPermissions: ["ppdb.sessions.view"] }
    ]
  },
  {
    title: "Ulangan",
    icon: FileCheck,
    group: "Akademik",
    feature: "ulanganRead",
    items: [
      { title: "Sesi Ulangan", url: "/ulangan", requiredPermissions: ["quizzes.sessions.view"] },
      { title: "Riwayat", url: "/ulangan/riwayat", requiredPermissions: ["quizzes.sessions.view"] }
    ]
  },
  {
    title: "Penjadwalan",
    icon: Calendar,
    items: [
      { title: "Jadwal Mengajar", url: "/jadwal/mengajar", requiredPermissions: ["tenant.authorization-audit.view"] },
      { title: "Events", url: "/jadwal/events", requiredPermissions: ["tenant.authorization-audit.view"] }
    ]
  },
  {
    title: "Overview",
    icon: LayoutDashboard,
    url: "/master",
    requiredPermissions: ["school-profile.profile.view", "academic-years.years.view", "subjects.subjects.view", "class-groups.groups.view", "people.people.view", "students.students.view", "teachers.teachers.view", "staff.staff.view", "facilities.locations.view", "assets.assets.view", "student-organizations.organizations.view", "extracurriculars.extracurriculars.view"],
    permissionMode: "any",
    group: "Administrasi",
    feature: "masterDataRead"
  },
  {
    title: "Import",
    icon: Upload,
    url: "/master/import",
    requiredPermissions: ["people-imports.revisions.view"],
    group: "Administrasi",
    feature: "masterDataRead"
  },
  {
    title: "Master Data",
    icon: Database,
    group: "Administrasi",
    feature: "masterDataRead",
    items: [
      { title: "Profil Sekolah", url: "/master/profil", requiredPermissions: ["school-profile.profile.view"] },
      { title: "Tahun Ajaran", url: "/master/tahun-ajaran", requiredPermissions: ["academic-years.years.view"] },
      { title: "Siswa", url: "/master/siswa", requiredPermissions: ["students.students.view"] },
      { title: "Guru", url: "/master/guru", requiredPermissions: ["teachers.teachers.view"] },
      { title: "Staf", url: "/master/staf", requiredPermissions: ["staff.staff.view"] },
      { title: "Mata Pelajaran", url: "/master/mapel", requiredPermissions: ["subjects.subjects.view"] },
      { title: "Rombongan Belajar", url: "/master/rombel", requiredPermissions: ["class-groups.groups.view"] },
      { title: "Sarana & Prasarana", url: "/master/sarpras", requiredPermissions: ["facilities.locations.view"] },
      { title: "Aset/Barang", url: "/master/sarpras/aset", requiredPermissions: ["assets.assets.view"] },
      { title: "Organisasi", url: "/master/organisasi", requiredPermissions: ["student-organizations.organizations.view"] },
      { title: "Ekstrakurikuler", url: "/master/organisasi/ekstrakurikuler", requiredPermissions: ["extracurriculars.extracurriculars.view"] }
    ]
  },
  {
    title: "Pengguna",
    icon: Settings,
    group: "Manajemen",
    items: [
      { title: "Manajemen Pengguna", url: "/users", requiredPermissions: ["tenant.users.view"] },
      { title: "Pemberian Role", url: "/settings/assignments", requiredPermissions: ["tenant.assignments.view"] },
      { title: "Roles", url: "/settings/roles", requiredPermissions: ["tenant.roles.list"] },
      { title: "Permission", url: "/settings/permissions", requiredPermissions: ["tenant.permissions.view"] },
    ],
  },
  {
    title: "Riwayat Keamanan",
    icon: Settings,
    url: "/security-history",
    group: "Sistem & Keamanan",
    requiredPermissions: ["tenant.users.view"],
  },
  {
    title: "Pengaturan Sistem",
    icon: Settings,
    url: "/settings",
    group: "Sistem & Keamanan",
    requiredPermissions: ["tenant-settings.landing-page.view"],
  },
  {
    title: "Backup & Restore",
    icon: Settings,
    url: "/settings/backup-restore",
    group: "Sistem & Keamanan",
    requiredPermissions: ["tenant.authorization-audit.view"],
  },
]
