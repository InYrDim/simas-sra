import { db } from "@/db";
import { tenant } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function hasFeature(tenantId: string, featureName: string): Promise<boolean> {
  const result = await db.select({ settings: tenant.settings }).from(tenant).where(eq(tenant.id, tenantId)).limit(1);
  
  if (result.length === 0 || !result[0].settings) {
    return false;
  }
  
  const settings = result[0].settings as Record<string, unknown>;
  
  // Asumsi struktur JSON: { "features": { "advancedAnalytics": true, "customTheme": false } }
  // Atau secara flat: { "feature_advancedAnalytics": true }
  // Untuk saat ini kita asumsikan struktur flat atau features property
  if (settings.features && typeof settings.features === 'object') {
    const features = settings.features as Record<string, unknown>;
    return !!features[featureName];
  }
  
  return !!settings[featureName];
}
