import { Home, Database, Calendar, ClipboardCheck, Library, Mail, Settings } from "lucide-react"
import { NavItem } from "@/types/components/NavItem"

export const menuItems: NavItem[] = [
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
    title: "Penjadwalan",
    icon: Calendar,
    roles: ["*"],
    items: [
      { title: "Jadwal Mengajar", url: "/jadwal/mengajar", roles: ["*"] },
      { title: "Events", url: "/jadwal/events", roles: ["*"] }
    ]
  },
  {
    title: "Master Data",
    icon: Database,
    roles: ["*"],
    group: "Administrasi",
    items: [
      { title: "Siswa", url: "/master/siswa", roles: ["*"] },
      { title: "Guru", url: "/master/guru", roles: ["*"] },
      { title: "Staf", url: "/master/staf", roles: ["*"] },
      { title: "Mata Pelajaran", url: "/master/mapel", roles: ["*"] },
      { title: "Organisasi", url: "/master/organisasi", roles: ["*"] }
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
