import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp fmt --write",
    "vite.config.ts": "vp lint --fix",
    "packages/**": () => "vp run -r check",
  },
  fmt: {
    ignorePatterns: ["**/*.md"],
  },
  lint: { options: { typeAware: true, typeCheck: true } },
  run: {
    cache: true,
  },
});
