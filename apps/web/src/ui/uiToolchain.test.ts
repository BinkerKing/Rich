import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const vite = readFileSync(new URL("../../vite.config.ts", import.meta.url), "utf8");
const tsconfig = readFileSync(new URL("../../tsconfig.json", import.meta.url), "utf8");

test("UI toolchain configures Tailwind and the source alias", () => {
  assert.match(vite, /@tailwindcss\/vite/);
  assert.match(vite, /resolve:/);
  assert.match(tsconfig, /"@\/\*"/);
});
