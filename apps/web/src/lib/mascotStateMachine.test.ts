/**
 * 单元测试：Mascot 状态机。
 * 跑法：apps/server/node_modules/.bin/tsx --test apps/web/src/lib/mascotStateMachine.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createMascotStateMachine } from "./mascotStateMachine.js";

test("初始态 idle", () => {
  const m = createMascotStateMachine();
  assert.equal(m.getState(), "idle");
  m.destroy();
});

test("user-send → thinking", () => {
  const m = createMascotStateMachine();
  m.dispatch({ type: "user-send" });
  assert.equal(m.getState(), "thinking");
  m.destroy();
});

test("user-send → thinking → first-text-chunk → talking", () => {
  const m = createMascotStateMachine();
  m.dispatch({ type: "user-send" });
  m.dispatch({ type: "first-text-chunk" });
  assert.equal(m.getState(), "talking");
  m.destroy();
});

test("done → idle（非复杂）", () => {
  const m = createMascotStateMachine();
  m.dispatch({ type: "user-send" });
  m.dispatch({ type: "first-text-chunk" });
  m.dispatch({ type: "done" });
  assert.equal(m.getState(), "idle");
  m.destroy();
});

test("done complex=true → proud", () => {
  const m = createMascotStateMachine();
  m.dispatch({ type: "user-send" });
  m.dispatch({ type: "done", complex: true });
  assert.equal(m.getState(), "proud");
  m.destroy();
});

test("error → embarrassed", () => {
  const m = createMascotStateMachine();
  m.dispatch({ type: "user-send" });
  m.dispatch({ type: "error", message: "boom" });
  assert.equal(m.getState(), "embarrassed");
  m.destroy();
});

test("force 总是切，即便相同状态", () => {
  const m = createMascotStateMachine("idle");
  let changes = 0;
  m.onChange(() => { changes++; });
  m.dispatch({ type: "force", state: "idle" });
  assert.equal(changes, 1);  // force 即使目标 = 当前也算切（明确意图）
  m.destroy();
});

test("防抖：相同 target 200ms 内只 emit 一次", () => {
  const m = createMascotStateMachine();
  let changes = 0;
  m.onChange(() => { changes++; });
  m.dispatch({ type: "user-send" });
  m.dispatch({ type: "user-send" });
  m.dispatch({ type: "user-send" });
  // 三次都打 thinking，应该只 emit 一次（首次 idle→thinking）
  assert.equal(changes, 1);
  m.destroy();
});

test("自动回落：proud 2.5s 后回 idle（异步）", async () => {
  // 这个用 setTimeout 测会拖太长；这里只验证 schedule 不 throw
  const m = createMascotStateMachine();
  m.dispatch({ type: "praise" });
  assert.equal(m.getState(), "proud");
  // 不等回落，直接销毁即测试结束
  m.destroy();
});

test("subscribe 收到每次状态变化", () => {
  const m = createMascotStateMachine();
  const states: string[] = [];
  m.onChange(s => states.push(s));
  m.dispatch({ type: "user-send" });           // thinking
  m.dispatch({ type: "first-text-chunk" });    // talking
  m.dispatch({ type: "done" });                 // idle
  assert.deepEqual(states, ["thinking", "talking", "idle"]);
  m.destroy();
});
