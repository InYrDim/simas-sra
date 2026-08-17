// Isi data master demo (Tahun Ajaran, Guru, Mapel, Rombel, + 2 Siswa) untuk satu tenant.
// Idempoten: pakai onDuplicateKeyUpdate, aman dijalankan berulang.
//
// Jalankan dengan kondisi export "react-server" agar modul `server-only` jadi no-op:
//   pnpm exec NODE_OPTIONS=--conditions=react-server tsx scripts/import-demo-master-data.ts <tenant-domain>

import "dotenv/config";

import { and, eq } from "drizzle-orm";

import { closeDatabasePool, db } from "@/db";
import { schoolAdminAuthority, tenant, user } from "@/db/schema";
import { importDemoMasterData } from "@/lib/master-data/demo-master-data-import";
import { schoolProfileStore } from "@/lib/master-data/school-profile-data";

const domain = process.argv[2];
if (!domain) {
  throw new Error("Usage: tsx scripts/import-demo-master-data.ts <tenant-domain>");
}

const educationLevels = ["SD", "SMP", "SMA", "SMK"] as const;
type EducationLevel = (typeof educationLevels)[number];

async function main() {
  const [school] = await db
    .select({ id: tenant.id, name: tenant.name })
    .from(tenant)
    .where(eq(tenant.domain, domain))
    .limit(1);
  if (!school) throw new Error(`Tenant dengan domain "${domain}" tidak ditemukan`);

  const [actor] = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .innerJoin(schoolAdminAuthority, eq(schoolAdminAuthority.userId, user.id))
    .where(
      and(
        eq(user.tenantId, school.id),
        eq(schoolAdminAuthority.tenantId, school.id),
        eq(schoolAdminAuthority.authorityState, "active" as const),
      ),
    )
    .limit(1);
  if (!actor) throw new Error(`Tenant "${domain}" belum memiliki school admin aktif`);

  const identity = await schoolProfileStore.findProviderIdentity(school.id);
  const educationLevel = educationLevels.find((level) => level === identity?.educationLevel) as EducationLevel | undefined;
  if (!educationLevel) {
    throw new Error(`educationLevel tenant "${domain}" belum diisi (provider identity: ${identity?.educationLevel ?? "null"})`);
  }

  const principal = {
    userId: actor.id,
    tenantId: school.id,
    role: "school-admin" as const,
    capabilities: { read: true, write: true, downloadTemplate: true },
    schoolAdmin: true,
  };

  const result = await importDemoMasterData(principal, educationLevel);
  console.log(`Data master demo untuk ${school.name} (${domain}) berhasil diimpor: ${result.imported.join(", ")}.`);
}

main()
  .catch((error: unknown) => {
    console.error("Import data master demo gagal:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(closeDatabasePool);
