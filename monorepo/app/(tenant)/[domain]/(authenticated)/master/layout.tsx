import { enforceTenantMasterDataOperation } from "@/lib/authorization/tenant-operation-route-access";

export default async function MasterDataLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}>) {
  const { domain } = await params;
  await enforceTenantMasterDataOperation(domain, "master-data.overview.load");
  return children;
}
