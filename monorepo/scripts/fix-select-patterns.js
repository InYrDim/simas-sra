const fs = require("fs");
const path = require("path");

const LIB_DIR = path.join(process.cwd(), "lib");
const APP_DIR = path.join(process.cwd(), "app");

function findTsFiles(dir) {
  const files = [];
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

  // Fix 1: const [row] = await db.select()... -> const rows = await db.select()...
  // This fixes the QueryResult<never>[0] error
  content = content.replace(
    /const\s+\[(\w+)\]\s*=\s*await\s+db\.select\(\)\.from\(([^)]+)\)/g,
    (match, varName, table) => {
      changes++;
      return `const ${varName}s = await db.select().from(${table})`;
    }
  );
  
  // Also fix: const [rows] = await db.select()...
  content = content.replace(
    /const\s+\[(\w+)\]\s*=\s*await\s+db\.select\(\)\.from\(([^)]+)\)/g,
    (match, varName, table) => {
      changes++;
      return `const ${varName} = await db.select().from(${table})`;
    }
  );

  // Fix 2: updated[0].rowCount -> updated.rowCount
  content = content.replace(
    /(\w+)\[0\]\.rowCount/g,
    "$1.rowCount"
  );

  // Fix 3: result[0].affectedRows -> result.rowCount (already done, but just in case)
  content = content.replace(
    /(\w+)\[0\]\.affectedRows/g,
    "$1.rowCount"
  );

  // Fix 4: rows[0] after select - if we have `const rows = await db.select()...` followed by `const row = rows[0]`
  // This should work fine since rows is now an array

  if (content !== original) {
    fs.writeFileSync(file, content);
    totalFiles++;
    console.log(`Fixed ${path.relative(process.cwd(), file)} (${changes} changes)`);
  }
}

console.log(`\nTotal: ${totalFiles} files changed`);
