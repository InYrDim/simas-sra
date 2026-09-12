import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/platform/auth";
import { resolveCentralDestination } from "@/lib/platform/central-identity";
import { getCentralIdentity } from "@/lib/platform/central-identity-data";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(resolveCentralDestination(await getCentralIdentity(session.user.id)));
  return children;
}
