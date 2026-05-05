#!/usr/bin/env bun
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const msgPath = process.argv[2];

if (!msgPath) {
  console.error("commit-msg: missing commit message file path");
  process.exit(1);
}

const result = spawnSync(process.execPath, ["x", "commitlint", "--edit", resolve(msgPath)], {
  stdio: "inherit",
});

process.exit(result.status ?? 1);
