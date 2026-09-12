import { Skeleton } from "@/components/ui/skeleton";

export default function JadwalMengajarLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6" role="status" aria-live="polite" aria-label="Memuat halaman Jadwal Mengajar">
      <span className="sr-only">Memuat halaman Jadwal Mengajar…</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}
