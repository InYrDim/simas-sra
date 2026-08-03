export default async function WhatsAppBotPage({
  params,
}: {
  params: Promise<{ domain: string }>;
}) {
  await params;

  return <main />;
}
