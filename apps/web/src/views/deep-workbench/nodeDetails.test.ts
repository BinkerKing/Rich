import assert from "node:assert/strict";
import test from "node:test";
import { nodeDetails, updateNodeDetails } from "./nodeDetails.js";

const tree = {
  data: { uid: "root", text: "根节点" },
  children: [{ data: { uid: "customer", text: "客户研究" }, children: [] }],
};

test("stores detail HTML only on the selected node", () => {
  const updated = updateNodeDetails(tree, "customer", "<p><strong>访谈结论</strong></p>");

  assert.equal(nodeDetails(updated.children[0]), "<p><strong>访谈结论</strong></p>");
  assert.equal(nodeDetails(updated), "");
  assert.equal(tree.children[0].data.detailsHtml, undefined);
});

test("keeps the original tree when the node does not exist", () => {
  assert.equal(updateNodeDetails(tree, "missing", "<p>内容</p>"), tree);
});
