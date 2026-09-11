import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./AppLauncherView.tsx", import.meta.url), "utf8");

test("从应用中心打开任务时回到任务清单", () => {
  assert.match(source, /if \(id === "taskWorkbench"\) localStorage\.removeItem\("rich\.workbench\.selected"\);/);
});
