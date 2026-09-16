const fs = require("fs");
const path = require("path");

const files = [
  "./lib/authorization/legacy-non-admin-backfill-data.ts",
  "./lib/authorization/school-admin-authority-data.ts",
  "./lib/authorization/security-audit-data.ts",
  "./lib/authorization/security-audit-retention-db.ts",
  "./lib/authorization/security-command-store.ts",
  "./lib/authorization/tenant-role-lifecycle-data.ts",
  "./lib/integrations/whatsapp-bot/tenant-openwa-credential.ts",
  "./lib/integrations/whatsapp-bot/whatsapp-bot-data.ts",
  "./lib/master-data/demo-master-data-import.ts",
  "./lib/provider/provider-admin.ts",
];

for (const file of files) {
  let content = fs.readFileSync(file, "utf-8");
  const original = content;

  // Find all .onDuplicateKeyUpdate({ set: { ... }) patterns
  // and replace with .onConflictDoUpdate({ target: <table>.id, set: { ... })
  content = content.replace(
    /\.onDuplicateKeyUpdate\(\{\s*set:/g,
    (match) => {
      // Look backward for .insert(tableName)
      const beforeMatch = content.substring(0, content.indexOf(match));
      const insertMatch = beforeMatch.match(/\.insert\((\w+)\)/);
      if (!insertMatch) {
        return match.replace(".onDuplicateKeyUpdate", ".onConflictDoUpdate");
      }
      const tableVar = insertMatch[1];
      return `.onConflictDoUpdate({ target: ${tableVar}.id, set:`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Fixed ${file}`);
  }
}
