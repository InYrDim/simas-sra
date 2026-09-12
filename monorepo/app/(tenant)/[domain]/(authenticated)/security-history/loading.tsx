export default function SecurityHistoryLoading() {
  return (
    <main className="space-y-6 p-4 md:p-6" aria-busy="true" aria-live="polite">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="h-5 w-96 max-w-full animate-pulse rounded bg-muted/70" />
      <div className="h-72 animate-pulse rounded-lg border bg-muted/40" />
      <span className="sr-only">Memuat riwayat keamanan…</span>
    </main>
  );
}
