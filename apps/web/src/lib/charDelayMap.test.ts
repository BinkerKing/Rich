/**
 * 单元测试：charDelayMap + streamCharScheduler。
 * 跑法：apps/server/node_modules/.bin/tsx --test apps/web/src/lib/charDelayMap.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { delayFor } from "./charDelayMap.js";

test("default preset 普通字符 60-90ms", () => {
  // 多次采样取均值，验证落在范围
  let sum = 0;
  const N = 1000;
  for (let i = 0; i < N; i++) sum += delayFor("a", "default");
  const avg = sum / N;
  assert.ok(avg >= 60 && avg <= 90, `期望 60-90，实测均值 ${avg.toFixed(1)}`);
});

test("default 句号 200-300ms", () => {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < 200; i++) {
    const d = delayFor("。", "default");
    min = Math.min(min, d); max = Math.max(max, d);
  }
  assert.ok(min >= 200, `句号最小 ${min} < 200`);
  assert.ok(max <= 300, `句号最大 ${max} > 300`);
});

test("default 逗号 80-120ms", () => {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < 200; i++) {
    const d = delayFor("，", "default");
    min = Math.min(min, d); max = Math.max(max, d);
  }
  assert.ok(min >= 80, `逗号最小 ${min} < 80`);
  assert.ok(max <= 120, `逗号最大 ${max} > 120`);
});

test("default 换行恒 400ms", () => {
  assert.equal(delayFor("\n", "default"), 400);
});

test("keywordStart 加 100ms", () => {
  const without = delayFor("a", "default", { isKeywordStart: false });
  const withKw = delayFor("a", "default", { isKeywordStart: true });
  // 同一次调用结果有抖动，但 with vs without 差至少 60ms（boost - max抖动）
  assert.ok(withKw - without >= 50, `keyword start 增量应 >= 50ms，实测 ${withKw - without}`);
});

test("fast preset 比 default 快", () => {
  let fastSum = 0, defaultSum = 0;
  for (let i = 0; i < 500; i++) {
    fastSum += delayFor("a", "fast");
    defaultSum += delayFor("a", "default");
  }
  assert.ok(fastSum < defaultSum, "fast 总延迟应 < default");
});

test("slow preset 句号比 default 长（按均值）", () => {
  let slowSum = 0, defSum = 0;
  for (let i = 0; i < 500; i++) {
    slowSum += delayFor("。", "slow");
    defSum += delayFor("。", "default");
  }
  assert.ok(slowSum > defSum * 1.2, `slow 均值 (${(slowSum/500).toFixed(0)}) 应明显 > default (${(defSum/500).toFixed(0)})`);
});

test("ceremonial preset 视觉块前最慢", () => {
  let cer = 0, def = 0;
  for (let i = 0; i < 500; i++) {
    cer += delayFor("a", "ceremonial");
    def += delayFor("a", "default");
  }
  assert.ok(cer > def * 1.5, "ceremonial 应明显比 default 慢");
});
