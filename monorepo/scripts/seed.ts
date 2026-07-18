import { db } from '../db';
import { tenant } from '../db/schema';
import { user } from '../auth-schema';
import crypto from 'crypto';

async function main() {
  console.log("Seeding dummy tenants...");
  
  console.log("Fetching tenants...");
  let allTenants = await db.select().from(tenant);

  if (allTenants.length === 0) {
    const tenantsToInsert = [
      { id: crypto.randomUUID(), name: "Sekolah A", domain: "sekolah-a", settings: { features: { advancedAnalytics: true } } },
      { id: crypto.randomUUID(), name: "Sekolah B", domain: "sekolah-b", settings: { features: { advancedAnalytics: false } } }
    ];
    for (const t of tenantsToInsert) {
      await db.insert(tenant).values(t);
    }
    allTenants = await db.select().from(tenant);
  }

  console.log("Seeding dummy users...");
  const usersToInsert = [
    {
      id: crypto.randomUUID(),
      name: "Budi (Sekolah A)",
      email: "budi@sekolah-a.com",
      tenantId: allTenants.find(t => t.domain === 'sekolah-a')?.id || allTenants[0].id,
      emailVerified: true
    },
    {
      id: crypto.randomUUID(),
      name: "Siti (Sekolah B)",
      email: "siti@sekolah-b.com",
      tenantId: allTenants.find(t => t.domain === 'sekolah-b')?.id || allTenants[1]?.id || allTenants[0].id,
      emailVerified: true
    }
  ];

  for (const u of usersToInsert) {
    try {
      await db.insert(user).values(u);
      console.log(`Inserted user: ${u.name} (${u.email})`);
    } catch (e) {
      const error = e as { code?: string };
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`User ${u.email} already exists. Skipping.`);
      } else {
        console.error(`Error inserting ${u.name}:`, e);
      }
    }
  }

  console.log("Seeding completed.");
  process.exit(0);
}

main().catch(err => {
  console.error("Failed to seed:", err);
  process.exit(1);
});
