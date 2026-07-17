import { db } from '../db';
import { tenant } from '../db/schema';
import crypto from 'crypto';

async function main() {
  console.log("Seeding dummy tenants...");
  
  const tenantsToInsert = [
    {
      id: crypto.randomUUID(),
      name: "Sekolah A",
      domain: "sekolah-a",
    },
    {
      id: crypto.randomUUID(),
      name: "Sekolah B",
      domain: "sekolah-b",
    }
  ];

  for (const t of tenantsToInsert) {
    try {
      await db.insert(tenant).values(t);
      console.log(`Inserted tenant: ${t.name} (${t.domain})`);
    } catch (e) {
      const error = e as { code?: string };
      if (error.code === 'ER_DUP_ENTRY') {
        console.log(`Tenant ${t.domain} already exists. Skipping.`);
      } else {
        console.error(`Error inserting ${t.name}:`, e);
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
