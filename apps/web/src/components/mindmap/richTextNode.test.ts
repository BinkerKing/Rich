import assert from "node:assert/strict";
import test from "node:test";
import { titleFromNodeHtml, titleNoteNodeHtml } from "./richTextNode.js";

test("creates a title-and-note card as safely escaped rich text HTML", () => {
  assert.equal(
    titleNoteNodeHtml("引擎 <诊断>", "问题1\n问题2"),
    '<p><strong>引擎 &lt;诊断&gt;</strong></p><p>问题1<br>问题2</p>',
  );
});

test("uses the first rich-text paragraph as the knowledge-tree title", () => {
  assert.equal(titleFromNodeHtml('<p><strong>引擎诊断</strong></p><p>问题1<br>问题2</p>'), "引擎诊断");
  assert.equal(titleFromNodeHtml("普通标题"), "普通标题");
});
