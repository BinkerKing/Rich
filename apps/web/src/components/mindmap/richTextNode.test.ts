import assert from "node:assert/strict";
import test from "node:test";
import { decorateTitleNoteHtml, hasNodeNote, nextNodeIcon, nodeIconHtml, normalizeTitleNoteTree, richTextNodeLayoutCss, titleFromNodeHtml, titleNoteNodeHtml, titleOnlyNodeHtml } from "./richTextNode.js";

test("creates a title-and-note card as safely escaped rich text HTML", () => {
  assert.equal(
    titleNoteNodeHtml("引擎 <诊断>", "问题1\n问题2"),
    '<p class="mindmap-node-title"><strong>引擎 &lt;诊断&gt;</strong></p><div class="mindmap-node-note"><p>问题1<br>问题2</p></div>',
  );
});

test("restores the title and note classes after rich-text editing", () => {
  assert.equal(
    decorateTitleNoteHtml('<p><strong>引擎诊断</strong></p><p><em>待检查</em></p>'),
    '<p class="mindmap-node-title"><strong>引擎诊断</strong></p><div class="mindmap-node-note"><p><em>待检查</em></p></div>',
  );
});

test("migrates existing title-note cards to one grouped note module", () => {
  const tree = { data: { nodeCardStyle: "title-note", text: "<p>标题</p><p>第一条</p><p>第二条</p>" }, children: [] };
  const normalized = normalizeTitleNoteTree(tree);
  assert.equal(
    (normalized.data as Record<string, unknown>).text,
    '<p class="mindmap-node-title">标题</p><div class="mindmap-node-note"><p>第一条</p><p>第二条</p></div>',
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
  assert.match(richTextNodeLayoutCss, /\.mindmap-node-note/);
  assert.match(richTextNodeLayoutCss, /border:/);
  assert.match(richTextNodeLayoutCss, /\.smm-richtext-node-edit-wrap/);
  assert.match(richTextNodeLayoutCss, /\.smm-node\.active \.smm-hover-node/);
  assert.match(richTextNodeLayoutCss, /stroke-width:\s*4px/);
  assert.match(richTextNodeLayoutCss, /drop-shadow/);
});

test("keeps the title and note visually separate while Quill is editing", () => {
  assert.match(richTextNodeLayoutCss, /\.ql-editor > p:first-child/);
  assert.match(richTextNodeLayoutCss, /\.ql-editor > p:not\(:first-child\)/);
  assert.match(richTextNodeLayoutCss, /background:\s*rgba\(15, 23, 42/);
});

test("groups multiple editing note paragraphs into one continuous card", () => {
  assert.match(richTextNodeLayoutCss, /\.ql-editor > p:nth-child\(2\):not\(:last-child\)/);
  assert.match(richTextNodeLayoutCss, /\.ql-editor > p:nth-child\(n \+ 3\):not\(:last-child\)/);
  assert.match(richTextNodeLayoutCss, /\.ql-editor > p:not\(:first-child\):last-child/);
});

test("leaves a generous gap before notes in display and edit modes", () => {
  const noteGaps = Array.from(richTextNodeLayoutCss.matchAll(/margin-top:\s*(\d+)px/g), match => Number(match[1]));
  assert.ok(noteGaps.filter(gap => gap >= 12).length >= 2);
});

test("keeps the configured node color on titles with notes", () => {
  assert.match(
    richTextNodeLayoutCss,
    /\.smm-richtext-node-wrap \.mindmap-node-title,[\s\S]*?color:\s*inherit/,
  );
  assert.match(
    richTextNodeLayoutCss,
    /\.ql-editor > p:first-child[\s\S]*?color:\s*inherit/,
  );
});

test("adds an icon before the title without changing the knowledge-tree title", () => {
  const text = nodeIconHtml('<p><strong>引擎诊断</strong></p>', "⚙️");
  assert.equal(text, '<p><span class="mindmap-node-icon" contenteditable="false">⚙️</span><strong>引擎诊断</strong></p>');
  assert.equal(titleFromNodeHtml(text), "引擎诊断");
});

test("removes the node icon while retaining the title content", () => {
  const withIcon = '<p><span class="mindmap-node-icon" contenteditable="false">⚙️</span><strong>引擎诊断</strong></p>';
  assert.equal(nodeIconHtml(withIcon, undefined), '<p><strong>引擎诊断</strong></p>');
});

test("replaces an icon after rich text has reordered its attributes", () => {
  const editedText = '<p><span contenteditable="false" class="mindmap-node-icon">⚙️</span>引擎诊断</p>';
  assert.equal(
    nodeIconHtml(editedText, "📌"),
    '<p><span class="mindmap-node-icon" contenteditable="false">📌</span>引擎诊断</p>',
  );
});

test("clicking the selected node icon removes it", () => {
  assert.equal(nextNodeIcon("⚙️", "⚙️"), undefined);
  assert.equal(nextNodeIcon("⚙️", "📌"), "📌");
});

test("restores the saved node icon when a mind map is opened", () => {
  const tree = { data: { nodeIcon: "⚙️", text: "<p>引擎诊断</p>" }, children: [] };
  assert.equal(
    (normalizeTitleNoteTree(tree).data as Record<string, unknown>).text,
    '<p><span class="mindmap-node-icon" contenteditable="false">⚙️</span>引擎诊断</p>',
  );
});
