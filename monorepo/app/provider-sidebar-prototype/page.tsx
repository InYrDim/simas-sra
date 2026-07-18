"use client"

// PROTOTYPE — three sidebar directions, switchable via ?variant=, on /provider-sidebar-prototype.

import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Flag,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings,
  ShieldCheck,
  TicketCheck,
  Users,
  X,
} from "lucide-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Suspense, useEffect, useMemo, useState } from "react"

type VariantKey = "A" | "B" | "C"
type Surface = "provider" | "tenant"
type NavItem = { label: string; icon: typeof BarChart3; disabled?: boolean }

const variants: { key: VariantKey; name: string }[] = [
  { key: "A", name: "Grouped navigation" },
  { key: "B", name: "Operational rail" },
  { key: "C", name: "Context bands" },
]

const providerPrimary: NavItem[] = [
  { label: "Ringkasan", icon: BarChart3 },
  { label: "Tenant", icon: Building2 },
]

const providerUpcoming: NavItem[] = [
  { label: "Fitur", icon: Flag },
  { label: "Billing", icon: CreditCard },
  { label: "Impersonasi", icon: Users },
  { label: "Audit Log", icon: ClipboardList },
  { label: "Support Ticket", icon: TicketCheck },
  { label: "Pengaturan Provider", icon: Settings },
]

const tenantItems: NavItem[] = [
  { label: "Dasbor", icon: BarChart3 },
  { label: "Pengguna", icon: Users },
  { label: "Akademik", icon: BookOpen },
  { label: "Pengaturan", icon: Settings },
]

export default function ProviderSidebarPrototypePage() {
  return (
    <Suspense fallback={null}>
      <ProviderSidebarPrototype />
    </Suspense>
  )
}

function ProviderSidebarPrototype() {
  const searchParams = useSearchParams()
  const selected = searchParams.get("variant")
  const variant: VariantKey = selected === "B" || selected === "C" ? selected : "A"
  const [surface, setSurface] = useState<Surface>("provider")
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <main className="min-h-svh bg-slate-50 text-slate-950">
      <div className="fixed left-3 top-3 z-50 flex items-center gap-2 md:hidden">
        <button
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Tutup navigasi" : "Buka navigasi"}
          className="grid size-11 place-items-center rounded-lg border bg-white shadow-sm"
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>
      </div>

      <div className="fixed right-3 top-3 z-50 flex rounded-lg border bg-white p-1 shadow-sm">
        {(["provider", "tenant"] as const).map((item) => (
          <button
            key={item}
            aria-pressed={surface === item}
            className={`rounded-md px-3 py-2 text-xs font-semibold capitalize ${surface === item ? "bg-slate-950 text-white" : "text-slate-600"}`}
            onClick={() => setSurface(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {variant === "A" && <VariantA collapsed={collapsed} mobileOpen={mobileOpen} surface={surface} />}
      {variant === "B" && <VariantB collapsed={collapsed} mobileOpen={mobileOpen} surface={surface} />}
      {variant === "C" && <VariantC collapsed={collapsed} mobileOpen={mobileOpen} surface={surface} />}

      <button
        aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
        className="fixed bottom-5 left-5 z-40 hidden size-11 place-items-center rounded-full border bg-white shadow-lg md:grid"
        onClick={() => setCollapsed((value) => !value)}
      >
        {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
      </button>

      {process.env.NODE_ENV !== "production" && <PrototypeSwitcher current={variant} />}
    </main>
  )
}

function Shell({ children, collapsed, mobileOpen, sidebar }: { children: React.ReactNode; collapsed: boolean; mobileOpen: boolean; sidebar: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      {mobileOpen && <button aria-label="Tutup navigasi" className="fixed inset-0 z-20 bg-slate-950/40 md:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-30 transition-all duration-200 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "md:w-20" : "w-72 md:w-72"}`}>
        {sidebar}
      </aside>
      <section className={`min-w-0 flex-1 transition-[margin] ${collapsed ? "md:ml-20" : "md:ml-72"}`}>
        {children}
      </section>
    </div>
  )
}

function DemoContent({ surface, emptyStyle = "card" }: { surface: Surface; emptyStyle?: "card" | "inline" }) {
  return (
    <div className="mx-auto max-w-6xl p-5 pt-20 md:p-10 md:pt-24">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-700">{surface === "provider" ? "Area Provider" : "Tenant • SMA Nusantara"}</p>
      <h1 className="mt-2 text-3xl font-bold">{surface === "provider" ? "Ringkasan layanan" : "Dasbor sekolah"}</h1>
      <p className="mt-2 max-w-2xl text-slate-600">Prototype read-only untuk menilai hierarki, identitas konteks, active state, collapsed mode, dan perilaku mobile.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {["Tenant aktif", "Perlu perhatian", "Tiket terbuka"].map((label, index) => (
          <article key={label} className="rounded-xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold">{[24, 3, 7][index]}</p>
          </article>
        ))}
      </div>
      <div className={`mt-6 border border-dashed border-slate-300 bg-white ${emptyStyle === "card" ? "rounded-xl p-10 text-center" : "border-x-0 p-8"}`}>
        <CircleHelp className={`${emptyStyle === "card" ? "mx-auto" : ""} size-6 text-slate-400`} />
        <h2 className="mt-3 font-semibold">Belum ada aktivitas terbaru</h2>
        <p className="mt-1 text-sm text-slate-500">Empty state tetap menjelaskan apa yang akan muncul di sini.</p>
      </div>
    </div>
  )
}

function VariantA(props: VariantProps) {
  const { surface, collapsed } = props
  const isProvider = surface === "provider"
  const theme = isProvider ? "bg-white text-slate-800 border-r" : "bg-[#071a33] text-slate-100"
  return (
    <Shell {...props} sidebar={
      <div className={`flex h-full flex-col ${theme}`}>
        <Brand collapsed={collapsed} surface={surface} subtle={isProvider} />
        <nav aria-label={`Navigasi ${isProvider ? "Provider" : "Tenant"}`} className="flex-1 overflow-y-auto p-3">
          {!collapsed && <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-widest opacity-50">Utama</p>}
          <NavList items={isProvider ? providerPrimary : tenantItems} collapsed={collapsed} active={isProvider ? "Ringkasan" : "Dasbor"} dark={!isProvider} />
          {isProvider && <>
            {!collapsed && <p className="mt-7 px-3 pb-2 text-[11px] font-bold uppercase tracking-widest opacity-50">Operasional</p>}
            <NavList items={providerUpcoming} collapsed={collapsed} active="" dark={false} />
          </>}
        </nav>
        <Identity collapsed={collapsed} surface={surface} dark={!isProvider} />
      </div>
    }><DemoContent surface={surface} /></Shell>
  )
}

function VariantB(props: VariantProps) {
  const { surface, collapsed } = props
  const isProvider = surface === "provider"
  const items = isProvider ? [...providerPrimary, ...providerUpcoming] : tenantItems
  return (
    <Shell {...props} sidebar={
      <div className={`flex h-full ${isProvider ? "bg-slate-950 text-white" : "bg-[#06162d] text-white"}`}>
        <div className="flex w-16 shrink-0 flex-col items-center border-r border-white/10 py-4">
          <div className="grid size-9 place-items-center rounded-lg bg-sky-500 font-black">S</div>
          <div className="mt-7 flex flex-col gap-3">
            {items.slice(0, 6).map(({ label, icon: Icon }, index) => <button key={label} aria-label={label} aria-current={index === 0 ? "page" : undefined} title={label} className={`grid size-10 place-items-center rounded-lg ${index === 0 ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/10 hover:text-white"}`}><Icon className="size-5" /></button>)}
          </div>
          <ShieldCheck className="mt-auto size-5 text-emerald-400" aria-label="Sesi terverifikasi" />
        </div>
        {!collapsed && <div className="flex min-w-0 flex-1 flex-col p-4">
          <p className="text-xs font-semibold text-sky-400">{isProvider ? "Provider Console" : "SMA Nusantara"}</p>
          <h2 className="mt-1 truncate font-bold">{isProvider ? "Operasional SIMAS" : "Ruang kerja sekolah"}</h2>
          <div className="relative mt-5"><Search className="absolute left-3 top-2.5 size-4 text-slate-500" /><input aria-label="Cari menu" className="w-full rounded-lg border border-white/10 bg-white/5 py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-sky-400" placeholder="Cari menu…" /></div>
          <div className="mt-6 text-xs uppercase tracking-widest text-slate-500">Sedang dibuka</div>
          <div className="mt-2 rounded-lg bg-white/10 p-3"><p className="font-semibold">{isProvider ? "Ringkasan" : "Dasbor"}</p><p className="mt-1 text-xs text-slate-400">Ikhtisar dan tindakan penting</p></div>
          <div className="mt-auto border-t border-white/10 pt-4"><Identity collapsed={false} surface={surface} dark /></div>
        </div>}
      </div>
    }><DemoContent surface={surface} emptyStyle="inline" /></Shell>
  )
}

function VariantC(props: VariantProps) {
  const { surface, collapsed } = props
  const isProvider = surface === "provider"
  const items = isProvider ? [...providerPrimary, ...providerUpcoming] : tenantItems
  return (
    <Shell {...props} sidebar={
      <div className={`flex h-full flex-col border-r ${isProvider ? "bg-stone-50 text-slate-900" : "bg-[#081d38] text-white"}`}>
        <div className="border-b border-current/10 p-4"><Brand collapsed={collapsed} surface={surface} subtle={isProvider} /></div>
        {!collapsed && <div className={`m-3 rounded-xl p-3 ${isProvider ? "bg-sky-100 text-sky-950" : "bg-white/10"}`}><p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Konteks aktif</p><p className="mt-1 font-bold">{isProvider ? "Seluruh layanan" : "SMA Nusantara"}</p><p className="text-xs opacity-70">{isProvider ? "24 Tenant" : "nusa.simas.id"}</p></div>}
        <nav aria-label={`Navigasi ${isProvider ? "Provider" : "Tenant"}`} className="flex-1 overflow-y-auto px-3 py-2">
          {items.map(({ label, icon: Icon }, index) => <button key={label} aria-current={index === 0 ? "page" : undefined} title={collapsed ? label : undefined} className={`mb-1 flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm ${index === 0 ? isProvider ? "bg-slate-900 text-white" : "bg-sky-400 text-slate-950" : "opacity-70 hover:bg-current/10 hover:opacity-100"}`}><Icon className="size-5 shrink-0" />{!collapsed && <span>{label}</span>}{!collapsed && isProvider && index > 1 && <span className="ml-auto size-1.5 rounded-full bg-slate-300" aria-label="Belum tersedia" />}</button>)}
        </nav>
        {!collapsed && <div className="m-3 rounded-xl border border-current/10 p-3"><p className="text-xs opacity-60">Masuk sebagai</p><p className="mt-1 text-sm font-bold">{isProvider ? "Provider Admin" : "School Admin"}</p><p className="truncate text-xs opacity-60">admin@simas.id</p></div>}
      </div>
    }><DemoContent surface={surface} /></Shell>
  )
}

type VariantProps = { collapsed: boolean; mobileOpen: boolean; surface: Surface }

function Brand({ collapsed, surface, subtle }: { collapsed: boolean; surface: Surface; subtle: boolean }) {
  return <div className="flex min-h-16 items-center gap-3 px-4"><div className={`grid size-9 shrink-0 place-items-center rounded-lg font-black ${subtle ? "bg-slate-950 text-white" : "bg-sky-400 text-slate-950"}`}>S</div>{!collapsed && <div className="min-w-0"><p className="font-black tracking-tight">SIMAS</p><p className="truncate text-xs opacity-55">{surface === "provider" ? "Provider" : "SMA Nusantara"}</p></div>}</div>
}

function NavList({ items, collapsed, active, dark }: { items: NavItem[]; collapsed: boolean; active: string; dark: boolean }) {
  return <div className="space-y-1">{items.map(({ label, icon: Icon }) => { const current = label === active; return <button key={label} aria-current={current ? "page" : undefined} title={collapsed ? label : undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium ${current ? dark ? "bg-sky-400 text-slate-950" : "bg-slate-900 text-white" : "opacity-65 hover:bg-current/10 hover:opacity-100"}`}><Icon className="size-5 shrink-0" />{!collapsed && <span>{label}</span>}</button> })}</div>
}

function Identity({ collapsed, surface, dark }: { collapsed: boolean; surface: Surface; dark: boolean }) {
  return <div className={`flex items-center gap-3 p-4 ${dark ? "border-white/10" : "border-slate-200"}`}><div className="grid size-9 shrink-0 place-items-center rounded-full bg-sky-500 text-xs font-bold text-white">RA</div>{!collapsed && <div className="min-w-0"><p className="truncate text-sm font-semibold">Rani Aditya</p><p className="truncate text-xs opacity-55">{surface === "provider" ? "Provider Admin" : "School Admin"}</p></div>}</div>
}

function PrototypeSwitcher({ current }: { current: VariantKey }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentIndex = variants.findIndex(({ key }) => key === current)
  const go = useMemo(() => (direction: number) => {
    const next = variants[(currentIndex + direction + variants.length) % variants.length]
    const params = new URLSearchParams(searchParams.toString())
    params.set("variant", next.key)
    router.replace(`${pathname}?${params.toString()}`)
  }, [currentIndex, pathname, router, searchParams])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.matches("input, textarea, [contenteditable='true']")) return
      if (event.key === "ArrowLeft") go(-1)
      if (event.key === "ArrowRight") go(1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [go])

  return <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-950 p-1.5 text-white shadow-2xl ring-1 ring-white/20"><button aria-label="Variasi sebelumnya" className="grid size-9 place-items-center rounded-full hover:bg-white/15" onClick={() => go(-1)}><ArrowLeft className="size-4" /></button><div aria-live="polite" className="min-w-44 text-center text-xs font-semibold">{current} — {variants[currentIndex].name}</div><button aria-label="Variasi berikutnya" className="grid size-9 place-items-center rounded-full hover:bg-white/15" onClick={() => go(1)}><ArrowRight className="size-4" /></button></div>
}
