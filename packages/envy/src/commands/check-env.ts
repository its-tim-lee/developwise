import { resolveProjectEnv } from "../helpers/index.ts";

interface CheckEnvOptions {
  appEnv?: string;
  stdout?: (message: string) => void;
}

export function checkEnv({
  appEnv = process.env.APP_ENV,
  stdout = console.log,
}: CheckEnvOptions = {}): void {
  const env = resolveProjectEnv(appEnv === undefined ? {} : { appEnv });

  stdout(`[envy] APP_ENV=${env.APP_ENV}`);
}
