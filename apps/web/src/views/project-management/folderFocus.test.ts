import { describe, expect, it } from "vitest";
import { shouldScrollFocusedFolderIntoView } from "./folderFocus.js";

describe("shouldScrollFocusedFolderIntoView", () => {
  it("does not scroll a row merely because it was selected by a click", () => {
    expect(shouldScrollFocusedFolderIntoView("release/20260829", "release/20260829", null)).toBe(false);
  });

  it("scrolls when an explicit navigation target matches the row", () => {
    expect(shouldScrollFocusedFolderIntoView("release/20260829", "release/20260829", "release/20260829")).toBe(true);
  });
});
