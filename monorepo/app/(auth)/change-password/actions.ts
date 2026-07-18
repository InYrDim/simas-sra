"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import { auth } from "@/lib/auth";
import { createChangeSchoolAdminPasswordCommand } from "@/lib/school-admin-activation";
import { schoolAdminActivationStore } from "@/lib/school-admin-activation-data";

export async function changeRequiredPasswordAction(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");

  const currentPassword = formData.get("currentPassword");
  const newPassword = formData.get("newPassword");
  const confirmation = formData.get("confirmation");
  if (typeof currentPassword !== "string" || typeof newPassword !== "string" || newPassword.length < 8) {
    redirect("/change-password?error=invalid");
  }
  if (confirmation !== newPassword) redirect("/change-password?error=confirmation");

  const changePassword = createChangeSchoolAdminPasswordCommand({ store: schoolAdminActivationStore });
  const result = await changePassword({
    userId: session.user.id,
    currentSessionId: session.session.id,
    currentPassword,
    newPassword,
  });
  if (!result.ok) redirect("/change-password?error=current");

  const [tenantData] = await db
    .select({ domain: tenant.domain })
    .from(tenant)
    .where(eq(tenant.id, session.user.tenantId ?? ""))
    .limit(1);
  redirect(tenantData ? `/${tenantData.domain}/dashboard` : "/login");
}
