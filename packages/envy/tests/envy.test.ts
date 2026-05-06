import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { resolveProjectEnv, loadProjectEnv } from "../src/helpers/index.ts";
import { renderEnvTypeContent } from "../src/commands/generate-env-types/helpers.ts";
import { initProject } from "../src/commands/init.ts";
import { defineEnvVarPlugin } from "../src/index.ts";

const tempProjectPaths: string[] = [];
const publicIndexUrl = new URL("../src/index.ts", import.meta.url).href;

async function createTempProject(): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "envy-test-"));
  tempProjectPaths.push(cwd);

  await writeFile(
    path.join(cwd, "env.config.ts"),
    `import { z, type SchemaByAppEnv } from "${publicIndexUrl}";

const requiredString = z.string().min(1);
const optionalString = z.string().optional();

const commonEnvShape = {
  APP_ENV: z.enum(["development", "staging", "production"]),
  PROJECT_NAME: requiredString,
  ENV_EXPANSION_TEST: optionalString,
  ENV_PRIORITY_TEST: optionalString,
};

export const schemaByAppEnv = {
  development: z.object({
    ...commonEnvShape,
    APP_ENV: z.literal("development"),
    DEVELOPMENT_ONLY: optionalString,
  }).strict(),
  staging: z.object({
    ...commonEnvShape,
    APP_ENV: z.literal("staging"),
    STAGING_ONLY: optionalString,
  }).strict(),
  production: z.object({
    ...commonEnvShape,
    APP_ENV: z.literal("production"),
    PRODUCTION_ONLY: optionalString,
  }).strict(),
} satisfies SchemaByAppEnv;
`,
  );
  await writeFile(
    path.join(cwd, ".env.default"),
    [
      "PROJECT_NAME=rightdown",
      "ENV_EXPANSION_TEST=${PROJECT_NAME}-${APP_ENV}",
      "ENV_PRIORITY_TEST=from-default",
      "",
    ].join("\n"),
  );
  await writeFile(path.join(cwd, ".env"), "ENV_PRIORITY_TEST=from-env\n");
  await writeFile(
    path.join(cwd, ".env.staging.defaults"),
    "ENV_PRIORITY_TEST=from-staging-defaults\nSTAGING_ONLY=from-staging-defaults\n",
  );
  await writeFile(path.join(cwd, ".env.staging"), "ENV_PRIORITY_TEST=from-staging\n");

  return cwd;
}

async function createEmptyTempProject(): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "envy-test-"));
  tempProjectPaths.push(cwd);

  return cwd;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(
    tempProjectPaths.splice(0).map((cwd) => rm(cwd, { recursive: true, force: true })),
  );
});

test("resolves, expands, prioritizes, and validates env files without mutating process.env", async () => {
  const cwd = await createTempProject();
  const before = process.env.ENV_PRIORITY_TEST;

  const env = resolveProjectEnv({ cwd, appEnv: "staging" });

  expect(env).toMatchObject({
    APP_ENV: "staging",
    PROJECT_NAME: "rightdown",
    ENV_EXPANSION_TEST: "rightdown-staging",
    ENV_PRIORITY_TEST: "from-staging",
    STAGING_ONLY: "from-staging-defaults",
  });
  expect(process.env.ENV_PRIORITY_TEST).toBe(before);
});

test("loadProjectEnv mutates process.env with the validated values", async () => {
  const cwd = await createTempProject();
  const beforeAppEnv = process.env.APP_ENV;
  const before = process.env.ENV_PRIORITY_TEST;

  try {
    loadProjectEnv({ cwd, appEnv: "staging" });

    expect(process.env.APP_ENV).toBe("staging");
    expect(process.env.ENV_PRIORITY_TEST).toBe("from-staging");
  } finally {
    if (beforeAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = beforeAppEnv;
    }

    if (before === undefined) {
      delete process.env.ENV_PRIORITY_TEST;
    } else {
      process.env.ENV_PRIORITY_TEST = before;
    }
  }
});

test("renderEnvTypeContent uses a stable union of all env keys", async () => {
  const cwd = await createTempProject();
  await writeFile(
    path.join(cwd, ".env.development.defaults"),
    "DEVELOPMENT_ONLY=from-development\n",
  );
  await writeFile(path.join(cwd, ".env.production.defaults"), "PRODUCTION_ONLY=from-production\n");

  const content = renderEnvTypeContent(cwd);

  expect(content).toContain("readonly APP_ENV: 'development' | 'staging' | 'production'");
  expect(content).toContain("readonly PROJECT_NAME: string");
  expect(content).toContain("readonly DEVELOPMENT_ONLY?: string");
  expect(content).toContain("readonly STAGING_ONLY?: string");
  expect(content).toContain("readonly PRODUCTION_ONLY?: string");
});

test("defineEnvVarPlugin injects every resolved env key as process.env.KEY", async () => {
  const cwd = await createTempProject();
  const beforeAppEnv = process.env.APP_ENV;
  const beforeCwd = process.cwd();

  try {
    process.env.APP_ENV = "staging";
    process.chdir(cwd);

    const plugin = defineEnvVarPlugin();
    const config = plugin.config();

    expect(config.define).toMatchObject({
      "process.env.APP_ENV": '"staging"',
      "process.env.PROJECT_NAME": '"rightdown"',
      "process.env.ENV_PRIORITY_TEST": '"from-staging"',
    });
  } finally {
    process.chdir(beforeCwd);
    if (beforeAppEnv === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = beforeAppEnv;
    }
  }
});

test("throws on unknown env vars when the user schema is strict", async () => {
  const cwd = await createTempProject();
  await writeFile(path.join(cwd, ".env.staging"), "UNKNOWN_KEY=value\n");

  expect(() => resolveProjectEnv({ cwd, appEnv: "staging" })).toThrow("UNKNOWN_KEY");
});

test("supports legacy env.schema.ts projects", async () => {
  const cwd = await createTempProject();
  await rm(path.join(cwd, "env.config.ts"));
  await writeFile(
    path.join(cwd, "env.schema.ts"),
    `import { z, type SchemaByAppEnv } from "${publicIndexUrl}";

const optionalString = z.string().optional();

export const schemaByAppEnv = {
  development: z.object({
    APP_ENV: z.literal("development"),
    PROJECT_NAME: z.string().min(1),
    ENV_EXPANSION_TEST: optionalString,
    ENV_PRIORITY_TEST: optionalString,
  }).strict(),
  staging: z.object({
    APP_ENV: z.literal("staging"),
    PROJECT_NAME: z.string().min(1),
    ENV_EXPANSION_TEST: optionalString,
    ENV_PRIORITY_TEST: optionalString,
  }).strict(),
  production: z.object({
    APP_ENV: z.literal("production"),
    PROJECT_NAME: z.string().min(1),
    ENV_EXPANSION_TEST: optionalString,
    ENV_PRIORITY_TEST: optionalString,
  }).strict(),
} satisfies SchemaByAppEnv;
`,
  );

  const env = resolveProjectEnv({ cwd, appEnv: "development" });

  expect(env).toMatchObject({
    APP_ENV: "development",
    PROJECT_NAME: "rightdown",
  });
});

test("init preserves legacy env.schema.ts without creating env.config.ts", async () => {
  const cwd = await createEmptyTempProject();
  await writeFile(path.join(cwd, "package.json"), '{"scripts":{}}\n');
  await writeFile(
    path.join(cwd, "env.schema.ts"),
    `import { z, type SchemaByAppEnv } from "${publicIndexUrl}";

const optionalString = z.string().optional();

export const schemaByAppEnv = {
  development: z.object({
    APP_ENV: z.literal("development"),
    PROJECT_NAME: z.string().min(1),
    APP_CHANNEL_LABEL: optionalString,
    DEVELOPMENT_DEFAULT_ONLY: optionalString,
  }).strict(),
  staging: z.object({
    APP_ENV: z.literal("staging"),
    PROJECT_NAME: z.string().min(1),
    APP_CHANNEL_LABEL: optionalString,
    STAGING_DEFAULT_ONLY: optionalString,
  }).strict(),
  production: z.object({
    APP_ENV: z.literal("production"),
    PROJECT_NAME: z.string().min(1),
    APP_CHANNEL_LABEL: optionalString,
    PRODUCTION_DEFAULT_ONLY: optionalString,
  }).strict(),
} satisfies SchemaByAppEnv;
`,
  );

  const result = initProject({ cwd });

  expect(result.messages).toContain("kept existing env.schema.ts");
  expect(await fileExists(path.join(cwd, "env.schema.ts"))).toBe(true);
  expect(await fileExists(path.join(cwd, "env.config.ts"))).toBe(false);
  expect(await fileExists(path.join(cwd, "env.d.ts"))).toBe(true);
});

test("generated env type content can be written to env.d.ts", async () => {
  const cwd = await createTempProject();
  const { generateEnvTypes } = await import("../src/commands/generate-env-types/index.ts");
  const result = generateEnvTypes({ cwd });
  const written = await readFile(result.outputPath, "utf8");

  expect(written).toBe(result.content);
});
