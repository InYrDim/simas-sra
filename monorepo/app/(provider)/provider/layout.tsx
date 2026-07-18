import { ProviderShell } from "@/components/provider/provider-shell";
import { getProviderPageAccess } from "@/lib/provider-access";
import { forbidden } from "next/navigation";

export default async function ProviderLayout({ children }: { children: React.ReactNode }) {
  const access = await getProviderPageAccess();

  if (access.status === "forbidden") {
    forbidden();
  }

  return <ProviderShell principal={access.principal}>{children}</ProviderShell>;
}
