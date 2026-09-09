import assert from "node:assert/strict";
import test from "node:test";
import { clampNodeDetailPanelWidth, loadNodeDetailPanelWidth } from "./nodeDetailPanel.js";

test("clamps the node detail panel width to its usable range", () => {
  assert.equal(clampNodeDetailPanelWidth(280), 320);
  assert.equal(clampNodeDetailPanelWidth(486), 486);
  assert.equal(clampNodeDetailPanelWidth(900), 720);
});

test("loads a saved width and falls back for invalid values", () => {
  assert.equal(loadNodeDetailPanelWidth("540"), 540);
  assert.equal(loadNodeDetailPanelWidth("not-a-number"), 440);
});
