"use client"

import { useState } from "react"
import {
  AlertTriangle,
  Archive,
  Building2,
  CalendarClock,
  Check,
  ChevronRight,
  Clock3,
  Download,
  FileCheck2,
  History,
  LockKeyhole,
  School,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
} from "lucide-react"
import { useSearchParams } from "next/navigation"

import { PrototypeSwitcher } from "@/components/prototype-switcher"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Role = "school" | "provider"
type Stage = "request" | "review" | "waiting" | "reopening" | "ready" | "deleted"

type StageData = {
  key: Stage
  short: string
  title: string
  status: string
  description: string
  schoolAction: string
  providerAction: string
}

const stages: StageData[] = [
  { key: "request", short: "Pengajuan", title: "Ajukan Penutupan Tenant", status: "Tenant aktif", description: "School Admin menjelaskan alasan, memahami dampaknya, lalu melakukan autentikasi ulang.", schoolAction: "Ajukan penutupan", providerAction: "Belum ada tindakan" },
  { key: "review", short: "Peninjauan", title: "Pengajuan menunggu keputusan Provider", status: "Ditinjau • 9 hari tersisa", description: "Tenant tetap aktif. Semua School Admin dapat melihat dan membatalkan pengajuan sebelum disetujui.", schoolAction: "Batalkan pengajuan", providerAction: "Tinjau pengajuan" },
  { key: "waiting", short: "Masa tunggu", title: "Tenant ditutup, penghapusan dijadwalkan", status: "21 hari menuju siap dihapus", description: "Data belum dihapus. School Admin dapat meminta ekspor atau Pembukaan Kembali.", schoolAction: "Minta pembukaan kembali", providerAction: "Kelola jadwal & ekspor" },
  { key: "reopening", short: "Pembukaan", title: "Permintaan Pembukaan Kembali ditinjau", status: "Penghapusan diblokir", description: "Tenggat tidak bergeser. Jika ditolak setelah tenggat, kasus menjadi siap dihapus.", schoolAction: "Lihat permintaan", providerAction: "Putuskan pembukaan kembali" },
  { key: "ready", short: "Siap dihapus", title: "Tenant siap dihapus permanen", status: "Menunggu konfirmasi akhir", description: "Tidak ada penghapusan otomatis. Provider harus memeriksa blocker lalu mengonfirmasi identitas Tenant.", schoolAction: "Unduh ekspor", providerAction: "Konfirmasi penghapusan" },
  { key: "deleted", short: "Selesai", title: "Penghapusan Tenant selesai", status: "Dihapus • final", description: "Ruang kerja dan data sekolah tidak tersedia lagi. Catatan Penghapusan Tenant tetap disimpan.", schoolAction: "Lihat pemberitahuan", providerAction: "Lihat catatan penghapusan" },
]

const variants = [
  { key: "A", name: "Pusat status" },
  { key: "B", name: "Perjalanan terpandu" },
  { key: "C", name: "Inbox kasus" },
]

export function TenantClosurePrototype() {
  const searchParams = useSearchParams()
  const requestedVariant = searchParams.get("variant")?.toUpperCase() ?? "A"
  const variant = variants.some((item) => item.key === requestedVariant) ? requestedVariant : "A"
  const [role, setRole] = useState<Role>("school")
  const [stageKey, setStageKey] = useState<Stage>("waiting")
  const stage = stages.find((item) => item.key === stageKey) ?? stages[2]

  return (
    <main className="min-h-screen bg-muted/30 pb-28">
      <PrototypeHeader role={role} setRole={setRole} stage={stageKey} setStage={setStageKey} />
      {variant === "A" && <VariantA role={role} stage={stage} />}
      {variant === "B" && <VariantB role={role} stage={stage} setStage={setStageKey} />}
      {variant === "C" && <VariantC role={role} stage={stage} />}
      <PrototypeSwitcher variants={variants} current={variant} />
    </main>
  )
}

function PrototypeHeader({ role, setRole, stage, setStage }: { role: Role; setRole: (role: Role) => void; stage: Stage; setStage: (stage: Stage) => void }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto max-w-7xl px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="bg-primary p-2 text-primary-foreground"><Building2 className="size-5" /></div><div><p className="font-semibold">SIMAS • Prototype lifecycle</p><p className="text-xs text-muted-foreground">SDN 191 Inpres Batunapara • batunapara.simas.id</p></div></div>
          <div className="flex border bg-muted/40 p-1">
            <Button onClick={() => setRole("school")} size="sm" variant={role === "school" ? "default" : "ghost"}><School /> School Admin</Button>
            <Button onClick={() => setRole("provider")} size="sm" variant={role === "provider" ? "default" : "ghost"}><ShieldCheck /> Provider Admin</Button>
          </div>
        </div>
        <div className="mt-4 flex gap-1 overflow-x-auto pb-1">
          {stages.map((item) => <Button className="shrink-0" key={item.key} onClick={() => setStage(item.key)} size="xs" variant={stage === item.key ? "secondary" : "ghost"}>{item.short}</Button>)}
        </div>
      </div>
    </header>
  )
}

function VariantA({ role, stage }: { role: Role; stage: StageData }) {
  return (
    <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[1fr_340px]">
      <section className="space-y-6">
        <div className="border-l-4 border-primary bg-background p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><Badge variant={stage.key === "deleted" ? "destructive" : "outline"}>{stage.status}</Badge><h1 className="mt-3 text-3xl font-semibold tracking-tight">{stage.title}</h1><p className="mt-2 max-w-2xl text-muted-foreground">{stage.description}</p></div><CalendarClock className="size-10 text-primary" /></div>
          <div className="mt-6 flex flex-wrap gap-3"><Button disabled={role === "school" && stage.key === "deleted"}>{role === "school" ? stage.schoolAction : stage.providerAction}</Button><Button variant="outline"><History /> Lihat riwayat</Button></div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Metric icon={Clock3} label="Tenggat" value={stage.key === "waiting" ? "10 Agu 2026, 23.59 WITA" : "—"} />
          <Metric icon={Archive} label="Ekspor data" value={stage.key === "ready" ? "Siap diunduh" : "Belum diminta"} />
          <Metric icon={LockKeyhole} label="Blocker penghapusan" value={stage.key === "reopening" ? "Pembukaan kembali" : "Tidak ada"} />
        </div>
        <Card><CardHeader><CardTitle>Apa yang terjadi berikutnya?</CardTitle></CardHeader><CardContent><JourneyStrip current={stage.key} /></CardContent></Card>
      </section>
      <aside className="space-y-4">
        <Card><CardHeader><CardTitle>Tindakan yang tersedia</CardTitle></CardHeader><CardContent className="space-y-3"><ActionList role={role} stage={stage.key} /></CardContent></Card>
        <Assumptions />
      </aside>
    </div>
  )
}

function VariantB({ role, stage, setStage }: { role: Role; stage: StageData; setStage: (stage: Stage) => void }) {
  const currentIndex = stages.findIndex((item) => item.key === stage.key)
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-8 max-w-2xl"><p className="text-sm font-semibold text-primary">PANDUAN LANGKAH DEMI LANGKAH</p><h1 className="mt-2 text-4xl font-semibold">{stage.title}</h1><p className="mt-3 text-lg text-muted-foreground">Hanya keputusan yang relevan saat ini ditampilkan. Dampak permanen selalu dikonfirmasi ulang.</p></div>
      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <nav className="space-y-1">{stages.map((item, index) => <button className={cn("flex w-full items-center gap-3 border-l-2 px-3 py-3 text-left text-sm", item.key === stage.key ? "border-primary bg-primary/5 font-semibold" : index < currentIndex ? "border-green-600 text-muted-foreground" : "border-border text-muted-foreground")} key={item.key} onClick={() => setStage(item.key)}><span className={cn("grid size-6 place-items-center rounded-full border text-xs", index < currentIndex && "border-green-600 bg-green-600 text-white")}>{index < currentIndex ? <Check className="size-3" /> : index + 1}</span>{item.short}</button>)}</nav>
        <section className="space-y-5">
          <div className="bg-foreground p-7 text-background"><p className="text-sm opacity-70">Status saat ini</p><p className="mt-1 text-xl font-semibold">{stage.status}</p><p className="mt-4 max-w-xl opacity-80">{stage.description}</p></div>
          <Card><CardHeader><CardTitle>{role === "school" ? "Yang dapat Anda lakukan" : "Keputusan Provider"}</CardTitle></CardHeader><CardContent className="space-y-5"><ImpactSummary stage={stage.key} /><div className="border-t pt-5"><Button size="lg">{role === "school" ? stage.schoolAction : stage.providerAction}<ChevronRight /></Button><p className="mt-3 text-xs text-muted-foreground">Tindakan sensitif akan meminta autentikasi ulang sebelum diproses.</p></div></CardContent></Card>
          <Assumptions />
        </section>
      </div>
    </div>
  )
}

function VariantC({ role, stage }: { role: Role; stage: StageData }) {
  return (
    <div className="mx-auto max-w-7xl px-5 py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Kasus Penutupan Tenant / KPT-2026-0041</p><h1 className="text-3xl font-semibold">SDN 191 Inpres Batunapara</h1></div><Badge variant="outline">{stage.status}</Badge></div>
      <div className="grid min-h-[620px] border bg-background lg:grid-cols-[300px_1fr_300px]">
        <aside className="border-r p-4"><p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Peristiwa kasus</p>{stages.map((item) => <div className={cn("mb-1 border p-3", item.key === stage.key && "border-primary bg-primary/5")} key={item.key}><p className="text-sm font-medium">{item.short}</p><p className="mt-1 text-xs text-muted-foreground">{item.key === stage.key ? "Sedang ditampilkan" : "Riwayat / kemungkinan"}</p></div>)}</aside>
        <section className="p-6 lg:p-8"><div className="flex items-center gap-2 text-sm text-muted-foreground"><UserRoundCheck className="size-4" /> Tampilan {role === "school" ? "School Admin" : "Provider Admin"}</div><h2 className="mt-4 text-2xl font-semibold">{stage.title}</h2><p className="mt-2 max-w-2xl text-muted-foreground">{stage.description}</p><div className="my-7 border-y py-5"><ImpactSummary stage={stage.key} /></div><h3 className="font-semibold">Aktivitas terbaru</h3><div className="mt-3 space-y-4"><Activity icon={FileCheck2} title="Status kasus diperbarui" detail={stage.status} /><Activity icon={Download} title="Ekspor data" detail={stage.key === "ready" ? "Selesai dan siap diunduh" : "Belum ada ekspor aktif"} /><Activity icon={History} title="Audit" detail="Setiap tindakan menyimpan aktor, role, waktu, dan alasan." /></div></section>
        <aside className="border-l bg-muted/20 p-5"><p className="text-xs font-semibold uppercase text-muted-foreground">Panel tindakan</p><div className="mt-4 space-y-3"><Button className="w-full">{role === "school" ? stage.schoolAction : stage.providerAction}</Button><Button className="w-full" variant="outline">Lihat semua audit</Button>{stage.key === "ready" && role === "provider" ? <Button className="w-full" variant="destructive"><Trash2 /> Hapus Tenant</Button> : null}</div><div className="mt-6"><Assumptions /></div></aside>
      </div>
    </div>
  )
}

function JourneyStrip({ current }: { current: Stage }) {
  return <div className="flex overflow-x-auto">{stages.map((item, index) => <div className="flex min-w-32 flex-1 items-center" key={item.key}><div className={cn("grid size-8 shrink-0 place-items-center rounded-full border text-xs", item.key === current ? "border-primary bg-primary text-primary-foreground" : "bg-background")}>{index + 1}</div><span className="ml-2 text-xs">{item.short}</span>{index < stages.length - 1 && <div className="mx-2 h-px min-w-4 flex-1 bg-border" />}</div>)}</div>
}

function Metric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return <Card><CardContent className="flex gap-3 pt-6"><Icon className="size-5 text-primary" /><div><p className="text-xs uppercase text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div></CardContent></Card>
}

function ActionList({ role, stage }: { role: Role; stage: Stage }) {
  const actions = role === "school"
    ? stage === "review" ? ["Batalkan pengajuan", "Lihat alasan pengajuan", "Lihat riwayat"] : ["Minta ekspor data", "Minta Pembukaan Kembali", "Lihat tenggat"]
    : stage === "ready" ? ["Periksa blocker", "Konfirmasi identitas Tenant", "Mulai Penghapusan Tenant"] : ["Tinjau alasan", "Kelola tenggat", "Proses ekspor"]
  return actions.map((action) => <div className="flex items-center justify-between border-b pb-3 text-sm last:border-0" key={action}><span>{action}</span><ChevronRight className="size-4 text-muted-foreground" /></div>)
}

function ImpactSummary({ stage }: { stage: Stage }) {
  const permanent = stage === "ready" || stage === "deleted"
  return <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-xs uppercase text-muted-foreground">Data sekolah</p><p className="mt-1 font-medium">{permanent ? "Akan / telah dihapus permanen" : "Tetap disimpan"}</p></div><div><p className="text-xs uppercase text-muted-foreground">Identitas pengguna</p><p className="mt-1 font-medium">Tetap ada bila memiliki hubungan SIMAS lain</p></div><div><p className="text-xs uppercase text-muted-foreground">Operasional Tenant</p><p className="mt-1 font-medium">{stage === "request" || stage === "review" ? "Tetap aktif" : stage === "deleted" ? "Tidak tersedia" : "Ditutup"}</p></div><div><p className="text-xs uppercase text-muted-foreground">Dapat dipulihkan</p><p className="mt-1 font-medium">{permanent ? "Tidak setelah penghapusan" : "Ya, melalui Pembukaan Kembali"}</p></div></div>
}

function Activity({ icon: Icon, title, detail }: { icon: typeof History; title: string; detail: string }) {
  return <div className="flex gap-3"><div className="grid size-9 shrink-0 place-items-center bg-muted"><Icon className="size-4" /></div><div><p className="text-sm font-medium">{title}</p><p className="text-xs text-muted-foreground">{detail}</p></div></div>
}

function Assumptions() {
  return <div className="border border-amber-300 bg-amber-50 p-4 text-amber-950"><div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><div><p className="text-sm font-semibold">Asumsi prototype</p><p className="mt-1 text-xs leading-5">Menu yang tetap dapat diakses saat Tenant ditutup dan aturan perubahan tenggat masih diputuskan di ticket paralel. Prototype hanya menguji hierarki informasi, kejelasan konsekuensi, dan letak tindakan.</p></div></div></div>
}
