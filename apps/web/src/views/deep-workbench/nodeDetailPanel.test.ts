import assert from "node:assert/strict";
import test from "node:test";
import { clampNodeDetailPanelWidth, loadNodeDetailPanelWidth, nodeDetailPanelMaxWidth } from "./nodeDetailPanel.js";

test("clamps the node detail panel width to its usable range", () => {
  assert.equal(clampNodeDetailPanelWidth(280), 320);
  assert.equal(clampNodeDetailPanelWidth(486), 486);
  assert.equal(clampNodeDetailPanelWidth(900, 800), 800);
});

test("loads a saved width and falls back for invalid values", () => {
  assert.equal(loadNodeDetailPanelWidth("540", 800), 540);
  assert.equal(loadNodeDetailPanelWidth("not-a-number"), 440);
});

test("limits the resizable panel to two thirds of the available canvas", () => {
  assert.equal(nodeDetailPanelMaxWidth(1200), 800);
  assert.equal(nodeDetailPanelMaxWidth(600), 400);
});
