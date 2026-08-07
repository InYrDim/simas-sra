import { Skeleton } from "@/components/ui/skeleton";

export default function ELibraryLoading() {
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6" role="status" aria-live="polite" aria-label="Memuat halaman E-Library">
      <span className="sr-only">Memuat halaman E-Library…</span>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 rounded-2xl" />
    </div>
  );
}
