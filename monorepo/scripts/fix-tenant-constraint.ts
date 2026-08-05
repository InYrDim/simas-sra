import { sql } from "drizzle-orm";
import { db } from "@/db";

async function main() {
  console.log("Dropping old constraint...");
  try {
    await db.execute(sql`ALTER TABLE tenant DROP CHECK tenant_onboarding_trial_state_check`);
    console.log("Dropped old constraint.");
  } catch (error: any) {
    console.log("Could not drop (maybe doesn't exist):", error.message);
  }

  console.log("Adding new constraint...");
  try {
    await db.execute(sql`
      ALTER TABLE tenant ADD CONSTRAINT tenant_onboarding_trial_state_check CHECK((
        (onboarding_completed_at IS NULL AND trial_started_at IS NULL AND trial_ends_at IS NULL)
        OR (onboarding_completed_at IS NOT NULL AND trial_started_at = onboarding_completed_at AND trial_ends_at IS NOT NULL AND trial_ends_at > trial_started_at)
      ))
    `);
    console.log("Added new constraint.");
  } catch (error: any) {
    console.log("Could not add:", error.message);
  }
  
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
