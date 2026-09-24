import * as fs from "fs";
import * as path from "path";

const OUTPUT_PATH = path.join(process.cwd(), "db", "schema.pg.ts");
let content = fs.readFileSync(OUTPUT_PATH, "utf-8");

// Remove mysqlEnum from imports
content = content.replace(/,\s*mysqlEnum\n/, "\n");

// Fix multi-line fsp: 3 -> precision: 3
content = content.replace(
  /timestamp\("([^"]+)",\s*\{\s*fsp:\s*3,\s*\}\)/g,
  'timestamp("$1", { precision: 3 })'
);

// Fix dynamic mysqlEnum usage: mysqlEnum("status", whatsappBotRequestStatus)
content = content.replace(
  /mysqlEnum\("([^"]+)",\s*(\w+)\)/g,
  (match, enumName, varName) => {
    const pascalName = enumName.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('') + "Enum";
    // Check if we already have this enum defined
    if (content.includes(`export const ${pascalName} = pgEnum`)) {
      return `${pascalName}()`;
    }
    // Otherwise, we need to add it after the varName definition
    // Actually, we should find the const and add pgEnum after it
    return match; // Will handle manually
  }
);

fs.writeFileSync(OUTPUT_PATH, content);
console.log("Fixed schema written");
