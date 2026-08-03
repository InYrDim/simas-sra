import { Skeleton } from '@/components/ui/skeleton';

export default function UsersLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6" role="status" aria-live="polite" aria-label="Memuat ruang kerja siklus akun">
      <span className="sr-only">Memuat ruang kerja siklus akun…</span>
      <div className="space-y-2"><Skeleton className="h-8 w-72" /><Skeleton className="h-4 w-full max-w-xl" /></div>
      <div className="grid gap-3 sm:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}</div>
      <Skeleton className="h-16 rounded-2xl" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}
