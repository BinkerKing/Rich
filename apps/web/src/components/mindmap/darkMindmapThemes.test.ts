import assert from "node:assert/strict";
import { test } from "node:test";
import { DARK_MINDMAP_THEMES, DEFAULT_DARK_MINDMAP_THEME_ID } from "./darkMindmapThemes.ts";

test("provides six square, colored-border dark mind map themes", () => {
  assert.equal(DARK_MINDMAP_THEMES.length, 6);
  assert.equal(DARK_MINDMAP_THEMES[0].id, DEFAULT_DARK_MINDMAP_THEME_ID);

  for (const theme of DARK_MINDMAP_THEMES) {
    const config = theme.config as {
      backgroundColor: string;
      lineColor: string;
      root: { shape: string; borderRadius: number; borderColor: string };
      second: { shape: string; borderRadius: number; borderColor: string };
      node: { shape: string; borderRadius: number; borderColor: string };
    };

    assert.match(config.backgroundColor, /^#0/i);
    assert.match(config.lineColor, /^#/);
    for (const node of [config.root, config.second, config.node]) {
      assert.equal(node.shape, "rectangle");
      assert.equal(node.borderRadius, 4);
      assert.match(node.borderColor, /^#/);
    }
  }
});
