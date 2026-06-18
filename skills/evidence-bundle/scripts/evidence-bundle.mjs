#!/usr/bin/env node
// evidence-bundle — turn a Playwright run into a structured, shareable proof.
//
// Gathers demo screenshots + test videos, converts webm -> mp4 (so they render
// inline on GitHub/Slack), and assembles a bundle: a folder with a README
// skeleton + manifest.json + screenshots/ + videos/, plus a .zip.
//
// Deterministic and project-agnostic: every path comes from a flag or env var,
// nothing is hardcoded. The narrative (filling the README, drafting the PR/Slack
// surfaces) is intentionally NOT done here — that is the LLM's job, driven by the
// manifest this script emits. See SKILL.md.
//
// Usage:
//   evidence-bundle.mjs --results <dir> --evidence <dir> --out <dir> [--title "..."] [--no-zip]
//
// Env fallbacks:
//   EVIDENCE_RESULTS_DIR     (default: ./test-results)   — holds <test>/video.webm
//   EVIDENCE_SCREENSHOTS_DIR (default: ./e2e-evidence)   — holds loose *.png
//   EVIDENCE_OUT_DIR         (default: ./evidence-bundle)
//   EVIDENCE_TITLE           (default: "E2E Evidence Bundle")

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HELP = `evidence-bundle — Playwright run -> structured, shareable proof

  --results <dir>    dir holding <test>/video.webm   (env EVIDENCE_RESULTS_DIR, default ./test-results)
  --evidence <dir>   dir holding loose *.png         (env EVIDENCE_SCREENSHOTS_DIR, default ./e2e-evidence)
  --out <dir>        output bundle dir               (env EVIDENCE_OUT_DIR, default ./evidence-bundle)
  --title "..."      bundle title for the README     (env EVIDENCE_TITLE)
  --no-zip           skip the .zip (folder only)
  --include-setup    keep videos from Playwright setup projects (excluded by default)
  -h, --help

Requires: ffmpeg (webm->mp4). Optional: zip (for the archive).`;

function parseArgs(argv) {
  const out = { zip: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--results") out.results = next();
    else if (a === "--evidence") out.evidence = next();
    else if (a === "--out") out.out = next();
    else if (a === "--title") out.title = next();
    else if (a === "--no-zip") out.zip = false;
    else if (a === "--include-setup") out.includeSetup = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return out;
}

function hasCli(cmd) {
  try {
    execFileSync("sh", ["-c", `command -v ${cmd}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// Recursively collect files matching pred.
function walk(dir, pred, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, pred, acc);
    else if (pred(p)) acc.push(p);
  }
  return acc;
}

function sanitize(s) {
  return (
    s
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "video"
  );
}

// The README is a SKELETON the LLM fills — every blank is a `<!-- FILL: ... -->`
// so a half-filled bundle is obvious, never silently shipped.
function renderReadme(title, shots, vids) {
  const L = [`# ${title} — Evidence Bundle`, ""];
  L.push(
    "<!-- FILL: one paragraph — what the feature is + the headline result. -->",
    "",
    "## Validation summary",
    "",
    "| Check | Result | Why it matters |",
    "|---|---|---|",
    "| <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |",
    "",
  );
  if (vids.length) {
    L.push("## Videos", "");
    for (const v of vids) {
      L.push(`- \`${v.file}\` — <!-- FILL: what this shows (from test: ${v.test}) -->`);
    }
    L.push("");
  }
  if (shots.length) {
    L.push("## Screenshots", "");
    for (const s of shots) {
      L.push(`- \`${s.file}\` — <!-- FILL: caption for ${s.name} -->`);
    }
    L.push("");
  }
  L.push(
    "## Test evidence",
    "",
    "<!-- FILL: committed tests backing this (integration/component/E2E) + pass counts. -->",
    "",
  );
  return L.join("\n") + "\n";
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`ERROR: ${e.message}\n\n${HELP}`);
    process.exit(2);
  }
  if (args.help) {
    console.log(HELP);
    return;
  }

  const resultsDir = path.resolve(
    args.results || process.env.EVIDENCE_RESULTS_DIR || "test-results",
  );
  const evidenceDir = path.resolve(
    args.evidence || process.env.EVIDENCE_SCREENSHOTS_DIR || "e2e-evidence",
  );
  const outDir = path.resolve(
    args.out || process.env.EVIDENCE_OUT_DIR || "evidence-bundle",
  );
  const title = args.title || process.env.EVIDENCE_TITLE || "E2E Evidence Bundle";

  if (!hasCli("ffmpeg")) {
    console.error("ERROR: ffmpeg is required (webm->mp4). Install it and retry.");
    process.exit(1);
  }
  const zipAvailable = hasCli("zip");
  if (args.zip && !zipAvailable) {
    console.warn("WARN: zip CLI not found — producing the folder only (no .zip).");
  }

  const screenshots = fs.existsSync(evidenceDir)
    ? fs
        .readdirSync(evidenceDir)
        .filter((f) => f.toLowerCase().endsWith(".png"))
        .sort()
    : [];
  let videos = walk(resultsDir, (p) => p.endsWith("video.webm")).sort();
  // Playwright setup projects (e.g. auth.setup.ts) record videos too — those are
  // harness plumbing, not demo content, so exclude them unless asked.
  if (!args.includeSetup) {
    videos = videos.filter((p) => !/setup/i.test(path.basename(path.dirname(p))));
  }

  if (!screenshots.length && !videos.length) {
    console.error(
      `ERROR: no evidence found (no *.png in ${evidenceDir}; no video.webm under ${resultsDir}).`,
    );
    process.exit(1);
  }

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, "screenshots"), { recursive: true });
  if (videos.length) fs.mkdirSync(path.join(outDir, "videos"), { recursive: true });

  const shotManifest = [];
  for (const f of screenshots) {
    fs.copyFileSync(path.join(evidenceDir, f), path.join(outDir, "screenshots", f));
    shotManifest.push({ file: `screenshots/${f}`, name: path.basename(f, ".png") });
  }

  const vidManifest = [];
  const usedNames = new Set();
  for (const v of videos) {
    const testDir = path.basename(path.dirname(v));
    let name = sanitize(testDir);
    // Guard against name collisions when two tests sanitize to the same string.
    let candidate = name;
    let n = 2;
    while (usedNames.has(candidate)) candidate = `${name}-${n++}`;
    usedNames.add(candidate);
    const mp4 = `${candidate}.mp4`;
    execFileSync(
      "ffmpeg",
      [
        "-y", "-loglevel", "error",
        "-i", v,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        "-an",
        path.join(outDir, "videos", mp4),
      ],
      { stdio: "inherit" },
    );
    vidManifest.push({
      file: `videos/${mp4}`,
      test: testDir,
      source: path.relative(process.cwd(), v),
    });
  }

  const manifest = {
    title,
    generatedFrom: { results: resultsDir, evidence: evidenceDir },
    screenshots: shotManifest,
    videos: vidManifest,
  };
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(outDir, "README.md"),
    renderReadme(title, shotManifest, vidManifest),
  );

  let zipPath = null;
  if (args.zip && zipAvailable) {
    zipPath = `${outDir}.zip`;
    fs.rmSync(zipPath, { force: true });
    execFileSync("zip", ["-rq", zipPath, "."], { cwd: outDir, stdio: "inherit" });
  }

  console.log(
    `evidence-bundle: ${shotManifest.length} screenshot(s), ${vidManifest.length} video(s)`,
  );
  console.log(`  folder: ${outDir}`);
  if (zipPath) console.log(`  zip:    ${zipPath}`);
  console.log(
    `  next:   fill the <!-- FILL --> blanks in ${path.join(outDir, "README.md")} from manifest.json`,
  );
}

main();
