import { ProviderShell } from "@/components/provider/provider-shell";
import { getProviderPageAccess } from "@/lib/provider-access";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const access = await getProviderPageAccess();
  return <ProviderShell principal={access.principal}>{children}</ProviderShell>;
}
