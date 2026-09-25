import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const catalog = readFileSync(new URL("./appCatalog.ts", import.meta.url), "utf8");
const view = readFileSync(new URL("../views/MindmapView.tsx", import.meta.url), "utf8");
const structureMap = readFileSync(new URL("../components/KnowledgeStructureMap.tsx", import.meta.url), "utf8");
const player = readFileSync(new URL("../components/MindmapPlayer.tsx", import.meta.url), "utf8");

test("keeps MindPPT and DeepMindMap as distinct application names", () => {
  assert.match(catalog, /\{ id: "mindmap", label: "MindPPT"/);
  assert.match(catalog, /\{ id: "deepWorkbench", label: "DeepMindMap"/);
  assert.match(view, /MindPPT · 共 \{decks\.length\} 份/);
  assert.match(structureMap, /生成 MindPPT/);
  assert.match(player, />MindPPT<\/p>/);
});
