import { Home, Users, Settings, BookOpen } from "lucide-react"
import { NavItem } from "@/types/components/NavItem"

export const menuItems: NavItem[] = [
  {
    title: "Dasbor",
    icon: Home,
    url: "/",
    roles: ["superadmin", "pimpinan", "staff", "guru", "siswa"]
  },
  {
    title: "Data Siswa",
    icon: Users,
    url: "/siswa",
    roles: ["staff", "guru", "pimpinan"]
  },
  {
    title: "Akademik",
    icon: BookOpen,
    roles: ["staff", "guru", "siswa", "pimpinan"],
    items: [
      { title: "Jadwal Pelajaran", url: "/akademik/jadwal", roles: ["staff", "guru", "siswa", "pimpinan"] },
      { title: "Penilaian & Rapor", url: "/akademik/nilai", roles: ["guru", "siswa", "pimpinan"] }
    ]
  },
  {
    title: "Pengaturan",
    icon: Settings,
    roles: ["superadmin"],
    group: "Sistem & Keamanan",
    items: [
      { title: "Manajemen Pengguna", url: "/users", roles: ["superadmin"] },
      { title: "Pengaturan Sistem", url: "/settings", roles: ["superadmin"] }
    ]
  },
]
