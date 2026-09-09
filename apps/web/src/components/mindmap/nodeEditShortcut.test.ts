import assert from "node:assert/strict";
import test from "node:test";
import { isNodeEditShortcut } from "./nodeEditShortcut.js";

test("accepts an unmodified tilde as the node edit shortcut", () => {
  assert.equal(isNodeEditShortcut({ key: "~", code: "Backquote", altKey: false, ctrlKey: false, metaKey: false }), true);
  assert.equal(isNodeEditShortcut({ key: "～", code: "Backquote", altKey: false, ctrlKey: false, metaKey: false }), true);
  assert.equal(isNodeEditShortcut({ key: "`", code: "Backquote", altKey: false, ctrlKey: false, metaKey: false }), true);
});

test("accepts the physical tilde key when an input method reports Process", () => {
  assert.equal(isNodeEditShortcut({ key: "Process", code: "Backquote", altKey: false, ctrlKey: false, metaKey: false }), true);
});

test("ignores tilde when it is combined with another shortcut modifier", () => {
  assert.equal(isNodeEditShortcut({ key: "~", code: "Backquote", altKey: false, ctrlKey: true, metaKey: false }), false);
});
