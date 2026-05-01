import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCAL_ENV_FILE_NAMES } from "../helpers/metadata.ts";
import { generateEnvTypes } from "./generate-env-types/index.ts";

interface InitOptions {
  cwd?: string;
}

export interface InitResult {
  messages: string[];
}

const ENVY_SCRIPTS = {
  "check:env:development": "envy check-env --app-env development",
  "check:env:staging": "envy check-env --app-env staging",
  "check:env:production": "envy check-env --app-env production",
  "generate:env-types": "envy generate-env-types",
} as const;

const TEMPLATE_FILE_NAMES = [
  "env.schema.ts",
  ".env.default",
  ".env",
  ".env.development.defaults",
  ".env.development",
  ".env.staging.defaults",
  ".env.staging",
  ".env.production.defaults",
  ".env.production",
] as const;

const SETUP_DOC_URL =
  "https://github.com/its-tim-lee/developwise/blob/main/packages/envy/docs/setup.md";

function resolvePackageRoot(): string {
  let directory = path.dirname(fileURLToPath(import.meta.url));

  while (true) {
    if (
      existsSync(path.join(directory, "package.json")) &&
      existsSync(path.join(directory, "templates"))
    ) {
      return directory;
    }

    const parentDirectory = path.dirname(directory);

    if (parentDirectory === directory) {
      throw new Error("[envy] Could not locate envy package root.");
    }

    directory = parentDirectory;
  }
}

function writeFileIfMissing(filePath: string, content: string): boolean {
  if (existsSync(filePath)) {
    return false;
  }

  writeFileSync(filePath, content, "utf8");
  return true;
}

function copyTemplateIfMissing(cwd: string, templatesDirectory: string, fileName: string): string {
  const templatePath = path.join(templatesDirectory, fileName);
  const filePath = path.resolve(cwd, fileName);
  const created = writeFileIfMissing(filePath, readFileSync(templatePath, "utf8"));

  return `${created ? "created" : "kept existing"} ${fileName}`;
}

function updatePackageJsonScripts(cwd: string): string {
  const packageJsonPath = path.resolve(cwd, "package.json");

  if (!existsSync(packageJsonPath)) {
    throw new Error(`[envy] Missing package.json at project root: ${cwd}.`);
  }

  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    scripts?: Record<string, string>;
  };

  packageJson.scripts = {
    ...packageJson.scripts,
    ...ENVY_SCRIPTS,
  };

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");

  return "updated package.json scripts";
}

function updateGitignore(cwd: string): string {
  const gitignorePath = path.resolve(cwd, ".gitignore");
  const existingContent = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf8") : "";
  const prefix = existingContent.length > 0 && !existingContent.endsWith("\n") ? "\n" : "";
  const entries = ["# envy", ...LOCAL_ENV_FILE_NAMES].join("\n");

  writeFileSync(gitignorePath, `${existingContent}${prefix}${entries}\n`, "utf8");

  return "updated .gitignore";
}

export function initProject({ cwd = process.cwd() }: InitOptions = {}): InitResult {
  const messages: string[] = [];
  const templatesDirectory = path.join(resolvePackageRoot(), "templates");

  messages.push(updatePackageJsonScripts(cwd));

  for (const fileName of TEMPLATE_FILE_NAMES) {
    messages.push(copyTemplateIfMissing(cwd, templatesDirectory, fileName));
  }

  messages.push(updateGitignore(cwd));

  const { outputPath } = generateEnvTypes({ cwd });
  messages.push(`generated ${path.relative(cwd, outputPath)}`);
  messages.push(`next: review generated files, then read ${SETUP_DOC_URL}`);

  return {
    messages,
  };
}
