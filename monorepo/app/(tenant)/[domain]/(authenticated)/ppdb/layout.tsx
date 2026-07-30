import { enforceTenantFeatureAccess } from "@/lib/features/tenant-feature-route-access";

export default async function PpdbLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}>) {
  const { domain } = await params;
  await enforceTenantFeatureAccess(domain, "ppdbRead", "read");
  return children;
}
