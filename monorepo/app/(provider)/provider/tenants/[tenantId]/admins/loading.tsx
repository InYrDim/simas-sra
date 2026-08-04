export default function ProviderSchoolAdminRosterLoading() {
  return (
    <main className="space-y-6 p-6" aria-busy="true" aria-live="polite">
      <div className="h-8 w-72 animate-pulse rounded bg-muted" />
      <div className="h-48 animate-pulse rounded-lg border bg-muted/40" />
      <span className="sr-only">Memuat roster School Admin…</span>
    </main>
  );
}
