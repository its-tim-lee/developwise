#!/usr/bin/env bun
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONVENTIONAL_COMMIT, PACKAGE_PATH_TO_SCOPE } from "../metadata/version-and-release.ts";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const check = process.argv.includes("--check");

type PackageJson = {
  version?: string;
};

type ReleasePackageConfig = {
  component: string;
  "release-type": "node";
  "exclude-paths"?: string[];
};

function packageJsonPath(packagePath: string): string {
  return packagePath === "." ? "package.json" : join(packagePath, "package.json");
}

function readVersion(packagePath: string): string {
  const path = join(ROOT, packageJsonPath(packagePath));
  const packageJson = JSON.parse(readFileSync(path, "utf8")) as PackageJson;

  if (typeof packageJson.version !== "string") {
    throw new Error(`${packageJsonPath(packagePath)} is missing a string "version"`);
  }

  return packageJson.version;
}

function sortPackagePaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    if (a === ".") return -1;
    if (b === ".") return 1;
    return a.localeCompare(b);
  });
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2).replace(/\[\n( +)"([^"]+)"\n +\]/g, '["$2"]')}\n`;
}

function workflowReleasePlease(): string {
  return `name: Release Please

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write
  id-token: write # Required for npm Trusted Publishing / OIDC.

jobs:
  release-please:
    runs-on: ubuntu-latest
    steps:
      - name: Create or update GitHub releases
        id: release
        uses: googleapis/release-please-action@v5
        with:
          config-file: release-please-config.json
          manifest-file: .release-please-manifest.json

      - name: Checkout release commit
        if: \${{ steps.release.outputs['packages/envy--release_created'] == 'true' }}
        uses: actions/checkout@v5

      - name: Setup Vite+ and Node.js
        if: \${{ steps.release.outputs['packages/envy--release_created'] == 'true' }}
        uses: voidzero-dev/setup-vp@v1
        with:
          node-version: "24"
          cache: true

      # Trusted Publishing requires npm 11.5.1+ and a supported Node.js runtime.
      # Keep npm current so publish authentication does not fail due to an old bundled npm.
      - name: Update npm CLI
        if: \${{ steps.release.outputs['packages/envy--release_created'] == 'true' }}
        run: npm install -g npm@latest

      # Do not set NODE_AUTH_TOKEN here. npm authenticates through the Trusted Publisher
      # connection configured on npmjs.com for @developwise/envy.
      - name: Install dependencies
        if: \${{ steps.release.outputs['packages/envy--release_created'] == 'true' }}
        run: vp install --frozen-lockfile

      # Trusted Publishing generates npm provenance automatically; --provenance is unnecessary.
      - name: Publish @developwise/envy to npm
        if: \${{ steps.release.outputs['packages/envy--release_created'] == 'true' }}
        working-directory: packages/envy
        run: npm publish --access public
`;
}

function workflowPrLint(): string {
  const block = (items: readonly string[]) => items.map((item) => `            ${item}`).join("\n");

  return `name: PR title lint

on:
  pull_request:
    types: [opened, edited, synchronize, reopened]
    branches:
      - main

jobs:
  lint:
    name: Validate PR title
    runs-on: ubuntu-latest
    permissions:
      pull-requests: read
    steps:
      - uses: amannn/action-semantic-pull-request@v6
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        with:
          types: |
${block(CONVENTIONAL_COMMIT.TYPES)}
          scopes: |
${block(CONVENTIONAL_COMMIT.SCOPES)}
`;
}

function workflowPublishReady(): string {
  return `name: Publish readiness

on:
  pull_request:
    branches:
      - main

jobs:
  envy:
    name: "@developwise/envy publish dry run"
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5

      - name: Setup Vite+ and Node.js
        uses: voidzero-dev/setup-vp@v1
        with:
          node-version: "24"
          cache: true

      - name: Update npm CLI
        run: npm install -g npm@latest

      - name: Install dependencies
        run: vp install --frozen-lockfile

      - name: Run readiness checks
        run: vp run ready

      - name: Reset Envy build output before publish dry run
        run: rm -rf packages/envy/dist

      - name: Dry-run @developwise/envy npm publish
        working-directory: packages/envy
        run: npm publish --dry-run --access public
`;
}

function workflowReleaseMetadataCheck(): string {
  return `name: Release metadata check

on:
  pull_request:
    branches:
      - main

jobs:
  check:
    name: Verify generated release metadata
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: voidzero-dev/setup-vp@v1
        with:
          node-version: "24"
          cache: true
      - run: vp install --frozen-lockfile
      - run: vp run check:release-please
`;
}

const packagePaths = sortPackagePaths(Object.keys(PACKAGE_PATH_TO_SCOPE));
const childPackagePaths = packagePaths.filter((path) => path !== ".");

const releaseConfig = {
  "release-type": "simple",
  "separate-pull-requests": false,
  packages: Object.fromEntries(
    packagePaths.map((path) => {
      const entry: ReleasePackageConfig = {
        component: PACKAGE_PATH_TO_SCOPE[path]!,
        "release-type": "node",
      };

      if (path === "." && childPackagePaths.length > 0) {
        entry["exclude-paths"] = childPackagePaths;
      }

      return [path, entry];
    }),
  ),
};

const manifest = Object.fromEntries(packagePaths.map((path) => [path, readVersion(path)]));

const files = new Map<string, string>([
  ["release-please-config.json", json(releaseConfig)],
  [".release-please-manifest.json", json(manifest)],
  [".github/workflows/publish-ready.yml", workflowPublishReady()],
  [".github/workflows/release-please.yml", workflowReleasePlease()],
  [".github/workflows/pr-lint.yml", workflowPrLint()],
  [".github/workflows/release-metadata-check.yml", workflowReleaseMetadataCheck()],
]);

const staleFiles: string[] = [];

for (const [relativePath, content] of files) {
  const path = join(ROOT, relativePath);
  const current = existsSync(path) ? readFileSync(path, "utf8") : "";

  if (current === content) continue;

  if (check) {
    staleFiles.push(relativePath);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

if (staleFiles.length > 0) {
  console.error("Release metadata is stale. Regenerate these files:");
  for (const file of staleFiles) console.error(`  ${file}`);
  process.exit(1);
}

if (check) {
  console.log("Release metadata is up to date.");
} else {
  console.log("Wrote release-please and release metadata workflow files.");
}
