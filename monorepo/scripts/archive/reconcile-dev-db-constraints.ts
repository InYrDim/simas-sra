import "dotenv/config";
import mysql from "mysql2/promise";

// One-off reconciliation for the disposable dev DB: the committed Phase 2
// migration was applied partially (tables exist, some FKs missing). Apply only
// the missing constraint statements verbatim from the migration SQL. Do not
// touch the committed migration.
const statements = [
  "ALTER TABLE `school_admin_proof` ADD CONSTRAINT `school_admin_proof_authority_fkey` FOREIGN KEY (`tenant_id`,`authority_id`) REFERENCES `school_admin_authority`(`tenant_id`,`id`)",
  "ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_command_fkey` FOREIGN KEY (`security_context_kind`,`context_id`,`command_id`) REFERENCES `security_command`(`security_context_kind`,`context_id`,`id`)",
  "ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_target_authority_fkey` FOREIGN KEY (`tenant_id`,`target_school_admin_authority_id`) REFERENCES `school_admin_authority`(`tenant_id`,`id`)",
  "ALTER TABLE `security_audit_event` ADD CONSTRAINT `security_audit_event_target_proof_fkey` FOREIGN KEY (`tenant_id`,`target_school_admin_proof_id`) REFERENCES `school_admin_proof`(`tenant_id`,`id`)",
  "ALTER TABLE `security_outbox` ADD CONSTRAINT `security_outbox_command_fkey` FOREIGN KEY (`security_context_kind`,`context_id`,`command_id`) REFERENCES `security_command`(`security_context_kind`,`context_id`,`id`)",
  "ALTER TABLE `tenant_role` ADD CONSTRAINT `tenant_role_tenant_copy_fkey` FOREIGN KEY (`tenant_id`,`copied_from_role_id`) REFERENCES `tenant_role`(`tenant_id`,`id`)",
  "ALTER TABLE `tenant_role_assignment` ADD CONSTRAINT `tenant_role_assignment_role_fkey` FOREIGN KEY (`tenant_id`,`role_id`) REFERENCES `tenant_role`(`tenant_id`,`id`)",
];

const databaseUrl = process.env.DATABASE_URL;

async function main(): Promise<void> {
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const connection = await mysql.createConnection(databaseUrl);
  try {
    for (const statement of statements) {
      const name = statement.match(/CONSTRAINT `([^`]+)`/)?.[1] ?? statement;
      const [[existing]] = await connection.execute<mysql.RowDataPacket[]>(
        "SELECT 1 FROM `information_schema`.`table_constraints` WHERE `constraint_schema`=DATABASE() AND `constraint_name`=?",
        [name],
      );
      if (existing) {
        console.log(`skip (present): ${name}`);
        continue;
      }
      await connection.query(statement);
      console.log(`applied: ${name}`);
    }
  } finally {
    await connection.end();
  }
}

void main();
