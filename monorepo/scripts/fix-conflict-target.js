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
  "./lib/master-data/school-profile-data.ts",
  "./lib/provider/provider-admin.ts",
];

for (const file of files) {
  let content = fs.readFileSync(file, "utf-8");
  const original = content;

  // Replace .onConflictDoUpdate({ set: { ... }) with .onConflictDoUpdate({ target: table.id, set: { ... })
  content = content.replace(/\.onConflictDoUpdate\(\{(\s*set:\s*\{)/g, (match, p1) => {
    // Look backward for .insert(tableName)
    const beforeMatch = content.substring(0, match.index);
    const insertMatch = beforeMatch.match(/\.insert\((\w+)\)/);
    if (!insertMatch) return match;
    const tableVar = insertMatch[1];
    return `.onConflictDoUpdate({ target: ${tableVar}.id, $1`;
  });

  if (content !== original) {
    fs.writeFileSync(file, content);
    console.log(`Fixed ${file}`);
  }
}
