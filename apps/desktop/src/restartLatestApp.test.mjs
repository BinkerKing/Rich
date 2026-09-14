import assert from "node:assert/strict";
import test from "node:test";
import { findRichProjectRoot } from "./restartLatestApp.ts";

test("uses an explicitly configured Rich source root when it contains the deployment script", () => {
  const result = findRichProjectRoot({
    cwd: "/",
    home: "/Users/example",
    environment: { RICH_APP_PROJECT_ROOT: "/work/Rich" },
    exists: path => path === "/work/Rich/scripts/rich-deploy.mjs",
  });

  assert.equal(result, "/work/Rich");
});

test("falls back to the standard Rich workspace instead of the packaged app working directory", () => {
  const result = findRichProjectRoot({
    cwd: "/Applications/Rich.app",
    home: "/Users/example",
    environment: {},
    exists: path => path === "/Users/example/Documents/Ai-WorkSpace/Rich/scripts/rich-deploy.mjs",
  });

  assert.equal(result, "/Users/example/Documents/Ai-WorkSpace/Rich");
});
