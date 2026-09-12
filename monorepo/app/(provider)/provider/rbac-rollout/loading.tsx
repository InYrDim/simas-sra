import { Spinner } from "@/components/ui/spinner";

export default function ProviderRbacRolloutLoading() {
  return (
    <main
      className="flex min-h-48 items-center justify-center gap-3 p-4 text-sm text-muted-foreground md:p-6"
      aria-busy="true"
      aria-live="polite"
    >
      <Spinner />
      <span>Memuat operasi rollout RBAC…</span>
    </main>
  );
}
