import { enforceMasterDataAccess } from "@/lib/tenant-master-data-route-access";

export default async function WhatsAppBotPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await params;
  await enforceMasterDataAccess(domain, "read");

  return <main />;
}
