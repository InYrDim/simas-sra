"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { importDemoMasterData } from "@/lib/master-data/demo-master-data-import";
import { schoolProfileStore } from "@/lib/master-data/school-profile-data";
import { enforceTenantMasterDataOperation } from "@/lib/master-data/tenant-master-data-route-access";

const educationLevels = ["SD", "SMP", "SMA", "SMK"] as const;
type EducationLevel = (typeof educationLevels)[number];

export async function importDemoMasterDataAction(domain: string) {
  const principal = await enforceTenantMasterDataOperation(domain, "people-imports.execute", [
      "people-imports.revisions.execute",
      "people.people.create",
      "people.people.update",
      "students.students.create",
      "students.students.update",
      "teachers.teachers.create",
      "teachers.teachers.update",
      "staff.staff.create",
      "staff.staff.update",
    ]);
  const identity = await schoolProfileStore.findProviderIdentity(principal.tenantId);
  const educationLevel = educationLevels.find((level) => level === identity?.educationLevel) as EducationLevel | undefined;

  if (!educationLevel) {
    redirect(`/${domain}/master/import?demo=invalid-school-level`);
  }

  try {
    await importDemoMasterData(principal, educationLevel);
  } catch {
    redirect(`/${domain}/master/import?demo=error`);
  }

  revalidatePath(`/${domain}/dashboard`);
  revalidatePath(`/${domain}/master`);
  revalidatePath(`/${domain}/master/import`);
  redirect(`/${domain}/master/import?demo=success`);
}
