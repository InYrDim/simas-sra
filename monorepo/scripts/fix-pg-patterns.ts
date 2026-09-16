import * as fs from "fs";
import * as path from "path";

const LIB_DIR = path.join(process.cwd(), "lib");
const APP_DIR = path.join(process.cwd(), "app");

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

function extractBraceContent(text: string, startIndex: number): { content: string; endIndex: number } | null {
  let depth = 0;
  let i = startIndex;
  while (i < text.length) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    if (depth === 0) {
      return { content: text.substring(startIndex, i), endIndex: i };
    }
    i++;
  }
  return null;
}

const files = [...findTsFiles(LIB_DIR), ...findTsFiles(APP_DIR)];

let totalFiles = 0;

for (const file of files) {
  let content = fs.readFileSync(file, "utf-8");
  let changes = 0;
  
  // Fix onDuplicateKeyUpdate with nested braces
  const onDupRegex = /\.onDuplicateKeyUpdate\(\{/g;
  let match;
  while ((match = onDupRegex.exec(content)) !== null) {
    const startIdx = match.index + match[0].length - 1; // Position of opening {
    const result = extractBraceContent(content, startIdx);
    if (result) {
      const innerContent = result.content;
      // MySQL: .onDuplicateKeyUpdate({ set: { ... } })
      // PostgreSQL: .onConflictDoUpdate({ set: { ... } })
      // But we need to add target. Let's check if set is directly inside
      const replacement = `.onConflictDoUpdate({${innerContent}})`;
      content = content.substring(0, match.index) + replacement + content.substring(result.endIndex + 1);
      changes++;
      // Reset regex index since content changed
      onDupRegex.lastIndex = match.index + replacement.length;
    }
  }

  // Fix affectedRows -> rowCount
  const affectedMatches = content.match(/\.affectedRows/g);
  if (affectedMatches) {
    content = content.replace(/\.affectedRows/g, ".rowCount");
    changes += affectedMatches.length;
  }

  // Fix result[0].affectedRows -> result.rowCount
  // The [0] indexing will be handled by TypeScript if we just change affectedRows to rowCount
  // But we also need to handle cases where result is destructured as [rows]
  
  if (changes > 0) {
    fs.writeFileSync(file, content);
    totalFiles++;
    console.log(`Fixed ${path.relative(process.cwd(), file)} (${changes} changes)`);
  }
}

console.log(`\nTotal: ${totalFiles} files changed`);
