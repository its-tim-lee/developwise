import { resolveProjectEnv } from "./helpers/index.ts";

interface EnvyVitePlugin {
  name: string;
  config(): {
    define: Record<string, string>;
  };
}

export function defineEnvVarPlugin(): EnvyVitePlugin {
  return {
    name: "envy:define-env-var",
    config() {
      const env = resolveProjectEnv();
      const define = Object.fromEntries(
        Object.keys(env).map((key) => [`process.env.${key}`, JSON.stringify(env[key])]),
      );

      return {
        define,
      };
    },
  };
}
