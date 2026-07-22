#!/usr/bin/env node
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const outFile = path.join(os.tmpdir(), 'dbpush-result.txt');

exec('npx drizzle-kit push 2>&1', { 
  cwd: path.join(__dirname, 'monorepo'),
  encoding: 'utf-8', 
  timeout: 120000,
  maxBuffer: 10 * 1024 * 1024
}, (err, stdout, stderr) => {
  let result = '';
  if (stdout) result += 'STDOUT:\n' + stdout + '\n';
  if (stderr) result += 'STDERR:\n' + stderr + '\n';
  if (err) result += 'ERROR: ' + err.message + '\n';
  result += 'EXIT: ' + (err ? err.code : 0) + '\n';
  fs.writeFileSync(outFile, result);
  process.exit(0);
});
