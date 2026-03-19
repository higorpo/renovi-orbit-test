#!/usr/bin/env node
/**
 * Prerelease script: bump version, run integration + unit tests, lint, format, build.
 * Usage: yarn prerelease [major|minor|patch]
 * Default: patch
 */

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pkgPath = path.join(root, "package.json");

const VALID_BUMP = ["major", "minor", "patch"];
const bump = (process.argv[2] || "patch").toLowerCase();
if (!VALID_BUMP.includes(bump)) {
  console.error(
    `Usage: yarn prerelease [major|minor|patch]\nReceived: "${bump}". Use one of: ${VALID_BUMP.join(", ")}.`
  );
  process.exit(1);
}

function run(cmd, description) {
  console.log(`\n▶ ${description}\n`);
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

function bumpVersion() {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
  const [major, minor, patch] = (pkg.version || "0.0.0").split(".").map(Number);
  let next;
  if (bump === "major") next = `${major + 1}.0.0`;
  else if (bump === "minor") next = `${major}.${minor + 1}.0`;
  else next = `${major}.${minor}.${patch + 1}`;
  pkg.version = next;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`\n▶ Bumped version to ${next} (${bump})\n`);
}

try {
  run("yarn test:e2e", "Integration tests (E2E)");
  run("yarn test:run", "Unit tests");
  run("yarn lint", "ESLint");
  run("yarn format", "Prettier format");
  run("yarn build", "Build");
  bumpVersion();
  console.log("\n✅ Prerelease finished successfully.\n");
} catch (err) {
  console.error("\n❌ Prerelease failed.", err.message || err);
  process.exit(1);
}
