"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Download,
  Ellipsis,
  Filter,
  Import,
  LayoutList,
  LoaderCircle,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

const variants = [
  { key: "A", name: "Registry table" },
  { key: "B", name: "Split workspace" },
  { key: "C", name: "Task overview" },
] as const;
type Variant = (typeof variants)[number]["key"];
type DemoState = "default" | "empty" | "loading" | "error" | "archived";

const students = [
  { name: "Alya Putri Maharani", nis: "24031", nisn: "0123456781", class: "VII A", status: "Aktif", account: "Terhubung" },
  { name: "Bima Pratama", nis: "24032", nisn: "0123456782", class: "VII A", status: "Aktif", account: "Belum ada" },
  { name: "Citra Lestari", nis: "23018", nisn: "0123456783", class: "VIII B", status: "Aktif", account: "Terhubung" },
  { name: "Daffa Ramadhan", nis: "22009", nisn: "0123456784", class: "IX A", status: "Lulus", account: "Belum ada" },
  { name: "Eka Nuraini", nis: "24035", nisn: "—", class: "VII C", status: "Aktif", account: "Terhubung" },
];

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "green" | "blue" | "amber" }) {
  const tones = { neutral: "bg-muted text-muted-foreground", green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200", blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200", amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

function StatePicker({ state, setState }: { state: DemoState; setState: (state: DemoState) => void }) {
  return <label className="flex items-center gap-2 text-xs text-muted-foreground">Simulasi keadaan<select value={state} onChange={event => setState(event.target.value as DemoState)} className="rounded-md border bg-background px-2 py-1.5 text-foreground"><option value="default">Berisi data</option><option value="empty">Kosong</option><option value="loading">Memuat</option><option value="error">Gagal</option><option value="archived">Arsip</option></select></label>;
}

function PageTitle({ compact = false }: { compact?: boolean }) {
  return <div><p className="text-sm text-muted-foreground">Master Data / Siswa</p><h1 className={`${compact ? "text-2xl" : "text-3xl"} mt-1 font-bold tracking-tight`}>Data Siswa</h1><p className="mt-1 text-sm text-muted-foreground">Kelola identitas dan lifecycle 487 siswa sekolah.</p></div>;
}

function SearchBox({ placeholder = "Cari nama, NIS, atau NISN" }: { placeholder?: string }) {
  return <div className="flex h-10 min-w-0 items-center gap-2 rounded-lg border bg-background px-3"><Search className="size-4 shrink-0 text-muted-foreground" /><input className="w-full bg-transparent text-sm outline-none" placeholder={placeholder} /></div>;
}

function SharedState({ state }: { state: DemoState }) {
  if (state === "loading") return <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted-foreground"><LoaderCircle className="size-8 animate-spin" /><p className="text-sm">Memuat data siswa…</p><span className="sr-only" role="status">Data sedang dimuat</span></div>;
  if (state === "error") return <div className="flex min-h-72 flex-col items-center justify-center gap-3 p-6 text-center"><span className="rounded-full bg-red-100 p-3 text-red-700 dark:bg-red-950 dark:text-red-200"><CircleAlert className="size-6" /></span><div><h2 className="font-semibold">Data siswa tidak dapat dimuat</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Periksa koneksi lalu coba lagi. Filter Anda tetap disimpan.</p></div><button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"><RotateCcw className="size-4" /> Coba lagi</button></div>;
  if (state === "empty") return <div className="flex min-h-72 flex-col items-center justify-center gap-4 p-6 text-center"><span className="rounded-full bg-primary/10 p-4 text-primary"><UsersRound className="size-7" /></span><div><h2 className="font-semibold">Belum ada data siswa</h2><p className="mt-1 max-w-md text-sm text-muted-foreground">Tambahkan satu siswa atau gunakan template untuk mengimpor banyak data sekaligus.</p></div><div className="flex flex-wrap justify-center gap-2"><button className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> Tambah siswa</button><button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"><Import className="size-4" /> Impor template</button></div></div>;
  return null;
}

function VariantA({ state }: { state: DemoState }) {
  const hasSpecial = state === "empty" || state === "loading" || state === "error";
  return <main className="mx-auto w-full max-w-7xl space-y-5 pb-24">
    <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><PageTitle /><div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"><Import className="size-4" /> Impor</button><button className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> Tambah siswa</button></div></header>
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center"><div className="flex-1"><SearchBox /></div><div className="flex flex-wrap gap-2"><button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Filter className="size-4" /> Status: Semua <ChevronDown className="size-3" /></button><button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><LayoutList className="size-4" /> Kelas: Semua</button><button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><SlidersHorizontal className="size-4" /> Kolom</button></div></div>
      {hasSpecial ? <SharedState state={state} /> : <><div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2.5 text-xs"><span>{state === "archived" ? "Menampilkan 18 siswa diarsipkan" : "487 siswa · diurutkan berdasarkan nama"}</span>{state === "archived" && <Pill tone="amber">Mode arsip</Pill>}</div><div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="w-10 p-3"><input type="checkbox" aria-label="Pilih semua siswa" /></th><th className="p-3 font-medium">Nama siswa</th><th className="p-3 font-medium">NIS / NISN</th><th className="p-3 font-medium">Rombel aktif</th><th className="p-3 font-medium">Status</th><th className="p-3 font-medium">Akun</th><th className="w-12 p-3"><span className="sr-only">Tindakan</span></th></tr></thead><tbody>{students.map(student => <tr key={student.nis} className="border-t hover:bg-muted/30"><td className="p-3"><input type="checkbox" aria-label={`Pilih ${student.name}`} /></td><td className="p-3"><button className="font-medium hover:underline">{student.name}</button></td><td className="p-3"><p className="font-mono">{student.nis}</p><p className="text-xs text-muted-foreground">{student.nisn}</p></td><td className="p-3">{student.class}</td><td className="p-3"><Pill tone={student.status === "Aktif" ? "green" : "neutral"}>{student.status}</Pill></td><td className="p-3"><Pill tone={student.account === "Terhubung" ? "blue" : "neutral"}>{student.account}</Pill></td><td className="p-3"><button className="rounded-md p-2 hover:bg-muted" aria-label={`Tindakan untuk ${student.name}`}><MoreHorizontal className="size-4" /></button></td></tr>)}</tbody></table></div><footer className="flex flex-col justify-between gap-3 border-t p-4 text-sm sm:flex-row sm:items-center"><span className="text-muted-foreground">1–25 dari {state === "archived" ? 18 : 487}</span><div className="flex items-center gap-1"><button className="rounded-md border px-3 py-1.5">Sebelumnya</button><button className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground">1</button><button className="rounded-md px-3 py-1.5 hover:bg-muted">2</button><button className="rounded-md px-3 py-1.5 hover:bg-muted">3</button><button className="rounded-md border px-3 py-1.5">Berikutnya</button></div></footer></>}
    </section>
  </main>;
}

function DetailPanel({ archived = false }: { archived?: boolean }) {
  return <aside className="flex min-h-[620px] flex-col border-l bg-card"><div className="flex items-start justify-between border-b p-5"><div className="flex gap-3"><span className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="size-5" /></span><div><h2 className="font-semibold">Alya Putri Maharani</h2><p className="text-sm text-muted-foreground">NIS 24031 · VII A</p></div></div><button className="rounded-md p-2 hover:bg-muted"><X className="size-4" /></button></div>{archived && <div className="m-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><strong>Catatan diarsipkan.</strong> Data hanya dapat dibaca sampai diaktifkan kembali.</div>}<div className="flex gap-1 border-b px-5"><button className="border-b-2 border-primary px-3 py-3 text-sm font-medium">Ringkasan</button><button className="px-3 py-3 text-sm text-muted-foreground">Riwayat</button></div><div className="flex-1 space-y-6 overflow-auto p-5"><section><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Identitas siswa</p><dl className="mt-3 grid grid-cols-2 gap-4 text-sm"><div><dt className="text-muted-foreground">NIS</dt><dd className="mt-1 font-medium">24031</dd></div><div><dt className="text-muted-foreground">NISN</dt><dd className="mt-1 font-medium">0123456781</dd></div><div><dt className="text-muted-foreground">Status</dt><dd className="mt-1"><Pill tone="green">Aktif</Pill></dd></div><div><dt className="text-muted-foreground">Masuk sekolah</dt><dd className="mt-1 font-medium">15 Juli 2024</dd></div></dl></section><section className="border-t pt-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Data pribadi</p><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-muted-foreground">Tempat, tanggal lahir</dt><dd className="mt-1">Palu, 8 Januari 2012</dd></div><div><dt className="text-muted-foreground">Alamat</dt><dd className="mt-1">Jl. Merdeka No. 12, Batunapara</dd></div></dl></section><section className="border-t pt-5"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Relasi</p><button className="mt-3 flex w-full items-center justify-between rounded-lg border p-3 text-left text-sm"><span><strong>Rombel VII A</strong><br /><span className="text-muted-foreground">Tahun Ajaran 2026/2027</span></span><ChevronRight className="size-4" /></button></section></div><div className="flex gap-2 border-t p-4">{archived ? <button className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><RotateCcw className="size-4" /> Aktifkan kembali</button> : <><button className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Edit data</button><button className="rounded-lg border p-2.5" aria-label="Tindakan lainnya"><Ellipsis className="size-4" /></button></>}</div></aside>;
}

function VariantB({ state }: { state: DemoState }) {
  const hasSpecial = state === "empty" || state === "loading" || state === "error";
  return <main className="w-full pb-24"><header className="mb-4 flex flex-col justify-between gap-4 md:flex-row md:items-center"><PageTitle compact /><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> Tambah siswa</button></header><section className="grid min-h-[620px] overflow-hidden rounded-xl border bg-card shadow-sm xl:grid-cols-[minmax(520px,1fr)_420px]"><div className="min-w-0"><div className="flex gap-2 border-b p-3"><div className="flex-1"><SearchBox placeholder="Cari siswa" /></div><button className="rounded-lg border p-2.5" aria-label="Filter"><Filter className="size-4" /></button><button className="rounded-lg border p-2.5" aria-label="Impor"><Import className="size-4" /></button></div>{hasSpecial ? <SharedState state={state} /> : <div className="divide-y">{students.map((student, index) => <button key={student.nis} className={`grid w-full grid-cols-[minmax(0,1fr)_100px_80px_24px] items-center gap-3 p-4 text-left text-sm hover:bg-muted/40 ${index === 0 ? "bg-primary/5 ring-1 ring-inset ring-primary/20" : ""}`}><span className="min-w-0"><strong className="block truncate">{student.name}</strong><span className="text-xs text-muted-foreground">NIS {student.nis} · NISN {student.nisn}</span></span><span>{student.class}</span><Pill tone={student.status === "Aktif" ? "green" : "neutral"}>{student.status}</Pill><ChevronRight className="size-4 text-muted-foreground" /></button>)}</div>}<div className="border-t p-3 text-center text-xs text-muted-foreground">Memuat 25 per halaman · 487 total</div></div><DetailPanel archived={state === "archived"} /></section></main>;
}

function Metric({ label, value, note, tone = "normal" }: { label: string; value: string; note: string; tone?: "normal" | "amber" }) {
  return <div className={`rounded-xl border p-5 ${tone === "amber" ? "border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20" : "bg-card"}`}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></div>;
}

function VariantC({ state }: { state: DemoState }) {
  const hasSpecial = state === "empty" || state === "loading" || state === "error";
  return <main className="mx-auto w-full max-w-6xl space-y-6 pb-24"><header className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><PageTitle /><div className="flex gap-2"><button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><Download className="size-4" /> Ekspor</button><button className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"><Plus className="size-4" /> Tambah siswa</button></div></header>{hasSpecial ? <section className="rounded-xl border bg-card"><SharedState state={state} /></section> : <><section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Metric label="Siswa aktif" value="462" note="95% dari seluruh data" /><Metric label="Tanpa rombel" value="11" note="Perlu ditindaklanjuti" tone="amber" /><Metric label="Akun terhubung" value="318" note="69% siswa aktif" /><Metric label={state === "archived" ? "Diarsipkan" : "Lulus tahun ini"} value={state === "archived" ? "18" : "36"} note="Riwayat tetap tersedia" /></section><section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"><div className="rounded-xl border bg-card"><div className="flex items-center justify-between border-b p-5"><div><h2 className="font-semibold">Siswa terbaru</h2><p className="text-sm text-muted-foreground">Terakhir diperbarui di Master Data</p></div><button className="text-sm font-medium text-primary">Lihat semua</button></div><div className="divide-y">{students.slice(0, 4).map(student => <div className="flex items-center gap-3 p-4" key={student.nis}><span className="flex size-9 items-center justify-center rounded-full bg-muted"><UserRound className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{student.name}</strong><span className="text-xs text-muted-foreground">{student.nis} · {student.class}</span></span><Pill tone={student.status === "Aktif" ? "green" : "neutral"}>{student.status}</Pill><button className="rounded-md p-2" aria-label={`Buka ${student.name}`}><ChevronRight className="size-4" /></button></div>)}</div></div><aside className="space-y-4"><div className="rounded-xl border bg-card p-5"><h2 className="font-semibold">Tindakan cepat</h2><div className="mt-4 grid gap-2"><button className="flex items-center gap-3 rounded-lg border p-3 text-left text-sm"><Plus className="size-4 text-primary" /><span><strong>Tambah satu siswa</strong><br /><span className="text-xs text-muted-foreground">Gunakan formulir bertahap</span></span></button><button className="flex items-center gap-3 rounded-lg border p-3 text-left text-sm"><Import className="size-4 text-primary" /><span><strong>Impor dari template</strong><br /><span className="text-xs text-muted-foreground">Validasi sebelum disimpan</span></span></button><button className="flex items-center gap-3 rounded-lg border p-3 text-left text-sm"><Archive className="size-4 text-primary" /><span><strong>Lihat arsip</strong><br /><span className="text-xs text-muted-foreground">18 catatan</span></span></button></div></div><div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/20"><h2 className="font-semibold">11 siswa tanpa rombel</h2><p className="mt-1 text-sm text-muted-foreground">Siswa aktif ini belum memiliki keanggotaan rombel pada Tahun Ajaran berjalan.</p><button className="mt-4 text-sm font-medium text-primary">Tinjau siswa <ArrowRight className="ml-1 inline size-4" /></button></div></aside></section></>}</main>;
}

function PrototypeSwitcher({ current, state, setState }: { current: Variant; state: DemoState; setState: (state: DemoState) => void }) {
  const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams(); const index = variants.findIndex(item => item.key === current);
  const go = (offset: number) => { const next = variants[(index + offset + variants.length) % variants.length]; const params = new URLSearchParams(searchParams.toString()); params.set("variant", next.key); router.replace(`${pathname}?${params.toString()}`); };
  useEffect(() => { const listener = (event: KeyboardEvent) => { const target = event.target as HTMLElement | null; if (target?.matches("input, textarea, select, [contenteditable='true']")) return; if (event.key === "ArrowLeft") go(-1); if (event.key === "ArrowRight") go(1); }; window.addEventListener("keydown", listener); return () => window.removeEventListener("keydown", listener); });
  if (process.env.NODE_ENV === "production") return null;
  return <div className="fixed bottom-4 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-2xl border bg-foreground p-2 text-background shadow-2xl"><button onClick={() => go(-1)} className="rounded-full p-2 hover:bg-background/15" aria-label="Varian sebelumnya"><ArrowLeft className="size-4" /></button><span className="min-w-40 text-center text-sm font-medium">{current} — {variants[index].name}</span><button onClick={() => go(1)} className="rounded-full p-2 hover:bg-background/15" aria-label="Varian berikutnya"><ArrowRight className="size-4" /></button><span className="hidden h-6 w-px bg-background/25 sm:block" /><StatePicker state={state} setState={setState} /></div>;
}

export function MasterDataUxPrototype() {
  const searchParams = useSearchParams(); const requested = searchParams.get("variant")?.toUpperCase(); const current: Variant = requested === "B" || requested === "C" ? requested : "A"; const [state, setState] = useState<DemoState>("default");
  return <><div className="mb-4 flex items-center gap-2 rounded-lg border border-dashed border-fuchsia-400 bg-fuchsia-50 px-4 py-2 text-sm text-fuchsia-950 dark:bg-fuchsia-950/30 dark:text-fuchsia-100"><CircleAlert className="size-4" /><strong>PROTOTYPE — tiga sistem UX Master Data, bukan implementasi produksi.</strong></div>{current === "A" ? <VariantA state={state} /> : current === "B" ? <VariantB state={state} /> : <VariantC state={state} />}<PrototypeSwitcher current={current} state={state} setState={setState} /></>;
}
