import { Construction } from "lucide-react";

type ProviderEmptyStateProps = Readonly<{
  title: string;
  description: string;
}>;

export function ProviderEmptyState({ title, description }: ProviderEmptyStateProps) {
  return (
    <section className="grid min-h-[55vh] place-items-center" aria-labelledby="empty-state-title">
      <div className="max-w-lg rounded-xl border bg-card p-8 text-center shadow-sm">
        <Construction className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
        <h1 id="empty-state-title" className="mt-4 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 font-medium text-muted-foreground">Fitur ini belum tersedia.</p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
    </section>
  );
}
