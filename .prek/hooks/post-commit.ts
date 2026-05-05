#!/usr/bin/env bun
import { spawnSync } from "node:child_process";

const diff = spawnSync("git", ["diff", "HEAD~1", "HEAD", "--name-only"], {
  encoding: "utf8",
});

if (diff.status !== 0) {
  process.exit(0);
}

const changedFiles = diff.stdout
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const needsReleaseMetadata = changedFiles.some((file) => {
  if (file === "metadata/version-and-release.ts") return true;
  if (file === "release-please-config.json") return false;
  if (file === ".release-please-manifest.json") return false;
  if (file === ".github/workflows/pr-lint.yml") return false;
  if (file === "package.json") return true;
  return file.startsWith("packages/") && file.endsWith("/package.json");
});

if (!needsReleaseMetadata) {
  process.exit(0);
}

const result = spawnSync(process.execPath, ["scripts/generate-release-please-configs.ts"], {
  stdio: "inherit",
});

if ((result.status ?? 1) !== 0) {
  process.exit(result.status ?? 1);
}

console.log(
  [
    "post-commit: release metadata regenerated.",
    "Review and commit any changed files separately, usually as:",
    "  chore(system): update release metadata",
  ].join("\n"),
);
