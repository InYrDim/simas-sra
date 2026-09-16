import * as fs from "fs";
import * as path from "path";

const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.ts");
const LIB_DIR = path.join(process.cwd(), "lib");
const APP_DIR = path.join(process.cwd(), "app");

// Parse schema to extract table primary keys
const schemaContent = fs.readFileSync(SCHEMA_PATH, "utf-8");
const tablePrimaryKeys: Record<string, string> = {};

// Match primary key definitions in table callback
const pkRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\("([^"]+)",[\s\S]*?\(table\)\s*=>\s*\[[^\]]*?\.on\(table\.(\w+),\s*table\.(\w+)\)/g;
let pkMatch;
while ((pkMatch = pkRegex.exec(schemaContent)) !== null) {
  const varName = pkMatch[1];
  const tableName = pkMatch[2];
  tablePrimaryKeys[varName] = pkMatch[3]; // Use first column of composite PK
  tablePrimaryKeys[tableName] = pkMatch[3];
}

// Also match single column primary keys defined inline
const singlePkRegex = /export\s+const\s+(\w+)\s*=\s*pgTable\("([^"]+)",\s*\{[^}]*?(\w+):\s*\w+\("([^"]+)"[^)]*\)\.primaryKey\(\)/gs;
let singlePkMatch;
while ((singlePkMatch = singlePkRegex.exec(schemaContent)) !== null) {
  const varName = singlePkMatch[1];
  const tableName = singlePkMatch[2];
  const columnVar = singlePkMatch[3];
  const columnName = singlePkMatch[4];
  if (!tablePrimaryKeys[varName]) {
    tablePrimaryKeys[varName] = columnVar;
  }
  if (!tablePrimaryKeys[tableName]) {
    tablePrimaryKeys[tableName] = columnVar;
  }
}

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
let totalChanges = 0;

for (const file of files) {
  let content = fs.readFileSync(file, "utf-8");
  let changes = 0;
  const original = content;

  // Fix 1: onConflictDoUpdate without target
  const onConflictRegex = /\.onConflictDoUpdate\(\{(\s*set:\s*\{)/g;
  let match;
  while ((match = onConflictRegex.exec(content)) !== null) {
    // Find the table name by looking backward for .insert(tableName)
    const beforeMatch = content.substring(Math.max(0, match.index - 300), match.index);
    const insertMatch = beforeMatch.match(/\.insert\((\w+)\)/);
    if (!insertMatch) continue;
    
    const tableVar = insertMatch[1];
    const pkColumn = tablePrimaryKeys[tableVar];
    if (!pkColumn) continue;

    // Check if target already exists
    const afterMatch = content.substring(match.index, match.index + 200);
    if (afterMatch.includes("target:")) continue;

    const replacement = `.onConflictDoUpdate({ target: ${tableVar}.${pkColumn},$1`;
    content = content.substring(0, match.index) + replacement + content.substring(match.index + match[0].length - 1);
    changes++;
    onConflictRegex.lastIndex = match.index + replacement.length;
  }

  // Fix 2: updated[0].rowCount -> updated.rowCount (removing array destructuring)
  // Pattern: const updated = await db.update(...).where(...); return updated[0].rowCount === 1;
  content = content.replace(
    /const\s+(\w+)\s*=\s*await\s+db\.update\([^)]+\)\.set\([^)]+\)\.where\([^)]+\);\s*return\s+\1\[0\]\.rowCount\s*===\s*1;/g,
    (match, varName) => {
      changes++;
      return `const ${varName} = await db.update(${varName === 'updated' ? 'table' : '...'}).set({...}).where(...).returning({ id: table.id });\n    return ${varName}.length === 1;`;
    }
  );

  if (content !== original) {
    fs.writeFileSync(file, content);
    totalFiles++;
    totalChanges += changes;
    console.log(`Fixed ${path.relative(process.cwd(), file)} (${changes} changes)`);
  }
}

console.log(`\nTotal: ${totalFiles} files changed, ${totalChanges} total changes`);
console.log("Sample primary keys:", Object.entries(tablePrimaryKeys).slice(0, 10));
