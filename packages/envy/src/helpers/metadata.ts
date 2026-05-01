export const INTERNAL_APP_ENV_LIST = ["development", "staging", "production"] as const;

export const LOCAL_ENV_FILE_NAMES = [
  ".env",
  ".env.development",
  ".env.staging",
  ".env.production",
] as const;
