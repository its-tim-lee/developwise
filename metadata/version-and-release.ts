import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { globbySync } from "globby";

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

type PackageJson = {
  name?: string;
  version?: string;
  workspaces?: {
    packages?: string[];
  };
};

function readPackageJson(path: string): PackageJson {
  return JSON.parse(readFileSync(path, "utf8")) as PackageJson;
}

function normalizePath(path: string): string {
  return path.split(sep).join("/");
}

function componentFromPackageName(packagePath: string, packageName?: string): string {
  if (packagePath === ".") return "system";
  if (!packageName) return packagePath.split("/").at(-1)!;

  return packageName.startsWith("@") ? packageName.split("/").at(-1)! : packageName;
}

function discoverWorkspacePackagePaths(): string[] {
  const rootPackageJson = readPackageJson(join(ROOT, "package.json"));
  const workspaceGlobs = rootPackageJson.workspaces?.packages ?? [];
  const packageJsonGlobs = workspaceGlobs.map((pattern) => `${pattern}/package.json`);
  const packageJsonFiles = globbySync(packageJsonGlobs, {
    cwd: ROOT,
    gitignore: true,
    onlyFiles: true,
  });

  return packageJsonFiles
    .map((file) => normalizePath(relative(ROOT, dirname(join(ROOT, file)))))
    .sort();
}

function discoverPackages(): Record<string, string> {
  const entries: Record<string, string> = {
    ".": "system",
  };

  for (const packagePath of discoverWorkspacePackagePaths()) {
    const packageJsonPath = join(ROOT, packagePath, "package.json");
    if (!existsSync(packageJsonPath)) continue;

    const packageJson = readPackageJson(packageJsonPath);
    entries[packagePath] = componentFromPackageName(packagePath, packageJson.name);
  }

  return entries;
}

export const PACKAGE_PATH_TO_SCOPE = discoverPackages();

export const CONVENTIONAL_COMMIT = {
  SCOPES: Object.values(PACKAGE_PATH_TO_SCOPE),
  TYPES: [
    "feat",
    "fix",
    "docs",
    "chore",
    "refactor",
    "test",
    "ci",
    "build",
    "perf",
    "style",
    "revert",
  ],
} as const;
