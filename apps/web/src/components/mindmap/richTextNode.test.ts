import assert from "node:assert/strict";
import test from "node:test";
import { hasNodeNote, richTextNodeLayoutCss, titleFromNodeHtml, titleNoteNodeHtml, titleOnlyNodeHtml } from "./richTextNode.js";

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

test("recognizes a note only when the content after the title is not empty", () => {
  const emptyNote = '<p><strong>引擎诊断</strong></p><p><br></p>';
  assert.equal(hasNodeNote(emptyNote), false);
  assert.equal(titleOnlyNodeHtml(emptyNote), '<p><strong>引擎诊断</strong></p>');
  assert.equal(hasNodeNote('<p><strong>引擎诊断</strong></p><p>待检查</p>'), true);
});

test("resets paragraph margins inside SVG rich-text nodes so their content is not clipped", () => {
  assert.match(richTextNodeLayoutCss, /\.smm-richtext-node-wrap p/);
  assert.match(richTextNodeLayoutCss, /margin:\s*0/);
});
