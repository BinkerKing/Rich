import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./DeploymentStepsSection.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../ProjectsView.css", import.meta.url), "utf8");

test("无部署步骤时只显示纯文本未配置提示", () => {
  assert.match(source, /if \(!loaded && !error\) return null;/);
  assert.match(source, /if \(!error && items\.length === 0\) return <p className="prj-pm-unconfigured">暂未配置。<\/p>;/);
  assert.match(styles, /\.prj-pm-unconfigured\s*\{[^}]*color:\s*var\(--muted\)/s);
});
