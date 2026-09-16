import * as fs from "fs";
import * as path from "path";

const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.ts");
const LIB_DIR = path.join(process.cwd(), "lib");
const APP_DIR = path.join(process.cwd(), "app");

// Parse schema to extract table primary keys
const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
const tablePrimaryKeys: Record<string, string> = {};

// Match: export const tableName = pgTable("table_name", { id: varchar("id", ...).primaryKey(), ... })
const tableRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\("([^"]+)",\s*\{[^}]*?(\w+):\s*\w+\("([^"]+)"[^)]*\)\.primaryKey\(\)/gs;

let tableMatch;
while ((tableMatch = tableRegex.exec(schemaContent)) !== null) {
  const varName = tableMatch[1];
  const tableName = tableMatch[2];
  const columnVar = tableMatch[3];
  const columnName = tableMatch[4];
  tablePrimaryKeys[varName] = columnVar;
  tablePrimaryKeys[tableName] = columnVar;
}

// Also match composite primary keys
const compositePkRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\("([^"]+)",[\s\S]*?\(table\)\s*=>\s*\[[^\]]*primaryKey\(\)\.on\(table\.(\w+),\s*table\.(\w+)\)/g;

// Find all .ts files
function findTsFiles(dir: string): string[] {
  const files: string[] = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (entry === "node_modules" || entry === ".next" || entry === "scripts" || entry === "e2e" || entry.startsWith(".")) {
      continue;
    }
    if (fs.statSync(fullPath).isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".mysql.test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

const files = [...findTsFiles(LIB_DIR), ...findTsFiles(APP_DIR)];

let totalFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, "utf-8");
  let changes = 0;
  const original = content;

  // Fix onConflictDoUpdate without target
  const onConflictRegex = /\.onConflictDoUpdate\(\{(\s*set:\s*\{)/g;
  let match;
  while ((match = onConflictRegex.exec(content)) !== null) {
    // Find the table name by looking backward for .insert(tableName)
    const beforeMatch = content.substring(Math.max(0, match.index - 200), match.index);
    const insertMatch = beforeMatch.match(/\.insert\((\w+)\)/);
    if (!insertMatch) continue;
    
    const tableVar = insertMatch[1];
    const pkColumn = tablePrimaryKeys[tableVar];
    if (!pkColumn) continue;

    // Check if target already exists
    const afterMatch = content.substring(match.index, match.index + 100);
    if (afterMatch.includes("target:")) continue;

    const replacement = `.onConflictDoUpdate({ target: ${tableVar}.${pkColumn},$1`;
    content = content.substring(0, match.index) + replacement + content.substring(match.index + match[0].length - 1);
    changes++;
    onConflictRegex.lastIndex = match.index + replacement.length;
  }

  if (content !== original) {
    fs.writeFileSync(file, content);
    totalFiles++;
    console.log(`Fixed ${path.relative(process.cwd(), file)} (${changes} changes)`);
  }
}

console.log(`\nTotal: ${totalFiles} files changed`);
console.log("Known primary keys:", Object.entries(tablePrimaryKeys).slice(0, 10));
