"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  Download,
  FileSpreadsheet,
  History,
  Info,
  RotateCcw,
  Search,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";

const variants = [
  { key: "A", name: "Wizard terpandu" },
  { key: "B", name: "Review spreadsheet" },
  { key: "C", name: "Pusat pekerjaan impor" },
] as const;

type VariantKey = (typeof variants)[number]["key"];

const rows = [
  { row: 2, name: "Alya Putri", id: "24031", result: "Siap", tone: "success", note: "Data baru" },
  { row: 3, name: "Bima Pratama", id: "24032", result: "Peringatan", tone: "warning", note: "Mirip Bima P., 12-05-2012" },
  { row: 4, name: "Citra Lestari", id: "22018", result: "Ditolak", tone: "danger", note: "NIS sudah digunakan" },
  { row: 5, name: "Daffa Ramadhan", id: "24034", result: "Siap", tone: "success", note: "Data baru" },
  { row: 6, name: "Eka Nuraini", id: "24035", result: "Ditolak", tone: "danger", note: "Tanggal lahir wajib diisi" },
];

const jobs = [
  { file: "siswa-baru-juli.xlsx", time: "Hari ini, 10.42", state: "Perlu ditinjau", detail: "42 siap · 3 peringatan · 2 ditolak", color: "amber" },
  { file: "siswa-pindahan.xlsx", time: "Kemarin, 14.10", state: "Selesai", detail: "8 dibuat · 1 ditautkan · 0 gagal", color: "green" },
  { file: "angkatan-2023.xlsx", time: "18 Jul, 09.05", state: "Selesai", detail: "116 dibuat · 4 dilewati", color: "green" },
];

function Stat({ value, label, tone = "neutral" }: { value: string; label: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const colors = {
    neutral: "border-border bg-card",
    success: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100",
    warning: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100",
    danger: "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100",
  };
  return <div className={`rounded-xl border p-4 ${colors[tone]}`}><p className="text-2xl font-semibold">{value}</p><p className="mt-1 text-sm opacity-70">{label}</p></div>;
}

function StatusBadge({ tone, children }: { tone: string; children: React.ReactNode }) {
  const classes = tone === "success" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : tone === "warning" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}>{children}</span>;
}

function VariantA() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 pb-24">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm text-muted-foreground">Master Data / Siswa / Impor</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Impor data siswa</h1><p className="mt-2 text-muted-foreground">Selesaikan satu tahap sebelum melanjutkan. Belum ada data yang disimpan.</p></div>
        <button className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium"><History className="size-4" /> Riwayat impor</button>
      </header>

      <ol className="grid grid-cols-2 gap-2 rounded-xl border bg-card p-3 md:grid-cols-5">
        {["Unduh template", "Unggah", "Validasi", "Cocokkan", "Konfirmasi"].map((label, index) => <li key={label} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${index === 2 ? "bg-primary text-primary-foreground" : index < 2 ? "text-foreground" : "text-muted-foreground"}`}>{index < 2 ? <CheckCircle2 className="size-4" /> : index === 2 ? <Circle className="size-4 fill-current" /> : <Circle className="size-4" />}<span>{label}</span></li>)}
      </ol>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-semibold">3. Periksa hasil validasi</h2><p className="mt-1 text-sm text-muted-foreground">Perbaiki baris yang ditolak. Peringatan harus diputuskan sebelum impor.</p></div><span className="rounded-md bg-muted px-3 py-1.5 text-xs font-mono">Template Siswa v1.0</span></div></div>
        <div className="grid gap-3 p-6 sm:grid-cols-3"><Stat value="42" label="Siap dibuat" tone="success" /><Stat value="3" label="Perlu keputusan" tone="warning" /><Stat value="2" label="Harus diperbaiki" tone="danger" /></div>
        <div className="border-t px-6 py-4"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="text-muted-foreground"><tr className="border-b"><th className="pb-3 font-medium">Baris</th><th className="pb-3 font-medium">Nama</th><th className="pb-3 font-medium">NIS</th><th className="pb-3 font-medium">Hasil</th><th className="pb-3 font-medium">Keterangan</th></tr></thead><tbody>{rows.map(row => <tr className="border-b last:border-0" key={row.row}><td className="py-4">{row.row}</td><td className="py-4 font-medium">{row.name}</td><td className="py-4 font-mono">{row.id}</td><td className="py-4"><StatusBadge tone={row.tone}>{row.result}</StatusBadge></td><td className="py-4 text-muted-foreground">{row.note}</td></tr>)}</tbody></table></div></div>
        <div className="flex flex-col gap-3 border-t bg-muted/30 p-6 sm:flex-row sm:items-center sm:justify-between"><button className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium"><Download className="size-4" /> Unduh baris bermasalah</button><div className="flex gap-2"><button className="rounded-lg border bg-background px-4 py-2 text-sm font-medium">Ganti berkas</button><button className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Tinjau 3 kemiripan <ChevronRight className="size-4" /></button></div></div>
      </section>
      <aside className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100"><ShieldCheck className="mt-0.5 size-5 shrink-0" /><p><strong>Impor atomik.</strong> Seluruh berkas disimpan bersama setelah semua baris valid dan keputusan duplikat selesai. Mengunggah ulang berkas yang sama tidak membuat data ganda.</p></aside>
    </main>
  );
}

function VariantB() {
  return (
    <main className="flex w-full flex-col gap-4 pb-24">
      <header className="flex flex-col justify-between gap-4 border-b pb-5 xl:flex-row xl:items-center"><div><p className="text-sm text-muted-foreground">siswa-baru-juli.xlsx · Template v1.0</p><h1 className="text-2xl font-bold">Review sebelum impor</h1></div><div className="flex flex-wrap gap-2"><button className="rounded-lg border px-3 py-2 text-sm font-medium">Batalkan</button><button className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"><Download className="size-4" /> Ekspor koreksi</button><button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Impor 42 baris siap</button></div></header>
      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_300px]">
        <aside className="rounded-xl border bg-card p-3"><p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tampilkan</p>{[["Semua baris", "47"], ["Siap", "42"], ["Peringatan", "3"], ["Ditolak", "2"]].map(([name, count], i) => <button key={name} className={`mb-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${i === 2 ? "bg-amber-100 font-medium text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "hover:bg-muted"}`}><span>{name}</span><span>{count}</span></button>)}<div className="my-3 border-t" /><p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Kolom bermasalah</p>{["NIS", "Tanggal lahir", "Identitas mirip"].map(x => <button className="flex w-full rounded-lg px-3 py-2 text-sm hover:bg-muted" key={x}>{x}</button>)}</aside>
        <section className="min-w-0 rounded-xl border bg-card"><div className="flex items-center gap-2 border-b p-3"><div className="flex flex-1 items-center gap-2 rounded-lg border bg-background px-3"><Search className="size-4 text-muted-foreground" /><input className="h-9 w-full bg-transparent text-sm outline-none" placeholder="Cari nama, NIS, atau nomor baris" /></div><button className="rounded-lg border px-3 py-2 text-sm">Kolom</button></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="bg-muted/60 text-xs"><tr><th className="border-r p-3">#</th><th className="border-r p-3">Nama lengkap</th><th className="border-r p-3">NIS</th><th className="border-r p-3">Tanggal lahir</th><th className="border-r p-3">Status</th><th className="p-3">Validasi</th></tr></thead><tbody>{rows.map((row, index) => <tr key={row.row} className={index === 1 ? "bg-amber-50 dark:bg-amber-950/20" : ""}><td className="border-r border-t p-3 text-muted-foreground">{row.row}</td><td className="border-r border-t p-3 font-medium">{row.name}</td><td className="border-r border-t p-3 font-mono">{row.id}</td><td className="border-r border-t p-3">{index === 4 ? <span className="text-red-600">—</span> : `0${index + 2}-0${index + 1}-2012`}</td><td className="border-r border-t p-3">Aktif</td><td className="border-t p-3"><StatusBadge tone={row.tone}>{row.result}</StatusBadge></td></tr>)}</tbody></table></div></section>
        <aside className="rounded-xl border bg-card p-5"><div className="flex items-center gap-2 text-amber-700 dark:text-amber-300"><AlertTriangle className="size-5" /><h2 className="font-semibold">Kemungkinan orang sama</h2></div><p className="mt-2 text-sm text-muted-foreground">Baris 3 memiliki identitas yang mirip dengan warga sekolah yang sudah ada.</p><div className="mt-5 space-y-3"><div className="rounded-lg border-2 border-primary bg-primary/5 p-4"><p className="text-xs text-muted-foreground">BARIS IMPOR</p><p className="mt-1 font-semibold">Bima Pratama</p><p className="text-sm">Bandung, 12 Mei 2012</p></div><div className="rounded-lg border p-4"><p className="text-xs text-muted-foreground">DATA TERSEDIA</p><p className="mt-1 font-semibold">Bima P.</p><p className="text-sm">Bandung, 12 Mei 2012</p><p className="mt-2 text-xs text-muted-foreground">Profil Staf · tanpa profil Siswa</p></div></div><div className="mt-5 space-y-2"><button className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">Tautkan dan tambah profil Siswa</button><button className="w-full rounded-lg border px-3 py-2 text-sm font-medium">Ini orang yang berbeda</button><button className="w-full px-3 py-2 text-sm text-muted-foreground">Lewati baris ini</button></div></aside>
      </div>
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm"><span><strong>Mode keputusan per baris:</strong> 1 dari 3 peringatan sedang ditinjau.</span><span className="text-muted-foreground">Perubahan belum disimpan</span></div>
    </main>
  );
}

function VariantC() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 pb-24">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><p className="text-sm text-muted-foreground">Master Data / Siswa</p><h1 className="mt-1 text-3xl font-bold">Pusat impor</h1><p className="mt-1 text-muted-foreground">Unggah, lanjutkan review, dan audit seluruh pekerjaan impor.</p></div><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground"><Upload className="size-4" /> Mulai impor baru</button></header>
      <section className="grid gap-4 md:grid-cols-4"><Stat value="1" label="Menunggu keputusan" tone="warning" /><Stat value="0" label="Sedang diproses" /><Stat value="124" label="Data dibuat bulan ini" tone="success" /><Stat value="4" label="Baris dilewati" /></section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-2xl border bg-card"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-lg font-semibold">Pekerjaan impor</h2><p className="text-sm text-muted-foreground">Setiap unggahan memiliki hasil dan audit terpisah.</p></div><button className="rounded-lg border px-3 py-2 text-sm">Filter</button></div><div className="divide-y">{jobs.map((job, index) => <article className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center" key={job.file}><div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${job.color === "amber" ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"}`}>{index === 0 ? <Clock3 className="size-5" /> : <Check className="size-5" />}</div><div className="min-w-0 flex-1"><p className="truncate font-medium">{job.file}</p><p className="text-sm text-muted-foreground">{job.time} · oleh Nur Aisyah</p><p className="mt-1 text-sm">{job.detail}</p></div><div className="flex items-center gap-3"><StatusBadge tone={index === 0 ? "warning" : "success"}>{job.state}</StatusBadge><button className="rounded-lg border p-2" aria-label={`Buka ${job.file}`}><ChevronRight className="size-4" /></button></div></article>)}</div></section>
        <aside className="space-y-4"><div className="rounded-2xl border bg-card p-5"><div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><FileSpreadsheet className="size-5" /></div><h2 className="mt-4 font-semibold">Template resmi</h2><p className="mt-1 text-sm text-muted-foreground">Gunakan template terbaru agar nama kolom dan kode pilihan dikenali.</p><button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium"><Download className="size-4" /> Template Siswa v1.0</button><p className="mt-3 text-center text-xs text-muted-foreground">XLSX · diperbarui 20 Jul 2026</p></div><div className="rounded-2xl border bg-card p-5"><h2 className="font-semibold">Cara kerja</h2><ol className="mt-4 space-y-4 text-sm">{[[Upload, "Unggah template terisi"], [ShieldCheck, "Sistem memvalidasi tanpa menyimpan"], [Users, "Putuskan identitas yang mirip"], [CheckCircle2, "Konfirmasi satu transaksi atomik"]].map(([Icon, text], index) => { const I = Icon as typeof Upload; return <li className="flex gap-3" key={text as string}><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">{index + 1}</span><span className="flex items-center gap-2"><I className="size-4 text-muted-foreground" />{text as string}</span></li>; })}</ol></div></aside>
      </div>
      <section className="rounded-2xl border border-dashed bg-muted/30 p-6"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex gap-3"><Info className="mt-0.5 size-5 text-blue-600" /><div><p className="font-medium">Aman untuk mencoba ulang</p><p className="text-sm text-muted-foreground">Berkas dan versi template menghasilkan kunci idempotensi. Pekerjaan yang sama akan dibuka kembali, bukan dijalankan dua kali.</p></div></div><button className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-3 py-2 text-sm"><RotateCcw className="size-4" /> Pelajari retry</button></div></section>
    </main>
  );
}

function PrototypeSwitcher({ current }: { current: VariantKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const index = variants.findIndex(item => item.key === current);
  const go = (offset: number) => {
    const next = variants[(index + offset + variants.length) % variants.length];
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", next.key);
    router.replace(`${pathname}?${params.toString()}`);
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, [contenteditable='true']")) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  if (process.env.NODE_ENV === "production") return null;
  return <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-foreground p-1.5 text-background shadow-2xl"><button onClick={() => go(-1)} className="rounded-full p-2 hover:bg-background/15" aria-label="Varian sebelumnya"><ArrowLeft className="size-4" /></button><span className="min-w-44 text-center text-sm font-medium">{current} — {variants[index].name}</span><button onClick={() => go(1)} className="rounded-full p-2 hover:bg-background/15" aria-label="Varian berikutnya"><ArrowRight className="size-4" /></button></div>;
}

export function PeopleImportPrototype() {
  const searchParams = useSearchParams();
  const requested = searchParams.get("variant")?.toUpperCase();
  const current: VariantKey = requested === "B" || requested === "C" ? requested : "A";
  return <><div className="mb-4 rounded-lg border border-dashed border-fuchsia-400 bg-fuchsia-50 px-4 py-2 text-sm text-fuchsia-950 dark:bg-fuchsia-950/30 dark:text-fuchsia-100"><strong>PROTOTYPE — jangan diproduksikan.</strong> Tiga bentuk alur impor, switchable via <code>?variant=</code>, pada route Siswa yang ada.</div>{current === "A" ? <VariantA /> : current === "B" ? <VariantB /> : <VariantC />}<PrototypeSwitcher current={current} /></>;
}
