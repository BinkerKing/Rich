import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./NodeDetailTableOfContents.tsx", import.meta.url), "utf8");

test("TOC renders every persisted section and an active state", () => {
  assert.match(source, /nodeDetailToc\.map/);
  assert.match(source, /is-active/);
  assert.match(source, /aria-label="本页内容"/);
});
