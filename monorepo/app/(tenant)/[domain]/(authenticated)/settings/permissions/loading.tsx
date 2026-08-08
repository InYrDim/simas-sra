export default function PermissionExplorerLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-56 rounded-md bg-muted animate-pulse" />
        <div className="h-4 w-80 rounded-md bg-muted animate-pulse" />
      </div>
      <div className="space-y-3">
        <div className="h-10 w-full rounded-md bg-muted animate-pulse" />
        <div className="h-64 w-full rounded-md bg-muted animate-pulse" />
      </div>
    </main>
  );
}
