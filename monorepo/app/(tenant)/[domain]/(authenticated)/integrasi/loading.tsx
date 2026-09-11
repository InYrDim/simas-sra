import { Skeleton } from "@/components/ui/skeleton";

export default function IntegrasiLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6" role="status" aria-live="polite" aria-label="Memuat halaman Integrasi">
      <span className="sr-only">Memuat halaman Integrasi…</span>
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-5 w-96" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  );
}