import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp run check",
  },
  pack: {
    entry: ["src/index.ts", "src/load-env-var.ts", "bin/index.ts"],
    dts: {
      tsgo: true,
    },
    format: ["esm", "cjs"],
    publint: true,
    attw: {
      profile: "node16",
      level: "error",
    },
  },
  // Keep lint settings here. package.json still passes an
  // explicit TypeScript file list because `vp lint` does not discover this
  // repo's files reliably yet; once it does, the script can become `vp lint`.
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  fmt: {},
});
