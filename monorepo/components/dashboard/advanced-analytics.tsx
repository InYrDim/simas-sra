import { hasFeature } from "@/lib/features";

const chartHeights = [42, 68, 35, 81, 56, 74, 49, 91, 63, 77, 52, 86];

export async function AdvancedAnalytics({ tenantId }: { tenantId: string }) {
  const isEnabled = await hasFeature(tenantId, "advancedAnalytics");

  if (!isEnabled) {
    return (
      <div className="col-span-4 rounded-2xl border bg-card text-card-foreground shadow-sm p-6 h-[400px] flex items-center justify-center border-dashed">
        <div className="text-center text-muted-foreground max-w-sm">
          <h3 className="font-semibold text-lg text-foreground mb-2">Advanced Analytics Locked</h3>
          <p>Fitur analitik lanjutan belum diaktifkan untuk tenant ini. Silakan hubungi provider untuk mengaktifkan fitur ini.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-4 rounded-2xl border bg-card text-card-foreground shadow-sm p-6 h-[400px] flex flex-col">
      <h3 className="font-semibold text-lg mb-4">Advanced Analytics</h3>
      <div className="flex-1 flex items-center justify-center bg-primary/5 rounded-xl border border-primary/10 relative overflow-hidden">
        {/* Dummy Chart */}
        <div className="absolute bottom-0 left-0 right-0 h-1/2 flex items-end justify-between px-6 gap-2">
          {chartHeights.map((height, index) => (
            <div
              key={index}
              className="w-full bg-primary/40 rounded-t-sm"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
        <div className="z-10 bg-background/80 backdrop-blur px-4 py-2 rounded-lg border shadow-sm">
          <div className="text-2xl font-bold text-primary">Unlocked!</div>
          <div className="text-xs text-muted-foreground">Premium feature</div>
        </div>
      </div>
    </div>
  );
}
