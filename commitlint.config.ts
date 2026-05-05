import { CONVENTIONAL_COMMIT } from "./metadata/version-and-release.ts";

export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [2, "always", [...CONVENTIONAL_COMMIT.TYPES]],
    "scope-enum": [2, "always", [...CONVENTIONAL_COMMIT.SCOPES]],
  },
};
