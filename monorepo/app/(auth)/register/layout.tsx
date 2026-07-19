import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { resolveCentralDestination } from "@/lib/central-identity";
import { getCentralIdentity } from "@/lib/central-identity-data";

export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(resolveCentralDestination(await getCentralIdentity(session.user.id)));
  return children;
}
