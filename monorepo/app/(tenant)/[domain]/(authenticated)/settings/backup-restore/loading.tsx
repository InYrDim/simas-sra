import { Skeleton } from "@/components/ui/skeleton";

export default function BackupRestoreLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6" role="status" aria-live="polite" aria-label="Memuat halaman Backup & Restore">
      <span className="sr-only">Memuat halaman Backup &amp; Restore…</span>
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  );
}
