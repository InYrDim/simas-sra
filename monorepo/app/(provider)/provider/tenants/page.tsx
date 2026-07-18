import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProviderTenantsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Tenant</h1>
        <p className="mt-1 text-muted-foreground">Kelola Tenant dan pengajuan layanan SIMAS.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Pengelolaan Tenant</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Daftar, tab pengajuan, dan detail Tenant akan tersedia pada tahap pengelolaan Tenant.
        </CardContent>
      </Card>
    </div>
  );
}
