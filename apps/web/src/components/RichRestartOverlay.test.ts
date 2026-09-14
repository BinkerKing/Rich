import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./RichRestartOverlay.tsx", import.meta.url), "utf8");

describe("RichRestartOverlay", () => {
  it("shows the restart countdown above the whole application and allows Escape to cancel", () => {
    expect(source).toContain('window.addEventListener("rich:restart-latest", beginRestart)');
    expect(source).toContain('position: "fixed"');
    expect(source).toContain('inset: 0');
    expect(source).toContain('zIndex: 100000');
    expect(source).toContain('event.key !== "Escape"');
  });

  it("starts deployment only after the global countdown reaches zero", () => {
    expect(source).toContain('if (countdown === 0)');
    expect(source).toContain("richWindow?.restartLatestApp?.()");
  });
});
