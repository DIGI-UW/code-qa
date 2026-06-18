#!/usr/bin/env node
// validate-skills.mjs — lint each skills/<name>/SKILL.md frontmatter.
// Checks: SKILL.md exists, has YAML frontmatter with `name` (matching the dir)
// and a non-empty `description`. Exit 1 on any error.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const skillsRoot = path.join(repoRoot, "skills");
let errors = 0;

if (!fs.existsSync(skillsRoot)) {
  console.error("✗ no skills/ directory");
  process.exit(1);
}

for (const name of fs.readdirSync(skillsRoot).sort()) {
  const dir = path.join(skillsRoot, name);
  if (!fs.statSync(dir).isDirectory()) continue;

  const md = path.join(dir, "SKILL.md");
  if (!fs.existsSync(md)) {
    console.error(`✗ ${name}: missing SKILL.md`);
    errors++;
    continue;
  }
  const text = fs.readFileSync(md, "utf8");
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) {
    console.error(`✗ ${name}: missing YAML frontmatter`);
    errors++;
    continue;
  }
  const nameLine = fm[1].match(/^name:\s*(.+)$/m);
  const hasDesc = /^description:\s*\S|^description:\s*[>|]/m.test(fm[1]);
  let ok = true;
  if (!nameLine) {
    console.error(`✗ ${name}: frontmatter missing 'name'`);
    errors++;
    ok = false;
  } else if (nameLine[1].trim() !== name) {
    console.error(`✗ ${name}: frontmatter name '${nameLine[1].trim()}' != dir '${name}'`);
    errors++;
    ok = false;
  }
  if (!hasDesc) {
    console.error(`✗ ${name}: frontmatter missing 'description'`);
    errors++;
    ok = false;
  }
  if (ok) console.log(`✓ ${name}`);
}

console.log(errors ? `\n${errors} error(s)` : `\nall skills valid`);
process.exit(errors ? 1 : 0);
