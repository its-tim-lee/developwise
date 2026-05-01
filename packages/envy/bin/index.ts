#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Command, CommanderError } from "commander";
import { checkEnv } from "../src/commands/check-env.ts";
import { generateEnvTypes } from "../src/commands/generate-env-types/index.ts";
import { initProject } from "../src/commands/init.ts";

interface CliIO {
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
}

interface CheckCommandOptions {
  appEnv?: string;
}

function readPackageVersion(): string {
  let directory = path.dirname(fileURLToPath(import.meta.url));

  while (!existsSync(path.join(directory, "package.json"))) {
    const parentDirectory = path.dirname(directory);

    if (parentDirectory === directory) {
      return "0.0.0";
    }

    directory = parentDirectory;
  }

  const packageJsonPath = path.join(directory, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };

  return packageJson.version ?? "0.0.0";
}

function runCheck(options: CheckCommandOptions, stdout: (message: string) => void): void {
  checkEnv({
    appEnv: options.appEnv,
    stdout,
  });
}

function runGenerateTypes(stdout: (message: string) => void): void {
  const { outputPath } = generateEnvTypes();

  stdout(`[envy] Updated ${path.relative(process.cwd(), outputPath)}`);
}

function runInit(stdout: (message: string) => void): void {
  const result = initProject();

  for (const message of result.messages) {
    stdout(`[envy:init] ${message}`);
  }
}

function createProgram({ stdout = console.log, stderr = console.error }: CliIO = {}): Command {
  const program = new Command();

  program
    .name("envy")
    .description(
      "Vite-based tooling for environment variable cascade loading, schema validation, type generation, and process.env injection.",
    )
    .version(readPackageVersion(), "-v, --version")
    .showHelpAfterError()
    .configureOutput({
      writeOut: (message) => {
        stdout(message.trimEnd());
      },
      writeErr: (message) => {
        stderr(message.trimEnd());
      },
      outputError: (message, write) => {
        write(message);
      },
    })
    .exitOverride();

  program
    .command("init")
    .description("Create missing envy starter files and package scripts.")
    .action(() => {
      runInit(stdout);
    });

  program
    .command("check-env")
    .description("Validate env vars for one APP_ENV.")
    .option("--app-env <appEnv>", "APP_ENV to validate: development, staging, or production")
    .action((options: CheckCommandOptions) => {
      runCheck(options, stdout);
    });

  program
    .command("generate-env-types")
    .description("Validate all APP_ENV values and generate env.d.ts.")
    .action(() => {
      runGenerateTypes(stdout);
    });

  return program;
}

export function runCli(
  args = process.argv.slice(2),
  { stdout = console.log, stderr = console.error }: CliIO = {},
): number {
  const program = createProgram({ stdout, stderr });

  try {
    program.parse(args, { from: "user" });
    return 0;
  } catch (error) {
    if (error instanceof CommanderError) {
      return error.exitCode;
    }

    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const currentFilePath = realpathSync(fileURLToPath(import.meta.url));
const invokedFilePath = process.argv[1] ? realpathSync(path.resolve(process.argv[1])) : undefined;

if (invokedFilePath === currentFilePath) {
  process.exitCode = runCli();
}
