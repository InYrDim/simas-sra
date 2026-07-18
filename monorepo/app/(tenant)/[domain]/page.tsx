import { notFound } from 'next/navigation';
import { db } from '@/db';
import { tenant } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { requireTenantFeatureAccess } from '@/lib/tenant-access';
import { TenantActivationError } from '@/lib/school-admin-activation';

export default async function TenantPage({
  params,
}: {
  params: Promise<{ domain: string }>
}) {
  const { domain } = await params;
  try {
    await requireTenantFeatureAccess(domain);
  } catch (error) {
    if (error instanceof TenantActivationError && error.code === "password-change-required") {
      redirect("/change-password");
    }
    throw error;
  }

  const tenantDataArray = await db.select().from(tenant).where(eq(tenant.domain, domain)).limit(1);
  const tenantData = tenantDataArray[0];

  if (!tenantData) {
    notFound();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 text-black">
      <div className="p-8 bg-white shadow-lg rounded-xl text-center">
        <h1 className="text-3xl font-bold mb-4">Tenant Dashboard</h1>
        <h2 className="text-2xl font-semibold mb-2">{tenantData.name}</h2>
        <p className="text-xl">
          Welcome to <span className="font-mono bg-gray-100 p-1 rounded text-blue-600">{tenantData.domain}</span>
        </p>
      </div>
    </div>
  );
}
