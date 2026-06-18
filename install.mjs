#!/usr/bin/env node
// install.mjs — copy this suite's skills into a host repo's agent-skills dir.
// For host repos WITHOUT their own skill installer. (OpenELIS-Global-2 instead
// points scripts/install-agent-skills.py at this repo's skills/ — see README.)
//
// Usage: node install.mjs --target <host-repo-root> [--agent claude|cursor]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const skillsRoot = path.join(root, "skills");

function parseArgs(argv) {
  const out = { agent: "claude" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target") out.target = argv[++i];
    else if (argv[i] === "--agent") out.agent = argv[++i];
    else if (argv[i] === "-h" || argv[i] === "--help") out.help = true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.help || !args.target) {
  console.log("Usage: node install.mjs --target <host-repo-root> [--agent claude|cursor]");
  process.exit(args.help ? 0 : 2);
}

const dest = path.join(path.resolve(args.target), `.${args.agent}`, "skills");
fs.mkdirSync(dest, { recursive: true });

let n = 0;
for (const name of fs.readdirSync(skillsRoot).sort()) {
  const src = path.join(skillsRoot, name);
  if (!fs.statSync(src).isDirectory()) continue;
  if (!fs.existsSync(path.join(src, "SKILL.md"))) continue;
  const out = path.join(dest, name);
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(src, out, { recursive: true });
  console.log(`installed ${name}`);
  n++;
}
console.log(`\n${n} skill(s) -> ${dest}`);
