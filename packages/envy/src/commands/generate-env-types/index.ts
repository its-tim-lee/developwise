import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { renderEnvTypeContent } from "./helpers.ts";

interface GenerateEnvTypesOptions {
  cwd?: string;
  outputPath?: string;
}

interface GenerateEnvTypesResult {
  outputPath: string;
  content: string;
}

export function generateEnvTypes({
  cwd = process.cwd(),
  outputPath = path.resolve(cwd, "env.d.ts"),
}: GenerateEnvTypesOptions = {}): GenerateEnvTypesResult {
  const content = renderEnvTypeContent(cwd);

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, content, "utf8");

  return {
    outputPath,
    content,
  };
}
