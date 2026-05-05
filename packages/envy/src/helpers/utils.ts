import type { z } from "zod";

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function renderZodIssuePath(issue: z.ZodIssue): string {
  return issue.path.length > 0 ? issue.path.join(".") : "<root>";
}

export function renderZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `- ${renderZodIssuePath(issue)}: ${issue.message}`).join("\n");
}

export function itIsJavaScriptIdentifier(value: string): boolean {
  return /^[$A-Z_a-z][$\w]*$/u.test(value);
}
