import { enforceTenantFeatureAccess } from "@/lib/features/tenant-feature-route-access";

export default async function UlanganLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}>) {
  const { domain } = await params;
  await enforceTenantFeatureAccess(domain, "ulanganRead", "read");
  return children;
}
