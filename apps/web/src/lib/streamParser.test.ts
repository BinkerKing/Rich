/**
 * 单元测试：StreamParser 状态机。
 * 跑法：node --test --import tsx apps/web/src/lib/streamParser.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { StreamParser } from "./streamParser.js";

interface Captured {
  text: string;
  visual: string;
  blocks: Array<{ hint: string; closed: boolean }>;
}

function makeCapture(): { c: Captured; cb: import("./streamParser.js").StreamParserCallbacks } {
  const c: Captured = { text: "", visual: "", blocks: [] };
  return {
    c,
    cb: {
      onTextChar: (ch) => { c.text += ch; },
      onVisualChar: (ch) => { c.visual += ch; },
      onBlockStart: (hint) => { c.blocks.push({ hint, closed: false }); },
      onBlockEnd: () => {
        const last = c.blocks[c.blocks.length - 1];
        if (last) last.closed = true;
      },
    },
  };
}

test("纯 text，无围栏", () => {
  const { c, cb } = makeCapture();
  const p = new StreamParser(cb);
  p.push("Hello, world!");
  p.flush();
  assert.equal(c.text, "Hello, world!");
  assert.equal(c.visual, "");
  assert.equal(c.blocks.length, 0);
});

test("一个围栏 visual + 前后 text", () => {
  const { c, cb } = makeCapture();
  const p = new StreamParser(cb);
  p.push("前置 text\n```ascii\nA→B\n```\n后置 text");
  p.flush();
  assert.equal(c.text, "前置 text\n\n后置 text");
  assert.equal(c.visual, "A→B\n");
  assert.equal(c.blocks.length, 1);
  assert.equal(c.blocks[0].hint, "ascii");
  assert.equal(c.blocks[0].closed, true);
});

test("跨 chunk 切围栏：``在前 chunk，`在后 chunk", () => {
  const { c, cb } = makeCapture();
  const p = new StreamParser(cb);
  p.push("hello``");
  p.push("`ascii\nX\n```end");
  p.flush();
  assert.equal(c.text, "helloend");
  assert.equal(c.visual, "X\n");
  assert.equal(c.blocks.length, 1);
});

test("围栏无 lang hint（裸 ```）", () => {
  const { c, cb } = makeCapture();
  const p = new StreamParser(cb);
  p.push("```\nfoo\n```");
  p.flush();
  assert.equal(c.visual, "foo\n");
  assert.equal(c.blocks[0].hint, "");
});

test("单个 backtick 不触发围栏", () => {
  const { c, cb } = makeCapture();
  const p = new StreamParser(cb);
  p.push("用 `code` 这种 inline");
  p.flush();
  // 两个孤立的 `code` 单 backtick 包裹 —— 不进围栏，全部 text
  assert.equal(c.text, "用 `code` 这种 inline");
  assert.equal(c.visual, "");
  assert.equal(c.blocks.length, 0);
});

test("两个连续 backtick 也不触发", () => {
  const { c, cb } = makeCapture();
  const p = new StreamParser(cb);
  p.push("空 `` 内联");
  p.flush();
  assert.equal(c.text, "空 `` 内联");
  assert.equal(c.visual, "");
});

test("两个围栏块", () => {
  const { c, cb } = makeCapture();
  const p = new StreamParser(cb);
  p.push("一\n```ascii\nA\n```\n二\n```mermaid\nB\n```\n三");
  p.flush();
  assert.equal(c.visual, "A\nB\n");
  assert.equal(c.blocks.length, 2);
  assert.equal(c.blocks[0].hint, "ascii");
  assert.equal(c.blocks[1].hint, "mermaid");
  assert.equal(c.blocks[0].closed, true);
  assert.equal(c.blocks[1].closed, true);
});

test("未闭合的围栏 flush 时按 visual 收尾", () => {
  const { c, cb } = makeCapture();
  const p = new StreamParser(cb);
  p.push("text\n```ascii\nA→B\n");  // 缺关闭 ```
  p.flush();
  assert.equal(c.visual, "A→B\n");
  assert.equal(c.blocks.length, 1);
  assert.equal(c.blocks[0].closed, true);  // flush 时强制 emit blockEnd
});

test("逐字符喂入跟整段喂入结果一致", () => {
  const input = "前 ```ascii\n│A│ → │B│\n```\n后";
  const r1 = makeCapture(); const p1 = new StreamParser(r1.cb);
  p1.push(input); p1.flush();
  const r2 = makeCapture(); const p2 = new StreamParser(r2.cb);
  for (const ch of input) p2.push(ch);
  p2.flush();
  assert.equal(r1.c.text, r2.c.text);
  assert.equal(r1.c.visual, r2.c.visual);
  assert.deepEqual(r1.c.blocks, r2.c.blocks);
});

test("性能：1 万字符（含 5 个围栏）< 50ms", () => {
  const block = "```ascii\nA→B→C\n```\n";
  const chunk = ("文字段落 ".repeat(100) + block).repeat(5);
  const total = chunk.length;
  const { cb } = makeCapture();
  const p = new StreamParser(cb);
  const t0 = performance.now();
  p.push(chunk);
  p.flush();
  const dt = performance.now() - t0;
  assert.ok(dt < 50, `parse ${total} chars 耗时 ${dt.toFixed(1)}ms，超 50ms`);
});
