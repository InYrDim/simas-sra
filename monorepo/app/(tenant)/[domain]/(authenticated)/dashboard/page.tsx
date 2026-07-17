import { SessionInfo } from "@/components/dashboard/session-info";
import { AdvancedAnalytics } from "@/components/dashboard/advanced-analytics";
import { db } from "@/db";
import { tenant } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params;
  
  const tenantDataArray = await db.select().from(tenant).where(eq(tenant.domain, domain)).limit(1);
  const tenantData = tenantDataArray[0];

  if (!tenantData) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">Ringkasan</h2>
      </div>
      
      <SessionInfo />
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-2 relative overflow-hidden group">
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="h-4 w-1/3 bg-muted rounded animate-pulse" />
            <div className="h-10 w-1/2 bg-muted rounded animate-pulse mt-2" />
          </div>
        ))}
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <AdvancedAnalytics tenantId={tenantData.id} />
        <div className="col-span-3 rounded-2xl border bg-card text-card-foreground shadow-sm p-6 h-[400px] flex flex-col gap-4">
          <div className="text-lg font-semibold">Aktivitas Terbaru</div>
          <div className="flex-1 space-y-4">
             {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="size-10 rounded-full bg-muted animate-pulse shrink-0" />
                <div className="space-y-2 flex-1">
                  <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-muted/50 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
