import { Home, Database, Calendar, ClipboardCheck, FileCheck, LayoutDashboard, Library, Mail, Settings, Upload, UserPlus } from "lucide-react"
import { type TenantNavItem } from "@/types/components/TenantNavItem"

export const tenantMenuItems: TenantNavItem[] = [
  {
    title: "Dasbor",
    icon: Home,
    url: "/dashboard",
    roles: ["*"]
  },
  {
    title: "Absensi",
    icon: ClipboardCheck,
    url: "/absensi",
    roles: ["*"]
  },
  {
    title: "E-Library",
    icon: Library,
    url: "/e-library",
    roles: ["*"]
  },
  {
    title: "Persuratan",
    icon: Mail,
    url: "/persuratan",
    roles: ["*"]
  },
  {
    title: "PPDB",
    icon: UserPlus,
    roles: ["*"],
    group: "Pendaftaran",
    items: [
      { title: "Review Pendaftar", url: "/ppdb", roles: ["school-admin"] },
      { title: "Sesi & Form", url: "/ppdb/settings", roles: ["school-admin"] },
      { title: "Riwayat PPDB", url: "/ppdb/riwayat", roles: ["school-admin"] }
    ]
  },
  {
    title: "Ulangan",
    icon: FileCheck,
    roles: ["*"],
    group: "Akademik",
    items: [
      { title: "Sesi Ulangan", url: "/ulangan", roles: ["*"] },
      { title: "Riwayat", url: "/ulangan/riwayat", roles: ["*"] }
    ]
  },
  {
    title: "Penjadwalan",
    icon: Calendar,
    roles: ["*"],
    items: [
      { title: "Jadwal Mengajar", url: "/jadwal/mengajar", roles: ["*"] },
      { title: "Events", url: "/jadwal/events", roles: ["*"] }
    ]
  },
  {
    title: "Overview",
    icon: LayoutDashboard,
    url: "/master",
    roles: ["school-admin"],
    group: "Administrasi"
  },
  {
    title: "Import",
    icon: Upload,
    url: "/master/import",
    roles: ["school-admin"],
    group: "Administrasi"
  },
  {
    title: "Master Data",
    icon: Database,
    roles: ["school-admin"],
    group: "Administrasi",
    items: [
      { title: "Profil Sekolah", url: "/master/profil", roles: ["school-admin"] },
      { title: "Tahun Ajaran", url: "/master/tahun-ajaran", roles: ["school-admin"] },
      { title: "Siswa", url: "/master/siswa", roles: ["school-admin"] },
      { title: "Guru", url: "/master/guru", roles: ["school-admin"] },
      { title: "Staf", url: "/master/staf", roles: ["school-admin"] },
      { title: "Mata Pelajaran", url: "/master/mapel", roles: ["school-admin"] },
      { title: "Rombongan Belajar", url: "/master/rombel", roles: ["school-admin"] },
      { title: "Sarana & Prasarana", url: "/master/sarpras", roles: ["school-admin"] },
      { title: "Aset/Barang", url: "/master/sarpras/aset", roles: ["school-admin"] },
      { title: "Organisasi", url: "/master/organisasi", roles: ["school-admin"] },
      { title: "Ekstrakurikuler", url: "/master/organisasi/ekstrakurikuler", roles: ["school-admin"] }
    ]
  },
  {
    title: "Manajemen",
    icon: Settings,
    roles: ["*"],
    group: "Sistem & Keamanan",
    items: [
      { title: "Manajemen Pengguna", url: "/users", roles: ["*"] },
      { title: "Pengaturan Sistem", url: "/settings", roles: ["*"] }
    ]
  },
]
