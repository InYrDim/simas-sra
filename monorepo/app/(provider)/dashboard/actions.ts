"use server";

import { db } from "@/db";
import { tenant } from "@/db/schema";
import { user } from "@/auth-schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { redirect } from "next/navigation";

export async function createTenantAction(formData: FormData) {
  const tenantName = formData.get("tenantName") as string;
  const domain = formData.get("domain") as string;
  const adminName = formData.get("adminName") as string;
  const adminEmail = formData.get("adminEmail") as string;

  if (!tenantName || !domain || !adminName || !adminEmail) {
    throw new Error("Semua field harus diisi");
  }

  // Check if domain exists
  const existing = await db.select().from(tenant).where(eq(tenant.domain, domain)).limit(1);
  if (existing.length > 0) {
    throw new Error("Domain sudah digunakan");
  }

  const tenantId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  
  // Set trial_ends_at to 1 month from now
  const trialEndsAt = new Date();
  trialEndsAt.setMonth(trialEndsAt.getMonth() + 1);

  try {
    // Transaction
    await db.transaction(async (tx) => {
      await tx.insert(tenant).values({
        id: tenantId,
        name: tenantName,
        domain: domain,
        trialEndsAt: trialEndsAt,
      });

      await tx.insert(user).values({
        id: userId,
        name: adminName,
        email: adminEmail,
        tenantId: tenantId,
        emailVerified: true,
      });
    });
  } catch (e) {
    console.error("Failed to create tenant:", e);
    throw new Error("Gagal membuat tenant baru");
  }

  // Redirect to new subdomain
  // Use http for localhost or https for production. Assuming localhost for dev
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
  const baseHost = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).host : "localhost:3000";
  
  // Clean up localhost:3000 -> localhost for subdomain, but usually you redirect to http://subdomain.localhost:3000
  // Next.js handles redirects via absolute URLs
  const redirectUrl = `${protocol}://${domain}.${baseHost}`;
  
  redirect(redirectUrl);
}
