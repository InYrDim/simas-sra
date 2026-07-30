import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/platform/auth";
import { resolveCentralDestination } from "@/lib/platform/central-identity";
import { getCentralIdentity } from "@/lib/platform/central-identity-data";

export default async function ContinueAfterLoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const identity = await getCentralIdentity(session.user.id);
  redirect(resolveCentralDestination(identity));
}
