import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./DeploymentStepsSection.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../ProjectsView.css", import.meta.url), "utf8");

test("无部署步骤时使用紧凑空态布局", () => {
  assert.match(source, /deployment-workspace prj-pm-legacy-skin\$\{items\.length === 0 \? " is-empty" : ""\}/);
  assert.match(styles, /\.deployment-workspace\.is-empty\s*\{[^}]*align-content:\s*start/s);
  assert.doesNotMatch(styles, /\.deployment-workspace\.is-empty\s*\{[^}]*flex:/s);
});
