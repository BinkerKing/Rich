import assert from "node:assert/strict";
import test from "node:test";
import { workbenchTitleFromRootText } from "./workbenchTitle.js";

test("uses only the plain root title for a knowledge workbench", () => {
  assert.equal(
    workbenchTitleFromRootText('<p class="mindmap-node-title"><strong>Claude Code 应用</strong></p><div class="mindmap-node-note"><p>待整理</p></div>'),
    "Claude Code 应用",
  );
});
