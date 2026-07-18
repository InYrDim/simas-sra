export default function ProviderForbidden() {
  return (
    <main className="grid min-h-svh place-items-center bg-background p-6">
      <section className="max-w-md text-center">
        <h1 className="text-2xl font-semibold">Akses ditolak</h1>
        <p className="mt-2 text-muted-foreground">Akun ini tidak memiliki akses Provider Admin.</p>
      </section>
    </main>
  );
}
