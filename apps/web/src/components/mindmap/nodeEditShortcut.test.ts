import assert from "node:assert/strict";
import test from "node:test";
import { isNodeEditShortcut } from "./nodeEditShortcut.js";

test("accepts an unmodified tilde as the node edit shortcut", () => {
  assert.equal(isNodeEditShortcut({ key: "~", altKey: false, ctrlKey: false, metaKey: false }), true);
});

test("ignores tilde when it is combined with another shortcut modifier", () => {
  assert.equal(isNodeEditShortcut({ key: "~", altKey: false, ctrlKey: true, metaKey: false }), false);
});
