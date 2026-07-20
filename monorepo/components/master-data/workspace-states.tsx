import { AlertCircle, Archive, LoaderCircle, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export function MasterDataLoading({ label = "Memuat data" }: { label?: string }) {
  return <div role="status" aria-live="polite" className="flex min-h-40 items-center justify-center gap-2 text-muted-foreground"><LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />{label}…</div>;
}

export function MasterDataRegionError({ retry }: { retry?: () => void }) {
  return <div role="alert" className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center"><AlertCircle aria-hidden="true" className="text-destructive" /><div><h2 className="font-semibold">Bagian ini tidak dapat dimuat</h2><p className="text-sm text-muted-foreground">Data lain di halaman tetap dapat digunakan.</p></div>{retry ? <Button type="button" variant="outline" onClick={retry}>Coba lagi</Button> : null}</div>;
}

export function MasterDataEmpty({ filtered = false }: { filtered?: boolean }) {
  return <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">{filtered ? <SearchX aria-hidden="true" /> : <Archive aria-hidden="true" />}<h2 className="font-semibold">{filtered ? "Tidak ada hasil" : "Belum ada data"}</h2><p className="max-w-sm text-sm text-muted-foreground">{filtered ? "Ubah pencarian atau filter untuk melihat hasil lain." : "Tambahkan catatan pertama saat data siap dikelola."}</p></div>;
}

export function MasterDataNotice({ kind }: { kind: "read-only" | "archived" | "conflict" }) {
  const notices = {
    "read-only": ["Mode hanya-baca", "Anda dapat melihat data, tetapi perubahan sedang tidak diizinkan."],
    archived: ["Catatan diarsipkan", "Arsip berbeda dari status operasional dan tidak dapat diedit."],
    conflict: ["Perubahan tidak disimpan", "Data telah berubah sejak formulir dibuka. Input Anda tetap tersedia untuk ditinjau."],
  } as const;
  const [title, message] = notices[kind];
  return <div role={kind === "conflict" ? "alert" : "status"} className="border-l-4 border-primary bg-muted p-3"><p className="font-medium">{title}</p><p className="text-sm text-muted-foreground">{message}</p></div>;
}
