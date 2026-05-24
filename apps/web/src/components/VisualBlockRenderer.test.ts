import { test } from "node:test";
import assert from "node:assert/strict";
import { detectBlockType } from "../lib/detectBlockType.js";

test("detect flowchart", () => {
  const ascii = "┌──┐\n│ A│ → ┌──┐\n└──┘   │ B│\n       └──┘";
  assert.equal(detectBlockType(ascii), "flowchart");
});

test("detect tree", () => {
  const ascii = "项目\n├─ A\n│  └─ A1\n└─ B";
  assert.equal(detectBlockType(ascii), "tree");
});

test("detect table", () => {
  const ascii = "Col │ A │ B\n────┼───┼───\nx   │ 1 │ 2\ny   │ 3 │ 4";
  assert.equal(detectBlockType(ascii), "table");
});

test("detect architecture (═ 强调)", () => {
  const ascii = "╔════════════╗\n║  App       ║\n╠══════╤═════╣\n║  ui  │ srv ║\n╚══════╧═════╝";
  assert.equal(detectBlockType(ascii), "architecture");
});

test("detect chart (█ 柱状)", () => {
  const ascii = "周一 ████████ 8\n周二 ███████████ 11\n周三 ██████ 6";
  assert.equal(detectBlockType(ascii), "chart");
});

test("detect concept (基础方框)", () => {
  const ascii = "┌──────────┐\n│  概念 A   │\n└──────────┘";
  assert.equal(detectBlockType(ascii), "concept");
});

test("detect raw（无 box-drawing）", () => {
  const ascii = "hello world\nno box drawing";
  assert.equal(detectBlockType(ascii), "raw");
});
