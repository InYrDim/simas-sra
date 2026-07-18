import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { schoolAdminActivation, tenant, user } from "@/db/schema";
import { auth } from "@/lib/auth";

export default async function ContinueAfterLoginPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!session.user.tenantId) redirect("/provider");

  const [destination] = await db
    .select({
      domain: tenant.domain,
      passwordChangeRequired: schoolAdminActivation.passwordChangeRequired,
    })
    .from(user)
    .innerJoin(tenant, eq(tenant.id, user.tenantId))
    .leftJoin(schoolAdminActivation, eq(schoolAdminActivation.userId, user.id))
    .where(eq(user.id, session.user.id))
    .limit(1);
  if (!destination) redirect("/login");
  redirect(destination.passwordChangeRequired ? "/change-password" : `/${destination.domain}/dashboard`);
}
