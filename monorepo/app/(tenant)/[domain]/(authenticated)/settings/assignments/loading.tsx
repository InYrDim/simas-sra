import { Skeleton } from '@/components/ui/skeleton';

export default function AssignmentsLoading() {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 p-6" aria-label="Memuat assignment role">
      <Skeleton className="h-16 w-72" />
      <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.2fr)]">
        <Skeleton className="h-[36rem] rounded-2xl" />
        <Skeleton className="h-[36rem] rounded-2xl" />
      </div>
    </div>
  );
}
