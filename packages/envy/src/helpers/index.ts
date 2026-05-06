import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import { expand as dotEnvExpand } from "dotenv-expand";
import { require as tsxRequire } from "tsx/cjs/api";
import { INTERNAL_APP_ENV_LIST } from "./metadata.ts";
import type {
  InternalAppEnv,
  LoadedEnvVar,
  ResolveProjectEnvOptions,
  SchemaByAppEnv,
} from "./types.ts";
import { isObject, renderZodError } from "./utils.ts";

const CONFIG_FILE_NAME = "env.config.ts";
const LEGACY_SCHEMA_FILE_NAME = "env.schema.ts";

interface EnvFile {
  path: string;
  parsed: Record<string, string>;
}

interface EnvConfigModule {
  schemaByAppEnv?: unknown;
}

function renderAllowedAppEnvList(): string {
  return INTERNAL_APP_ENV_LIST.map((appEnv) => `'${appEnv}'`).join(", ");
}

function parseAppEnv(appEnv: string | undefined): InternalAppEnv {
  if (INTERNAL_APP_ENV_LIST.includes(appEnv as InternalAppEnv)) {
    return appEnv as InternalAppEnv;
  }

  throw new Error(
    [
      "[envy] APP_ENV is required before loading env vars.",
      `Expected one of: ${renderAllowedAppEnvList()}.`,
      `Received: ${appEnv ?? "<missing>"}.`,
    ].join("\n"),
  );
}

function resolveEnvFilePaths(cwd: string, appEnv: InternalAppEnv): string[] {
  return [".env.default", ".env", `.env.${appEnv}.defaults`, `.env.${appEnv}`].map((fileName) =>
    path.resolve(cwd, fileName),
  );
}

function readEnvFile(filePath: string): EnvFile | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  return {
    path: filePath,
    parsed: parse(readFileSync(filePath, "utf8")),
  };
}

function getStringShellEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

function expandEnv(env: Record<string, string>): Record<string, string> {
  const expanded = dotEnvExpand({
    parsed: env,
    processEnv: {
      ...getStringShellEnv(),
      ...env,
    },
  }).parsed;

  return expanded ?? env;
}

function loadEnvFileCascade(cwd: string, appEnv: InternalAppEnv): Record<string, string> {
  const envFromFiles = resolveEnvFilePaths(cwd, appEnv)
    .map(readEnvFile)
    .filter((envFile): envFile is EnvFile => Boolean(envFile))
    .reduce<Record<string, string>>(
      (mergedEnv, envFile) => ({
        ...mergedEnv,
        ...envFile.parsed,
      }),
      {},
    );

  return expandEnv({
    ...envFromFiles,
    APP_ENV: appEnv,
  });
}

function isZodLikeSchema(value: unknown): boolean {
  return isObject(value) && typeof value.safeParse === "function";
}

function validateSchemaByAppEnv(value: unknown): SchemaByAppEnv {
  if (!isObject(value)) {
    throw new Error("[envy] env.config.ts must export an object named schemaByAppEnv.");
  }

  const missingKeys = INTERNAL_APP_ENV_LIST.filter((appEnv) => !(appEnv in value));
  const unknownKeys = Object.keys(value).filter(
    (key) => !INTERNAL_APP_ENV_LIST.includes(key as never),
  );

  if (missingKeys.length > 0 || unknownKeys.length > 0) {
    throw new Error(
      [
        "[envy] schemaByAppEnv must contain exactly these keys: development, staging, production.",
        missingKeys.length > 0 ? `Missing keys: ${missingKeys.join(", ")}.` : undefined,
        unknownKeys.length > 0 ? `Unknown keys: ${unknownKeys.join(", ")}.` : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  const invalidSchemaKeys = INTERNAL_APP_ENV_LIST.filter(
    (appEnv) => !isZodLikeSchema(value[appEnv]),
  );

  if (invalidSchemaKeys.length > 0) {
    throw new Error(
      `[envy] schemaByAppEnv contains non-Zod schemas for: ${invalidSchemaKeys.join(", ")}.`,
    );
  }

  return value as SchemaByAppEnv;
}

function importUserEnvConfigModule(configPath: string): EnvConfigModule {
  const importedModule = tsxRequire(configPath, import.meta.url) as EnvConfigModule & {
    default?: unknown;
  };

  return (
    isObject(importedModule.default) ? importedModule.default : importedModule
  ) as EnvConfigModule;
}

function renderEnvConfigFileName(configPath: string): string {
  return path.basename(configPath);
}

function resolveUserEnvConfigPath(cwd: string): string {
  const configPath = path.resolve(cwd, CONFIG_FILE_NAME);
  if (existsSync(configPath)) {
    return configPath;
  }

  const legacySchemaPath = path.resolve(cwd, LEGACY_SCHEMA_FILE_NAME);
  if (existsSync(legacySchemaPath)) {
    return legacySchemaPath;
  }

  throw new Error(
    `[envy] Missing ${CONFIG_FILE_NAME} at project root: ${cwd}. ` +
      `${LEGACY_SCHEMA_FILE_NAME} is still supported for existing projects.`,
  );
}

function loadUserEnvSchema(cwd = process.cwd()): SchemaByAppEnv {
  const configPath = resolveUserEnvConfigPath(cwd);

  const envConfigModule = importUserEnvConfigModule(configPath);

  if (!("schemaByAppEnv" in envConfigModule)) {
    throw new Error(`[envy] ${renderEnvConfigFileName(configPath)} must export schemaByAppEnv.`);
  }

  return validateSchemaByAppEnv(envConfigModule.schemaByAppEnv);
}

function assertStringEnvValues(env: Record<string, unknown>): LoadedEnvVar {
  const nonStringKeys = Object.entries(env)
    .filter((entry) => typeof entry[1] !== "string")
    .map(([key]) => key);

  if (nonStringKeys.length > 0) {
    throw new Error(
      [
        "[envy] Env schema output must contain only string values.",
        "Env files are string-based; parse booleans/numbers at usage sites instead of transforming them in env.config.ts.",
        `Non-string keys: ${nonStringKeys.join(", ")}.`,
      ].join("\n"),
    );
  }

  return env as LoadedEnvVar;
}

function validateProjectEnv(env: Record<string, string>, cwd: string): LoadedEnvVar {
  const appEnv = parseAppEnv(env.APP_ENV);
  const schemaByAppEnv = loadUserEnvSchema(cwd);
  const result = schemaByAppEnv[appEnv].safeParse(env);

  if (result.success) {
    return assertStringEnvValues(result.data as Record<string, unknown>);
  }

  throw new Error(
    [
      `[envy] Invalid env vars for APP_ENV='${appEnv}'.`,
      "Update env.config.ts when adding a new env var.",
      renderZodError(result.error),
    ].join("\n"),
  );
}

export function resolveProjectEnv({
  appEnv = process.env.APP_ENV,
  cwd = process.cwd(),
}: ResolveProjectEnvOptions = {}): LoadedEnvVar {
  const resolvedAppEnv = parseAppEnv(appEnv);
  const env = loadEnvFileCascade(cwd, resolvedAppEnv);

  return validateProjectEnv(env, cwd);
}

export function loadProjectEnv(options: ResolveProjectEnvOptions = {}): LoadedEnvVar {
  const env = resolveProjectEnv(options);

  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value;
  }

  return env;
}
