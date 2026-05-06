/**
 * This file will be handled by Envy.
 * It must be:
 * - at the file root
 * - export exactly `schemaByAppEnv`
 * - use Zod
 * - export APP_ENV in every environment
 *
 * Currently, the supported environments are "development", "staging", and "production".
 * If you don't use "staging", you may opt it out.
 */
import { z, type SchemaByAppEnv } from "@developwise/envy";

const requiredString = z.string().min(1);
const optionalString = z.string().optional();

const commonEnvShape = {
  PROJECT_NAME: requiredString,
  APP_CHANNEL_LABEL: optionalString,
};

export const schemaByAppEnv = {
  development: z
    .object({
      ...commonEnvShape,
      APP_ENV: z.literal("development"),
      DEVELOPMENT_DEFAULT_ONLY: optionalString,
      DEVELOPMENT_LOCAL_ONLY: optionalString,
    })
    .strict(),

  staging: z
    .object({
      ...commonEnvShape,
      APP_ENV: z.literal("staging"),
      STAGING_DEFAULT_ONLY: optionalString,
      STAGING_LOCAL_ONLY: optionalString,
    })
    .strict(),

  production: z
    .object({
      ...commonEnvShape,
      APP_ENV: z.literal("production"),
      PRODUCTION_DEFAULT_ONLY: optionalString,
      PRODUCTION_LOCAL_ONLY: optionalString,
    })
    .strict(),
} satisfies SchemaByAppEnv;
