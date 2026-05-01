import type { z } from "zod";
import type { INTERNAL_APP_ENV_LIST } from "./metadata.ts";

export type InternalAppEnv = (typeof INTERNAL_APP_ENV_LIST)[number];

export type SchemaByAppEnv = {
  development: z.ZodTypeAny;
  staging: z.ZodTypeAny;
  production: z.ZodTypeAny;
};

export type LoadedEnvVar = Record<string, string> & {
  APP_ENV: InternalAppEnv;
};

export interface ResolveProjectEnvOptions {
  appEnv?: string;
  cwd?: string;
}
