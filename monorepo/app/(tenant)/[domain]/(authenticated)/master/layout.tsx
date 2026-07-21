import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

export default async function MasterDataLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ domain: string }>;
}>) {
  const { domain } = await params;
  await enforceMasterDataAccess(domain, "read");
  return children;
}
