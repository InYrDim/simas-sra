import { redirect } from "next/navigation";

import { enforceTenantPageAccess } from "@/lib/tenant-access";

export default async function TenantPage({ params }: { params: Promise<{ domain: string }> }) {
  const { domain } = await params;
  await enforceTenantPageAccess(domain);
  redirect(`/${domain}/dashboard`);
}
