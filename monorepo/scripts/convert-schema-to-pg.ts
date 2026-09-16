import * as fs from "fs";
import * as path from "path";

const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.ts");
const OUTPUT_PATH = path.join(process.cwd(), "db", "schema.pg.ts");

let content = fs.readFileSync(SCHEMA_PATH, "utf-8");

// Step 1: Replace imports
content = content.replace(
  `from "drizzle-orm/mysql-core"`,
  `from "drizzle-orm/pg-core"`
);

// Step 2: Replace AnyMySqlColumn with AnyPgColumn
content = content.replace(/type AnyMySqlColumn/g, `type AnyPgColumn`);
content = content.replace(/AnyMySqlColumn/g, `AnyPgColumn`);

// Step 3: Replace mysqlTable with pgTable
content = content.replace(/mysqlTable/g, "pgTable");

// Step 4: Extract all mysqlEnum definitions with context
const enumRegex = /mysqlEnum\("([^"]+)",\s*\[([^\]]+)\]\)/g;
const enumMatches: { start: number; end: number; name: string; values: string[] }[] = [];
let enumMatch;

while ((enumMatch = enumRegex.exec(content)) !== null) {
  const enumName = enumMatch[1];
  const valuesStr = enumMatch[2];
  const values = valuesStr.match(/"([^"]+)"/g)?.map(v => v.slice(1, -1)) || [];
  enumMatches.push({
    start: enumMatch.index,
    end: enumMatch.index + enumMatch[0].length,
    name: enumName,
    values
  });
}

// Find table name for each enum by looking backward
const tableRegex = /(?:export\s+const\s+(\w+)\s*=\s*pgTable|mysqlTable)/g;
const tablePositions: { pos: number; name: string }[] = [];
let tableMatch;
while ((tableMatch = tableRegex.exec(content)) !== null) {
  tablePositions.push({ pos: tableMatch.index, name: tableMatch[1] });
}

for (const em of enumMatches) {
  let nearestTable = "unknown";
  let nearestDist = Infinity;
  for (const tp of tablePositions) {
    const dist = em.start - tp.pos;
    if (dist > 0 && dist < nearestDist) {
      nearestDist = dist;
      nearestTable = tp.name;
    }
  }
  em.name = `${nearestTable}_${em.name}`;
}

// Deduplicate enums: group by values, but keep unique names for different values
const enumGroups: Record<string, { name: string; values: string[]; varName: string }> = {};
const enumUsageMap = new Map<string, string>(); // position -> varName

for (const em of enumMatches) {
  const valuesKey = JSON.stringify(em.values);
  
  // Check if this exact values set already has a type
  let typeInfo = enumGroups[valuesKey];
  
  if (!typeInfo) {
    // Create new type
    const varName = em.name
      .split('_')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('') + "Enum";
    typeInfo = {
      name: em.name,
      values: em.values,
      varName
    };
    enumGroups[valuesKey] = typeInfo;
  }
  
  enumUsageMap.set(`${em.start}`, typeInfo.varName);
}

// Generate pgEnum definitions
let enumDefinitions = "// PostgreSQL enum types\n";
for (const e of Object.values(enumGroups)) {
  enumDefinitions += `export const ${e.varName} = pgEnum("${e.name}", [\n`;
  for (const v of e.values) {
    enumDefinitions += `  "${v}",\n`;
  }
  enumDefinitions += `]);\n\n`;
}

// Replace enums in reverse order to maintain string positions
const sortedUsages = Array.from(enumUsageMap.entries())
  .sort((a, b) => Number(b[0]) - Number(a[0])); // reverse sort by position

for (const [posStr, varName] of sortedUsages) {
  const pos = Number(posStr);
  // Find the end of this enum match
  const matchingEm = enumMatches.find(em => em.start === pos);
  if (!matchingEm) continue;
  
  const replacement = `${varName}()`;
  content = content.substring(0, pos) + replacement + content.substring(matchingEm.end);
}

// Step 6: Replace fsp: 3 with precision: 3
content = content.replace(/{ fsp: 3 }/g, "{ precision: 3 }");

// Step 7: Remove mode: "string" from date() columns
content = content.replace(/date\("([^"]+)",\s*\{\s*mode:\s*"string"\s*\}\)/g, 'date("$1")');

// Step 8: Replace json with jsonb
content = content.replace(/\bjson\("([^"]+)"\)/g, 'jsonb("$1")');

// Step 9: Fix REGEXP in CHECK constraints to ~
content = content.replace(/\bREGEXP\b/g, "~");

// Step 10: Fix CHAR_LENGTH to LENGTH
content = content.replace(/\bCHAR_LENGTH\b/g, "LENGTH");

// Step 11: Insert enum definitions after imports
const importBlockEnd = content.indexOf('} from "drizzle-orm/pg-core";');
if (importBlockEnd !== -1) {
  const insertPos = content.indexOf('\n', importBlockEnd) + 1;
  content = content.slice(0, insertPos) + '\n\n' + enumDefinitions + content.slice(insertPos);
}

fs.writeFileSync(OUTPUT_PATH, content);
console.log(`Converted schema written to ${OUTPUT_PATH}`);
console.log(`Found ${Object.keys(enumGroups).length} unique enum types (from ${enumMatches.length} total uses)`);
