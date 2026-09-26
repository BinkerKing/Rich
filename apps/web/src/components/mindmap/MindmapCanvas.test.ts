import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("recreates the canvas only when the theme content changes", async () => {
  const source = await readFile(new URL("./MindmapCanvas.tsx", import.meta.url), "utf8");
  assert.match(source, /const themeKey = typeof theme === "string" \? theme : JSON\.stringify\(theme\);/);
  assert.match(source, /\}, \[fitOnResize, layout, themeKey\]\);/);
});
