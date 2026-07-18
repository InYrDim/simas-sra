import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProviderSummaryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Ringkasan</h1>
        <p className="mt-1 text-muted-foreground">Pantau aktivitas utama layanan SIMAS dari area Provider.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Area Provider siap digunakan</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Metrik dan aktivitas Provider akan ditambahkan pada tahap implementasi Ringkasan berikutnya.
        </CardContent>
      </Card>
    </div>
  );
}
