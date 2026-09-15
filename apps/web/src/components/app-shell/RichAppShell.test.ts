import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./RichAppShell.tsx", import.meta.url), "utf8");

test("RichAppShell supports navigation, main content, and an optional right aside", () => {
  assert.match(source, /navigation: ReactNode/);
  assert.match(source, /aside\?: ReactNode/);
  assert.match(source, /rich-app-shell__aside/);
  assert.match(source, /localStorage/);
});
