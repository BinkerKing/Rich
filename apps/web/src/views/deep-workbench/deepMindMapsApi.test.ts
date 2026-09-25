import assert from "node:assert/strict";
import test from "node:test";
import { mergeLegacyMaps } from "./deepMindMapsApi.js";

test("imports legacy maps only when their IDs are absent from Postgres", () => {
  const server = [{ id: "same", title: "server", map: {}, createdAt: "1", updatedAt: "2" }];
  const legacy = [{ id: "same", title: "local", map: {}, createdAt: "1", updatedAt: "3" }, { id: "legacy", title: "legacy", map: {}, createdAt: "1", updatedAt: "1" }];

  assert.deepEqual(mergeLegacyMaps(server, legacy).map(item => item.id), ["legacy"]);
});
