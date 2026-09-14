import { describe, expect, it } from "vitest";
import { shouldRedeployLatestApp } from "./bugDeploymentPolicy.js";

describe("shouldRedeployLatestApp", () => {
  it.each(["请部署", "重新部署最新 App", "重新发布", "重启"])('treats "%s" as a redeploy request', message => {
    expect(shouldRedeployLatestApp(message)).toBe(true);
  });

  it.each(["修复后提交 Git", "不要部署", "无需重启"])('keeps "%s" as no redeploy', message => {
    expect(shouldRedeployLatestApp(message)).toBe(false);
  });
});
